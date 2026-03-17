import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadToS3 } from '@/lib/s3';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) return NextResponse.json({ urls: [] });

    const urls: string[] = [];
    for (const file of files.slice(0, 3)) {
      if (!file.type.startsWith('image/')) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.type.split('/')[1] || 'png';
      const key = `style-refs/${userId}/${randomUUID()}.${ext}`;
      const url = await uploadToS3(buffer, key);
      urls.push(url);
    }

    return NextResponse.json({ urls });
  } catch (error) {
    console.error('Style ref upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
