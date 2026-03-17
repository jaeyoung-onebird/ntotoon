import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, bio: true, image: true, createdAt: true, _count: { select: { subscribers: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: id, status: 'COMPLETED' },
      include: {
        episodes: {
          take: 1,
          orderBy: { number: 'asc' },
          include: { panels: { take: 1, orderBy: { orderIndex: 'asc' } } },
        },
        _count: { select: { episodes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const author = {
      ...user,
      subscriberCount: user._count.subscribers,
      _count: undefined,
    };

    return NextResponse.json({ author, projects });
  } catch (error) {
    console.error('Failed to get author:', error);
    return NextResponse.json({ error: 'Failed to get author' }, { status: 500 });
  }
}
