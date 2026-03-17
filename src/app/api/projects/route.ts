import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { title, novelText, style, styleRefs } = body;

    if (!title || !novelText) {
      return NextResponse.json(
        { error: 'title and novelText are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        title,
        novelText,
        style: style || 'drama',
        styleRefs: styleRefs ?? [],
        userId: (session.user as { id: string }).id,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

// List projects (user's own projects)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: (session.user as { id: string }).id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { episodes: true, characters: true } },
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to list projects:', error);
    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}
