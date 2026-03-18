'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Panel {
  id: string;
  finalImageUrl: string | null;
  rawImageUrl: string | null;
}

interface Episode {
  id: string;
  number: number;
  title: string | null;
  panels: Panel[];
}

interface Character {
  name: string;
  referenceSheet: string | null;
}

interface Project {
  id: string;
  title: string;
  style: string;
  createdAt: string;
  userId: string;
  user: { name: string | null };
  characters: Character[];
  episodes: Episode[];
  _count: { episodes: number };
  ratingAvg: number;
  ratingCount: number;
}

export default function FeedPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<{ checkedIn: boolean; streak: number; reward: number } | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    fetch('/api/feed')
      .then(r => r.json())
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetch('/api/attendance').then(r => r.json()).then(setAttendance).catch(console.error);
    }
  }, [session]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res = await fetch('/api/attendance', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAttendance(prev => prev ? { ...prev, checkedIn: true, streak: (prev.streak || 0) + 1 } : prev);
        alert(`출석 완료! ${data.reward}C 지급 (잔액: ${data.balance}C)`);
      } else if (res.status === 409) {
        alert('이미 출석했습니다!');
      }
    } catch { alert('출석체크 실패'); }
    finally { setCheckingIn(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 배너 */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <Link
                href={session?.user ? "/create" : "/login"}
                className="inline-block px-4 sm:px-6 py-2 sm:py-3 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg text-sm sm:text-base whitespace-nowrap mb-3 sm:hidden"
              >
                + 웹툰 만들기
              </Link>
              <h1 className="text-xl sm:text-3xl font-extrabold mb-1 sm:mb-2">내 이야기를 웹툰으로</h1>
              <p className="text-blue-200 text-xs sm:text-sm">이야기만 쓰면 AI가 웹툰으로 만들어드려요.</p>
            </div>
            <Link
              href={session?.user ? "/create" : "/login"}
              className="hidden sm:inline-block px-6 py-3 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg whitespace-nowrap"
            >
              + 웹툰 만들기
            </Link>
          </div>
        </div>
      </div>

      {/* 피드 */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">아직 웹툰이 없어요</h2>
            <p className="text-gray-500 mb-6">첫 번째 웹툰을 만들어보세요!</p>
            <Link
              href={session?.user ? "/create" : "/login"}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all"
            >
              웹툰 만들기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {projects.map((project) => {
              const firstPanel = project.episodes?.[0]?.panels?.[0];
              const thumbnail = firstPanel?.finalImageUrl || firstPanel?.rawImageUrl;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/episodes/1`}
                  className="group aspect-square bg-white overflow-hidden shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-300 flex flex-col"
                >
                  <div className="flex-1 overflow-hidden bg-gray-50">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5 bg-white flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-gray-900 text-sm leading-tight truncate group-hover:text-blue-600 transition-colors">
                        {project.title}
                      </h3>
                      {project.ratingAvg > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-yellow-500 font-semibold flex-shrink-0">
                          <span>★</span>{project.ratingAvg.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400 truncate">{project.user?.name || '익명'}</p>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{project._count.episodes}화</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
