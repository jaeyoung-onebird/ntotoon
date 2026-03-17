'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Rule { id: string; category: string; rule: string; score: number; source: string | null }
interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalEpisodes: number;
  pendingReports: number;
  recentQa: { id: string; overall: number; characterConsistency: number; artStyle: number; noTextInImages: number; createdAt: string; projectId: string }[];
  learning: {
    goldenImages: number;
    activeRules: number;
    avgQaScore: number;
    topRules: Rule[];
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  character: 'bg-blue-100 text-blue-700',
  background: 'bg-green-100 text-green-700',
  text_removal: 'bg-red-100 text-red-700',
  style: 'bg-purple-100 text-purple-700',
  composition: 'bg-yellow-100 text-yellow-700',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(console.error);
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
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>

      {/* 기본 통계 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          ) : <div key={card.label}>{inner}</div>;
        })}
      </div>

      {/* 자가학습 현황 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">자가학습 현황</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-5">
            <p className="text-sm text-blue-600 font-medium">Golden Images</p>
            <p className="text-3xl font-bold text-blue-800 mt-1">{stats.learning.goldenImages.toLocaleString()}</p>
            <p className="text-xs text-blue-500 mt-1">고득점 패널 수집량</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-5">
            <p className="text-sm text-purple-600 font-medium">학습된 프롬프트 규칙</p>
            <p className="text-3xl font-bold text-purple-800 mt-1">{stats.learning.activeRules}</p>
            <p className="text-xs text-purple-500 mt-1">활성 개선 규칙 수</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-5">
            <p className="text-sm text-green-600 font-medium">평균 QA 점수</p>
            <p className="text-3xl font-bold text-green-800 mt-1">{stats.learning.avgQaScore || '—'}</p>
            <p className="text-xs text-green-500 mt-1">전체 에피소드 평균</p>
          </div>
        </div>

        {/* 학습된 규칙 목록 */}
        {stats.learning.topRules.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-700">상위 학습 규칙 (QA 실패에서 학습)</p>
            </div>
            <div className="divide-y divide-gray-50">
              {stats.learning.topRules.map(rule => (
                <div key={rule.id} className="px-4 py-3 flex items-start gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${CATEGORY_COLORS[rule.category] || 'bg-gray-100 text-gray-600'}`}>
                    {rule.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">{rule.rule}</p>
                    {rule.source && <p className="text-xs text-gray-400 mt-0.5 truncate">출처: {rule.source}</p>}
                  </div>
                  <span className="text-xs font-bold text-blue-600 shrink-0">+{rule.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 최근 QA 점수 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">최근 QA 점수</h2>
        {stats.recentQa.length === 0 ? (
          <p className="text-gray-400">QA 결과가 없습니다</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3">프로젝트</th>
                  <th className="text-center px-3 py-3">종합</th>
                  <th className="text-center px-3 py-3">캐릭터</th>
                  <th className="text-center px-3 py-3">스타일</th>
                  <th className="text-center px-3 py-3">텍스트</th>
                  <th className="text-left px-4 py-3">일시</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentQa.map(qa => (
                  <tr key={qa.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{qa.projectId.slice(0, 8)}…</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-bold text-base ${qa.overall >= 7 ? 'text-green-600' : qa.overall >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {qa.overall}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600">{qa.characterConsistency}</td>
                    <td className="px-3 py-3 text-center text-gray-600">{qa.artStyle}</td>
                    <td className="px-3 py-3 text-center text-gray-600">{qa.noTextInImages}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(qa.createdAt).toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
