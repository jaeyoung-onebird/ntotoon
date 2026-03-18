'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>문제가 발생했습니다</h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{error.message || '알 수 없는 오류가 발생했습니다.'}</p>
            <button onClick={reset} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', fontWeight: 600, borderRadius: '0.75rem', border: 'none', cursor: 'pointer' }}>
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
