import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import Redis from 'ioredis';

export const maxDuration = 300; // 5분

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
          clearInterval(heartbeat);
          controller.close();
        }
      };

      // 15초마다 하트비트 전송 — 연결 유지
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          safeClose();
        }
      }, 15000);

      // Send current state first
      const currentProgress = {
        step: job.status === 'COMPLETED' ? 'complete' : job.status === 'FAILED' ? 'failed' : 'analyzing',
        progress: job.progress,
        message: job.message || 'Waiting...',
        ...(job.status === 'COMPLETED' && job.result ? { outputUrl: (job.result as { outputUrl?: string }).outputUrl } : {}),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(currentProgress)}\n\n`));

      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        safeClose();
        return;
      }

      // Subscribe to Redis pub/sub for real-time updates
      let subscriber: Redis;
      try {
        subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      } catch {
        // Redis 연결 실패 시 폴링 방식으로 전환
        const poller = setInterval(async () => {
          if (closed) { clearInterval(poller); return; }
          try {
            const fresh = await prisma.job.findUnique({ where: { id: jobId } });
            if (!fresh) { clearInterval(poller); safeClose(); return; }
            const progress = { step: fresh.status === 'COMPLETED' ? 'complete' : fresh.status === 'FAILED' ? 'failed' : 'analyzing', progress: fresh.progress, message: fresh.message || '' };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
            if (fresh.status === 'COMPLETED' || fresh.status === 'FAILED') { clearInterval(poller); safeClose(); }
          } catch { /* ignore */ }
        }, 3000);
        request.signal.addEventListener('abort', () => { clearInterval(poller); safeClose(); });
        return;
      }
      const channel = `pipeline:${jobId}`;

      subscriber.on('error', (err) => {
        console.warn('[SSE] Redis subscriber error:', err.message);
      });

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
