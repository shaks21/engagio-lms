"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/auth-guard";
import Sidebar from "@/components/ui/sidebar";
import Card from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ClassPulseData {
  time: string;
  score: number;
}

export default function ClassPulsePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; classroomCode: string; startedAt: string; course?: { title: string } }[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [pulseData, setPulseData] = useState<ClassPulseData[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) loadPulse(selectedSession);
  }, [selectedSession]);

  const loadSessions = async () => {
    try {
      const res = await fetch("/api/sessions/history");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0) setSelectedSession(data[0].id);
      }
    } catch {
      setError("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const loadPulse = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/analytics/session/${sessionId}/history`);
      if (res.ok) {
        const data = await res.json();
        setPulseData(data.classPulse || []);
      }
    } catch {
      setError("Failed to load class pulse");
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Class Pulse</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Session selector */}
          <Card className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Session
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.course?.title || "Session"} — Code: {s.classroomCode} — {new Date(s.startedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </Card>

          {/* Chart */}
          <Card title="Class Engagement Over Time">
            {pulseData.length === 0 ? (
              <p className="text-gray-400 py-12 text-center text-center">
                No engagement data yet. Start a classroom session and wait 60s for the first snapshot.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={pulseData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    stroke="#9ca3af"
                  />
                  <YAxis domain={[0, 100]} stroke="#9ca3af" />
                  <Tooltip
                    labelFormatter={(v) => new Date(v).toLocaleTimeString()}
                    formatter={(value) => [`Score: ${value}`, "Engagement"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}
