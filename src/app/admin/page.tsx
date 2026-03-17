'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalEpisodes: number;
  pendingReports: number;
  recentQa: { id: string; overall: number; createdAt: string; projectId: string }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    { label: '총 사용자', value: stats.totalUsers, href: '/admin/users' },
    { label: '총 프로젝트', value: stats.totalProjects, href: '/admin/projects' },
    { label: '총 에피소드', value: stats.totalEpisodes, href: null },
    { label: '대기 신고', value: stats.pendingReports, href: '/admin/reports' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">관리자 대시보드</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => {
          const inner = (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{card.value.toLocaleString()}</p>
            </div>
          );
          return card.href ? (
            <Link key={card.label} href={card.href} className="hover:shadow-md transition-shadow rounded-xl">
              {inner}
            </Link>
          ) : (
            <div key={card.label}>{inner}</div>
          );
        })}
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-4">최근 QA 점수</h2>
      {stats.recentQa.length === 0 ? (
        <p className="text-gray-400">QA 결과가 없습니다</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">프로젝트 ID</th>
                <th className="text-left px-4 py-3">전체 점수</th>
                <th className="text-left px-4 py-3">일시</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentQa.map(qa => (
                <tr key={qa.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono text-xs">{qa.projectId.slice(0, 8)}...</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${qa.overall >= 7 ? 'text-green-600' : qa.overall >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {qa.overall}/10
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(qa.createdAt).toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
