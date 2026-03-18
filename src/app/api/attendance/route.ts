import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const DAILY_REWARD = 25;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLog = await prisma.creditLog.findFirst({
      where: {
        userId,
        reason: '출석체크',
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    // 연속 출석 일수 계산
    let streak = 0;
    const logs = await prisma.creditLog.findMany({
      where: { userId, reason: '출석체크' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const checkDate = new Date(today);
    if (todayLog) {
      streak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    for (const log of logs) {
      const logDate = new Date(log.createdAt);
      logDate.setHours(0, 0, 0, 0);
      if (logDate.getTime() === checkDate.getTime()) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (logDate.getTime() < checkDate.getTime()) {
        break;
      }
    }

    return NextResponse.json({
      checkedIn: !!todayLog,
      streak,
      reward: DAILY_REWARD,
    });
  } catch (error) {
    console.error('Attendance GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 이미 출석했는지 확인
    const existing = await prisma.creditLog.findFirst({
      where: {
        userId,
        reason: '출석체크',
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    if (existing) {
      return NextResponse.json({ error: '이미 출석했습니다' }, { status: 409 });
    }

    // 크레딧 지급
    const user = await prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: DAILY_REWARD } },
    });

    await prisma.creditLog.create({
      data: {
        userId,
        amount: DAILY_REWARD,
        balance: user.credits,
        reason: '출석체크',
      },
    });

    return NextResponse.json({
      success: true,
      reward: DAILY_REWARD,
      balance: user.credits,
    });
  } catch (error) {
    console.error('Attendance POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
