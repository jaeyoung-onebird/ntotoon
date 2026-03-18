'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [image, setImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status !== 'authenticated') return;

    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setName(data.name || '');
        setBio(data.bio || '');
        setEmail(data.email || '');
        setImage(data.image || '');
      })
      .finally(() => setLoading(false));
  }, [status, router]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, bio }),
      });
      if (res.ok) setSaved(true);
    } catch {}
    finally { setSaving(false); }
  };

  if (loading || status === 'loading') {
    return <div className="max-w-lg mx-auto px-6 py-16 text-center text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">내 정보 수정</h1>

      <div className="space-y-5">
        {/* 아바타 + 사진 업로드 */}
        <div className="flex items-center gap-4 mb-6">
          <label className="relative cursor-pointer group">
            {image ? (
              <img src={image} alt="프로필" className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-200 group-hover:ring-blue-400 transition-all" />
            ) : (
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold group-hover:bg-blue-200 transition-all">
                {(name || '?')[0]}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs shadow-sm">
              +
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const formData = new FormData();
                formData.append('file', file);
                try {
                  const res = await fetch('/api/settings/avatar', { method: 'POST', body: formData });
                  if (res.ok) {
                    const { url } = await res.json();
                    setImage(url);
                  }
                } catch {}
                finally { setUploading(false); }
              }}
            />
            {uploading && <div className="absolute inset-0 bg-white/60 rounded-full flex items-center justify-center"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}
          </label>
          <div>
            <p className="font-semibold text-gray-900">{name || '이름 없음'}</p>
            <p className="text-sm text-gray-400">{email}</p>
          </div>
        </div>

        {/* 이름 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">닉네임</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all"
            placeholder="닉네임을 입력하세요"
          />
        </div>

        {/* 소개 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">소개</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none"
            placeholder="작가 소개를 입력하세요"
          />
        </div>

        {/* 이메일 (읽기전용) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
          <input
            value={email}
            disabled
            className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">이메일은 변경할 수 없습니다</p>
        </div>

        {/* 저장 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-all"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>

        {saved && (
          <p className="text-center text-sm text-green-600 font-medium">저장되었습니다!</p>
        )}
      </div>
    </div>
  );
}
