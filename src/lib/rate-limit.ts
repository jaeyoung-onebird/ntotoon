import { redis } from '@/lib/redis';

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  try {
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
  } catch {
    // Redis 장애 시 허용 (rate limit 없이 통과)
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}
