import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/settings — 내 정보 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      select: { id: true, name: true, email: true, bio: true, image: true, createdAt: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to get settings:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

// PUT /api/settings — 내 정보 수정
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const { name, bio } = await request.json();
    const userId = (session.user as { id: string }).id;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
      },
      select: { id: true, name: true, email: true, bio: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
