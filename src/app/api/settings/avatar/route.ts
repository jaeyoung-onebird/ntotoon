import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadToS3 } from '@/lib/s3';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `avatars/${userId}.${file.type.split('/')[1] || 'png'}`;
    const url = await uploadToS3(buffer, key, file.type);

    await prisma.user.update({
      where: { id: userId },
      data: { image: url },
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Failed to upload avatar:', error);
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }
}
