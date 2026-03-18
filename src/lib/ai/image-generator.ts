import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { config } from '@/lib/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// GPT-Image-1
// ---------------------------------------------------------------------------

async function generateWithGPT(
  prompt: string,
  referenceImageBuffers?: Buffer[],
  quality: 'low' | 'medium' | 'high' = 'low',
  size: '1024x1024' | '1024x1536' | '1536x1024' = '1024x1536',
  maxRetries = 3,
): Promise<Buffer> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let imageBuffer: Buffer;

      if (referenceImageBuffers && referenceImageBuffers.length > 0) {
        // 레퍼런스 이미지 있는 경우: edit API 사용
        const refBuf = referenceImageBuffers[0];
        const resized = await sharp(refBuf)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();

        const file = await OpenAI.toFile(resized, 'reference.png', { type: 'image/png' });

        const response = await openai.images.edit({
          model: 'gpt-image-1.5',
          image: file,
          prompt,
          size: '1024x1024',
          quality,
        });

        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error('No image returned from GPT-Image-1 edit');
        imageBuffer = Buffer.from(b64, 'base64');
      } else {
        // 레퍼런스 없는 경우: generate API 사용
        const response = await openai.images.generate({
          model: 'gpt-image-1.5',
          prompt,
          size,
          quality,
          n: 1,
        });

        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error('No image returned from GPT-Image-1');
        imageBuffer = Buffer.from(b64, 'base64');
      }

      if (!(await validateImage(imageBuffer))) {
        if (attempt < maxRetries) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        throw new Error('Invalid image after all retries');
      }

      return imageBuffer;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const isRateLimit = error instanceof Error && error.message.includes('429');
      const waitMs = isRateLimit ? 15000 * (attempt + 1) : 2000 * (attempt + 1);
      console.warn(`[GPT-Image] Retry ${attempt + 1}/${maxRetries} in ${waitMs}ms:`, (error as Error).message);
      await sleep(waitMs);
    }
  }
  throw new Error('All GPT-Image attempts failed');
}

// ---------------------------------------------------------------------------
// Gemini fallback
// ---------------------------------------------------------------------------

async function generateWithGemini(
  prompt: string,
  model: string,
  referenceImageBuffers?: Buffer[],
  aspectRatio = '2:3',
  maxRetries = 3,
): Promise<Buffer> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (referenceImageBuffers && referenceImageBuffers.length > 0) {
        for (const buf of referenceImageBuffers) {
          const resized = await sharp(buf)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          contents.push({ inlineData: { mimeType: 'image/png', data: resized.toString('base64') } });
        }
      }
      contents.push({ text: prompt });

      const response = await gemini.models.generateContent({
        model,
        contents,
        config: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } },
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
        if (attempt < maxRetries) { await sleep(2000 * (attempt + 1)); continue; }
        throw new Error('Invalid image after all retries');
      }
      return imageBuffer;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const isRateLimit = error instanceof Error && error.message.includes('429');
      const waitMs = isRateLimit ? 15000 * (attempt + 1) : 2000 * (attempt + 1);
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
  return generateWithGPT(prompt, undefined, 'low', '1024x1536');
}

export async function generatePanel(
  prompt: string,
  hasCharacters = true,
  referenceImageBuffers?: Buffer[],
  styleReferenceBuffers?: Buffer[],
): Promise<Buffer> {
  let enrichedPrompt = prompt;

  if (styleReferenceBuffers && styleReferenceBuffers.length > 0) {
    const styleRefs = styleReferenceBuffers.slice(0, config.ai.maxStyleRefs);
    enrichedPrompt = `STYLE REFERENCE: Match the art style of the reference image(s) — line weight, coloring, shading technique. Do NOT copy characters from references.\n\n${enrichedPrompt}`;
  }

  if (hasCharacters && referenceImageBuffers && referenceImageBuffers.length > 0) {
    enrichedPrompt += `\n\nCHARACTER REFERENCE: Reproduce exact same face, hair, and clothing from reference image(s). If prompt says "1boy", draw as male.`;
  }

  // 레퍼런스 이미지 합치기 (캐릭터 + 스타일)
  const allRefs: Buffer[] = [];
  if (referenceImageBuffers) allRefs.push(...referenceImageBuffers.slice(0, MAX_CHAR_REFS));
  if (styleReferenceBuffers) allRefs.push(...styleReferenceBuffers.slice(0, config.ai.maxStyleRefs));

  return generateWithGemini(
    enrichedPrompt,
    config.ai.modelQuality, // gemini-3.1-flash-image-preview
    allRefs.length > 0 ? allRefs : undefined,
    '2:3',
  );
}
