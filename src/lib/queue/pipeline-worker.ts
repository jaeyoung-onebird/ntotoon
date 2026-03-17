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

const worker = new Worker(
  'webtoon-pipeline',
  async (job) => {
    const { projectId, jobId } = job.data;

    try {
      const outputUrl = await runPipeline(projectId, async (progress) => {
        await job.updateProgress(progress.progress);
        await prisma.job.update({
          where: { id: jobId },
          data: { progress: progress.progress, message: progress.message },
        });
        await redis.publish(`pipeline:${jobId}`, JSON.stringify(progress));
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
      });
      captureException(error, { tags: { projectId, jobId, source: 'pipeline-worker' } });
      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

export default worker;
