'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">문제가 발생했습니다</h2>
        <p className="text-gray-500 text-sm mb-6">{error.message || '알 수 없는 오류가 발생했습니다.'}</p>
        <button onClick={reset} className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all">
          다시 시도
        </button>
      </div>
    </div>
  );
}
