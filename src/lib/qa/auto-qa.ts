import Anthropic from '@anthropic-ai/sdk';
import { evaluateWebtoon, QAScore } from './evaluator';
import { generatePanel } from '@/lib/ai/image-generator';
import { addSpeechBubbles } from '@/lib/image/speech-bubbles';
import { uploadToS3, downloadFromS3 } from '@/lib/s3';
import { prisma } from '@/lib/db';
import path from 'path';
import { captureException } from '@/lib/error-reporter';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
import { config } from '@/lib/config';

const PASS_SCORE = config.qa.passScore;
const MAX_RETRIES = config.qa.maxRetries;

/**
 * 파이프라인 완료 후 자동 실행되는 QA
 * 1. 평가
 * 2. 점수 낮으면 문제 패널 재생성 (최대 2회)
 * 3. 학습한 규칙을 DB에 저장 → 다음 생성에 자동 적용
 */
export async function runAutoQA(
  projectId: string,
  episodeId: string,
  onProgress?: (msg: string) => void
): Promise<QAScore | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    onProgress?.(`QA 평가 ${attempt + 1}회차...`);

    let score: QAScore;
    try {
      score = await evaluateWebtoon(projectId, episodeId);
    } catch (error) {
      captureException(error, { tags: { projectId, episodeId, source: 'auto-qa' } });
      onProgress?.(`QA 평가 실패: ${error}`);
      return null;
    }

    // DB에 QA 결과 저장
    await prisma.qaResult.create({
      data: {
        projectId,
        episodeId,
        overall: score.overall,
        characterConsistency: score.characterConsistency,
        artStyle: score.artStyle,
        noTextInImages: score.noTextInImages,
        speechBubbles: score.speechBubbles,
        storyFlow: score.storyFlow,
        backgroundQuality: score.backgroundQuality,
        issues: score.issues,
        suggestions: score.suggestions,
      },
    });

    onProgress?.(`QA 점수: ${score.overall}/10 (캐릭터 ${score.characterConsistency}, 스타일 ${score.artStyle}, 텍스트없음 ${score.noTextInImages})`);

    // 통과
    if (score.overall >= PASS_SCORE) {
      onProgress?.(`QA 통과! ${score.overall}점`);
      // 성공한 패턴에서 규칙 학습 + 고득점 이미지 수집
      await learnFromSuccess(score, projectId, episodeId);
      return score;
    }

    // 실패 → 규칙 학습 + 재생성
    onProgress?.(`QA 미통과 (${score.overall}점). 개선 중...`);
    await learnFromFailure(score);

    if (attempt < MAX_RETRIES) {
      await regenerateBadPanels(projectId, episodeId, score, onProgress);
    }
  }

  return null;
}

/**
 * QA 실패에서 프롬프트 규칙 학습
 */
async function learnFromFailure(score: QAScore) {
  try {
  // Claude에게 구체적인 프롬프트 규칙 생성 요청
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `A webtoon QA evaluation found these issues:
${score.issues.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Scores: character_consistency=${score.characterConsistency}, art_style=${score.artStyle}, no_text=${score.noTextInImages}, backgrounds=${score.backgroundQuality}

Generate concise prompt rules that would fix these issues. Each rule should be a single sentence that can be appended to an image generation prompt.

Respond ONLY in JSON:
\`\`\`json
[
  {"category": "character", "rule": "Maintain exact same hairstyle length and color across all panels"},
  {"category": "text_removal", "rule": "All signs, labels, and text in the scene must be blank or illegible"}
]
\`\`\`

Categories: character, background, text_removal, style, composition
Maximum 4 rules. Only include rules for scores below 8.`,
    }],
  });

  const content = response.content[0];
  if (content.type !== 'text') return;

  try {
    const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content.text;
    const rules = JSON.parse(jsonStr) as Array<{ category: string; rule: string }>;

    for (const { category, rule } of rules) {
      // 중복 체크
      const existing = await prisma.promptImprovement.findFirst({
        where: { rule: { contains: rule.substring(0, 50) } },
      });

      if (!existing) {
        await prisma.promptImprovement.create({
          data: {
            category,
            rule,
            score: 0,
            active: true,
            source: `QA failure: ${score.issues[0]?.substring(0, 100) || 'unknown'}`,
          },
        });
      }
    }
  } catch { /* ignore parse errors */ }
  } catch (err) {
    console.warn('[QA] learnFromFailure failed:', (err as Error).message);
  }
}

/**
 * QA 성공에서 기존 규칙 점수 올리기 + 고득점 이미지 수집
 */
async function learnFromSuccess(score: QAScore, projectId?: string, episodeId?: string) {
  // 규칙 점수 올리기
  if (score.overall >= 9) {
    await prisma.promptImprovement.updateMany({
      where: { active: true },
      data: { score: { increment: 1 } },
    });
  }

  // 고득점 이미지 수집 (golden threshold 이상)
  if (score.overall >= config.qa.goldenThreshold && episodeId) {
    await collectGoldenImages(projectId || '', episodeId, score);
  }
}

/**
 * 고득점 패널을 golden_images에 저장 (LoRA 학습 데이터셋)
 */
async function collectGoldenImages(projectId: string, episodeId: string, score: QAScore) {
  const panels = await prisma.panel.findMany({
    where: { episodeId },
    orderBy: { orderIndex: 'asc' },
  });

  for (const panel of panels) {
    if (!panel.finalImageUrl) continue;

    // 이미 수집된 이미지는 건너뛰기
    const existing = await prisma.goldenImage.findFirst({
      where: { panelId: panel.id },
    });
    if (existing) continue;

    // 카테고리 분류
    const isWide = panel.cameraAngle === 'wide-shot' || panel.cameraAngle === 'bird-eye';
    const category = isWide ? 'background' : 'panel';

    // 태그 생성
    const tags = [
      panel.cameraAngle,
      panel.mood,
      panel.setting?.split(',')[0]?.trim(),
    ].filter((t): t is string => !!t);

    await prisma.goldenImage.create({
      data: {
        panelId: panel.id,
        projectId,
        imageUrl: panel.finalImageUrl,
        prompt: panel.imagePrompt || '',
        qaScore: score.overall,
        styleScore: score.artStyle,
        category,
        tags,
      },
    });
  }

  const count = await prisma.goldenImage.count();
  console.log(`[QA] Golden images 수집 완료: 이 에피소드 ${panels.length}장 추가 (총 ${count}장 보유)`);
}

/**
 * 문제 패널 재생성
 */
async function regenerateBadPanels(
  projectId: string,
  episodeId: string,
  score: QAScore,
  onProgress?: (msg: string) => void
) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      panels: {
        include: { dialogues: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!episode) return;

  // 캐릭터 레퍼런스 준비 (디스크에서 읽어서 Buffer로 전달)
  const characters = await prisma.character.findMany({ where: { projectId } });
  const refBuffers: Buffer[] = [];
  for (const char of characters) {
    if (char.referenceSheet) {
      try {
        const key = char.referenceSheet.startsWith('/uploads/')
          ? char.referenceSheet.slice('/uploads/'.length)
          : char.referenceSheet.replace(/^\//, '');
        const buffer = await downloadFromS3(key);
        refBuffers.push(buffer);
      } catch { /* skip */ }
    }
  }

  // 학습된 규칙 가져오기
  const improvements = await getActiveImprovements();
  const extraPrompt = improvements.map(r => r.rule).join('. ');

  // 캐릭터 일관성이 낮으면 캐릭터 있는 패널 중 절반을 재생성
  const panelsToRedo = selectPanelsToRegenerate(episode.panels, score);

  for (const panel of panelsToRedo) {
    onProgress?.(`패널 ${panel.orderIndex + 1} 재생성 중...`);

    try {
      const enhancedPrompt = panel.imagePrompt
        ? `${panel.imagePrompt}. ${extraPrompt}`
        : extraPrompt;

      const imageBuffer = await generatePanel(enhancedPrompt, true, refBuffers.length > 0 ? refBuffers : undefined);

      const dialogues = (panel.dialogues as Array<{ speaker: string; text: string; type: string; positionX?: number | null; positionY?: number | null }>).map((d) => ({
        speaker: d.speaker,
        text: d.text,
        type: d.type.toLowerCase() as 'speech' | 'thought' | 'narration' | 'sfx',
        positionX: d.positionX ?? undefined,
        positionY: d.positionY ?? undefined,
      }));

      const finalBuffer = await addSpeechBubbles(imageBuffer, dialogues);

      const rawKey = `projects/${projectId}/episodes/${episodeId}/panels/${panel.orderIndex}_raw.jpg`;
      const finalKey = `projects/${projectId}/episodes/${episodeId}/panels/${panel.orderIndex}_final.jpg`;
      await uploadToS3(imageBuffer, rawKey);
      const finalUrl = await uploadToS3(finalBuffer, finalKey);

      await prisma.panel.update({
        where: { id: panel.id },
        data: { rawImageUrl: `/${rawKey}`, finalImageUrl: finalUrl },
      });
    } catch (error) {
      onProgress?.(`패널 ${panel.orderIndex + 1} 재생성 실패`);
    }
  }
}

function selectPanelsToRegenerate(
  panels: Array<{ id: string; orderIndex: number; imagePrompt: string | null; dialogues: unknown[] }>,
  score: QAScore
): typeof panels {
  // 점수 기반으로 재생성할 패널 선택 (최대 3개)
  const candidates = [...panels];

  if (score.characterConsistency < 7) {
    // 캐릭터 패널 중 중간~후반부 (초반은 보통 괜찮음)
    const mid = Math.floor(candidates.length / 2);
    return candidates.slice(mid, mid + 3);
  }

  if (score.noTextInImages < 7) {
    // 배경이 복잡한 패널 (보통 후반부)
    return candidates.slice(-3);
  }

  // 기본: 중간 3개
  const start = Math.floor(candidates.length / 3);
  return candidates.slice(start, start + 3);
}

/**
 * DB에서 학습된 프롬프트 규칙 가져오기
 * prompt-builder에서 호출하여 모든 생성에 자동 적용
 */
export async function getActiveImprovements(): Promise<Array<{ category: string; rule: string }>> {
  const improvements = await prisma.promptImprovement.findMany({
    where: { active: true },
    orderBy: { score: 'desc' },
    take: 10, // 상위 10개만
  });

  return improvements.map(i => ({ category: i.category, rule: i.rule }));
}
