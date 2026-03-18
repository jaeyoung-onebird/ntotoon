'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PipelineProgress {
  step: string;
  progress: number;
  message: string;
  panelUrl?: string;
  characterUrl?: string;
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
  novelText: string | null;
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
  userId: string;
  user: { name: string; id: string };
  characters: Character[];
  episodes: Episode[];
  jobs: Array<{ id: string; status: string; progress: number; message: string | null }>;
}

interface CommentData {
  id: string;
  text: string;
  createdAt: string;
  user: { name: string | null; id: string };
}

export default function EpisodePage({ params }: { params: Promise<{ id: string; num: string }> }) {
  const { id, num } = use(params);
  const episodeNum = parseInt(num);
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const router = useRouter();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const jobId = searchParams.get('jobId');

  const [project, setProject] = useState<Project | null>(null);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [nextEpText, setNextEpText] = useState('');
  const [showNextEpForm, setShowNextEpForm] = useState(false);
  const [nextEpLoading, setNextEpLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expandElapsed, setExpandElapsed] = useState(0);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteText, setRewriteText] = useState('');
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentText, setCommentText] = useState('');
  const [eta, setEta] = useState<string>('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [livePanels, setLivePanels] = useState<string[]>([]);
  const [liveChars, setLiveChars] = useState<string[]>([]);

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

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Load ratings (에피소드별)
  const currentEpId = project?.episodes?.find(e => e.number === episodeNum)?.id;
  useEffect(() => {
    if (!currentEpId) return;
    fetch(`/api/projects/${id}/ratings?episodeId=${currentEpId}`)
      .then(r => r.json())
      .then(data => {
        setRatingAvg(data.average || 0);
        setRatingCount(data.count || 0);
        if (data.userRating) setUserRating(data.userRating);
      })
      .catch(console.error);
  }, [id, currentEpId]);

  // Load comments (에피소드별)
  useEffect(() => {
    if (!project) return;
    const epId = project.episodes?.find(e => e.number === episodeNum)?.id;
    if (!epId) return;
    fetch(`/api/projects/${id}/comments?episodeId=${epId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setComments(data); })
      .catch(console.error);
  }, [id, project, episodeNum]);

  const handleRate = async (score: number) => {
    if (!session?.user) { alert('로그인이 필요합니다'); window.location.href = '/login'; return; }
    setUserRating(score);
    try {
      await fetch(`/api/projects/${id}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, episodeId: currentEpId }),
      });
      const res = await fetch(`/api/projects/${id}/ratings?episodeId=${currentEpId}`);
      const data = await res.json();
      setRatingAvg(data.average || 0);
      setRatingCount(data.count || 0);
    } catch { console.error('Rating failed'); }
  };

  const handleComment = async () => {
    if (!session?.user) { alert('로그인이 필요합니다'); window.location.href = '/login'; return; }
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText.trim(), episodeId: episode?.id }),
      });
      if (!res.ok) {
        if (res.status === 401) { alert('로그인이 필요합니다'); return; }
        throw new Error('Failed');
      }
      const newComment = await res.json();
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
    } catch { alert('댓글 작성 실패'); }
    finally { setCommentLoading(false); }
  };

  // SSE with auto-reconnect
  useEffect(() => {
    const activeJobId = jobId || project?.jobs?.[0]?.id;
    if (!activeJobId) return;
    const job = project?.jobs?.find((j) => j.id === activeJobId);
    if (job?.status === 'COMPLETED' || job?.status === 'FAILED') return;

    let es: EventSource | null = null;
    let ticker: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    let retryCount = 0;
    const MAX_RETRIES = 10;
    const realProgressRef = { current: 0 };
    const sseStartTime = Date.now();

    function connect() {
      if (cancelled) return;
      es = new EventSource(`/api/stream/${activeJobId}`);

      ticker = setInterval(() => {
        setProgress(prev => {
          if (!prev || prev.step === 'complete' || prev.step === 'failed') return prev;
          const ceiling = Math.min(realProgressRef.current + 8, 99);
          if (prev.progress >= ceiling) return prev;
          const newProgress = Math.round((prev.progress + 0.2) * 10) / 10;

          const elapsed = (Date.now() - sseStartTime) / 1000;
          if (newProgress > 5) {
            const totalEstimate = elapsed / (newProgress / 100);
            const remaining = Math.max(0, totalEstimate - elapsed);
            if (remaining < 60) {
              setEta(`약 ${Math.ceil(remaining)}초 남음`);
            } else {
              setEta(`약 ${Math.ceil(remaining / 60)}분 남음`);
            }
          }

          return { ...prev, progress: newProgress };
        });
      }, 400);

      es.onmessage = (event) => {
        try {
          const data: PipelineProgress = JSON.parse(event.data);
          retryCount = 0; // 메시지 수신 성공 → 재시도 카운트 리셋
          realProgressRef.current = data.progress;
          setProgress(data);
          setLogs(prev => {
            const msg = `[${new Date().toLocaleTimeString('ko-KR')}] ${data.message}`;
            if (prev[prev.length - 1] === msg) return prev;
            return [...prev.slice(-20), msg];
          });
          if (data.panelUrl) {
            setLivePanels(prev => prev.includes(data.panelUrl!) ? prev : [...prev, data.panelUrl!]);
          }
          if (data.characterUrl) {
            setLiveChars(prev => prev.includes(data.characterUrl!) ? prev : [...prev, data.characterUrl!]);
          }
          if (data.step === 'complete' || data.step === 'failed') {
            cleanup();
            setLivePanels([]);
            setLiveChars([]);
            fetchProject();
          }
        } catch {}
      };

      es.onerror = () => {
        // 연결 끊김 → 정리 후 재연결 시도
        if (es) es.close();
        if (ticker) clearInterval(ticker);
        es = null;
        ticker = null;

        if (cancelled) return;

        retryCount++;
        if (retryCount > MAX_RETRIES) {
          // 최대 재시도 초과 → DB에서 최종 상태 확인
          fetch(`/api/projects/${id}`)
            .then(r => r.json())
            .then(p => {
              if (p.status === 'COMPLETED') {
                setProgress({ step: 'complete', progress: 100, message: '완료!' });
                fetchProject();
              } else if (p.status === 'FAILED') {
                setProgress(prev => prev ? { ...prev, step: 'failed', message: '생성 실패' } : null);
              } else {
                // 아직 진행 중이면 한번 더 시도
                retryCount = 0;
                setTimeout(connect, 3000);
              }
            })
            .catch(() => {
              setProgress(prev => prev ? { ...prev, step: 'failed', message: '연결이 끊어졌습니다' } : null);
            });
          return;
        }

        // 재연결 (점진적 대기: 1초, 2초, 3초...)
        const delay = Math.min(retryCount * 1000, 5000);
        setLogs(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString('ko-KR')}] 연결 재시도 중... (${retryCount}/${MAX_RETRIES})`]);
        setTimeout(connect, delay);
      };
    }

    function cleanup() {
      cancelled = true;
      if (es) es.close();
      if (ticker) clearInterval(ticker);
    }

    connect();
    return cleanup;
  }, [jobId, project?.jobs, fetchProject, id]);

  const handleRewrite = async () => {
    if (!rewriteText.trim()) return;
    setNextEpLoading(true);
    try {
      // 같은 에피소드를 새 텍스트로 재생성
      const res = await fetch(`/api/projects/${id}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novelText: rewriteText.trim() }),
      });
      if (!res.ok) throw new Error('재작성 실패');
      const { jobId: newJobId, episodeNumber } = await res.json();
      setRewriting(false);
      setRewriteText('');
      window.location.href = `/projects/${id}/episodes/${episodeNumber}?jobId=${newJobId}`;
    } catch { alert('재작성 실패'); }
    finally { setNextEpLoading(false); }
  };

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
    } catch { alert('AI 살 붙이기 실패'); }
    finally { setExpanding(false); }
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
      const { jobId: newJobId, episodeNumber } = await res.json();
      setShowNextEpForm(false);
      setNextEpText('');
      window.location.href = `/projects/${id}/episodes/${episodeNumber}?jobId=${newJobId}`;
    } catch { alert('에피소드 생성 실패'); }
    finally { setNextEpLoading(false); }
  };

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-500">불러오는 중...</div>;
  if (!project) return <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-500">프로젝트를 찾을 수 없습니다</div>;

  const episode = project.episodes.find(ep => ep.number === episodeNum);
  const isGenerating = progress && progress.step !== 'complete' && progress.step !== 'failed';
  const isLatestEpisode = episodeNum === Math.max(...project.episodes.map(e => e.number));
  const isOwner = session?.user && (session.user as { id?: string }).id === project.userId;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/projects/${id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
            ← {project.title}
          </Link>
          {editingTitle && isOwner ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetch(`/api/projects/${id}/episodes/${episode?.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: titleInput }),
                    }).then(() => { fetchProject(); setEditingTitle(false); });
                  } else if (e.key === 'Escape') setEditingTitle(false);
                }}
              />
              <button
                onClick={() => {
                  fetch(`/api/projects/${id}/episodes/${episode?.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: titleInput }),
                  }).then(() => { fetchProject(); setEditingTitle(false); });
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >저장</button>
              <button onClick={() => setEditingTitle(false)} className="text-sm text-gray-400 hover:text-gray-600">취소</button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">{episodeNum}화{episode?.title ? ` - ${episode.title}` : ''}</h1>
          )}
        </div>
        {isOwner && !isGenerating && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setTitleInput(episode?.title || ''); setEditingTitle(true); }}
              className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700 transition-all"
            >
              수정
            </button>
            <button
              onClick={async () => {
                if (!confirm(`${episodeNum}화를 삭제하시겠습니까?`)) return;
                const res = await fetch(`/api/projects/${id}/episodes/${episode?.id}`, { method: 'DELETE' });
                if (res.ok) {
                  if (episodeNum > 1) router.push(`/projects/${id}/episodes/${episodeNum - 1}`);
                  else router.push(`/projects/${id}`);
                } else alert('삭제 실패');
              }}
              className="px-3 py-1.5 text-sm text-red-400 border border-red-200 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {/* 에피소드 네비게이션 */}
      <div className="flex gap-2 flex-wrap mb-6">
        {project.episodes
          .sort((a, b) => a.number - b.number)
          .map((ep) => (
          <Link
            key={ep.id}
            href={`/projects/${id}/episodes/${ep.number}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ep.number === episodeNum
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {ep.number}화
          </Link>
        ))}
      </div>

      {/* 진행 표시 + 메이킹 로그 */}
      {isGenerating && progress && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">{progress.message}</span>
            <span className="text-sm font-semibold text-blue-600">{Math.round(progress.progress)}%</span>
          </div>
          {eta && (
            <p className="text-xs text-gray-400 mb-2">{eta}</p>
          )}
          <div className="w-full bg-blue-50 rounded-full h-3 mb-4">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          {/* 메이킹 로그 */}
          {logs.length > 0 && (
            <div className="led-panel rounded-lg p-3 max-h-40 overflow-y-auto border border-white/10" style={{ boxShadow: '0 0 20px rgba(255,255,255,0.03) inset' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ boxShadow: '0 0 8px #fff, 0 0 16px rgba(255,255,255,0.4)' }} />
                <span className="text-[10px] text-white/80 font-mono tracking-widest uppercase">System Log</span>
              </div>
              {logs.map((log, i) => (
                <p
                  key={i}
                  className="text-[11px] font-mono leading-relaxed"
                  style={{
                    color: i === logs.length - 1 ? '#ffffff' : '#555555',
                    textShadow: i === logs.length - 1 ? '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.3)' : 'none',
                  }}
                >
                  {i === logs.length - 1 ? '▸ ' : '  '}{log}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 생성 중 실시간 미리보기 */}
      {isGenerating && (liveChars.length > 0 || livePanels.length > 0) && (
        <div className="mb-8">
          {/* 캐릭터 미리보기 */}
          {liveChars.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">캐릭터 생성 완료</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {liveChars.map((url, i) => (
                  <img key={i} src={url} alt={`캐릭터 ${i + 1}`} className="w-28 h-40 object-cover rounded-lg shadow-md flex-shrink-0 animate-fade-in" />
                ))}
              </div>
            </div>
          )}
          {/* 패널 미리보기 */}
          {livePanels.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">패널 생성 중 ({livePanels.length}장 완성)</h3>
              <div className="max-w-[600px] mx-auto space-y-3">
                {livePanels.map((url, i) => (
                  <div key={i} className="rounded-xl overflow-hidden shadow-md bg-white animate-fade-in">
                    <img src={url} alt={`패널 ${i + 1}`} className="w-full" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 생성 중 소설 텍스트 읽기 */}
      {isGenerating && project.novelText && (
        <div className="max-w-5xl mx-auto mb-8 bg-white border-2 border-gray-200 p-8">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">이야기 원작</h3>
          <div className="text-[15px] text-gray-900 whitespace-pre-wrap leading-[1.9] max-h-[480px] overflow-y-auto" style={{ fontFamily: '"NanumSquareRound", "Apple SD Gothic Neo", sans-serif' }}>
            {project.novelText}
          </div>
        </div>
      )}

      {/* 화 제목 + 패널 뷰어 */}
      {episode?.panels && episode.panels.length > 0 && (
        <div className="mb-8">
          <div className="max-w-[600px] mx-auto">
            <div className="text-center py-6 mb-4">
              <p className="text-sm text-blue-500 font-semibold mb-1">제 {episodeNum}화</p>
              <h2 className="text-2xl font-bold text-gray-900">{episode.title || project.title}</h2>
            </div>
          </div>
          <div className="max-w-[600px] mx-auto space-y-4">
            {episode.panels
              .sort((a: Panel, b: Panel) => a.orderIndex - b.orderIndex)
              .map((panel: Panel) => (
                <div key={panel.id} className="rounded-xl overflow-hidden shadow-md bg-white">
                  {(panel.finalImageUrl || panel.rawImageUrl) && (
                    <img
                      src={panel.finalImageUrl || panel.rawImageUrl || ''}
                      alt={panel.sceneDescription}
                      className="w-full webtoon-panel"
                      loading="lazy"
                      onContextMenu={(e) => e.preventDefault()}
                      draggable={false}
                    />
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 이전화 / 다음화 */}
      <div className="flex items-center justify-between max-w-[600px] mx-auto py-4 mb-4">
        {episodeNum > 1 ? (
          <Link
            href={`/projects/${id}/episodes/${episodeNum - 1}`}
            className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10.354 3.354a.5.5 0 00-.708-.708l-5 5a.5.5 0 000 .708l5 5a.5.5 0 00.708-.708L5.707 8l4.647-4.646z"/></svg>
            이전화
          </Link>
        ) : <div />}
        <span className="text-sm text-gray-400 font-medium">{episodeNum} / {Math.max(...project.episodes.map(e => e.number))}화</span>
        {episodeNum < Math.max(...project.episodes.map(e => e.number)) ? (
          <Link
            href={`/projects/${id}/episodes/${episodeNum + 1}`}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all"
          >
            다음화
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5.646 3.354a.5.5 0 01.708-.708l5 5a.5.5 0 010 .708l-5 5a.5.5 0 01-.708-.708L10.293 8 5.646 3.354z"/></svg>
          </Link>
        ) : <div />}
      </div>

      {/* 공유하기 */}
      <div className="max-w-[600px] mx-auto mb-6">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => {
              const url = `${window.location.origin}/projects/${id}/episodes/${episodeNum}`;
              navigator.clipboard.writeText(url).then(() => alert('링크가 복사되었습니다!')).catch(() => {});
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            링크 복사
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/projects/${id}/episodes/${episodeNum}`;
              const text = `${project.title} ${episodeNum}화`;
              window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            X
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/projects/${id}/episodes/${episodeNum}`;
              const text = `${project.title} ${episodeNum}화`;
              window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1877F2] text-white text-sm font-medium rounded-xl hover:bg-[#166FE5] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/projects/${id}/episodes/${episodeNum}`;
              const text = `${project.title} ${episodeNum}화`;
              window.open(`https://story.kakao.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FEE500] text-[#3C1E1E] text-sm font-medium rounded-xl hover:bg-[#FDD835] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-5.52 0-10 3.59-10 8 0 2.83 1.88 5.32 4.72 6.73-.21.78-.76 2.82-.87 3.26-.14.55.2.54.42.39.17-.12 2.71-1.84 3.8-2.59.62.09 1.26.14 1.93.14 5.52 0 10-3.59 10-8s-4.48-8-10-8z"/></svg>
            카카오
          </button>
        </div>
      </div>

      {/* 재작성 (본인만) */}
      {isOwner && !isGenerating && (
        <div className="mb-6">
          {!rewriting ? (
            <div className="text-center">
              <button
                onClick={() => { setRewriting(true); setRewriteText(episode?.novelText || project.novelText || ''); }}
                className="px-5 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-700 transition-all"
              >
                이 화 재작성하기
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">{episodeNum}화 재작성</h3>
              <textarea
                value={rewriteText}
                onChange={(e) => setRewriteText(e.target.value)}
                rows={10}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y text-gray-800 leading-relaxed"
              />
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleRewrite}
                  disabled={nextEpLoading || expanding || rewriteText.trim().length < 10}
                  className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                >
                  {nextEpLoading ? '생성 중...' : '이 텍스트로 재생성'}
                </button>
                <button
                  onClick={async () => {
                    if (!rewriteText.trim()) return;
                    setExpanding(true);
                    try {
                      const res = await fetch(`/api/projects/${id}/expand`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          text: rewriteText,
                          characters: project?.characters?.map(c => ({ name: c.name, description: c.description })) || [],
                        }),
                      });
                      if (res.ok) { const { expandedText } = await res.json(); setRewriteText(expandedText); }
                    } catch {} finally { setExpanding(false); }
                  }}
                  disabled={expanding || nextEpLoading || rewriteText.trim().length < 10}
                  className="px-5 py-2.5 bg-white border-2 border-blue-200 text-blue-700 font-semibold rounded-xl hover:bg-blue-50 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
                >
                  {expanding ? `AI 작성 중... (${expandElapsed}초) · 약 1분 소요` : 'AI로 내용 추가'}
                </button>
                <button
                  onClick={() => { setRewriting(false); setRewriteText(''); }}
                  className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 작가 정보 */}
      {project.user && (
        <div className="border-t border-gray-100 pt-4 mt-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
            {(project.user.name || '?')[0]}
          </div>
          <div>
            <Link href={`/authors/${project.userId}`} className="font-semibold text-gray-900 hover:text-blue-600">
              {project.user.name || '익명'}
            </Link>
            <p className="text-xs text-gray-400">작가</p>
          </div>
        </div>
      )}

      {/* 별점 */}
      <div className="mt-6 bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">평점</h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-2xl transition-colors"
              >
                <span className={
                  (hoverRating || userRating || 0) >= star
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }>
                  ★
                </span>
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-500">
            {ratingAvg > 0 ? `${ratingAvg} (${ratingCount}명)` : '아직 평가 없음'}
          </span>
        </div>
      </div>

      {/* 댓글 */}
      <div className="mt-6 bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">댓글 {comments.length > 0 && `(${comments.length})`}</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
            placeholder="댓글을 입력하세요..."
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-800"
          />
          <button
            onClick={handleComment}
            disabled={commentLoading || !commentText.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            {commentLoading ? '...' : '댓글 작성'}
          </button>
        </div>
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 text-xs font-bold flex-shrink-0">
                {(comment.user.name || '?')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{comment.user.name || '익명'}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.createdAt).toLocaleDateString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{comment.text}</p>
                {/* 본인 댓글만 수정/삭제 */}
                {session?.user && (session.user as { id?: string }).id === comment.user.id && (
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={async () => {
                        const newText = prompt('댓글 수정', comment.text);
                        if (!newText || newText === comment.text) return;
                        await fetch(`/api/projects/${id}/comments`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ commentId: comment.id, text: newText }),
                        });
                        setComments(prev => prev.map(c => c.id === comment.id ? { ...c, text: newText } : c));
                      }}
                      className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('댓글을 삭제하시겠습니까?')) return;
                        await fetch(`/api/projects/${id}/comments`, {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ commentId: comment.id }),
                        });
                        setComments(prev => prev.filter(c => c.id !== comment.id));
                      }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
          )}
        </div>
      </div>

      {/* (이전화/다음화는 패널 바로 아래에 위치) */}

      {/* 다음 화 만들기 (본인 + 최신 에피소드에서만) */}
      {isOwner && isLatestEpisode && (project.status === 'COMPLETED' || project.status === 'FAILED') && (
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-6 mt-8">
          {!showNextEpForm ? (
            <div className="text-center">
              <p className="text-gray-500 text-sm mb-3">
                {episodeNum}화 완료 · 같은 캐릭터로 이어서 만들기
              </p>
              <button
                onClick={() => setShowNextEpForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-600/20"
              >
                {episodeNum + 1}화 만들기
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">{episodeNum + 1}화 소설 텍스트</h3>
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
                  {nextEpLoading ? '생성 중...' : `${episodeNum + 1}화 생성하기`}
                </button>
                <button
                  onClick={handleExpandText}
                  disabled={expanding || nextEpLoading || nextEpText.trim().length < 10}
                  className="px-5 py-2.5 bg-white border-2 border-blue-200 text-blue-700 font-semibold rounded-xl hover:bg-blue-50 hover:border-blue-300 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
                >
                  {expanding ? `AI 작성 중... (${expandElapsed}초) · 약 1분 소요` : 'AI로 살 붙이기'}
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
