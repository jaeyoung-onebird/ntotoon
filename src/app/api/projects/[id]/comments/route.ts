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

    const episodeId = request.nextUrl.searchParams.get('episodeId');
    const comments = await prisma.comment.findMany({
      where: { projectId: id, ...(episodeId ? { episodeId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true, id: true } },
      },
    });

    return NextResponse.json(
      comments.map(c => ({
        id: c.id,
        text: c.text,
        createdAt: c.createdAt,
        user: { name: c.user.name, id: c.user.id },
      }))
    );
  } catch (error) {
    console.error('Failed to get comments:', error);
    return NextResponse.json({ error: 'Failed to get comments' }, { status: 500 });
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
    const { text, episodeId } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const comment = await prisma.comment.create({
      data: {
        userId,
        projectId: id,
        episodeId: episodeId || null,
        text: text.trim(),
      },
      include: {
        user: { select: { name: true, id: true } },
      },
    });

    return NextResponse.json({
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      user: { name: comment.user.name, id: comment.user.id },
    });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

// PUT — 댓글 수정 (본인만)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { commentId, text } = await request.json();
    if (!commentId || !text?.trim()) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { text: text.trim() },
    });
    return NextResponse.json({ id: updated.id, text: updated.text });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE — 댓글 삭제 (본인만)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { commentId } = await request.json();
    if (!commentId) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.comment.delete({ where: { id: commentId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
