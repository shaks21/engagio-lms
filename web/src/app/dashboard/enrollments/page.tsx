'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Users, UserCheck, Mail, BookOpen } from 'lucide-react';

interface Enrollment {
  id: string;
  status: string;
  course: { id: string; title: string };
  user: { id: string; email: string };
}

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [eRes, cRes] = await Promise.all([
        api.get('/enrollments'),
        api.get('/courses'),
      ]);
      setEnrollments(eRes.data);
      const all = cRes.data;
      const enrolledIds = new Set(eRes.data.map((e: Enrollment) => e.course.id));
      setCourses(all.filter((c: any) => !enrolledIds.has(c.id)));
    } catch {
      setError('Failed to load enrollments');
    } finally { setLoading(false); }
  };

  const handleEnroll = async () => {
    if (!courseId) return;
    setEnrolling(true);
    try {
      await api.post('/enrollments', { courseId });
      setCourseId('');
      await fetchData();
    } catch {
      setError('Failed to enroll');
    } finally { setEnrolling(false); }
  };

  const handleUnenroll = async (id: string) => {
    if (!confirm('Unenroll from this course?')) return;
    try {
      await api.delete(`/enrollments/${id}`);
      await fetchData();
    } catch {
      setError('Failed to unenroll');
    }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
              <Users className="w-6 h-6 text-green-400" /> Enrollments
            </h1>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          {user?.role === 'STUDENT' && courses.length > 0 && (
            <Card className="mb-6">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Enroll in a new course</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    value={courseId} onChange={(e) => setCourseId(e.target.value)}
                  >
                    <option value="">Select a course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleEnroll} disabled={enrolling || !courseId}
                  className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll'}
                </button>
              </div>
            </Card>
          )}

          {loading ? (
            <div className="text-gray-500 py-8 text-center">Loading enrollments...</div>
          ) : enrollments.length === 0 ? (
            <div className="text-gray-500 py-12 text-center">No enrollments yet</div>
          ) : (
            <div className="space-y-3">
              {enrollments.map((e) => (
                <Card key={e.id} className="hover:border-green-500/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                        {user?.role === 'STUDENT' ? <BookOpen className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-100">{e.course.title}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                          <Mail className="w-3 h-3" />{e.user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        e.status === 'active'
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-gray-900/30 text-gray-400'
                      }`}>
                        {e.status}
                      </span>
                      {user?.role === 'STUDENT' && (
                        <button
                          onClick={() => handleUnenroll(e.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Unenroll
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
