'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { ChevronDown, ChevronUp, BarChart3, Users, Zap } from 'lucide-react';
import { type EngagementScore, type ClassPulseEntry } from '@/hooks/useEngagement';

interface ClassStatsProps {
  scores: EngagementScore[];
  avgScore: number;
  history: ClassPulseEntry[];
  isTeacher?: boolean;
}

export default function ClassStats({
  scores,
  avgScore,
  history,
  isTeacher = false,
}: ClassStatsProps) {
  const [open, setOpen] = React.useState(true);

  if (!isTeacher) return null;

  // Build history chart data — last 10 entries max
  const chartData = useMemo(() => {
    return history.slice(-12).map((p) => ({
      time: new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: p.score,
    }));
  }, [history]);

  // Per-student mini-bars
  const studentData = useMemo(() => {
    return scores
      .map((s) => ({
        name: s.email.split('@')[0].slice(0, 10),
        score: s.score,
        color: s.score > 70 ? '#22c55e' : s.score >= 40 ? '#eab308' : '#ef4444',
      }))
      .slice(0, 8);
  }, [scores]);

  return (
    <motion.div
      className="absolute top-14 right-4 z-40 w-72"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/60 hover:bg-gray-800/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-engagio-400" />
            <span className="text-sm font-semibold text-white">Class Stats</span>
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-2 px-4 pt-3 pb-2">
                <div className="bg-gray-900/40 rounded-lg p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Zap
                      className={`w-3.5 h-3.5 ${
                        avgScore > 70 ? 'text-green-400' : avgScore > 40 ? 'text-yellow-400' : 'text-red-400'
                      }`}
                    />
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg</span>
                  </div>
                  <div
                    className={`text-xl font-bold ${
                      avgScore > 70 ? 'text-green-400' : avgScore > 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}
                  >
                    {avgScore}
                  </div>
                </div>
                <div className="bg-gray-900/40 rounded-lg p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-engagio-400" />
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Active</span>
                  </div>
                  <div className="text-xl font-bold text-white">{scores.length}</div>
                </div>
              </div>

              {/* Class Pulse line chart */}
              {chartData.length > 1 && (
                <div className="px-4 pb-3">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Class Pulse (10 min)</div>
                  <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: '#e2e8f0',
                          }}
                        />
                        <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                          {chartData.map((_, index) => (
                            <Cell
                              key={index}
                              fill={
                                (chartData[index]?.score || 0) > 70
                                  ? '#22c55e'
                                  : (chartData[index]?.score || 0) >= 40
                                    ? '#eab308'
                                    : '#ef4444'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Student mini-bars */}
              {studentData.length > 0 && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Students</div>
                  {studentData.map((s) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 w-20 truncate">{s.name}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${s.score}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 w-7 text-right">{s.score}</span>
                    </div>
                  ))}
                </div>
              )}

              {scores.length === 0 && history.length === 0 && (
                <p className="text-center text-gray-500 text-xs py-4">No engagement data yet</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
