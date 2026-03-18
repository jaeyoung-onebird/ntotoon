'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Header() {
  const { data: session, status, update } = useSession();
  const [credits, setCredits] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // 페이지 이동마다 크레딧 + 닉네임 갱신
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/credits')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data) setCredits(data.credits); })
        .catch(() => {});
      fetch('/api/settings')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.name) setUserName(data.name); })
        .catch(() => {});
    }
  }, [status, pathname]);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="group select-none relative">
          {/* ink blobs - blue + red/orange */}
          <div className="absolute -left-4 -top-2 w-5 h-5 bg-red-400 rounded-full opacity-0 group-hover:opacity-30 group-hover:-translate-x-4 group-hover:-translate-y-4 group-hover:scale-[2] transition-all duration-[900ms]" />
          <div className="absolute left-[200px] top-0 w-4 h-4 bg-orange-400 rounded-full opacity-0 group-hover:opacity-35 group-hover:translate-x-5 group-hover:-translate-y-3 transition-all duration-700 delay-75" />
          <div className="absolute left-[90px] -bottom-5 w-4 h-4 bg-blue-600 rounded-full opacity-0 group-hover:opacity-25 group-hover:translate-y-4 group-hover:scale-150 transition-all duration-[800ms] delay-150" />
          <div className="absolute left-[160px] -top-4 w-3 h-3 bg-red-500 rounded-full opacity-0 group-hover:opacity-40 group-hover:-translate-y-5 group-hover:translate-x-3 transition-all duration-[1000ms] delay-200" />
          <div className="absolute left-[40px] -top-4 w-3 h-3 bg-orange-500 rounded-full opacity-0 group-hover:opacity-30 group-hover:-translate-y-3 group-hover:-translate-x-2 transition-all duration-[1100ms] delay-100" />

          <svg width="250" height="72" viewBox="-10 -10 270 92" fill="none" className="overflow-visible">

            {/* Layer 0: background lines */}
            <path d="M-8 58 C15 35 40 15 70 32 C100 48 105 5 145 22 C185 38 205 10 250 28"
              stroke="#1e3a8a" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.1"
              className="group-hover:opacity-22 transition-opacity duration-700"/>

            <path d="M-5 10 C30 45 60 -5 100 40 C140 85 170 0 210 35 C240 60 255 15 265 30"
              stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.1"
              className="group-hover:opacity-22 transition-opacity duration-600"/>

            <path d="M50 -8 L65 20 L55 22 L80 55" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.08"
              className="group-hover:opacity-20 transition-opacity duration-500"/>

            {/* Layer 1: abstract drawing */}
            <path d="M0 52 C-2 32 10 20 14 10 C18 0 28 -2 32 10 C36 22 28 30 38 26 C48 22 42 8 52 4 C62 0 58 20 64 26 C70 32 80 22 86 28"
              stroke="#1e3a8a" strokeWidth="2.8" strokeLinecap="round" fill="none"
              className="group-hover:stroke-[#dc2626] transition-colors duration-700"/>

            <path d="M3 50 C2 38 12 24 16 14 C20 4 30 2 34 12 C38 22 32 32 40 28"
              stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.15"
              className="group-hover:opacity-35 transition-opacity duration-500"/>

            <path d="M18 20 L24 12 L28 22 L22 28 Z" stroke="#dc2626" strokeWidth="2.2" fill="none" opacity="0.5"/>
            <path d="M20 16 L26 16 M23 13 L23 25" stroke="#1e3a8a" strokeWidth="1.2" opacity="0.35"/>
            <circle cx="23" cy="19" r="3" fill="#0f172a" opacity="0.85"/>
            <circle cx="24" cy="18" r="1" fill="#f97316"/>

            <path d="M38 14 L44 6 L46 20 Z" stroke="#f97316" strokeWidth="1.8" fill="none" opacity="0.35"/>
            <path d="M36 16 L42 8 L44 18 Z" stroke="#2563eb" strokeWidth="1" fill="#fee2e2" opacity="0.2"/>
            <circle cx="42" cy="14" r="1.5" fill="#1e3a8a" opacity="0.7"/>

            <path d="M32 22 L28 28 L34 30 L30 34" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.25"/>

            <path d="M16 42 C26 34 36 44 48 36 C58 28 68 42 78 34 C84 30 90 38 96 34" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" fill="none" opacity="0.2"
              className="group-hover:opacity-35 transition-opacity duration-400"/>

            <path d="M48 2 C58 -8 68 4 78 -4 C88 -12 98 2 108 -6" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.2"/>
            <path d="M52 8 C62 0 72 6 82 -2 C92 -8 102 4 112 -2" stroke="#60a5fa" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.15"/>
            <path d="M30 0 C36 -10 44 -4 50 -12" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.18"/>
            <path d="M160 -4 C170 4 180 -6 190 2 C200 10 210 -2 220 6" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.12"/>

            {/* Layer 2: text */}
            <text x="36" y="56" fill="#fee2e2" style={{ fontSize: '65px', fontWeight: 900, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}
              transform="rotate(-10, 36, 56)" opacity="0.1">N</text>

            <text x="46" y="48" fill="#0f172a" style={{ fontSize: '46px', fontWeight: 900, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}
              transform="rotate(-8, 46, 48)" opacity="0.92">N</text>

            <text x="84" y="44" fill="#fca5a5" style={{ fontSize: '38px', fontWeight: 700, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}
              transform="rotate(7, 84, 44)" opacity="0.15">to</text>

            <text x="76" y="40" fill="#dc2626" style={{ fontSize: '30px', fontWeight: 800, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}
              transform="rotate(5, 76, 40)" opacity="0.85">to</text>

            <path d="M104 34 C110 26 116 22 124 30" stroke="#f97316" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.2"/>
            <path d="M100 38 C108 30 114 28 120 34" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.12"/>

            <text x="106" y="54" fill="#dbeafe" style={{ fontSize: '58px', fontWeight: 900, fontFamily: 'Georgia, serif' }}
              transform="rotate(-5, 106, 54)" opacity="0.1">T</text>

            <text x="112" y="50" fill="#1e3a8a" style={{ fontSize: '48px', fontWeight: 900, fontFamily: 'Georgia, serif' }}
              transform="rotate(-4, 112, 50)" opacity="0.9">T</text>

            <text x="138" y="56" fill="#fed7aa" style={{ fontSize: '50px', fontWeight: 900, fontFamily: 'Georgia, serif' }}
              transform="rotate(8, 138, 56)" opacity="0.1">O</text>
            <text x="142" y="44" fill="#1e40af" style={{ fontSize: '46px', fontWeight: 900, fontFamily: 'Georgia, serif' }}
              transform="rotate(6, 142, 44)" opacity="0.88">O</text>

            <text x="168" y="56" fill="#dc2626" style={{ fontSize: '40px', fontWeight: 900, fontFamily: 'Georgia, serif' }}
              transform="rotate(-8, 168, 56)" opacity="0.6">O</text>

            <text x="192" y="46" fill="#0f172a" style={{ fontSize: '50px', fontWeight: 900, fontFamily: 'Georgia, serif' }}
              transform="rotate(6, 192, 46)" opacity="0.9">N</text>

            <text x="196" y="50" fill="#ef4444" style={{ fontSize: '50px', fontWeight: 900, fontFamily: 'Georgia, serif' }}
              transform="rotate(8, 196, 50)" opacity="0.06">N</text>

            {/* Layer 3: overlays */}
            <path d="M40 20 C80 50 140 15 200 48" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.06"
              className="group-hover:opacity-18 transition-opacity duration-400"/>
            <path d="M60 52 C100 18 160 55 220 20" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.05"
              className="group-hover:opacity-12 transition-opacity duration-500"/>

            <circle cx="92" cy="28" r="3" fill="#dc2626" opacity="0.1"/>
            <circle cx="158" cy="40" r="2" fill="#f97316" opacity="0.12"/>
            <circle cx="215" cy="30" r="3.5" fill="#2563eb" opacity="0.07"/>
            <circle cx="72" cy="48" r="1.5" fill="#ef4444" opacity="0.1"/>
            <circle cx="130" cy="12" r="2" fill="#f97316" opacity="0.08"/>

            <path d="M150 26 C158 20 164 28 158 34 C152 40 144 34 150 26" stroke="#f97316" strokeWidth="1.5" fill="none" opacity="0.15"
              className="group-hover:opacity-35 transition-opacity duration-600"/>

            {/* Layer 4: splatter + stars */}
            <circle cx="-2" cy="50" r="3.5" fill="#dc2626" opacity="0.08"/>
            <circle cx="8" cy="58" r="1.5" fill="#1e3a8a" opacity="0.06"/>
            <circle cx="235" cy="20" r="2.5" fill="#f97316" opacity="0.12"/>
            <circle cx="110" cy="4" r="1.5" fill="#ef4444" opacity="0.15"/>
            <circle cx="185" cy="60" r="2" fill="#2563eb" opacity="0.08"/>
            <circle cx="44" cy="-2" r="3" fill="#f97316" opacity="0.1"/>
            <circle cx="228" cy="52" r="1.5" fill="#dc2626" opacity="0.1"/>

            <path d="M55 60 C95 54 115 62 145 56" stroke="#dc2626" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.04"
              className="group-hover:opacity-10 transition-opacity duration-500"/>
            <path d="M125 64 C165 58 195 66 240 60" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.04"/>

            <path d="M230 6 L232 14 L240 16 L232 18 L230 26 L228 18 L220 16 L228 14 Z" fill="#bfdbfe" opacity="0.45"
              className="group-hover:opacity-90 group-hover:scale-125 origin-center transition-all duration-500"/>
            <path d="M240 34 L241 38 L245 39 L241 40 L240 44 L239 40 L235 39 L239 38 Z" fill="#fecaca" opacity="0.3"
              className="group-hover:opacity-65 transition-opacity duration-700 delay-100"/>
            <path d="M8 4 L9.5 8 L13.5 9 L9.5 10 L8 14 L6.5 10 L2.5 9 L6.5 8 Z" fill="#fed7aa" opacity="0.2"
              className="group-hover:opacity-50 transition-opacity duration-600 delay-200"/>

            <circle cx="54" cy="16" r="3" fill="#dc2626" opacity="0.35"
              className="group-hover:opacity-70 group-hover:-translate-y-3 group-hover:scale-125 transition-all duration-400"/>

            <text x="44" y="76" fill="#6b7280" style={{ fontSize: '18px', letterSpacing: '0.08em', fontWeight: 700 }}>내 이야기를 웹툰으로 · 엔투툰</text>

          </svg>
        </Link>
        {/* 데스크톱 네비 */}
        <nav className="hidden md:flex items-center gap-4">
          {status === 'loading' ? (
            <div className="w-40 h-8 bg-gray-100 rounded-lg animate-pulse" />
          ) : session?.user ? (
            <>
              <Link href="/projects" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all">
                내 작품
              </Link>
              <Link href="/settings" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all">
                {userName || session.user.name || session.user.email}
              </Link>
              <Link href="/credits" className="px-3 py-1.5 bg-yellow-50 text-yellow-700 text-sm font-semibold rounded-lg hover:bg-yellow-100 transition-all border border-yellow-200">
                {credits !== null ? `${credits}C` : '...'}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="px-4 py-2 bg-gray-100 text-gray-400 text-sm font-medium rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-all">
              로그인
            </Link>
          )}
        </nav>

        {/* 모바일: 크레딧 + 햄버거 */}
        <div className="flex md:hidden items-center gap-3">
          {session?.user && (
            <Link href="/credits" className="px-2.5 py-1 bg-yellow-50 text-yellow-700 text-xs font-semibold rounded-md border border-yellow-200">
              {credits !== null ? `${credits}C` : '...'}
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              {mobileOpen ? (
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 드롭다운 */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 space-y-2">
          {session?.user ? (
            <>
              <Link href="/projects" className="block px-4 py-2.5 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100">내 작품</Link>
              <Link href="/settings" className="block px-4 py-2.5 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100">{userName || session.user.name || '내 정보'}</Link>
              <Link href="/credits" className="block px-4 py-2.5 text-yellow-700 text-sm font-semibold rounded-lg hover:bg-yellow-50">크레딧 {credits !== null ? `${credits}C` : ''}</Link>
              <Link href="/create" className="block px-4 py-2.5 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50">+ 웹툰 만들기</Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="block w-full text-left px-4 py-2.5 text-red-400 text-sm font-medium rounded-lg hover:bg-red-50"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" className="block px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg text-center">로그인</Link>
          )}
        </div>
      )}
    </header>
  );
}
