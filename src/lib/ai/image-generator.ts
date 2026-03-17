import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

// 모델 전략 (2026.03 기준)
// - 2.5 Flash: $0.039/장, 저렴 — 배경, 와이드샷
// - 3.1 Flash: $0.067/장, 최신+고퀄 — 캐릭터 시트, 캐릭터 패널
import { config } from '@/lib/config';

const MODEL_CHEAP = config.ai.modelCheap;
const MODEL_QUALITY = config.ai.modelQuality;

// ---------------------------------------------------------------------------
// Helpers
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
// Core generation via Gemini
// ---------------------------------------------------------------------------

async function generateWithGemini(
  prompt: string,
  model: string,
  referenceImageBuffers?: Buffer[],
  aspectRatio = '2:3',
  maxRetries = 2,
): Promise<Buffer> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Build contents: text prompt + optional reference images
      const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt },
      ];

      if (referenceImageBuffers && referenceImageBuffers.length > 0) {
        for (const buf of referenceImageBuffers) {
          contents.push({
            inlineData: {
              mimeType: 'image/png',
              data: buf.toString('base64'),
            },
          });
        }
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio,
            imageSize: '1K',
          },
        },
      });

      // Extract image from response
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

      if (!imageBuffer) {
        throw new Error('No image returned from Gemini');
      }

      if (!(await validateImage(imageBuffer))) {
        if (attempt < maxRetries) {
          console.warn(`Retry ${attempt + 1}: black/invalid image`);
          continue;
        }
        throw new Error('Black/invalid image after retries');
      }

      return imageBuffer;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(`Retry ${attempt + 1}:`, error);
    }
  }
  throw new Error('All attempts failed');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateCharacterSheet(prompt: string): Promise<Buffer> {
  return generateWithGemini(prompt, MODEL_QUALITY, undefined, '3:2');
}

export async function generatePanel(
  prompt: string,
  hasCharacters = true,
  referenceImageBuffers?: Buffer[],
  styleReferenceBuffers?: Buffer[],
): Promise<Buffer> {
  const allRefs: Buffer[] = [];
  let enrichedPrompt = prompt;

  if (styleReferenceBuffers && styleReferenceBuffers.length > 0) {
    allRefs.push(...styleReferenceBuffers);
    enrichedPrompt += `\n\nSTYLE REFERENCE: The first ${styleReferenceBuffers.length} attached image(s) are high-quality style examples. Match their art style, line weight, coloring technique, and overall visual quality exactly. Do NOT copy the characters in these style references — only copy the art style.`;
  }

  if (hasCharacters && referenceImageBuffers && referenceImageBuffers.length > 0) {
    allRefs.push(...referenceImageBuffers);
    enrichedPrompt += `\n\nCHARACTER REFERENCE: The remaining ${referenceImageBuffers.length} attached image(s) show the characters. Draw them exactly as shown — same face, hairstyle, clothing, and colors. If the prompt says "1boy", the character MUST be male regardless of style references.`;
  }

  if (allRefs.length > 0) {
    return generateWithGemini(enrichedPrompt, MODEL_QUALITY, allRefs, '2:3');
  }
  return generateWithGemini(prompt, MODEL_CHEAP, undefined, '2:3');
}

export async function generatePanelsBatch(
  panels: Array<{ prompt: string; hasCharacters: boolean; referenceImageBuffers?: Buffer[] }>,
  batchSize = 5,
  onProgress?: (completed: number, total: number) => void,
): Promise<Buffer[]> {
  const results: Buffer[] = [];
  for (let i = 0; i < panels.length; i += batchSize) {
    const batch = panels.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((p) => generatePanel(p.prompt, p.hasCharacters, p.referenceImageBuffers)),
    );
    results.push(...batchResults);
    onProgress?.(results.length, panels.length);
  }
  return results;
}
