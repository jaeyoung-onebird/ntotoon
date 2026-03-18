import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toPublicUrl } from '@/lib/s3';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, id: true } },
        characters: true,
        episodes: {
          include: {
            panels: {
              include: { dialogues: true, panelCharacters: true },
              orderBy: { orderIndex: 'asc' },
            },
          },
          orderBy: { number: 'asc' },
        },
        jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 15분 이상 RUNNING인 job은 stuck으로 간주하고 자동 정리
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const stuckJobs = await prisma.job.updateMany({
      where: { projectId: id, status: 'RUNNING', startedAt: { lt: fifteenMinAgo } },
      data: { status: 'FAILED', error: 'Timed out', completedAt: new Date() },
    });
    if (stuckJobs.count > 0) {
      await prisma.project.update({
        where: { id, status: { in: ['GENERATING', 'DRAFT'] } },
        data: { status: 'FAILED' },
      });
    }

    // 이미지 URL을 /cdn/ 프록시 경로로 변환
    const sanitized = {
      ...project,
      characters: project.characters.map(c => ({ ...c, referenceSheet: toPublicUrl(c.referenceSheet) })),
      episodes: project.episodes.map(ep => ({
        ...ep,
        outputUrl: toPublicUrl(ep.outputUrl),
        panels: ep.panels.map(p => ({
          ...p,
          rawImageUrl: toPublicUrl(p.rawImageUrl),
          finalImageUrl: toPublicUrl(p.finalImageUrl),
        })),
      })),
    };

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('Failed to get project:', error);
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id }, select: { userId: true } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // cascade가 없는 테이블 먼저 정리
    await prisma.qaResult.deleteMany({ where: { projectId: id } });
    await prisma.goldenImage.deleteMany({ where: { projectId: id } });
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
