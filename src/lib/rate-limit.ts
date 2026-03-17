import { redis } from '@/lib/redis';

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }
  const ttl = await redis.ttl(key);
  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
    retryAfter: current > limit ? ttl : 0,
  };
}
