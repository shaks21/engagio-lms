"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/auth-guard";
import Sidebar from "@/components/ui/sidebar";
import Card from "@/components/ui/card";
import api from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface StudentScore {
  userId: string;
  email: string;
  score: number;
  color: "green" | "yellow" | "red";
  lastUpdate: string;
}

function getScoreColor(cls: string): string {
  if (cls === "green") return "bg-green-500";
  if (cls === "yellow") return "bg-yellow-500";
  return "bg-red-500";
}

function getBorderColor(cls: string): string {
  if (cls === "green") return "border-green-400";
  if (cls === "yellow") return "border-yellow-400";
  return "border-red-400";
}

export default function TeacherDashboardPage() {
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScores = async () => {
    setRefreshing(true);
    try {
      const res = await api.get("/analytics/users/scores");
      setStudents(res.data);
    } catch {
      setError("Failed to fetch engagement scores");
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
    green: students.filter((s) => s.score > 70).length,
    yellow: students.filter((s) => s.score >= 40 && s.score <= 70).length,
    red: students.filter((s) => s.score < 40).length,
  };

  const avgScore =
    students.length > 0
      ? Math.round(students.reduce((a, b) => a + b.score, 0) / students.length)
      : 0;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
              <p className="text-gray-500 mt-1">Live student engagement heatmap</p>
            </div>
            <button
              onClick={fetchScores}
              disabled={refreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {refreshing ? "Refreshing..." : "Refresh Now"}
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <Card>
              <div className="text-3xl font-bold text-gray-900">{students.length}</div>
              <div className="text-sm text-gray-500">Total Tracked</div>
            </Card>
            <Card>
              <div className="text-3xl font-bold text-green-600">{stats.green}</div>
              <div className="text-sm text-gray-500">Engaged (&gt;70)</div>
            </Card>
            <Card>
              <div className="text-3xl font-bold text-yellow-600">{stats.yellow}</div>
              <div className="text-sm text-gray-500">Neutral (40-70)</div>
            </Card>
            <Card>
              <div className="text-3xl font-bold text-red-600">{stats.red}</div>
              <div className="text-sm text-gray-500">Disengaged (&lt;40)</div>
            </Card>
          </div>

          {/* Average Score Gauge */}
          <Card className="mb-8">
            <div className="text-lg font-semibold text-gray-700 mb-3">Class Average Score</div>
            <div className="flex items-center gap-6">
              <div className="text-5xl font-bold text-gray-900">{avgScore}</div>
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all duration-700 ${getScoreColor(
                      avgScore > 70 ? "green" : avgScore >= 40 ? "yellow" : "red"
                    )}`}
                    style={{ width: `${avgScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Heatmap Grid */}
          <Card title="Student Engagement Heatmap">
            {loading ? (
              <div className="text-gray-400 py-8 text-center">Loading...</div>
            ) : students.length === 0 ? (
              <div className="text-gray-400 py-8 text-center">
                No students currently in session. Start a classroom session to see live scores.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
                {students.map((s) => (
                  <div
                    key={s.userId}
                    className={`p-4 rounded-xl border-2 ${getBorderColor(s.color)} ${
                      s.color === "green"
                        ? "bg-green-50"
                        : s.color === "yellow"
                        ? "bg-yellow-50"
                        : "bg-red-50"
                    } transition-colors duration-500`}
                  >
                    <div className="text-sm font-medium text-gray-700 truncate">{s.email}</div>
                    <div className="text-xl font-bold mt-2 text-gray-900">{s.score}</div>
                    <div className={`text-xs mt-1 capitalize ${
                      s.color === "green" ? "text-green-600" :
                      s.color === "yellow" ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {s.color}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(s.lastUpdate).toLocaleTimeString()}
                    </div>
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
