import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { config } from '@/lib/config';

// QA용 이미지 리사이즈 (Claude API 한도 초과 방지)
async function resizeForQA(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(512, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface QAScore {
  overall: number; // 1-10
  characterConsistency: number; // 1-10
  artStyle: number; // 1-10
  noTextInImages: number; // 1-10
  speechBubbles: number; // 1-10
  storyFlow: number; // 1-10
  backgroundQuality: number; // 1-10
  episodeContinuity: number; // 1-10 (에피소드간 연속성)
  issues: string[];
  suggestions: string[];
}

export async function evaluateWebtoon(projectDir: string): Promise<QAScore> {
  // 캐릭터 시트 + 패널 이미지들을 수집
  const charDir = path.join(projectDir, 'characters');
  const charSheets: { name: string; buffer: Buffer }[] = [];

  try {
    const charFolders = await fs.readdir(charDir);
    for (const folder of charFolders) {
      const sheetPath = path.join(charDir, folder, 'sheet.png');
      try {
        const buffer = await fs.readFile(sheetPath);
        charSheets.push({ name: folder, buffer });
      } catch { /* skip */ }
    }
  } catch { /* no characters */ }

  // 에피소드 패널 수집
  const episodesDir = path.join(projectDir, 'episodes');
  const panelBuffers: Buffer[] = [];

  try {
    const episodes = await fs.readdir(episodesDir);
    for (const ep of episodes) {
      const panelsDir = path.join(episodesDir, ep, 'panels');
      try {
        const files = (await fs.readdir(panelsDir))
          .filter(f => f.endsWith('_final.png'))
          .sort((a, b) => {
            const numA = parseInt(a.split('_')[0]);
            const numB = parseInt(b.split('_')[0]);
            return numA - numB;
          });

        // 최대 10개 패널을 평가 (에피소드 전체에 걸쳐 고르게 분포)
        const selected = files.length <= 10 ? files : [
          files[0],
          files[Math.floor(files.length * 0.1)],
          files[Math.floor(files.length * 0.2)],
          files[Math.floor(files.length * 0.3)],
          files[Math.floor(files.length * 0.4)],
          files[Math.floor(files.length * 0.5)],
          files[Math.floor(files.length * 0.6)],
          files[Math.floor(files.length * 0.7)],
          files[Math.floor(files.length * 0.85)],
          files[files.length - 1],
        ];

        for (const f of selected) {
          const buffer = await fs.readFile(path.join(panelsDir, f));
          panelBuffers.push(buffer);
        }
      } catch { /* skip */ }
    }
  } catch { /* no episodes */ }

  if (panelBuffers.length === 0) {
    throw new Error('No panels found to evaluate');
  }

  // Claude Vision으로 평가
  const imageContents: Anthropic.ImageBlockParam[] = [];

  // 캐릭터 시트 추가 (리사이즈)
  for (const sheet of charSheets) {
    const resized = await resizeForQA(sheet.buffer);
    imageContents.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: resized.toString('base64') },
    });
  }

  // 패널 이미지 추가 (리사이즈)
  for (const panel of panelBuffers) {
    const resized = await resizeForQA(panel);
    imageContents.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: resized.toString('base64') },
    });
  }

  const response = await anthropic.messages.create({
    model: config.ai.qaModel,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: `You are a professional webtoon quality evaluator.

The first ${charSheets.length} image(s) are CHARACTER REFERENCE SHEETS.
The remaining ${panelBuffers.length} images are WEBTOON PANELS from the same episode.

Evaluate this webtoon on these criteria (1-10 each):

1. **characterConsistency**: Does the same character look the same across panels? Compare with the reference sheet. Same face, hair, clothing?
2. **artStyle**: Is the art style consistent across all panels? Does it look like a professional Korean webtoon?
3. **noTextInImages**: Are the images FREE of AI-generated text/letters/numbers? (10 = no text at all, 1 = text everywhere)
4. **speechBubbles**: Are speech bubbles clean, well-positioned, readable Korean text?
5. **storyFlow**: Do the panels flow naturally as a story sequence? Good composition variety?
6. **backgroundQuality**: Are backgrounds detailed and appropriate for each scene?

Respond ONLY in this JSON format:
\`\`\`json
{
  "overall": 7,
  "characterConsistency": 6,
  "artStyle": 8,
  "noTextInImages": 9,
  "speechBubbles": 7,
  "storyFlow": 8,
  "backgroundQuality": 7,
  "issues": ["specific issue 1", "specific issue 2"],
  "suggestions": ["specific code-level suggestion to fix issue 1", "specific suggestion 2"]
}
\`\`\`

Be HARSH and HONEST. Issues should be specific (e.g. "panel 3 character has different hair color than reference sheet"). Suggestions should be actionable code changes (e.g. "add 'maintain exact hair color: black short messy hair' to every panel prompt").`,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response');

  const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : content.text;
  const parsed = JSON.parse(jsonStr);
  return {
    ...parsed,
    episodeContinuity: parsed.episodeContinuity ?? parsed.storyFlow ?? 5,
  } as QAScore;
}
