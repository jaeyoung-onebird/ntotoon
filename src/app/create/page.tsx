'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { STYLE_PRESETS } from '@/lib/styles';

export default function CreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [novelText, setNovelText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('drama');
  const [customRefs, setCustomRefs] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExpand = async () => {
    if (!novelText.trim()) return;
    setExpanding(true);
    try {
      const res = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: novelText }),
      });
      if (!res.ok) throw new Error('실패');
      const { expandedText } = await res.json();
      setNovelText(expandedText);
    } catch {
      setError('AI 살 붙이기에 실패했습니다');
    } finally {
      setExpanding(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const images = files.filter(f => f.type.startsWith('image/')).slice(0, 3);
    setCustomRefs(prev => [...prev, ...images].slice(0, 3));
    e.target.value = '';
  };

  const removeRef = (i: number) => {
    setCustomRefs(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novelText.trim()) return;

    setLoading(true);
    setError('');

    try {
      // 커스텀 레퍼런스 이미지 업로드
      let styleRefUrls: string[] = [];
      if (customRefs.length > 0) {
        const formData = new FormData();
        customRefs.forEach(f => formData.append('files', f));
        const uploadRes = await fetch('/api/style-refs/upload', { method: 'POST', body: formData });
        if (uploadRes.ok) {
          const { urls } = await uploadRes.json();
          styleRefUrls = urls;
        }
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || '제목 없음',
          novelText: novelText.trim(),
          style: selectedStyle,
          styleRefs: styleRefUrls,
        }),
      });
      if (!res.ok) throw new Error('프로젝트 생성 실패');
      const project = await res.json();

      const genRes = await fetch(`/api/projects/${project.id}/generate`, { method: 'POST' });
      if (!genRes.ok) throw new Error('생성 시작 실패');
      const { jobId } = await genRes.json();

      router.push(`/projects/${project.id}/episodes/1?jobId=${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
      {/* Hero */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          AI 웹툰 생성기
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
          내 이야기를 <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">웹툰</span>으로
        </h1>
        <p className="text-lg text-gray-500 max-w-md mx-auto">
          텍스트만 붙여넣으세요. AI가 캐릭터, 장면, 말풍선까지 자동으로 만들어드립니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            제목 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="웹툰 제목을 입력하세요"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all"
          />
        </div>

        {/* 그림체 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            그림체 선택
          </label>
          <div className="grid grid-cols-4 gap-2">
            {STYLE_PRESETS.map((style) => (
              <button
                key={style.key}
                type="button"
                onClick={() => setSelectedStyle(style.key)}
                className={`p-3 rounded-xl border-2 text-left transition-all
                  ${selectedStyle === style.key
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
              >
                <div className="text-2xl mb-1">{style.emoji}</div>
                <div className="text-sm font-semibold text-gray-800">{style.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{style.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 커스텀 스타일 레퍼런스 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              내 그림체 레퍼런스 <span className="text-gray-400 font-normal">(선택 · 최대 3장)</span>
            </label>
            {customRefs.length > 0 && (
              <span className="text-xs text-blue-600 font-medium">{customRefs.length}/3 업로드됨</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">
            원하는 그림체의 샘플 이미지를 올리면 AI가 그 스타일로 생성합니다. 선택 안 하면 위 프리셋을 사용합니다.
          </p>

          <div className="flex gap-2 flex-wrap">
            {customRefs.map((file, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-blue-200 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(file)}
                  alt={`ref ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeRef(i)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-lg"
                >
                  ×
                </button>
              </div>
            ))}

            {customRefs.length < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center text-gray-400 hover:text-blue-500"
              >
                <span className="text-2xl">+</span>
                <span className="text-[10px] mt-0.5">이미지</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* 소설 텍스트 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            소설 텍스트
          </label>
          <textarea
            value={novelText}
            onChange={(e) => setNovelText(e.target.value)}
            placeholder={`여기에 소설 텍스트를 붙여넣으세요...\n\n예시:\n민수는 카페 창가에 앉아 커피를 마시고 있었다.\n문이 열리며 수진이 들어왔다.\n"오랜만이야," 수진이 미소를 지으며 말했다.`}
            rows={12}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all resize-y text-gray-800 leading-relaxed"
          />
          <div className="flex justify-between mt-1.5">
            <p className="text-xs text-gray-400">{novelText.length}자 입력됨</p>
            <p className="text-xs text-gray-400">100자 이상 권장</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || expanding || novelText.trim().length < 10}
            className="flex-1 py-3.5 px-6 bg-gradient-to-r from-blue-600 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                생성 중...
              </span>
            ) : '웹툰 생성하기'}
          </button>
          <button
            type="button"
            onClick={handleExpand}
            disabled={expanding || loading || novelText.trim().length < 10}
            className="py-3.5 px-5 bg-white border-2 border-blue-200 text-blue-700 font-semibold rounded-xl hover:bg-blue-50 hover:border-blue-300 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
          >
            {expanding ? 'AI 작성 중...' : 'AI로 살 붙이기'}
          </button>
        </div>
      </form>

      {/* Steps */}
      <div className="mt-16 grid grid-cols-4 gap-3">
        {[
          { step: '1', title: '텍스트 분석', desc: '장면과 캐릭터 추출' },
          { step: '2', title: '캐릭터 디자인', desc: '일관된 외형 생성' },
          { step: '3', title: '패널 생성', desc: '장면별 컷 그리기' },
          { step: '4', title: '완성', desc: '말풍선 + 조립' },
        ].map((item) => (
          <div key={item.step} className="text-center p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2">
              {item.step}
            </div>
            <div className="text-sm font-semibold text-gray-800">{item.title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
