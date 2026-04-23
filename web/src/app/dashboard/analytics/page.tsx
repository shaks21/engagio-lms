'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import { getEngagementOverview, type EngagementOverview } from '@/lib/api';
import { BarChart3, Calendar, Clock, TrendingUp } from 'lucide-react';

export default function AnalyticsPage() {
  const [data, setData] = useState<EngagementOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const d = await getEngagementOverview();
      setData(d);
    } catch {
      setError('Failed to load analytics');
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex min-h-screen bg-[#0b0f1a]">
      <Sidebar />
      <main className="flex-1 p-8 text-gray-500 flex items-center justify-center">Loading analytics...</main>
    </div>
  );

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-gray-100 mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-engagio-400" /> Analytics
          </h1>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          {data && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="text-center">
                  <div className="text-3xl font-bold text-engagio-400">{data.totalSessions}</div>
                  <div className="text-sm text-gray-500 mt-1">Total Sessions</div>
                </Card>
                <Card className="text-center">
                  <div className="text-3xl font-bold text-green-400">{data.activeSessions}</div>
                  <div className="text-sm text-gray-500 mt-1">Active</div>
                </Card>
                <Card className="text-center">
                  <div className="text-3xl font-bold text-purple-400 flex items-center justify-center gap-1">
                    <Clock className="w-5 h-5"></Clock>{Math.floor(data.totalDwellTime / 60)}m
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Total Dwell Time</div>
                </Card>
                <Card className="text-center">
                  <div className="text-3xl font-bold text-orange-400 flex items-center justify-center gap-1">
                    <TrendingUp className="w-5 h-5"></TrendingUp>{Math.floor(data.avgDwellTime / 60)}m
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Avg Dwell Time</div>
                </Card>
              </div>

              <Card title="Events by Type" className="mb-6">
                {Object.keys(data.eventTypeCounts).length === 0 ? (
                  <p className="text-gray-500 py-6 text-center">No events recorded yet</p>
                ) : (
                  <div className="space-y-3 py-2">
                    {Object.entries(data.eventTypeCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => {
                        const maxCount = Math.max(...Object.values(data.eventTypeCounts));
                        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <span className="w-28 text-sm text-gray-400 capitalize truncate">
                              {type.replace('_', ' ').toLowerCase()}
                            </span>
                            <div className="flex-1 bg-[#0b0f1a] rounded-full h-6 overflow-hidden">
                              <div
                                className="h-full bg-engagio-500/80 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              >
                                <span className="text-xs font-medium text-white">{count}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>

              <Card title="Recent Sessions">
                {data.eventsBySession.length === 0 ? (
                  <p className="text-gray-500 py-6 text-center">No session activity</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm app-table">
                      <thead>
                        <tr>
                          <th>Session</th>
                          <th>Events</th>
                          <th>Dwell Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.eventsBySession.map((s) => (
                          <tr key={s.id} className="border-b border-[#232d42]">
                            <td className="py-3 px-4 text-gray-300">{s.id.slice(0, 8)}...</td>
                            <td className="py-3 px-4 text-gray-300">{s._count.events}</td>
                            <td className="py-3 px-4 text-gray-300">{Math.floor(s.dwellTime / 60)}m {s.dwellTime % 60}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
