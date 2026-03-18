import { Worker } from 'bullmq';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { captureException } from '@/lib/error-reporter';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

console.log('[Worker] Starting pipeline worker...');

const worker = new Worker(
  'webtoon-pipeline',
  async (job) => {
    const { projectId, jobId } = job.data;

    try {
      const outputUrl = await runPipeline(projectId, async (progress) => {
        await job.updateProgress(progress.progress).catch(() => {});
        await prisma.job.update({
          where: { id: jobId },
          data: { progress: progress.progress, message: progress.message },
        }).catch(() => {});
        await redis.publish(`pipeline:${jobId}`, JSON.stringify(progress)).catch(() => {});
      });

      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', progress: 100, completedAt: new Date(), result: { outputUrl } as object },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'FAILED', error: message, completedAt: new Date() },
      }).catch(() => {});
      captureException(error, { tags: { projectId, jobId, source: 'pipeline-worker' } });
      // 재시도 하지 않음 — 이미 FAILED로 마킹됨
    }
  },
  {
    connection,
    concurrency: 1, // 동시 1개만 (메모리 절약)
    autorun: true,
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

console.log('[Worker] Pipeline worker ready. Waiting for jobs...');

// 안전한 종료
process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down...');
  await worker.close();
  process.exit(0);
});

export default worker;
