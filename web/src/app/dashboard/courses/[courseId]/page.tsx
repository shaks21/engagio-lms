'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Play, Users, Clock, Radio } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string | null;
  instructor?: { email: string };
  _count?: { enrollments: number; sessions: number };
}

interface Enrollment {
  id: string;
  userId: string;
  status: string;
  user?: { id: string; email: string; role: string };
}

interface Session {
  id: string;
  classroomCode: string;
  startedAt: string;
  endedAt: string | null;
  dwellTime: number;
}

export default function CourseDetailPage() {
  const params = useParams() as { courseId: string };
  const courseId = params.courseId;

  const [course, setCourse] = useState<Course | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (courseId) loadData(); }, [courseId]);

  const loadData = async () => {
    try {
      const [courseRes, enrollRes, historyRes] = await Promise.all([
        api.get(`/courses/${courseId}`),
        api.get(`/enrollments/course/${courseId}`),
        api.get(`/sessions/history?courseId=${courseId}`),
      ]);
      setCourse(courseRes.data);
      setEnrollments(enrollRes.data);
      setSessions(historyRes.data);
    } catch { setError('Failed to load course data'); }
    finally { setLoading(false); }
  };

  const handleStartSession = async () => {
    setError(null);
    try {
      const res = await api.post(`/sessions/start?courseId=${courseId}`);
      const code = res.data.classroomCode;
      alert(`Session started! Code: ${code}`);
      await loadData();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to start session');
    }
  };

  const handleUnenroll = async (enrollment: Enrollment) => {
    if (!confirm(`Remove ${enrollment.user?.email} from this course?`)) return;
    try {
      await api.delete(`/enrollments/course/${courseId}/user/${enrollment.userId}`);
      await loadData();
    } catch { setError('Failed to unenroll student'); }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6">
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-1 text-engagio-400 hover:text-engagio-300 text-sm font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Courses
          </Link>

          {course && (
            <Card className="mb-6 hover:border-engagio-500 transition-colors">
              <h1 className="text-2xl font-bold text-gray-100">{course.title}</h1>
              {course.description && <p className="text-gray-400 mt-2">{course.description}</p>}
              <div className="flex gap-4 mt-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> Instructor: {course.instructor?.email || 'N/A'}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {course._count?.enrollments ?? 0} students
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {course._count?.sessions ?? 0} sessions
                </span>
              </div>
            </Card>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          <div className="flex gap-4 mb-6">
            <button
              onClick={handleStartSession}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Start Session
            </button>
          </div>

          <Card title="Enrolled Students" className="mb-6">
            {enrollments.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">No students enrolled yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm app-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => (
                      <tr key={e.id} className="border-b border-[#232d42]">
                        <td className="py-3 px-4 text-gray-300">{e.user?.email}</td>
                        <td className="py-3 px-4 text-gray-300">{e.user?.role}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            e.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'
                          }`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleUnenroll(e)}
                            className="text-red-400 hover:text-red-300 text-xs transition-colors"
                          >
                            Unenroll
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Session History">
            {sessions.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">No sessions yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm app-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Started</th>
                      <th>Status</th>
                      <th>Dwell Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td className="py-3 px-4 text-gray-300 font-mono">{s.classroomCode}</td>
                        <td className="py-3 px-4 text-gray-400">{new Date(s.startedAt).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          {s.endedAt ? (
                            <span className="text-gray-400">Ended</span>
                          ) : (
                            <span className="text-green-400 font-medium flex items-center gap-1">
                              <Radio className="w-3 h-3 animate-pulse" /> Live
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {Math.floor(s.dwellTime / 60)}m {s.dwellTime % 60}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}
