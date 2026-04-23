'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import { getCourses, getActiveSessions, startSession, getSessionByCode, type Session } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function ClassroomDashboard() {
  const router = useRouter();
  const { userId } = useAuth();
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'new' | 'active' | 'join'>('new');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [c, s] = await Promise.all([getCourses(), getActiveSessions()]);
      setCourses(c);
      setSessions(s);
    } catch {
      setError('Failed to load classroom data');
    }
  };

  const handleStart = async () => {
    if (!selectedCourse || !userId) return;
    setError(null);
    setLoading(true);
    try {
      const session = await startSession({ courseId: selectedCourse, userId });
      router.push(`/classroom/${session.id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getSessionByCode(joinCode.trim());
      router.push(`/classroom/${data.id}`);
    } catch {
      setError('Session not found. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Classroom</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
            {(['new', 'active', 'join'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  tab === t
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'new' ? 'Start New' : t === 'active' ? 'Active Sessions' : 'Join by Code'}
              </button>
            ))}
          </div>

          {tab === 'new' && (
            <Card title="Start a New Session">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select a course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleStart}
                  disabled={loading || !selectedCourse}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Starting...' : 'Start Session'}
                </button>
              </div>
            </Card>
          )}

          {tab === 'active' && (
            <Card title="Active Sessions">
              {sessions.length === 0 ? (
                <p className="text-gray-400 py-6 text-center">No active sessions</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{s.course?.title}</div>
                        <div className="text-sm text-gray-500">
                          Code: <span className="font-mono">{s.classroomCode}</span>
                          {s.user && ` · ${s.user.email}`}
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/classroom/${s.id}`)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'join' && (
            <Card title="Join by Code">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session Code</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-mono text-2xl tracking-widest uppercase"
                    placeholder="ABC123"
                    maxLength={8}
                  />
                </div>
                <button
                  onClick={handleJoin}
                  disabled={loading || joinCode.length < 4}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Join Session'}
                </button>
              </div>
            </Card>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
