import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 입력하세요' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: '이미 가입된 이메일입니다' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name: name || email.split('@')[0], credits: 100 },
    });

    // 가입 축하 100C 무료 지급 — 로그만 기록 (credits는 이미 100으로 생성됨)
    await prisma.creditLog.create({
      data: { userId: user.id, amount: 100, balance: 100, reason: '회원가입 축하 100C 무료 지급' },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: '회원가입 실패' }, { status: 500 });
  }
}
