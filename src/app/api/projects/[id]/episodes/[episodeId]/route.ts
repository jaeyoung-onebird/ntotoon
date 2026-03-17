import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;
    const { id, episodeId } = await params;

    const project = await prisma.project.findUnique({ where: { id }, select: { userId: true } });
    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.episode.delete({ where: { id: episodeId } });

    // Check if any episodes remain
    const remaining = await prisma.episode.count({ where: { projectId: id } });
    if (remaining === 0) {
      await prisma.project.update({ where: { id }, data: { status: 'DRAFT' } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete episode:', error);
    return NextResponse.json({ error: 'Failed to delete episode' }, { status: 500 });
  }
}
