'use client';
import Link from 'next/link';

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">프로젝트를 불러올 수 없습니다</h2>
        <p className="text-gray-500 text-sm mb-6">{error.message || '알 수 없는 오류가 발생했습니다.'}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all">
            다시 시도
          </button>
          <Link href="/" className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
