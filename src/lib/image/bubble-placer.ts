import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import type { DialogueData } from '@/types/scene';

const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

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
    const promptText = `You are a webtoon speech bubble placement expert. Analyze this image and find the best position for each speech bubble.

Dialogues to place:
${dialogueList}

STRICT RULES:
1. NEVER cover any character's face, head, or upper body. This is the #1 rule.
2. First, identify where all character faces are in the image. Then place bubbles AWAY from those areas.
3. Prefer these safe zones (in priority order):
   - Top corners of the panel (y: 0.03-0.12)
   - Empty sky/ceiling/wall areas above characters
   - Sides of the panel where no characters exist
   - Bottom corners (only for narration)
4. speech type: place ABOVE and to the side of the speaker's head, never overlapping the face. Use tailDirection to point toward the speaker.
5. thought type: place above character with "up" tail direction
6. narration type: place at very top (y: 0.03-0.08) or very bottom (y: 0.90-0.97) edge
7. sfx type: place near the action source, away from faces
8. x,y are 0-1 ratios (0,0 = top-left, 1,1 = bottom-right)
9. Keep bubbles in upper 40% of the image (y < 0.4) whenever possible
10. If two characters are talking, place their bubbles on opposite sides (left vs right)

Respond ONLY in JSON array:
\`\`\`json
[
  {"index": 0, "x": 0.25, "y": 0.06, "tailDirection": "down"},
  {"index": 1, "x": 0.75, "y": 0.06, "tailDirection": "down"}
]
\`\`\``;

    const response = await gemini.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        { inlineData: { mimeType: 'image/jpeg', data: resized.toString('base64') } },
        { text: promptText },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallbackPlacements(dialogues);

    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
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

// Claude 실패 시 기본 배치 (상단에 배치하여 얼굴 안 가림)
function fallbackPlacements(dialogues: DialogueData[]): BubblePlacement[] {
  return dialogues.map((d, i) => ({
    speaker: d.speaker,
    text: d.text,
    type: d.type,
    x: i % 2 === 0 ? 0.22 : 0.78,
    y: d.type === 'narration' ? 0.04 : 0.05 + i * 0.08,
    tailDirection: 'down' as const,
  }));
}
