import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { config } from '@/lib/config';
import { prisma } from '@/lib/db';
import { downloadFromS3 } from '@/lib/s3';

const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

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
      const urlObj = new URL(url);
      const key = decodeURIComponent(urlObj.pathname.slice(1));
      return await downloadFromS3(key);
    }
    // /cdn/ 프록시 경로 → S3 키 추출
    if (url.startsWith('/cdn/')) {
      const key = decodeURIComponent(url.slice('/cdn/'.length));
      return await downloadFromS3(key);
    }
    // /uploads/ 로컬 경로
    const key = url.startsWith('/uploads/') ? url.slice('/uploads/'.length) : url.replace(/^\//, '');
    return await downloadFromS3(decodeURIComponent(key));
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

  // Gemini Vision 평가
  const imageContents: Array<{ inlineData: { mimeType: string; data: string } }> = [];

  for (const buf of charSheetBuffers) {
    const resized = await resizeForQA(buf);
    imageContents.push({ inlineData: { mimeType: 'image/jpeg', data: resized.toString('base64') } });
  }

  for (const buf of panelBuffers) {
    const resized = await resizeForQA(buf);
    imageContents.push({ inlineData: { mimeType: 'image/jpeg', data: resized.toString('base64') } });
  }

  const promptText = `You are a professional webtoon quality evaluator.

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
Be harsh and specific.`;

  const response = await gemini.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [...imageContents, { text: promptText }],
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Unexpected response');

  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // JSON 파싱 실패 시 기본 점수 반환
    console.warn('[QA] Claude 응답 파싱 실패, 기본 점수 사용');
    return {
      overall: 5, characterConsistency: 5, artStyle: 5,
      noTextInImages: 5, speechBubbles: 5, storyFlow: 5,
      backgroundQuality: 5, episodeContinuity: 5,
      issues: ['QA 평가 응답 파싱 실패'], suggestions: [],
    };
  }

  return {
    overall: (parsed.overall as number) ?? 5,
    characterConsistency: (parsed.characterConsistency as number) ?? 5,
    artStyle: (parsed.artStyle as number) ?? 5,
    noTextInImages: (parsed.noTextInImages as number) ?? 5,
    speechBubbles: (parsed.speechBubbles as number) ?? 5,
    storyFlow: (parsed.storyFlow as number) ?? 5,
    backgroundQuality: (parsed.backgroundQuality as number) ?? 5,
    episodeContinuity: (parsed.episodeContinuity as number) ?? (parsed.storyFlow as number) ?? 5,
    issues: Array.isArray(parsed.issues) ? parsed.issues as string[] : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions as string[] : [],
  };
}
