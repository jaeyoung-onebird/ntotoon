import { analyzeNovel, PreviousEpisodeContext } from './claude';
import type { AnalysisResult } from '@/types/scene';
import { sanitizeUserInput } from '@/lib/sanitize';

export async function analyzeText(
  novelText: string,
  previousEpisodes?: PreviousEpisodeContext[]
): Promise<AnalysisResult> {
  const MAX_CHUNK_SIZE = 5000;
  const sanitized = sanitizeUserInput(novelText);

  if (sanitized.length <= MAX_CHUNK_SIZE) {
    return analyzeNovel(sanitized, previousEpisodes);
  }

  const chunks = splitIntoChunks(sanitized, MAX_CHUNK_SIZE);
  return analyzeNovel(chunks[0], previousEpisodes);
}

function splitIntoChunks(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n\n', maxSize);
    if (splitIndex === -1 || splitIndex < maxSize * 0.5) {
      splitIndex = remaining.lastIndexOf('.', maxSize);
      if (splitIndex === -1 || splitIndex < maxSize * 0.5) {
        splitIndex = maxSize;
      } else {
        splitIndex += 1;
      }
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}
