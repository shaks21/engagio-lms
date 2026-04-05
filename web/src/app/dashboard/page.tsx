'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface RealtimeStats {
  activeSessions: number;
  liveEvents: number;
  totalUsers: number;
  timestamp: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/analytics/realtime');
      setStats(res.data);
    } catch (e) {
      console.error('Failed to fetch realtime stats');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.email}</h1>
            <p className="text-gray-500 text-sm mt-1">
              Role: <span className="uppercase font-medium">{user?.role}</span>
            </p>
          </div>

          {loading ? (
            <div className="text-gray-500">Loading stats...</div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.activeSessions}</div>
                <div className="text-sm text-gray-500 mt-1">Active Sessions</div>
              </Card>
              <Card className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.liveEvents}</div>
                <div className="text-sm text-gray-500 mt-1">Events (5 min)</div>
              </Card>
              <Card className="text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.totalUsers}</div>
                <div className="text-sm text-gray-500 mt-1">Total Users</div>
              </Card>
            </div>
          ) : (
            <div className="text-red-500 mb-6">Failed to load stats</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/courses">
              <Card className="hover:border-blue-400 cursor-pointer transition">
                <div className="text-xl font-semibold">📚 Courses</div>
                <p className="text-sm text-gray-500 mt-1">Manage your courses and instructors</p>
              </Card>
            </Link>
            <Link href="/dashboard/enrollments">
              <Card className="hover:border-green-400 cursor-pointer transition">
                <div className="text-xl font-semibold">👥 Enrollments</div>
                <p className="text-sm text-gray-500 mt-1">View and manage student enrollments</p>
              </Card>
            </Link>
            <Link href="/dashboard/analytics">
              <Card className="hover:border-purple-400 cursor-pointer transition">
                <div className="text-xl font-semibold">📊 Analytics</div>
                <p className="text-sm text-gray-500 mt-1">Engagement metrics and insights</p>
              </Card>
            </Link>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
