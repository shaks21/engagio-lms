'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import { getEngagementOverview, type EngagementOverview } from '@/lib/api';

export default function AnalyticsPage() {
  const [data, setData] = useState<EngagementOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const d = await getEngagementOverview();
      setData(d);
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading analytics...</div>;

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          {data && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{data.totalSessions}</div>
                  <div className="text-sm text-gray-500 mt-1">Total Sessions</div>
                </Card>
                <Card className="text-center">
                  <div className="text-3xl font-bold text-green-600">{data.activeSessions}</div>
                  <div className="text-sm text-gray-500 mt-1">Active</div>
                </Card>
                <Card className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {Math.floor(data.totalDwellTime / 60)}m
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Total Dwell Time</div>
                </Card>
                <Card className="text-center">
                  <div className="text-3xl font-bold text-orange-600">
                    {Math.floor(data.avgDwellTime / 60)}m
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Avg Dwell Time</div>
                </Card>
              </div>

              {/* Event Type Bar Chart */}
              <Card title="Events by Type" className="mb-6">
                {Object.keys(data.eventTypeCounts).length === 0 ? (
                  <p className="text-gray-400 py-6 text-center">No events recorded yet</p>
                ) : (
                  <div className="space-y-3 py-2">
                    {Object.entries(data.eventTypeCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => {
                        const maxCount = Math.max(...Object.values(data.eventTypeCounts));
                        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <span className="w-28 text-sm text-gray-600 capitalize truncate">
                              {type.replace('_', ' ').toLowerCase()}
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
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

              {/* Session Activity */}
              <Card title="Recent Sessions">
                {data.eventsBySession.length === 0 ? (
                  <p className="text-gray-400 py-6 text-center">No session activity</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Session</th>
                          <th className="text-left py-2 px-3">Events</th>
                          <th className="text-left py-2 px-3">Dwell Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.eventsBySession.map((s) => (
                          <tr key={s.id} className="border-b">
                            <td className="py-2 px-3 font-mono text-xs">{s.id.slice(0, 8)}...</td>
                            <td className="py-2 px-3">{s._count.events}</td>
                            <td className="py-2 px-3">{Math.floor(s.dwellTime / 60)}m {s.dwellTime % 60}s</td>
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
