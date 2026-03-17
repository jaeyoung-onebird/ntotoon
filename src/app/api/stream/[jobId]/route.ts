import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import Redis from 'ioredis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      // Send current state first
      const currentProgress = {
        step: job.status === 'COMPLETED' ? 'complete' : 'analyzing',
        progress: job.progress,
        message: job.message || 'Waiting...',
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(currentProgress)}\n\n`));

      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        safeClose();
        return;
      }

      // Subscribe to Redis pub/sub for real-time updates
      const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      const channel = `pipeline:${jobId}`;

      subscriber.subscribe(channel);
      subscriber.on('message', (_ch: string, message: string) => {
        try {
          if (closed) return;
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          const data = JSON.parse(message);
          if (data.step === 'complete' || data.step === 'failed') {
            subscriber.unsubscribe(channel);
            subscriber.disconnect();
            safeClose();
          }
        } catch {
          // ignore parse errors
        }
      });

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        subscriber.unsubscribe(channel);
        subscriber.disconnect();
        safeClose();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
