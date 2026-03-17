'use client';

import { useEffect, useState } from 'react';

interface AdminReport {
  id: string;
  reason: string;
  status: string;
  projectId: string | null;
  commentId: string | null;
  createdAt: string;
  reporter: { id: string; name: string | null; email: string };
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/reports')
      .then(r => r.json())
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleStatusUpdate = async (reportId: string, status: 'REVIEWED' | 'DISMISSED') => {
    const res = await fetch('/api/admin/reports', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, status }),
    });

    if (res.ok) {
      setReports(prev => prev.map(r => (r.id === reportId ? { ...r, status } : r)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">신고 관리</h1>

      {reports.length === 0 ? (
        <p className="text-gray-400 text-center py-16">신고가 없습니다</p>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <div
              key={report.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        report.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : report.status === 'REVIEWED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {report.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(report.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 mb-2">{report.reason}</p>
                  <div className="text-xs text-gray-400 space-x-3">
                    <span>신고자: {report.reporter.name || report.reporter.email}</span>
                    {report.projectId && <span>프로젝트: {report.projectId.slice(0, 8)}...</span>}
                    {report.commentId && <span>댓글: {report.commentId.slice(0, 8)}...</span>}
                  </div>
                </div>
                {report.status === 'PENDING' && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleStatusUpdate(report.id, 'REVIEWED')}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                    >
                      확인
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(report.id, 'DISMISSED')}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      기각
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
