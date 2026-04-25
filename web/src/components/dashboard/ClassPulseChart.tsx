/**
 * ClassPulseChart.tsx
 *
 * GREEN Phase: Renders a live AreaChart showing the class average
 * engagement score over the last 30 polling ticks (~ 5 min at 10s intervals).
 *
 * Dependencies: recharts ^3.8 (already installed)
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useLiveScores } from './TeacherHeatmap';

interface PulsePoint {
  time: string;
  average: number;
}

export interface ClassPulseChartProps {
  sessionId: string;
}

/* ─── Engagio-theme tooltip ─── */
function PulseTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0].value as number;
  const cls =
    value > 70
      ? 'text-engagio-success'
      : value >= 40
        ? 'text-engagio-warning'
        : 'text-engagio-danger';

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 shadow-xl">
      <span className="text-xs text-gray-400">Class Avg</span>
      <div className={`text-sm font-bold ${cls}`}>{value}/100</div>
    </div>
  );
}

export default function ClassPulseChart({ sessionId }: ClassPulseChartProps) {
  const { scores } = useLiveScores(sessionId);
  const [history, setHistory] = useState<PulsePoint[]>([]);
  const historyRef = useRef<PulsePoint[]>([]);

  /* ── Append a new data point every time scores update ── */
  useEffect(() => {
    if (scores.length === 0) return;

    const avg = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);

    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    historyRef.current = [...historyRef.current, { time, average: avg }];
    // Keep the last 30 snapshots ≈ 5 min at 10-second polls
    if (historyRef.current.length > 30) {
      historyRef.current = historyRef.current.slice(-30);
    }
    setHistory([...historyRef.current]);
  }, [scores]);

  const currentAvg = history.length > 0 ? history[history.length - 1].average : 0;

  const avgColor =
    currentAvg > 70
      ? 'text-engagio-success'
      : currentAvg >= 40
        ? 'text-engagio-warning'
        : 'text-engagio-danger';

  return (
    <div className="space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-100">Class Pulse</h2>

          {/* Live indicator */}
          <div
            data-testid="pulse-live-indicator"
            className="relative flex items-center gap-1.5"
          >
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-engagio-success opacity-75"
              />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-engagio-success"
              />
            </span>
            <span className="text-xs font-semibold text-engagio-success uppercase tracking-wider">
              Live
            </span>
          </div>
        </div>

        <div className={`text-2xl font-bold ${avgColor}`}>
          {history.length > 0 ? `${currentAvg}` : '—'}
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="pulseGradient" x1="0" y1="0" x2="0" y2="1">
                {/* Top (100%) → success (green) */}
                <stop offset="5%" stopColor="var(--color-engagio-success)" stopOpacity={0.35} />
                {/* Bottom (0%) → danger (red) */}
                <stop offset="95%" stopColor="var(--color-engagio-danger)" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />

            <XAxis
              dataKey="time"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip content={<PulseTooltip />} />

            <Area
              type="monotone"
              dataKey="average"
              stroke="var(--color-engagio-success)"
              strokeWidth={2}
              fill="url(#pulseGradient)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--color-engagio-success)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
