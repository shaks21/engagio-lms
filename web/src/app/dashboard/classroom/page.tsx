'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import { getCourses, getActiveSessions, startSession, getSessionByCode, type Session } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Video, Users, ArrowRight, Radio, Hash } from 'lucide-react';

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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [c, s] = await Promise.all([getCourses(), getActiveSessions()]);
      setCourses(c);
      setSessions(s);
    } catch { setError('Failed to load classroom data'); }
  };

  const handleStart = async () => {
    if (!selectedCourse || !userId) return;
    setError(null); setLoading(true);
    try {
      const session = await startSession({ courseId: selectedCourse });
      router.push(`/classroom/${session.id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to start session');
    } finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setError(null); setLoading(true);
    try {
      const data = await getSessionByCode(joinCode.trim());
      router.push(`/classroom/${data.id}`);
    } catch { setError('Session not found. Check the code and try again.'); }
    finally { setLoading(false); }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-gray-100 mb-6 flex items-center gap-2">
            <Video className="w-6 h-6 text-engagio-400" /> Classroom
          </h1>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          <div className="flex gap-1 bg-[#151b2b] rounded-lg p-1 mb-6 w-fit border border-[#232d42]">
            {(['new', 'active', 'join'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  tab === t
                    ? 'bg-engagio-600 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'new' ? 'Start New' : t === 'active' ? 'Active Sessions' : 'Join by Code'}
              </button>
            ))}
          </div>

          {tab === 'new' && (
            <Card title="Start a New Session" className="max-w-xl">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Course</label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors"
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
                  className="px-6 py-2.5 bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <Radio className="w-4 h-4" /> {loading ? 'Starting...' : 'Start Session'}
                </button>
              </div>
            </Card>
          )}

          {tab === 'active' && (
            <Card title="Active Sessions">
              {sessions.length === 0 ? (
                <p className="text-gray-500 py-6 text-center">No active sessions</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 bg-[#0b0f1a] rounded-lg border border-[#232d42]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <Radio className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-100">{s.course?.title}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Hash className="w-3 h-3" /> Code: <span className="font-mono">{s.classroomCode}</span>
                            {s.user && <span>· {s.user.email}</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/classroom/${s.id}`)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                      >
                        Join <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'join' && (
            <Card title="Join by Code" className="max-w-md">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Session Code</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors text-center font-mono text-2xl tracking-widest uppercase"
                    placeholder="ABC123"
                    maxLength={8}
                  />
                </div>
                <button
                  onClick={handleJoin}
                  disabled={loading || joinCode.length < 4}
                  className="w-full px-6 py-2.5 bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
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
