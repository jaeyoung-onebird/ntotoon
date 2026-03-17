'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AdminProject {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  _count: { episodes: number };
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReported, setShowReported] = useState(false);

  const fetchProjects = (reported: boolean) => {
    setLoading(true);
    fetch(`/api/admin/projects${reported ? '?reported=true' : ''}`)
      .then(r => r.json())
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects(showReported);
  }, [showReported]);

  const handleDelete = async (projectId: string) => {
    if (!window.confirm('이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    const res = await fetch('/api/admin/projects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });

    if (res.ok) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">프로젝트 관리</h1>
        <button
          onClick={() => setShowReported(!showReported)}
          className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
            showReported
              ? 'bg-red-50 text-red-700 hover:bg-red-100'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {showReported ? '신고된 프로젝트만' : '전체 보기'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">제목</th>
                <th className="text-left px-4 py-3">상태</th>
                <th className="text-left px-4 py-3">작가</th>
                <th className="text-left px-4 py-3">에피소드</th>
                <th className="text-left px-4 py-3">생성일</th>
                <th className="text-left px-4 py-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/projects/${project.id}`} className="hover:text-blue-600">
                      {project.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {project.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <Link href={`/authors/${project.user.id}`} className="hover:text-blue-600">
                      {project.user.name || project.user.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{project._count.episodes}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-xs font-medium px-3 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    프로젝트가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
