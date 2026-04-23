'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import api from '@/lib/api';
import { Activity, Users, RefreshCw } from 'lucide-react';

interface StudentScore {
  userId: string;
  email: string;
  score: number;
  color: 'green' | 'yellow' | 'red';
  lastUpdate: string;
}

function getScoreBg(cls: string): string {
  if (cls === 'green') return 'bg-green-500/20 border-green-500/40';
  if (cls === 'yellow') return 'bg-yellow-500/20 border-yellow-500/40';
  return 'bg-red-500/20 border-red-500/40';
}

function getScoreText(cls: string): string {
  if (cls === 'green') return 'text-green-400';
  if (cls === 'yellow') return 'text-yellow-400';
  return 'text-red-400';
}

export default function TeacherDashboardPage() {
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScores = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/analytics/users/scores');
      setStudents(res.data);
    } catch {
      setError('Failed to fetch engagement scores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 15000);
    return () => clearInterval(interval);
  }, []);

  const stats = {
    green: students.filter(s => s.score > 70).length,
    yellow: students.filter(s => s.score >= 40 && s.score <= 70).length,
    red: students.filter(s => s.score < 40).length,
  };

  const avgScore = students.length > 0
    ? Math.round(students.reduce((a, b) => a + b.score, 0) / students.length)
    : 0;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Teacher Dashboard</h1>
              <p className="text-gray-500 mt-1">Live student engagement heatmap</p>
            </div>
            <button
              onClick={fetchScores}
              disabled={refreshing}
              className="px-4 py-2 bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="text-center">
              <div className="text-3xl font-bold text-gray-100">{students.length}</div>
              <div className="text-sm text-gray-500">Total Tracked</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-green-400">{stats.green}</div>
              <div className="text-sm text-gray-500">Engaged (&gt;70)</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-yellow-400">{stats.yellow}</div>
              <div className="text-sm text-gray-500">Neutral (40-70)</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-red-400">{stats.red}</div>
              <div className="text-sm text-gray-500">Disengaged (&lt;40)</div>
            </Card>
          </div>

          <Card className="mb-8">
            <div className="text-lg font-semibold text-gray-200 mb-3">Class Average Score</div>
            <div className="flex items-center gap-6">
              <div className="text-5xl font-bold text-gray-100">{avgScore}</div>
              <div className="flex-1">
                <div className="bg-[#0b0f1a] rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 rounded-full transition-all duration-700 bg-engagio-500"
                    style={{ width: `${avgScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Student Engagement Heatmap">
            {loading ? (
              <div className="text-gray-500 py-8 text-center">Loading...</div>
            ) : students.length === 0 ? (
              <div className="text-gray-500 py-8 text-center">No students currently in session.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
                {students.map((s) => (
                  <div
                    key={s.userId}
                    className={`p-4 rounded-xl border transition-colors duration-500 ${getScoreBg(s.color)}`}
                  >
                    <div className="text-sm font-medium text-gray-300 truncate">{s.email}</div>
                    <div className={`text-xl font-bold mt-2 ${getScoreText(s.color)}`}>{s.score}</div>
                    <div className={`text-xs mt-1 capitalize ${getScoreText(s.color)}`}>{s.color}</div>
                    <div className="text-xs text-gray-500 mt-1">{new Date(s.lastUpdate).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}
