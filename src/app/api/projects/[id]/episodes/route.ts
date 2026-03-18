import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { redis } from '@/lib/redis';
import { sanitizeUserInput } from '@/lib/sanitize';
import { rateLimit } from '@/lib/rate-limit';
import { captureException } from '@/lib/error-reporter';

// POST /api/projects/[id]/episodes — 새 에피소드(다음 화) 생성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { allowed, retryAfter } = await rateLimit(`gen:${userId}`, 2, 300);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before generating again.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const novelText = sanitizeUserInput(body.novelText || '');

    if (!novelText) {
      return NextResponse.json({ error: 'novelText is required' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { episodes: { orderBy: { number: 'desc' }, take: 1 } },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // rewrite=true면 기존 에피소드 삭제 후 같은 번호로 재생성
    const isRewrite = body.rewrite === true && body.episodeNumber;
    let nextEpisodeNumber: number;

    if (isRewrite) {
      // 재작성: 해당 에피소드 삭제
      const existing = await prisma.episode.findFirst({
        where: { projectId: id, number: body.episodeNumber },
      });
      if (existing) {
        await prisma.episode.delete({ where: { id: existing.id } });
      }
      nextEpisodeNumber = body.episodeNumber;
    } else {
      // 새 에피소드: 현재 존재하는 에피소드 중 가장 높은 번호 + 1
      const lastEp = await prisma.episode.findFirst({
        where: { projectId: id },
        orderBy: { number: 'desc' },
      });
      nextEpisodeNumber = (lastEp?.number ?? 0) + 1;
    }

    // 프로젝트의 novelText를 새 에피소드 텍스트로 업데이트
    await prisma.project.update({
      where: { id },
      data: { novelText, status: 'DRAFT' },
    });

    // Job 생성
    const job = await prisma.job.create({
      data: {
        projectId: id,
        type: 'FULL_PIPELINE',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // 파이프라인 실행: BullMQ 큐 사용 가능하면 큐로, 아니면 인라인
    if (process.env.USE_QUEUE === 'true') {
      const { pipelineQueue } = await import('@/lib/queue/pipeline-queue');
      await pipelineQueue.add('generate', { projectId: id, jobId: job.id });
    } else {
      // 인라인 실행 (기존 캐릭터 재사용)
      runPipeline(id, async (progress) => {
        await prisma.job.update({
          where: { id: job.id },
          data: { progress: progress.progress, message: progress.message },
        });
        await redis.publish(`pipeline:${job.id}`, JSON.stringify(progress));
      })
        .then(async (outputUrl) => {
          await prisma.job.update({
            where: { id: job.id },
            data: { status: 'COMPLETED', progress: 100, completedAt: new Date(), result: { outputUrl } as object },
          });
        })
        .catch(async (error) => {
          const message = error instanceof Error ? error.message : 'Unknown error';
          captureException(error, { tags: { projectId: id, jobId: job.id, source: 'episodes-route' } });
          await prisma.job.update({
            where: { id: job.id },
            data: { status: 'FAILED', error: message, completedAt: new Date() },
          });
        });
    }

    return NextResponse.json({ jobId: job.id, episodeNumber: nextEpisodeNumber }, { status: 202 });
  } catch (error) {
    captureException(error, { tags: { source: 'episodes-route' } });
    return NextResponse.json({ error: 'Failed to create episode' }, { status: 500 });
  }
}
