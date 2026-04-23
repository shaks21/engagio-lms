'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { BookOpen, Plus, Users, Layers } from 'lucide-react';

interface CourseItem {
  id: string;
  title: string;
  description: string;
  _count: { enrollments: number; sessions: number };
  instructor: { email: string } | null;
}

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data);
    } catch {
      setError('Failed to load courses');
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.post('/courses', { title: newTitle, description: newDesc });
      setNewTitle('');
      setNewDesc('');
      setShowCreate(false);
      await fetchCourses();
    } catch {
      setError('Failed to create course');
    } finally { setCreating(false); }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-engagio-400" /> Courses
              </h1>
            </div>
            {user?.role === 'TEACHER' && (
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="bg-engagio-600 hover:bg-engagio-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> New Course
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          {showCreate && (
            <Card className="mb-6 hover:border-engagio-500 transition-colors">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors"
                    value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Course title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors"
                    value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Short description"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={creating}
                    className="px-4 py-2 bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >{creating ? 'Creating...' : 'Create'}</button>
                  <button onClick={() => setShowCreate(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg text-sm font-medium transition-colors"
                  >Cancel</button>
                </div>
              </div>
            </Card>
          )}

          {loading ? (
            <div className="text-gray-500 py-8 text-center">Loading courses...</div>
          ) : courses.length === 0 ? (
            <div className="text-gray-500 py-12 text-center">No courses yet. Create your first course!</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((c) => (
                <Link key={c.id} href={`/dashboard/courses/${c.id}`}>
                  <Card className="cursor-pointer hover:border-engagio-500 transition-colors h-full">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-engagio-500/10 flex items-center justify-center text-engagio-400">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-100 truncate">{c.title}</h3>
                        {c.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</p>}
                        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />{c._count?.enrollments ?? 0}
                          </span>
                          <span>{c._count?.sessions ?? 0} sessions</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
