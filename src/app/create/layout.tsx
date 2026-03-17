import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '웹툰 만들기',
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
