import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = await prisma.user.findUnique({ where: { id: userId } });
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const reported = request.nextUrl.searchParams.get('reported') === 'true';

    let projects;
    if (reported) {
      const reportedProjectIds = await prisma.report.findMany({
        where: { projectId: { not: null }, status: 'PENDING' },
        select: { projectId: true },
        distinct: ['projectId'],
      });
      const ids = reportedProjectIds.map(r => r.projectId).filter(Boolean) as string[];
      projects = await prisma.project.findMany({
        where: { id: { in: ids } },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { episodes: true } },
        },
      });
    } else {
      projects = await prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { episodes: true } },
        },
      });
    }

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to get projects:', error);
    return NextResponse.json({ error: 'Failed to get projects' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = await prisma.user.findUnique({ where: { id: userId } });
    if (admin?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { projectId } = await request.json();
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    await prisma.project.delete({ where: { id: projectId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
