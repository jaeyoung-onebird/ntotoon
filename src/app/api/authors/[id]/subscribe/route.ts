import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: authorId } = await params;
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    const subscriberCount = await prisma.subscription.count({
      where: { authorId },
    });

    let isSubscribed = false;
    if (userId) {
      const sub = await prisma.subscription.findUnique({
        where: { subscriberId_authorId: { subscriberId: userId, authorId } },
      });
      isSubscribed = !!sub;
    }

    return NextResponse.json({ isSubscribed, subscriberCount });
  } catch (error) {
    console.error('Failed to check subscription:', error);
    return NextResponse.json({ error: 'Failed to check subscription' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: authorId } = await params;

    if (userId === authorId) {
      return NextResponse.json({ error: 'Cannot subscribe to yourself' }, { status: 400 });
    }

    const author = await prisma.user.findUnique({ where: { id: authorId } });
    if (!author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }

    await prisma.subscription.create({
      data: { subscriberId: userId, authorId },
    });

    const subscriberCount = await prisma.subscription.count({ where: { authorId } });

    return NextResponse.json({ isSubscribed: true, subscriberCount });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Already subscribed' }, { status: 409 });
    }
    console.error('Failed to subscribe:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: authorId } = await params;

    await prisma.subscription.delete({
      where: { subscriberId_authorId: { subscriberId: userId, authorId } },
    });

    const subscriberCount = await prisma.subscription.count({ where: { authorId } });

    return NextResponse.json({ isSubscribed: false, subscriberCount });
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
