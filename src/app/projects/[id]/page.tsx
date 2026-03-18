'use client';

import { useEffect, useState, useCallback, use, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface PipelineProgress {
  step: string;
  progress: number;
  message: string;
  outputUrl?: string;
}

interface Panel {
  id: string;
  orderIndex: number;
  sceneDescription: string;
  rawImageUrl: string | null;
  finalImageUrl: string | null;
  dialogues: Array<{ speaker: string; text: string; type: string }>;
}

interface Episode {
  id: string;
  number: number;
  title: string | null;
  outputUrl: string | null;
  panels: Panel[];
}

interface Character {
  id: string;
  name: string;
  description: string;
  referenceSheet: string | null;
}

interface Project {
  id: string;
  title: string;
  status: string;
  novelText: string;
  characters: Character[];
  episodes: Episode[];
  jobs: Array<{ id: string; status: string; progress: number; message: string | null }>;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');

  const [project, setProject] = useState<Project | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextEpText, setNextEpText] = useState('');
  const [showNextEpForm, setShowNextEpForm] = useState(false);
  const [nextEpLoading, setNextEpLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expandElapsed, setExpandElapsed] = useState(0);

  useEffect(() => {
    if (!expanding) { setExpandElapsed(0); return; }
    setExpandElapsed(0);
    const timer = setInterval(() => setExpandElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [expanding]);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) setProject(await res.json());
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch project data
  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // SSE for generation progress
  useEffect(() => {
    const activeJobId = jobId || project?.jobs?.[0]?.id;
    if (!activeJobId) return;

    const job = project?.jobs?.find((j) => j.id === activeJobId);
    if (job?.status === 'COMPLETED' || job?.status === 'FAILED') return;

    const eventSource = new EventSource(`/api/stream/${activeJobId}`);

    eventSource.onmessage = (event) => {
      try {
        const data: PipelineProgress = JSON.parse(event.data);
        setProgress(data);

        if (data.step === 'complete') {
          eventSource.close();
          fetchProject();
        } else if (data.step === 'failed') {
          eventSource.close();
          fetchProject();
        }
      } catch {
        // ignore
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [jobId, project?.jobs, fetchProject]);

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-500">불러오는 중...</div>;
  }

  if (!project) {
    return <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-500">프로젝트를 찾을 수 없습니다</div>;
  }

  const handleExpandText = async () => {
    if (!nextEpText.trim()) return;
    setExpanding(true);
    try {
      const res = await fetch(`/api/projects/${id}/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: nextEpText,
          characters: project?.characters?.map(c => ({ name: c.name, description: c.description })) || [],
        }),
      });
      if (!res.ok) throw new Error('실패');
      const { expandedText } = await res.json();
      setNextEpText(expandedText);
    } catch {
      alert('AI 살 붙이기에 실패했습니다');
    } finally {
      setExpanding(false);
    }
  };

  const handleNextEpisode = async () => {
    if (!nextEpText.trim()) return;
    setNextEpLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novelText: nextEpText.trim() }),
      });
      if (!res.ok) throw new Error('에피소드 생성 실패');
      const { jobId: newJobId } = await res.json();
      setShowNextEpForm(false);
      setNextEpText('');
      // 새 jobId로 SSE 모니터링 시작을 위해 페이지 리로드
      window.location.href = `/projects/${id}?jobId=${newJobId}`;
    } catch {
      alert('에피소드 생성에 실패했습니다');
    } finally {
      setNextEpLoading(false);
    }
  };

  const isGenerating = progress && progress.step !== 'complete' && progress.step !== 'failed';
  const latestEpisode = project.episodes[project.episodes.length - 1];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
            ← 프로젝트 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
        </div>
      </div>

      {/* Progress indicator */}
      {isGenerating && progress && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">{progress.message}</span>
            <span className="text-sm font-semibold text-blue-600">{progress.progress}%</span>
          </div>
          <div className="w-full bg-blue-50 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="flex gap-2 mt-5">
            {[
              { key: 'analyzing', label: '텍스트 분석', icon: '1' },
              { key: 'characters', label: '캐릭터 생성', icon: '2' },
              { key: 'panels', label: '패널 그리기', icon: '3' },
              { key: 'bubbles', label: '말풍선', icon: '4' },
              { key: 'assembly', label: '조립', icon: '5' },
              { key: 'complete', label: '완료', icon: '6' },
            ].map((s, i, arr) => {
              const stepKeys = arr.map(a => a.key);
              const currentIdx = stepKeys.indexOf(progress.step);
              const thisIdx = stepKeys.indexOf(s.key);
              const isActive = progress.step === s.key;
              const isPast = thisIdx < currentIdx;
              return (
                <div key={s.key} className="flex items-center gap-2 flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-200 animate-pulse'
                          : isPast
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-400 border border-gray-200'
                      }`}
                    >
                      {isPast ? '\u2713' : s.icon}
                    </div>
                    <span className={`text-xs text-center leading-tight ${
                      isActive ? 'text-blue-600 font-semibold' : isPast ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`h-0.5 flex-1 -mt-5 ${isPast ? 'bg-blue-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Failed state */}
      {progress?.step === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <p className="text-red-700">{progress.message}</p>
        </div>
      )}

      {/* Characters */}
      {project.characters.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">캐릭터</h2>
          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin">
            {project.characters.map((char) => (
              <div
                key={char.id}
                className="flex-shrink-0 w-44 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative">
                  {char.referenceSheet ? (
                    <img
                      src={char.referenceSheet}
                      alt={char.name}
                      className="w-full h-52 object-cover"
                    />
                  ) : (
                    <div className="w-full h-52 bg-gray-100 flex items-center justify-center">
                      <span className="text-3xl text-gray-300">{char.name[0]}</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                    <h3 className="font-semibold text-white text-sm drop-shadow">{char.name}</h3>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-500 line-clamp-2">{char.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Webtoon viewer - individual panels in vertical scroll */}
      {latestEpisode?.panels && latestEpisode.panels.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">웹툰</h2>
          <div className="max-w-[600px] mx-auto space-y-4">
            {latestEpisode.panels
              .sort((a: Panel, b: Panel) => a.orderIndex - b.orderIndex)
              .map((panel: Panel) => (
                <div
                  key={panel.id}
                  className="rounded-xl overflow-hidden shadow-md bg-white"
                >
                  {(panel.finalImageUrl || panel.rawImageUrl) && (
                    <img
                      src={panel.finalImageUrl || panel.rawImageUrl || ''}
                      alt={panel.sceneDescription}
                      className="w-full"
                      loading="lazy"
                    />
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Stitched output fallback (if no panels but outputUrl exists) */}
      {latestEpisode?.outputUrl && (!latestEpisode.panels || latestEpisode.panels.length === 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">웹툰</h2>
          <div className="max-w-[600px] mx-auto rounded-xl overflow-hidden shadow-md bg-white">
            <img
              src={latestEpisode.outputUrl}
              alt={project.title}
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* 에피소드 목록 */}
      {project.episodes.length > 1 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">에피소드</h2>
          <div className="flex gap-2 flex-wrap">
            {project.episodes.map((ep) => (
              <Link key={ep.id} href={`/projects/${id}/episodes/${ep.number}`} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                ep.id === latestEpisode?.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
                {ep.number}화{ep.title ? ` - ${ep.title}` : ''}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Original text */}
      <details className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <summary className="cursor-pointer font-semibold text-gray-900">원본 텍스트</summary>
        <pre className="mt-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {project.novelText}
        </pre>
      </details>

      {/* 다음 화 만들기 */}
      {project.status === 'COMPLETED' && (
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-6">
          {!showNextEpForm ? (
            <div className="text-center">
              <p className="text-gray-500 text-sm mb-3">
                {project.episodes.length}화까지 완료 · 같은 캐릭터로 이어서 만들기
              </p>
              <button
                onClick={() => setShowNextEpForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-600/20"
              >
                {project.episodes.length + 1}화 만들기
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">{project.episodes.length + 1}화 소설 텍스트</h3>
              <textarea
                value={nextEpText}
                onChange={(e) => setNextEpText(e.target.value)}
                placeholder="다음 화 소설 텍스트를 입력하세요... (같은 캐릭터가 자동으로 유지됩니다)"
                rows={10}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y text-gray-800 leading-relaxed"
              />
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleNextEpisode}
                  disabled={nextEpLoading || expanding || nextEpText.trim().length < 10}
                  className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  {nextEpLoading ? '생성 중...' : `${project.episodes.length + 1}화 생성하기`}
                </button>
                <button
                  onClick={handleExpandText}
                  disabled={expanding || nextEpLoading || nextEpText.trim().length < 10}
                  className="px-5 py-2.5 bg-white border-2 border-blue-200 text-blue-700 font-semibold rounded-xl hover:bg-blue-50 hover:border-blue-300 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
                >
                  {expanding ? `AI 작성 중... ${Math.min(99, Math.round((expandElapsed / 15) * 100))}% (${Math.max(0, 15 - expandElapsed)}초)` : 'AI로 살 붙이기'}
                </button>
                <button
                  onClick={() => { setShowNextEpForm(false); setNextEpText(''); }}
                  className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm"
                >
                  취소
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {nextEpText.length}자 · 대충 써도 AI가 살을 붙여줍니다
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
