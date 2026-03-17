'use client';

import { useEffect, useState } from 'react';

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  credits: number;
  role: string;
  createdAt: string;
  _count: { projects: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleBanToggle = async (targetUserId: string, currentRole: string) => {
    const action = currentRole === 'BANNED' ? 'UNBAN' : 'BAN';
    const confirmed = window.confirm(
      action === 'BAN' ? '이 사용자를 차단하시겠습니까?' : '이 사용자의 차단을 해제하시겠습니까?'
    );
    if (!confirmed) return;

    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, action }),
    });

    if (res.ok) {
      setUsers(prev =>
        prev.map(u =>
          u.id === targetUserId ? { ...u, role: action === 'BAN' ? 'BANNED' : 'USER' } : u
        )
      );
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">사용자 관리</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">이름</th>
              <th className="text-left px-4 py-3">이메일</th>
              <th className="text-left px-4 py-3">크레딧</th>
              <th className="text-left px-4 py-3">프로젝트</th>
              <th className="text-left px-4 py-3">역할</th>
              <th className="text-left px-4 py-3">가입일</th>
              <th className="text-left px-4 py-3">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{user.name || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">{user.credits.toLocaleString()}</td>
                <td className="px-4 py-3">{user._count.projects}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-700'
                        : user.role === 'BANNED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3">
                  {user.role !== 'ADMIN' && (
                    <button
                      onClick={() => handleBanToggle(user.id, user.role)}
                      className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors ${
                        user.role === 'BANNED'
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      {user.role === 'BANNED' ? '차단 해제' : '차단'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
