import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { redis } from '@/lib/redis';
import { checkRedisHealth } from '@/lib/redis';
import { rateLimit } from '@/lib/rate-limit';
import { hasEnoughCredits } from '@/lib/credits';
import { captureException } from '@/lib/error-reporter';

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

    const redisHealthy = await checkRedisHealth();
    if (!redisHealthy) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status === 'ANALYZING' || project.status === 'GENERATING') {
      return NextResponse.json(
        { error: 'Generation already in progress' },
        { status: 409 }
      );
    }

    // Create job record
    const job = await prisma.job.create({
      data: {
        projectId: id,
        type: 'FULL_PIPELINE',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Run pipeline: use BullMQ queue if enabled, otherwise run inline
    if (process.env.USE_QUEUE === 'true') {
      const { pipelineQueue } = await import('@/lib/queue/pipeline-queue');
      await pipelineQueue.add('generate', { projectId: id, jobId: job.id });
    } else {
      // Inline execution (default for dev)
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
          captureException(error, { tags: { projectId: id, jobId: job.id, source: 'generate-route' } });
          await prisma.job.update({
            where: { id: job.id },
            data: { status: 'FAILED', error: message, completedAt: new Date() },
          });
        });
    }

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    captureException(error, { tags: { source: 'generate-route' } });
    return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 });
  }
}
