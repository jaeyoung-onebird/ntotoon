import { prisma } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public');
const MAX_STYLE_REFS = 3; // Gemini에 넘길 스타일 레퍼런스 최대 수

/**
 * golden_images에서 고득점 패널을 꺼내 Buffer로 반환
 * 카메라 앵글별로 다양하게 섞어서 선택
 */
export async function getStyleReferenceBuffers(
  category: 'panel' | 'background' = 'panel',
  cameraAngle?: string,
): Promise<Buffer[]> {
  try {
    const count = await prisma.goldenImage.count({ where: { category } });
    if (count === 0) return [];

    // 카메라 앵글이 같은 것 우선, 없으면 전체 상위
    const candidates = await prisma.goldenImage.findMany({
      where: {
        category,
        qaScore: { gte: 8 },
        ...(cameraAngle ? { tags: { array_contains: [cameraAngle] } } : {}),
      },
      orderBy: [{ qaScore: 'desc' }, { styleScore: 'desc' }],
      take: MAX_STYLE_REFS * 2,
    });

    // 부족하면 전체에서 보충
    const needed = MAX_STYLE_REFS - candidates.length;
    let extras: typeof candidates = [];
    if (needed > 0) {
      extras = await prisma.goldenImage.findMany({
        where: {
          category,
          qaScore: { gte: 8 },
          id: { notIn: candidates.map(c => c.id) },
        },
        orderBy: { qaScore: 'desc' },
        take: needed,
      });
    }

    const selected = [...candidates, ...extras].slice(0, MAX_STYLE_REFS);
    const buffers: Buffer[] = [];

    for (const img of selected) {
      try {
        const localPath = path.resolve(UPLOADS_DIR, img.imageUrl);
        if (!localPath.startsWith(UPLOADS_DIR)) continue;
        const buf = await fs.readFile(localPath);
        buffers.push(buf);
      } catch {
        // S3 URL이거나 파일 없으면 skip
      }
    }

    return buffers;
  } catch {
    return [];
  }
}
