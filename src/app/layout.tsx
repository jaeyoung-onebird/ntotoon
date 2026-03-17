import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import AuthProvider from "@/components/auth-provider";
import Header from "@/components/header";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: '엔투툰 - AI 웹툰 생성기',
    template: '%s | 엔투툰',
  },
  description: '텍스트만 입력하면 AI가 자동으로 웹툰을 만들어드립니다. 누구나 웹툰 작가가 될 수 있습니다.',
  keywords: ['AI 웹툰', '웹툰 만들기', '웹툰 생성기', 'AI', '엔투툰', 'NTOW'],
  openGraph: {
    title: '엔투툰 - AI 웹툰 생성기',
    description: '텍스트만 입력하면 AI가 자동으로 웹툰을 만들어드립니다.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '엔투툰',
  },
  twitter: {
    card: 'summary_large_image',
    title: '엔투툰 - AI 웹툰 생성기',
    description: '텍스트만 입력하면 AI가 자동으로 웹툰을 만들어드립니다.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geist.variable} font-sans antialiased bg-white min-h-screen`}>
        <AuthProvider>
          <Header />
          <main className="min-h-[calc(100vh-65px)]">{children}</main>
          <footer className="border-t border-gray-100 bg-gray-50/50">
            <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
              <span>&copy; 2026 엔투툰 (NTOW)</span>
              <div className="flex gap-4">
                <Link href="/terms" className="hover:text-gray-600 transition-colors">이용약관</Link>
                <Link href="/privacy" className="hover:text-gray-600 transition-colors">개인정보처리방침</Link>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
