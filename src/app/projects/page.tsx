'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: string;
  title: string;
  status: string;
  style: string;
  createdAt: string;
  _count: {
    episodes: number;
    characters: number;
  };
}

export default function ProjectsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status !== 'authenticated') return;

    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status, router]);

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    ANALYZING: 'bg-yellow-100 text-yellow-700',
    GENERATING: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: '대기',
    ANALYZING: '분석 중',
    GENERATING: '생성 중',
    COMPLETED: '완료',
    FAILED: '실패',
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-500">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">내 프로젝트</h1>
        <Link
          href="/create"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          새 웹툰 만들기
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">아직 프로젝트가 없습니다</p>
          <Link href="/create" className="text-blue-600 hover:underline">
            첫 번째 웹툰을 만들어보세요
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}/episodes/1`}
              className="block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{project.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    캐릭터 {project._count.characters}명 · 에피소드 {project._count.episodes}개
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[project.status] || 'bg-gray-100'}`}>
                    {statusLabels[project.status] || project.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
