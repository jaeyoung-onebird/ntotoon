import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, commentId, reason } = await request.json();

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    if (!projectId && !commentId) {
      return NextResponse.json({ error: 'projectId or commentId is required' }, { status: 400 });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        projectId: projectId || null,
        commentId: commentId || null,
        reason: reason.trim(),
      },
    });

    return NextResponse.json({ id: report.id, status: report.status });
  } catch (error) {
    console.error('Failed to create report:', error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}
