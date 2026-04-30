'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Award, Hash } from 'lucide-react';

export interface LeaderboardEntry {
  userId: string;
  totalScore: number;
  rank: number;
}

interface LeaderboardDisplayProps {
  entries: LeaderboardEntry[];
}

export default function LeaderboardDisplay({ entries }: LeaderboardDisplayProps) {
  const maxScore = Math.max(...entries.map((e) => e.totalScore), 1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md mx-auto bg-edu-slate/95 border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden"
      data-testid="leaderboard-display"
    >
      <div className="px-6 py-4 border-b border-gray-800/60 bg-engagio-600/10 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-engagio-400" />
        <span className="text-sm font-semibold text-white">Leaderboard</span>
        <span className="ml-auto text-xs text-gray-400">{entries.length} participants</span>
      </div>

      <div className="max-h-80 overflow-y-auto scrollbar-hide py-2">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No scores yet.</p>
        ) : (
          entries.map((entry) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/30 transition-colors"
            >
              <RankIcon rank={entry.rank} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {entry.userId.slice(0, 12)}
                </p>
              </div>
              <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                <div
                  className="h-full bg-engagio-500 rounded-full"
                  style={{ width: `${(entry.totalScore / maxScore) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-engagio-300 w-10 text-right">{entry.totalScore}</span>
              <span className="text-[10px] text-gray-500 w-6 text-center">#{entry.rank}</span>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Medal className="w-4 h-4 text-yellow-400 shrink-0" />;
  if (rank === 2) return <Award className="w-4 h-4 text-gray-300 shrink-0" />;
  if (rank === 3) return <Award className="w-4 h-4 text-amber-600 shrink-0" />;
  return <Hash className="w-4 h-4 text-gray-500 shrink-0" />;
}
