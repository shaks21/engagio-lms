'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import api from '@/lib/api';

interface Course { id: string; title: string; }
interface Enrollment {
  id: string; userId: string; courseId: string; status: string; createdAt: string;
  user?: { id: string; email: string; role: string };
  course?: { id: string; title: string };
}

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newCourseId, setNewCourseId] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [enRes, cRes] = await Promise.all([
        api.get('/enrollments'),
        api.get('/courses'),
      ]);
      setEnrollments(enRes.data);
      setCourses(cRes.data);
    } catch {
      setError('Failed to load enrollments');
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/enrollments', { courseId: newCourseId, userId: newUserId });
      setNewCourseId('');
      setNewUserId('');
      setShowAdd(false);
      await loadData();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to enroll');
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async (id: string) => {
    if (!confirm('Remove this enrollment?')) return;
    try {
      const enr = enrollments.find((x) => x.id === id)!;
      await api.delete(`/enrollments/course/${enr.courseId}/user/${enr.userId}`);
      await loadData();
    } catch {
      setError('Failed to unenroll');
    }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
            <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {showAdd ? 'Cancel' : '+ Enroll Student'}
            </button>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

          {showAdd && (
            <Card title="Add Enrollment" className="mb-6">
              <form onSubmit={handleEnroll} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                  <select value={newCourseId} onChange={(e) => setNewCourseId(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Select a course</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                  <input type="text" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="UUID of the user" />
                </div>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Enrolling...' : 'Enroll'}
                </button>
              </form>
            </Card>
          )}

          <Card>
            {enrollments.length === 0 ? (
              <p className="text-gray-400 py-8 text-center">No enrollments yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Student</th>
                      <th className="text-left py-2 px-3">Course</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => (
                      <tr key={e.id} className="border-b">
                        <td className="py-2 px-3">{e.user?.email || e.userId}</td>
                        <td className="py-2 px-3">{e.course?.title || e.courseId}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            e.status === 'active' ? 'bg-green-100 text-green-700' :
                            e.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <button onClick={() => handleUnenroll(e.id)} className="text-red-500 hover:text-red-700 text-xs">Unenroll</button>
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
