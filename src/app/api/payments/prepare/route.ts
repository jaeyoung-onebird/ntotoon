import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

// 크레딧 패키지 정의 (credits page와 동일하게 유지)
const PACKAGES: Record<number, { price: number }> = {
  50:  { price: 5000 },
  100: { price: 9000 },
  300: { price: 25500 },
  500: { price: 40000 },
};

// POST /api/payments/prepare — 주문 생성 및 orderId 반환
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { credits } = await request.json();

  const pkg = PACKAGES[credits as number];
  if (!pkg) return NextResponse.json({ error: '유효하지 않은 패키지' }, { status: 400 });

  const orderId = `ntow-${randomUUID()}`;

  await prisma.payment.create({
    data: { userId, orderId, amount: pkg.price, credits, status: 'PENDING' },
  });

  return NextResponse.json({ orderId, amount: pkg.price, credits });
}
