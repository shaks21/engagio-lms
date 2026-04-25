'use client';

import React, { useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import api from '@/lib/api';
import TeacherHeatmap from '@/components/dashboard/TeacherHeatmap';
import ClassPulseChart from '@/components/dashboard/ClassPulseChart';
import { ChevronDown } from 'lucide-react';

interface SessionOption {
  id: string;
  courseName: string;
  startTime: string;
}

export default function TeacherDashboardPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  /* ── Session picker ── */
  React.useEffect(() => {
    api.get('/sessions/active')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setSessions(list.map((s: any) => ({
          id: s.id || s.sessionId || s._id || '',
          courseName: s.courseName || s.course?.title || s.title || 'Untitled Session',
          startTime: s.startTime || s.startedAt || '',
        })));
      })
      .catch(() => setSessions([]));
  }, []);

  const selectedSession = sessions.find((s) => s.id === sessionId);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6">
          {
            /* Header */
          }
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Teacher Dashboard</h1>
              <p className="text-gray-500 mt-1">Live student engagement heatmap</p>
            </div>
            <div className="flex items-center gap-3">
              {
                /* Session picker */
              }
              <div className="relative">
                <button
                  data-testid="session-picker"
                  onClick={() => setShowPicker((v) => !v)}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white transition-colors"
                >
                  {selectedSession ? selectedSession.courseName : sessions.length > 0 ? 'Choose Session' : 'No Active Sessions'}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {showPicker && sessions.length > 0 && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setSessionId(s.id); setShowPicker(false); }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                          sessionId === s.id ? 'bg-engagio-600/20 text-engagio-400' : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        <div className="font-medium truncate">{s.courseName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {s.startTime ? new Date(s.startTime).toLocaleString() : 'No date'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Class Pulse Chart */}
          {sessionId && (
            <Card className="mb-6">
              <ClassPulseChart sessionId={sessionId} />
            </Card>
          )}

          {/* Heatmap */}
          <Card>
            {!sessionId ? (
              <div className="text-center text-gray-500 py-12 text-sm">
                Select an active session above to view the live engagement heatmap.
              </div>
            ) : (
              <TeacherHeatmap sessionId={sessionId} />
            )}
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}
