import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { addCredits } from '@/lib/credits';

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;

// POST /api/payments/confirm — 토스 결제 승인
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { paymentKey, orderId, amount } = await request.json();

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  // DB에서 주문 확인
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) return NextResponse.json({ error: '주문을 찾을 수 없습니다' }, { status: 404 });
  if (payment.userId !== userId) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  if (payment.status !== 'PENDING') return NextResponse.json({ error: '이미 처리된 주문입니다' }, { status: 409 });
  if (payment.amount !== amount) return NextResponse.json({ error: '금액 불일치' }, { status: 400 });

  // 토스 결제 승인 API 호출
  if (!TOSS_SECRET_KEY) {
    // 개발 모드: 실제 토스 호출 없이 통과
    console.warn('[Payments] TOSS_SECRET_KEY not set — skipping Toss confirmation (dev mode)');
  } else {
    const basicToken = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const err = await tossRes.json();
      await prisma.payment.update({
        where: { orderId },
        data: { status: 'FAILED', paymentKey },
      });
      return NextResponse.json({ error: err.message || '결제 승인 실패' }, { status: 400 });
    }

    const tossData = await tossRes.json();
    await prisma.payment.update({
      where: { orderId },
      data: { status: 'DONE', paymentKey, method: tossData.method, confirmedAt: new Date() },
    });
  }

  // 개발 모드 업데이트
  if (!TOSS_SECRET_KEY) {
    await prisma.payment.update({
      where: { orderId },
      data: { status: 'DONE', paymentKey, confirmedAt: new Date() },
    });
  }

  // 크레딧 지급
  const newBalance = await addCredits(
    userId,
    payment.credits,
    `크레딧 충전 ${payment.credits}C (결제 ${payment.amount.toLocaleString()}원)`
  );

  return NextResponse.json({ success: true, credits: newBalance, added: payment.credits });
}
