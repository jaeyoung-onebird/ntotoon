'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface CreditLog {
  id: string;
  amount: number;
  balance: number;
  reason: string;
  createdAt: string;
}

const PRESETS = [
  { credits: 50,  price: 5000,  discount: 0,  label: '체험용' },
  { credits: 100, price: 9000,  discount: 10, label: '인기' },
  { credits: 300, price: 25500, discount: 15, label: '추천' },
  { credits: 500, price: 40000, discount: 20, label: '최대 할인' },
];

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

export default function CreditsPage() {
  const { data: session, status } = useSession();
  const [credits, setCredits] = useState(0);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [charging, setCharging] = useState<number | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/credits');
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
        setLogs(data.logs);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchCredits();
    else if (status === 'unauthenticated') setLoading(false);
  }, [status, fetchCredits]);

  const handleCharge = async (amount: number, price: number) => {
    if (!session?.user) return;
    setCharging(amount);

    try {
      // 주문 생성
      const prepareRes = await fetch('/api/payments/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: amount }),
      });
      if (!prepareRes.ok) {
        alert('주문 생성 실패');
        return;
      }
      const { orderId } = await prepareRes.json();

      if (TOSS_CLIENT_KEY) {
        // 토스페이먼츠 SDK 동적 로드
        const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
        const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
        const payment = tossPayments.payment({
          customerKey: (session.user as { id: string }).id,
        });

        await payment.requestPayment({
          method: 'CARD',
          amount: { currency: 'KRW', value: price },
          orderId,
          orderName: `엔투툰 크레딧 ${amount}C`,
          successUrl: `${window.location.origin}/payments/success`,
          failUrl: `${window.location.origin}/payments/fail`,
        });
        // requestPayment는 리디렉트하므로 이후 코드는 실행 안됨
      } else {
        // 개발 모드: 토스 없이 직접 confirm
        const confirmRes = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentKey: `dev-${Date.now()}`, orderId, amount: price }),
        });
        if (confirmRes.ok) {
          const data = await confirmRes.json();
          setCredits(data.credits);
          await fetchCredits();
          alert(`${amount}C 충전 완료! (테스트 모드)`);
        } else {
          const err = await confirmRes.json();
          alert(err.error || '충전 실패');
        }
      }
    } catch (err) {
      console.error('결제 오류:', err);
    } finally {
      setCharging(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">로그인이 필요합니다</p>
          <Link href="/login" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            로그인
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Balance Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-8 mb-8">
          <p className="text-sm font-medium text-blue-500 uppercase tracking-wider mb-2">내 크레딧</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-blue-700">{credits.toLocaleString()}</span>
            <span className="text-2xl font-semibold text-blue-400">C</span>
          </div>
          <p className="text-sm text-gray-400 mt-2">1 크레딧 = 100원 · 에피소드 1편 생성 = 10C</p>
        </div>

        {/* Charge Presets */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-800 mb-4">크레딧 충전</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PRESETS.map(({ credits: amt, price, discount, label }) => (
              <button
                key={amt}
                onClick={() => handleCharge(amt, price)}
                disabled={charging !== null}
                className={`relative p-4 rounded-xl border-2 transition-all text-center
                  ${charging === amt
                    ? 'border-yellow-400 bg-yellow-50 scale-95'
                    : discount >= 20
                      ? 'border-blue-300 bg-blue-50 hover:border-yellow-300 hover:bg-yellow-50 hover:shadow-md ring-1 ring-blue-200'
                      : 'border-blue-100 bg-white hover:border-yellow-300 hover:bg-yellow-50 hover:shadow-md'
                  }
                  disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {discount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    {discount}% OFF
                  </div>
                )}
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
                <div className="text-2xl font-bold text-blue-700">{amt}C</div>
                {discount > 0 ? (
                  <div className="mt-1">
                    <span className="text-xs text-gray-400 line-through">{(amt * 100).toLocaleString()}원</span>
                    <div className="text-sm text-yellow-600 font-bold">{price.toLocaleString()}원</div>
                  </div>
                ) : (
                  <div className="text-sm text-yellow-600 font-semibold mt-1">{price.toLocaleString()}원</div>
                )}
                {charging === amt && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                    <div className="w-5 h-5 border-2 border-yellow-300 border-t-yellow-600 rounded-full animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>
          {!TOSS_CLIENT_KEY && (
            <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              테스트 모드: NEXT_PUBLIC_TOSS_CLIENT_KEY 미설정 — 결제 없이 즉시 충전됩니다
            </p>
          )}
        </div>

        {/* Credit Log */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4">사용 내역</h2>
          {logs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
              아직 내역이 없습니다
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">날짜</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">내용</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">금액</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 text-gray-400">
                        {new Date(log.createdAt).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-gray-700">{log.reason}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${log.amount > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        {log.amount > 0 ? '+' : ''}{log.amount}C
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">{log.balance}C</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
