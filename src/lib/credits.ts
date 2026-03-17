import { prisma } from './db';
import { config } from './config';

// 크레딧 차감 (markup은 estimateGenerationCost에서 이미 적용됨)
export async function deductCredits(userId: string, cost: number, reason: string): Promise<boolean> {
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

// 생성 비용 계산 (크레딧 단위)
// Gemini 3.1 Flash: $0.067/image, 2.5 Flash: $0.039/image
// 1 credit = 100 KRW ≈ $0.073
// Cost in credits = (dollar cost / 0.073) * markup
export function estimateGenerationCost(panelCount: number, characterCount: number): number {
  const charSheetCost = characterCount * config.credits.charSheetCostUSD;
  const panelCost = panelCount * config.credits.panelCostUSD;
  const claudeCost = config.credits.claudeCostUSD;
  const totalDollar = charSheetCost + panelCost + claudeCost;
  const totalKRW = totalDollar * config.credits.exchangeRate;
  const credits = Math.ceil((totalKRW / config.credits.creditValueKRW) * config.credits.markup);
  return credits;
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
