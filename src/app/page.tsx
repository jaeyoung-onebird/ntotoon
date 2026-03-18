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
  characters: Character[];
  episodes: Episode[];
  _count: { episodes: number };
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
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold mb-2">내 이야기를 웹툰으로</h1>
            <p className="text-blue-200 text-sm">이야기만 쓰면 AI가 웹툰으로 만들어드려요. 누구나 작가가 될 수 있습니다.</p>
          </div>
          <div className="flex items-center gap-3">
            {session?.user && attendance && !attendance.checkedIn && (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="px-5 py-3 bg-yellow-400 text-yellow-900 font-bold rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-all shadow-lg animate-pulse"
              >
                {checkingIn ? '...' : `출석체크 +${attendance.reward}C`}
              </button>
            )}
            {session?.user && attendance?.checkedIn && (
              <div className="px-5 py-3 bg-white/20 backdrop-blur text-white font-semibold rounded-xl text-sm">
                출석 완료 {attendance.streak > 1 && `(${attendance.streak}일 연속)`}
              </div>
            )}
            <Link
              href="/create"
              className="px-6 py-3 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg"
            >
              + 웹툰 만들기
            </Link>
          </div>
        </div>
      </div>

      {/* 피드 */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">아직 웹툰이 없어요</h2>
            <p className="text-gray-500 mb-6">첫 번째 웹툰을 만들어보세요!</p>
            <Link
              href="/create"
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all"
            >
              웹툰 만들기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              // 첫 에피소드의 첫 패널 이미지를 썸네일로
              const firstPanel = project.episodes?.[0]?.panels?.[0];
              const thumbnail = firstPanel?.finalImageUrl || firstPanel?.rawImageUrl;
              const charNames = project.characters?.map(c => c.name).join(', ');

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/episodes/1`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100"
                >
                  {/* 썸네일 */}
                  <div className="aspect-[3/4] overflow-hidden bg-gray-100 relative">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                    {/* 에피소드 수 뱃지 */}
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                      {project._count.episodes}화
                    </div>
                  </div>

                  {/* 정보 */}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 group-hover:text-blue-600 transition-colors">
                      {project.title}
                    </h3>
                    {charNames && (
                      <p className="text-xs text-gray-400 mb-2">등장인물: {charNames}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                      <span className="text-xs text-blue-500 font-medium group-hover:underline">
                        읽기 →
                      </span>
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
