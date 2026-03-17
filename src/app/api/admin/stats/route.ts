import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [
      totalUsers,
      totalProjects,
      totalEpisodes,
      recentQa,
      pendingReports,
      goldenImageCount,
      activeRules,
      avgQaScore,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.episode.count(),
      prisma.qaResult.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, overall: true, characterConsistency: true, artStyle: true, noTextInImages: true, createdAt: true, projectId: true },
      }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.goldenImage.count(),
      prisma.promptImprovement.findMany({
        where: { active: true },
        orderBy: { score: 'desc' },
        take: 10,
        select: { id: true, category: true, rule: true, score: true, source: true },
      }),
      prisma.qaResult.aggregate({ _avg: { overall: true } }),
    ]);

    return NextResponse.json({
      totalUsers,
      totalProjects,
      totalEpisodes,
      pendingReports,
      recentQa,
      // 자가학습 현황
      learning: {
        goldenImages: goldenImageCount,
        activeRules: activeRules.length,
        avgQaScore: Math.round((avgQaScore._avg.overall ?? 0) * 10) / 10,
        topRules: activeRules,
      },
    });
  } catch (error) {
    console.error('Failed to get admin stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
