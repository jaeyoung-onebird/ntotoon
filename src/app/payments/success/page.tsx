'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [added, setAdded] = useState(0);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState('');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = Number(searchParams.get('amount'));

    if (!paymentKey || !orderId || !amount) {
      setError('잘못된 접근입니다');
      setStatus('error');
      return;
    }

    fetch('/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setAdded(data.added);
          setBalance(data.credits);
          setStatus('success');
        } else {
          setError(data.error || '결제 확인 실패');
          setStatus('error');
        }
      })
      .catch(() => {
        setError('네트워크 오류가 발생했습니다');
        setStatus('error');
      });
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">결제를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">결제 실패</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link href="/credits" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            다시 시도
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">결제 완료!</h1>
        <p className="text-gray-500 mb-6">크레딧이 충전되었습니다</p>

        <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-500">충전 크레딧</span>
            <span className="text-2xl font-bold text-green-600">+{added}C</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-gray-500">현재 잔액</span>
            <span className="text-xl font-semibold text-blue-700">{balance.toLocaleString()}C</span>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Link href="/credits" className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            충전 내역
          </Link>
          <Link href="/" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            웹툰 만들기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
