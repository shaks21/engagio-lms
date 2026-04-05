'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import { getCourses, createCourse, deleteCourse, type Course } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CoursesPage() {
  const { userId } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await getCourses();
      setCourses(data);
    } catch (e) {
      setError('Failed to load courses');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createCourse({
        title,
        description: description || undefined,
        instructorId: userId!,
      });
      setTitle('');
      setDescription('');
      setShowCreate(false);
      await loadCourses();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this course and all related data?')) return;
    try {
      await deleteCourse(id);
      await loadCourses();
    } catch {
      setError('Failed to delete course');
    }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {showCreate ? 'Cancel' : '+ New Course'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {showCreate && (
            <Card title="Create Course" className="mb-6">
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Course title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <Card key={course.id}>
                <Link href={`/dashboard/courses/${course.id}`} className="block">
                  <h3 className="font-semibold text-lg text-gray-900">{course.title}</h3>
                  {course.description && (
                    <p className="text-sm text-gray-500 mt-1">{course.description}</p>
                  )}
                </Link>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-400">
                    {course.instructor?.email || 'No instructor'}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {course._count?.enrollments ?? 0} enrolled
                    </span>
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {course._count?.sessions ?? 0} sessions
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(course.id);
                      }}
                      className="text-red-500 hover:text-red-700 ml-1"
                      title="Delete course"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {courses.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No courses yet. Create one to get started.
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
