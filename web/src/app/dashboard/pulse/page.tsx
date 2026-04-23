'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import api from '@/lib/api';
import { Activity, Zap, Clock, Radio } from 'lucide-react';

interface LiveEvent {
  type: string;
  userId: string;
  sessionId: string;
  createdAt: string;
}

export default function PulsePage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [stats, setStats] = useState({ activeSessions: 0, liveEvents: 0, totalUsers: 0, timestamp: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [sRes, eRes] = await Promise.all([
        api.get('/analytics/realtime'),
        api.get('/analytics/events?limit=50'),
      ]);
      setStats(sRes.data);
      setEvents(eRes.data || []);
    } catch {
      setError('Failed to load live pulse data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const getEventIcon = (type: string) => {
    if (type.includes('MOUSE')) return <Zap className="w-4 h-4 text-engagio-400" />;
    if (type.includes('KEY')) return <Zap className="w-4 h-4 text-yellow-400" />;
    return <Activity className="w-4 h-4 text-green-400" />;
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-gray-100 mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6 text-engagio-400" /> Live Pulse
          </h1>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="text-center">
              <div className="text-3xl font-bold text-engagio-400">{stats.activeSessions}</div>
              <div className="text-sm text-gray-500 mt-1">Active Sessions</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-green-400">{events.length}</div>
              <div className="text-sm text-gray-500 mt-1">Recent Events</div>
            </Card>
            <Card className="text-center">
              <div className="text-3xl font-bold text-purple-400">{stats.totalUsers}</div>
              <div className="text-sm text-gray-500 mt-1">Total Users</div>
            </Card>
          </div>

          <Card title="Recent Events">
            {loading ? (
              <div className="text-gray-500 py-8 text-center flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 animate-spin" /> Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="text-gray-500 py-8 text-center">No recent events</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-hide pr-2">
                {events.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0b0f1a] border border-[#232d42]"
                  >
                    {getEventIcon(e.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-200">{e.type}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>User: {e.userId?.slice(0,8) || 'N/A'}...</span>
                        <span className="font-mono text-gray-600">{e.sessionId?.slice(0,8)}...</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">{new Date(e.createdAt).toLocaleTimeString()}</div>
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
