import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/feed — 완료된 프로젝트를 최신순으로, 썸네일 포함
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
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
        _count: { select: { episodes: true } },
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
  }
}
