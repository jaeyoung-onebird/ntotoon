'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    if (status === 'authenticated') {
      fetch('/api/admin/stats')
        .then(r => {
          if (r.status === 403 || r.status === 401) {
            setIsAdmin(false);
            router.push('/');
          } else {
            setIsAdmin(true);
          }
        })
        .catch(() => {
          setIsAdmin(false);
          router.push('/');
        });
    }
  }, [status, session, router]);

  if (status === 'loading' || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const navItems = [
    { href: '/admin', label: '대시보드' },
    { href: '/admin/users', label: '사용자' },
    { href: '/admin/projects', label: '프로젝트' },
    { href: '/admin/reports', label: '신고' },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col gap-1">
        <Link href="/" className="text-lg font-bold text-gray-900 mb-6 block">
          NTOW Admin
        </Link>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
