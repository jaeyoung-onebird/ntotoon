import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    const episodeId = request.nextUrl.searchParams.get('episodeId');
    const ratings = await prisma.rating.findMany({
      where: { projectId: id, ...(episodeId ? { episodeId } : {}) },
    });

    const count = ratings.length;
    const average = count > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r.score, 0) / count) * 10) / 10
      : 0;

    let userRating: number | null = null;
    if (userId) {
      const existing = ratings.find(r => r.userId === userId);
      userRating = existing?.score ?? null;
    }

    return NextResponse.json({ average, count, userRating });
  } catch (error) {
    console.error('Failed to get ratings:', error);
    return NextResponse.json({ error: 'Failed to get ratings' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { score, episodeId } = await request.json();

    if (!score || score < 1 || score > 5 || !Number.isInteger(score)) {
      return NextResponse.json({ error: 'Score must be an integer between 1 and 5' }, { status: 400 });
    }

    const rating = await prisma.rating.upsert({
      where: {
        userId_projectId_episodeId: { userId, projectId: id, episodeId: episodeId || null },
      },
      update: { score },
      create: { userId, projectId: id, episodeId: episodeId || null, score },
    });

    return NextResponse.json(rating);
  } catch (error) {
    console.error('Failed to create/update rating:', error);
    return NextResponse.json({ error: 'Failed to create/update rating' }, { status: 500 });
  }
}
