'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, X } from 'lucide-react';

export interface HandRaiseEntry {
  userId: string;
  identity: string;
  name: string;
  raisedAt: number; // timestamp
}

interface HandRaiseQueueProps {
  queue: HandRaiseEntry[];
  onSpotlight: (userId: string) => void;
  onDismiss: (userId: string) => void;
  isTeacher?: boolean;
}

export default function HandRaiseQueue({
  queue,
  onSpotlight,
  onDismiss,
  isTeacher = false,
}: HandRaiseQueueProps) {
  if (queue.length === 0 || !isTeacher) return null;

  return (
    <motion.div
      className="absolute top-14 left-4 z-40"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="glass-panel rounded-xl px-3 py-2 max-w-xs shadow-lg">
        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-gray-700">
          <Hand className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-semibold text-yellow-400">Raised Hands ({queue.length})</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <AnimatePresence>
            {queue.map((entry) => {
              const initials = entry.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <motion.div
                  key={entry.userId}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="relative flex-shrink-0 group"
                >
                  <button
                    onClick={() => onSpotlight(entry.userId)}
                    className="w-11 h-11 rounded-full bg-yellow-500/10 border-2 border-yellow-400/40
                               flex items-center justify-center text-xs font-bold text-yellow-300
                               hover:bg-yellow-500/20 hover:border-yellow-400 transition-all"
                    title={`Spotlight ${entry.name}`}
                  >
                    {initials}
                  </button>
                  <button
                    onClick={() => onDismiss(entry.userId)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-800
                               text-gray-400 hover:text-white hover:bg-gray-700
                               flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
