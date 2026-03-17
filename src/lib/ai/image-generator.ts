import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { config } from '@/lib/config';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const MODEL_CHEAP = config.ai.modelCheap;
const MODEL_QUALITY = config.ai.modelQuality;
const MAX_CHAR_REFS = config.ai.maxCharRefs;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export async function validateImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) return false;
    if (metadata.width < 256 || metadata.height < 256) return false;

    const stats = await sharp(buffer).stats();
    const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
    if (avgBrightness < 10 || avgBrightness > 250) return false;

    const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
    if (avgStdDev < 5) return false;

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Gemini with exponential backoff
// ---------------------------------------------------------------------------

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateWithGemini(
  prompt: string,
  model: string,
  referenceImageBuffers?: Buffer[],
  aspectRatio = '2:3',
  maxRetries = 3,
): Promise<Buffer> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Gemini: 이미지를 먼저, 텍스트 프롬프트를 마지막에 (instruction following 향상)
      const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (referenceImageBuffers && referenceImageBuffers.length > 0) {
        for (const buf of referenceImageBuffers) {
          // 레퍼런스 이미지는 1024px로 리사이즈 (API 비용 절감 + 속도)
          const resized = await sharp(buf)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          contents.push({
            inlineData: { mimeType: 'image/png', data: resized.toString('base64') },
          });
        }
      }

      contents.push({ text: prompt });

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio },
        },
      });

      let imageBuffer: Buffer | null = null;
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData) {
            imageBuffer = Buffer.from(part.inlineData.data!, 'base64');
            break;
          }
        }
      }

      if (!imageBuffer) throw new Error('No image returned from Gemini');

      if (!(await validateImage(imageBuffer))) {
        if (attempt < maxRetries) {
          console.warn(`[Gemini] Retry ${attempt + 1}: invalid image`);
          await sleep(2000 * (attempt + 1));
          continue;
        }
        throw new Error('Invalid image after all retries');
      }

      return imageBuffer;
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Rate limit (429) → 더 오래 대기
      const isRateLimit = error instanceof Error && error.message.includes('429');
      const waitMs = isRateLimit ? 10000 * (attempt + 1) : 2000 * (attempt + 1);
      console.warn(`[Gemini] Retry ${attempt + 1}/${maxRetries} in ${waitMs}ms:`, (error as Error).message);
      await sleep(waitMs);
    }
  }
  throw new Error('All Gemini attempts failed');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateCharacterSheet(prompt: string): Promise<Buffer> {
  // 캐릭터 시트: 세로 비율이 자연스러움 (전신 + 표정)
  return generateWithGemini(prompt, MODEL_QUALITY, undefined, '3:4');
}

export async function generatePanel(
  prompt: string,
  hasCharacters = true,
  referenceImageBuffers?: Buffer[],
  styleReferenceBuffers?: Buffer[],
): Promise<Buffer> {
  const allRefs: Buffer[] = [];
  let enrichedPrompt = prompt;

  // 스타일 레퍼런스 (최대 2장)
  if (styleReferenceBuffers && styleReferenceBuffers.length > 0) {
    const styleRefs = styleReferenceBuffers.slice(0, config.ai.maxStyleRefs);
    allRefs.push(...styleRefs);
    enrichedPrompt = `STYLE REFERENCE: The first ${styleRefs.length} image(s) show the target art style. Match line weight, coloring, and visual quality ONLY — do NOT copy characters.\n\n${enrichedPrompt}`;
  }

  // 캐릭터 레퍼런스 (캐릭터당 1장씩, 최대 MAX_CHAR_REFS장)
  if (hasCharacters && referenceImageBuffers && referenceImageBuffers.length > 0) {
    const charRefs = referenceImageBuffers.slice(0, MAX_CHAR_REFS);
    allRefs.push(...charRefs);
    enrichedPrompt += `\n\nCHARACTER REFERENCE: The last ${charRefs.length} image(s) show the exact character(s) to draw. Reproduce same face, hair, and clothing precisely. If the prompt says "1boy", the character MUST be drawn as male.`;
  }

  if (allRefs.length > 0) {
    return generateWithGemini(enrichedPrompt, MODEL_QUALITY, allRefs, '2:3');
  }

  return generateWithGemini(enrichedPrompt, MODEL_CHEAP, undefined, '2:3');
}
