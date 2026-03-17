import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { config } from '@/lib/config';
import { prisma } from '@/lib/db';
import { downloadFromS3 } from '@/lib/s3';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface QAScore {
  overall: number;
  characterConsistency: number;
  artStyle: number;
  noTextInImages: number;
  speechBubbles: number;
  storyFlow: number;
  backgroundQuality: number;
  episodeContinuity: number;
  issues: string[];
  suggestions: string[];
}

async function resizeForQA(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(512, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
}

// URL 또는 S3 key에서 Buffer 로드
async function loadImageBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // S3 public URL → key 추출
      const urlObj = new URL(url);
      const key = urlObj.pathname.slice(1); // leading slash 제거
      return await downloadFromS3(key);
    }
    // 로컬 경로 (/uploads/... 형태)
    const key = url.startsWith('/uploads/') ? url.slice('/uploads/'.length) : url.replace(/^\//, '');
    return await downloadFromS3(key);
  } catch {
    return null;
  }
}

// DB에서 에피소드 패널 이미지 로드 (로컬 파일 시스템 불필요)
export async function evaluateWebtoon(projectId: string, episodeId: string): Promise<QAScore> {
  // 캐릭터 시트 로드
  const characters = await prisma.character.findMany({ where: { projectId } });
  const charSheetBuffers: Buffer[] = [];
  for (const char of characters) {
    if (!char.referenceSheet) continue;
    const buf = await loadImageBuffer(char.referenceSheet);
    if (buf) charSheetBuffers.push(buf);
  }

  // 에피소드 패널 로드 (finalImageUrl 기준)
  const panels = await prisma.panel.findMany({
    where: { episodeId },
    orderBy: { orderIndex: 'asc' },
    select: { finalImageUrl: true, orderIndex: true },
  });

  if (panels.length === 0) throw new Error('No panels found to evaluate');

  // 최대 10개 고르게 샘플링
  const MAX = config.ai.maxEvalPanels;
  const selected = panels.length <= MAX
    ? panels
    : Array.from({ length: MAX }, (_, i) =>
        panels[Math.floor((i / MAX) * panels.length)]
      );

  const panelBuffers: Buffer[] = [];
  for (const panel of selected) {
    if (!panel.finalImageUrl) continue;
    const buf = await loadImageBuffer(panel.finalImageUrl);
    if (buf) panelBuffers.push(buf);
  }

  if (panelBuffers.length === 0) throw new Error('Could not load any panel images');

  // Claude Vision 평가
  const imageContents: Anthropic.ImageBlockParam[] = [];

  for (const buf of charSheetBuffers) {
    const resized = await resizeForQA(buf);
    imageContents.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: resized.toString('base64') },
    });
  }

  for (const buf of panelBuffers) {
    const resized = await resizeForQA(buf);
    imageContents.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: resized.toString('base64') },
    });
  }

  const response = await anthropic.messages.create({
    model: config.ai.qaModel,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        ...imageContents,
        {
          type: 'text',
          text: `You are a professional webtoon quality evaluator.

The first ${charSheetBuffers.length} image(s) are CHARACTER REFERENCE SHEETS.
The remaining ${panelBuffers.length} images are WEBTOON PANELS from the same episode.

Evaluate on these criteria (1-10 each):
1. characterConsistency: Same character look across panels? Compare with reference sheet.
2. artStyle: Consistent art style? Professional Korean webtoon quality?
3. noTextInImages: Images free of AI-generated text? (10=no text, 1=text everywhere)
4. speechBubbles: Speech bubbles clean, well-positioned, readable?
5. storyFlow: Panels flow naturally as a story? Good composition variety?
6. backgroundQuality: Backgrounds detailed and appropriate?

Respond ONLY in JSON:
\`\`\`json
{
  "overall": 7,
  "characterConsistency": 6,
  "artStyle": 8,
  "noTextInImages": 9,
  "speechBubbles": 7,
  "storyFlow": 8,
  "backgroundQuality": 7,
  "issues": ["specific issue 1"],
  "suggestions": ["actionable fix 1"]
}
\`\`\`
Be harsh and specific.`,
        },
      ],
    }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response');

  const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : content.text);
  return {
    ...parsed,
    episodeContinuity: parsed.episodeContinuity ?? parsed.storyFlow ?? 5,
  } as QAScore;
}
