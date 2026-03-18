import { prisma } from './db';
import { config } from './config';

// 크레딧 차감 (markup은 estimateGenerationCost에서 이미 적용됨)
export async function deductCredits(userId: string, cost: number, reason: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.credits < cost) return false;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: cost } },
    }),
    prisma.creditLog.create({
      data: {
        userId,
        amount: -cost,
        balance: user.credits - cost,
        reason,
      },
    }),
  ]);

  return true;
  } catch (err) {
    console.error('[Credits] deductCredits failed:', err);
    return false;
  }
}

// 크레딧 충전
export async function addCredits(userId: string, amount: number, reason: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const newBalance = user.credits + amount;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    }),
    prisma.creditLog.create({
      data: { userId, amount, balance: newBalance, reason },
    }),
  ]);

  return newBalance;
}

// 잔액 조회
export async function getCredits(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
  return user?.credits ?? 0;
}

// 에피소드 1편 생성 = 고정 25C
export function estimateGenerationCost(_panelCount: number, _characterCount: number): number {
  return 25;
}

// 크레딧 충분 여부 사전 검증
export async function hasEnoughCredits(
  userId: string,
  estimatedPanels?: number,
  estimatedNewChars?: number,
): Promise<{ sufficient: boolean; balance: number; required: number }> {
  const balance = await getCredits(userId);
  const required = estimateGenerationCost(estimatedPanels ?? 10, estimatedNewChars ?? 0);
  return { sufficient: balance >= required, balance, required };
}
