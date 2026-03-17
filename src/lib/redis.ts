import Redis from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return 'redis://localhost:6379';
};

export const redis = new Redis(getRedisUrl());
export default redis;

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
