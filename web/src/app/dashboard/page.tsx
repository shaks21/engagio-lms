'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { BookOpen, Users, BarChart3, Activity, Clock } from 'lucide-react';

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
    } catch {
      console.error('Failed to fetch realtime stats');
    } finally {
      setLoading(false);
    }
  };

  const navCards = [
    { href: '/dashboard/courses', icon: BookOpen, title: 'Courses', desc: 'Manage your courses and instructors', border: 'hover:border-engagio-500' },
    { href: '/dashboard/enrollments', icon: Users, title: 'Enrollments', desc: 'View and manage student enrollments', border: 'hover:border-green-500' },
    { href: '/dashboard/analytics', icon: BarChart3, title: 'Analytics', desc: 'Engagement metrics and insights', border: 'hover:border-purple-500' },
    { href: '/dashboard/classroom', icon: Activity, title: 'Classroom', desc: 'Start or join a live session', border: 'hover:border-yellow-500' },
  ];

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-100">Welcome back, {user?.email?.split('@')[0]}</h1>
            <p className="text-gray-500 text-sm mt-1">
              Role: <span className="uppercase font-semibold tracking-wider text-engagio-400">{user?.role}</span>
            </p>
          </div>

          {loading ? (
            <div className="text-gray-500 mb-8 flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin"></Clock> Loading stats...
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="text-center">
                <div className="text-3xl font-bold text-engagio-400">{stats.activeSessions}</div>
                <div className="text-sm text-gray-500 mt-1">Active Sessions</div>
              </Card>
              <Card className="text-center">
                <div className="text-3xl font-bold text-green-400">{stats.liveEvents}</div>
                <div className="text-sm text-gray-500 mt-1">Events (5 min)</div>
              </Card>
              <Card className="text-center">
                <div className="text-3xl font-bold text-purple-400">{stats.totalUsers}</div>
                <div className="text-sm text-gray-500 mt-1">Total Users</div>
              </Card>
            </div>
          ) : (
            <div className="text-red-400 mb-8">Failed to load stats</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {navCards.map((card) => (
              <Link key={card.href} href={card.href}>
                <Card className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${card.border} group`}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-engagio-400 group-hover:bg-engagio-500/10 transition-colors">
                      <card.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-100 text-lg">{card.title}</div>
                      <p className="text-sm text-gray-500 mt-0.5">{card.desc}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
