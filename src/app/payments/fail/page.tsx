'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const message = searchParams.get('message');

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">결제 실패</h1>
        {message && <p className="text-gray-500 mb-2">{message}</p>}
        {code && <p className="text-xs text-gray-400 mb-6">오류 코드: {code}</p>}
        <Link href="/credits" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
          다시 시도
        </Link>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense>
      <FailContent />
    </Suspense>
  );
}
