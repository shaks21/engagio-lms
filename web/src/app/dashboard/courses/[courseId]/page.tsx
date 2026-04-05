'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';

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

  useEffect(() => {
    if (courseId) loadData();
  }, [courseId]);

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
    } catch {
      setError('Failed to load course data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async () => {
    setError(null);
    try {
      const res = await api.post(`/sessions/start?courseId=${courseId}`);
      alert(`Session started! Code: ${res.data.classroomCode}`);
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
    } catch {
      setError('Failed to unenroll student');
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <Link href="/dashboard/courses" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Courses
          </Link>

          {course && (
            <Card className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
              {course.description && <p className="text-gray-600 mt-2">{course.description}</p>}
              <div className="flex gap-4 mt-3 text-sm text-gray-500">
                <span>Instructor: {course.instructor?.email || 'N/A'}</span>
                <span>{course._count?.enrollments ?? 0} students</span>
                <span>{course._count?.sessions ?? 0} sessions</span>
              </div>
            </Card>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-4 mb-6">
            <button
              onClick={handleStartSession}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Start Session
            </button>
          </div>

          <Card title="Enrolled Students" className="mb-6">
            {enrollments.length === 0 ? (
              <p className="text-gray-400 py-4 text-center">No students enrolled yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Email</th>
                      <th className="text-left py-2 px-3">Role</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => (
                      <tr key={e.id} className="border-b">
                        <td className="py-2 px-3">{e.user?.email}</td>
                        <td className="py-2 px-3">{e.user?.role}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => handleUnenroll(e)}
                            className="text-red-500 hover:text-red-700 text-xs"
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
              <p className="text-gray-400 py-4 text-center">No sessions yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Code</th>
                      <th className="text-left py-2 px-3">Started</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Dwell Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b">
                        <td className="py-2 px-3 font-mono">{s.classroomCode}</td>
                        <td className="py-2 px-3">{new Date(s.startedAt).toLocaleString()}</td>
                        <td className="py-2 px-3">
                          {s.endedAt ? 'Ended' : (
                            <span className="text-green-600 font-medium">Live</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
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
