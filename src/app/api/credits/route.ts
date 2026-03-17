import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { addCredits, getCredits } from '@/lib/credits';

// GET /api/credits — 크레딧 잔액 + 최근 로그 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const credits = await getCredits(userId);

    const logs = await prisma.creditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ credits, logs });
  } catch (error) {
    console.error('Failed to get credits:', error);
    return NextResponse.json({ error: 'Failed to get credits' }, { status: 500 });
  }
}

// POST /api/credits — 크레딧 충전 (임시: 실제 결제 없이 직접 추가)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const { amount } = await request.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: '유효하지 않은 금액입니다' }, { status: 400 });
    }

    const newBalance = await addCredits(userId, amount, `크레딧 충전: ${amount}C`);

    return NextResponse.json({ credits: newBalance });
  } catch (error) {
    console.error('Failed to add credits:', error);
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
  }
}
