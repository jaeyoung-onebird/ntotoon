import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = await prisma.user.findUnique({ where: { id: userId } });
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        credits: true,
        role: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to get users:', error);
    return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = await prisma.user.findUnique({ where: { id: userId } });
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { targetUserId, action } = await request.json();
    if (!targetUserId || !['BAN', 'UNBAN'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: 'Cannot ban yourself' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: action === 'BAN' ? 'BANNED' : 'USER' },
      select: { id: true, role: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
