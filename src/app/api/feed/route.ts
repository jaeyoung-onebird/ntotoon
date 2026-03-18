import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { toPublicUrl } from '@/lib/s3';

// GET /api/feed — 완료된 프로젝트를 최신순으로, 썸네일 포함
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        user: { select: { name: true } },
        characters: {
          select: { name: true, referenceSheet: true },
        },
        episodes: {
          orderBy: { number: 'asc' },
          take: 1,
          include: {
            panels: {
              orderBy: { orderIndex: 'asc' },
              take: 1,
              select: { id: true, finalImageUrl: true, rawImageUrl: true },
            },
          },
        },
        ratings: { select: { score: true } },
        _count: { select: { episodes: true } },
      },
    });

    const result = projects.map(({ ratings, ...project }) => ({
      ...project,
      characters: project.characters.map(c => ({ ...c, referenceSheet: toPublicUrl(c.referenceSheet) })),
      episodes: project.episodes.map(ep => ({
        ...ep,
        panels: ep.panels.map(p => ({
          ...p,
          finalImageUrl: toPublicUrl(p.finalImageUrl),
          rawImageUrl: toPublicUrl(p.rawImageUrl),
        })),
      })),
      ratingAvg: ratings.length > 0 ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / ratings.length) * 100) / 100 : 0,
      ratingCount: ratings.length,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
  }
}
