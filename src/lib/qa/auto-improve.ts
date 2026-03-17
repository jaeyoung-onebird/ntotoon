import Anthropic from '@anthropic-ai/sdk';
import { evaluateWebtoon, QAScore } from './evaluator';
import { generatePanel } from '@/lib/ai/image-generator';
import { addSpeechBubbles } from '@/lib/image/speech-bubbles';
import { uploadToS3, downloadFromS3 } from '@/lib/s3';
import { prisma } from '@/lib/db';
import path from 'path';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TARGET_SCORE = 7;
const MAX_ITERATIONS = 3; // 최대 3번 반복

export interface QAResult {
  iteration: number;
  score: QAScore;
  improved: boolean;
  regeneratedPanels: number[];
}

// 메인 QA 루프: 평가 → 문제 패널 재생성 → 재평가 반복
export async function runQALoop(
  projectId: string,
  onProgress?: (msg: string) => void
): Promise<QAResult[]> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      characters: true,
      episodes: {
        include: {
          panels: {
            include: { dialogues: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  });

  const episode = project.episodes[0];
  if (!episode) throw new Error('No episode found');

  const results: QAResult[] = [];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    onProgress?.(`QA 평가 ${iter + 1}회차 진행 중...`);

    // 1. 평가
    const score = await evaluateWebtoon(projectId, episode.id);
    onProgress?.(`평가 완료: ${score.overall}/10 | 캐릭터 ${score.characterConsistency} | 스타일 ${score.artStyle} | 텍스트없음 ${score.noTextInImages} | 말풍선 ${score.speechBubbles} | 흐름 ${score.storyFlow} | 배경 ${score.backgroundQuality}`);

    if (score.overall >= TARGET_SCORE) {
      results.push({ iteration: iter + 1, score, improved: false, regeneratedPanels: [] });
      onProgress?.(`${score.overall}점 달성! QA 통과`);
      break;
    }

    // 2. 문제 분석 → 어떤 패널을 재생성할지 Claude에게 물어봄
    const panelsToRegenerate = await identifyBadPanels(score, episode.panels.length);
    onProgress?.(`재생성 대상 패널: ${panelsToRegenerate.map(p => p.index + 1).join(', ')}`);

    // 3. 문제 패널 재생성 (개선된 프롬프트로)
    const characterRefBuffers: Buffer[] = [];
    for (const char of project.characters) {
      if (char.referenceSheet) {
        try {
          const key = char.referenceSheet.startsWith('/uploads/')
            ? char.referenceSheet.slice('/uploads/'.length)
            : char.referenceSheet.replace(/^\//, '');
          const buffer = await downloadFromS3(key);
          characterRefBuffers.push(buffer);
        } catch { /* skip */ }
      }
    }

    const regenerated: number[] = [];
    for (const { index, improvedPrompt } of panelsToRegenerate) {
      const panel = episode.panels[index];
      if (!panel) continue;

      onProgress?.(`패널 ${index + 1} 재생성 중 (개선된 프롬프트)...`);

      try {
        // 개선된 프롬프트로 재생성
        const fullPrompt = improvedPrompt || panel.imagePrompt || '';
        const imageBuffer = await generatePanel(fullPrompt, true, characterRefBuffers.length > 0 ? characterRefBuffers : undefined);

        // 말풍선 추가
        const dialogues = panel.dialogues.map(d => ({
          speaker: d.speaker,
          text: d.text,
          type: d.type.toLowerCase() as 'speech' | 'thought' | 'narration' | 'sfx',
          positionX: d.positionX ?? undefined,
          positionY: d.positionY ?? undefined,
        }));

        const finalBuffer = await addSpeechBubbles(imageBuffer, dialogues);

        // 저장
        const rawKey = `projects/${projectId}/episodes/${episode.id}/panels/${index}_raw.png`;
        const finalKey = `projects/${projectId}/episodes/${episode.id}/panels/${index}_final.png`;
        await uploadToS3(imageBuffer, rawKey);
        const finalUrl = await uploadToS3(finalBuffer, finalKey);

        await prisma.panel.update({
          where: { id: panel.id },
          data: {
            rawImageUrl: `/${rawKey}`,
            finalImageUrl: finalUrl,
            imagePrompt: fullPrompt,
          },
        });

        regenerated.push(index);
      } catch (error) {
        onProgress?.(`패널 ${index + 1} 재생성 실패: ${error}`);
      }
    }

    results.push({ iteration: iter + 1, score, improved: regenerated.length > 0, regeneratedPanels: regenerated });

    if (regenerated.length === 0) {
      onProgress?.('재생성할 패널이 없어 루프 종료');
      break;
    }
  }

  // 최종 평가
  if (results.length > 0 && results[results.length - 1].score.overall < TARGET_SCORE) {
    const finalScore = await evaluateWebtoon(projectId, episode.id);
    onProgress?.(`최종 점수: ${finalScore.overall}/10`);
    results.push({ iteration: results.length + 1, score: finalScore, improved: false, regeneratedPanels: [] });
  }

  return results;
}

// Claude에게 어떤 패널이 문제인지, 어떻게 개선할지 물어봄
async function identifyBadPanels(
  score: QAScore,
  totalPanels: number
): Promise<Array<{ index: number; improvedPrompt: string }>> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `A webtoon was generated with ${totalPanels} panels and got these scores:
- Character Consistency: ${score.characterConsistency}/10
- Art Style: ${score.artStyle}/10
- No Text in Images: ${score.noTextInImages}/10
- Speech Bubbles: ${score.speechBubbles}/10
- Story Flow: ${score.storyFlow}/10
- Background Quality: ${score.backgroundQuality}/10

Issues found:
${score.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Suggestions:
${score.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Based on these issues, which panels (0-indexed) should be regenerated? For each, provide an improved prompt addition.

Respond ONLY in JSON:
\`\`\`json
[
  {"index": 2, "promptAddition": "Ensure character has exact same short black messy hair and black t-shirt as reference. Male character in his late 20s."},
  {"index": 5, "promptAddition": "Remove all text and signs from the background. Clean illustration only."}
]
\`\`\`

Maximum 4 panels. Only include panels with real issues. If the main issue is consistency, pick the panels where characters look most different from the reference.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') return [];

  try {
    const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content.text;
    const parsed = JSON.parse(jsonStr) as Array<{ index: number; promptAddition: string }>;

    return parsed
      .filter(p => p.index >= 0 && p.index < totalPanels)
      .map(p => ({
        index: p.index,
        improvedPrompt: p.promptAddition,
      }));
  } catch {
    return [];
  }
}
