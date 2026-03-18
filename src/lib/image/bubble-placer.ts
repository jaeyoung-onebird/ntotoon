import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import type { DialogueData } from '@/types/scene';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface BubblePlacement {
  speaker: string;
  text: string;
  type: string;
  x: number; // 0-1 비율
  y: number; // 0-1 비율
  tailDirection: 'down' | 'up' | 'left' | 'right' | 'none';
}

/**
 * Claude Vision으로 이미지를 분석하여 말풍선 최적 위치를 결정
 * - 캐릭터 얼굴 위치 파악
 * - 빈 공간 탐색
 * - 각 대사를 해당 캐릭터 근처 빈 공간에 배치
 */
export async function calculateBubblePlacements(
  imageBuffer: Buffer,
  dialogues: DialogueData[]
): Promise<BubblePlacement[]> {
  if (dialogues.length === 0) return [];

  // 이미지를 작게 리사이즈해서 API 비용 절약
  const resized = await sharp(imageBuffer)
    .resize(512, null, { fit: 'inside' })
    .jpeg({ quality: 60 })
    .toBuffer();

  const dialogueList = dialogues.map((d, i) =>
    `${i + 1}. [${d.type}] ${d.speaker}: "${d.text}"`
  ).join('\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: resized.toString('base64') },
          },
          {
            type: 'text',
            text: `You are a webtoon speech bubble placement expert. Analyze this webtoon panel image and determine the optimal position for each speech bubble.

Dialogues to place:
${dialogueList}

Rules:
- Place speech bubbles near the speaking character's head, in empty space
- Don't cover character faces or important visual elements
- speech type: place near character with tail pointing to them
- thought type: place near character with cloud dots
- narration type: place at top or bottom edge of the panel
- sfx type: place near the action/sound source
- x,y are 0-1 ratios (0,0 = top-left, 1,1 = bottom-right)
- tailDirection: which direction the bubble tail should point

Respond ONLY in JSON array:
\`\`\`json
[
  {"index": 0, "x": 0.3, "y": 0.15, "tailDirection": "down"},
  {"index": 1, "x": 0.7, "y": 0.1, "tailDirection": "down"}
]
\`\`\``,
          },
        ],
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return fallbackPlacements(dialogues);

    const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content.text;
    const placements = JSON.parse(jsonStr) as Array<{ index: number; x: number; y: number; tailDirection: string }>;

    // 인덱스 범위 검증 + 대사 수와 배치 수 맞추기
    const validPlacements = placements.filter(
      (p) => typeof p.index === 'number' && p.index >= 0 && p.index < dialogues.length
    );

    // Claude가 반환한 배치가 부족하면 fallback으로 보충
    if (validPlacements.length < dialogues.length) {
      const covered = new Set(validPlacements.map(p => p.index));
      const fb = fallbackPlacements(dialogues);
      for (let i = 0; i < dialogues.length; i++) {
        if (!covered.has(i)) {
          validPlacements.push({ index: i, x: fb[i].x, y: fb[i].y, tailDirection: fb[i].tailDirection });
        }
      }
    }

    return validPlacements.map((p) => {
      const d = dialogues[p.index];
      return {
        speaker: d.speaker,
        text: d.text,
        type: d.type,
        x: Math.max(0.05, Math.min(0.95, p.x || 0.5)),
        y: Math.max(0.05, Math.min(0.95, p.y || 0.1)),
        tailDirection: (p.tailDirection || 'down') as BubblePlacement['tailDirection'],
      };
    });
  } catch (error) {
    console.warn('[BubblePlacer] Claude analysis failed, using fallback:', error);
    return fallbackPlacements(dialogues);
  }
}

// Claude 실패 시 기본 배치
function fallbackPlacements(dialogues: DialogueData[]): BubblePlacement[] {
  return dialogues.map((d, i) => ({
    speaker: d.speaker,
    text: d.text,
    type: d.type,
    x: i % 2 === 0 ? 0.25 : 0.75,
    y: d.type === 'narration' ? 0.08 : 0.12 + i * 0.12,
    tailDirection: 'down' as const,
  }));
}
