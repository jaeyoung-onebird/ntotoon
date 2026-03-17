'use client';

import { useEffect, useState, use } from 'react';
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
  panels: Panel[];
}

interface Project {
  id: string;
  title: string;
  createdAt: string;
  episodes: Episode[];
  _count: { episodes: number };
}

interface Author {
  id: string;
  name: string | null;
  bio: string | null;
  image: string | null;
  createdAt: string;
  subscriberCount?: number;
}

export default function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const [author, setAuthor] = useState<Author | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [subLoading, setSubLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/authors/${id}`)
      .then(r => r.json())
      .then(data => {
        setAuthor(data.author);
        setProjects(data.projects || []);
        if (data.author?.subscriberCount !== undefined) {
          setSubscriberCount(data.author.subscriberCount);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch(`/api/authors/${id}/subscribe`)
      .then(r => r.json())
      .then(data => {
        setIsSubscribed(data.isSubscribed);
        setSubscriberCount(data.subscriberCount);
      })
      .catch(console.error);
  }, [id]);

  const handleSubscribe = async () => {
    if (!currentUserId) return;
    setSubLoading(true);
    try {
      const res = await fetch(`/api/authors/${id}/subscribe`, {
        method: isSubscribed ? 'DELETE' : 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setIsSubscribed(data.isSubscribed);
        setSubscriberCount(data.subscriberCount);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!author) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        작가를 찾을 수 없습니다
      </div>
    );
  }

  const authorName = author.name || '익명 작가';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 프로필 헤더 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center gap-5">
            {author.image ? (
              <img
                src={author.image}
                alt={authorName}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
                {authorName[0]}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{authorName}</h1>
              {author.bio && (
                <p className="text-gray-500 mt-1">{author.bio}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                <span>
                  가입일: {new Date(author.createdAt).toLocaleDateString('ko-KR')}
                </span>
                <span>
                  작품 {projects.length}개
                </span>
                <span>
                  구독자 {subscriberCount}명
                </span>
              </div>
            </div>
            {currentUserId && currentUserId !== id && (
              <button
                onClick={handleSubscribe}
                disabled={subLoading}
                className={`ml-auto px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isSubscribed
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {subLoading ? '...' : isSubscribed ? '구독중' : '구독'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 작품 그리드 */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-lg font-bold text-gray-900 mb-6">완성된 작품</h2>
        {projects.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            아직 완성된 작품이 없습니다
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const firstPanel = project.episodes?.[0]?.panels?.[0];
              const thumbnail = firstPanel?.finalImageUrl || firstPanel?.rawImageUrl;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/episodes/1`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100"
                >
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
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                      {project._count.episodes}화
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 group-hover:text-blue-600 transition-colors">
                      {project.title}
                    </h3>
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
