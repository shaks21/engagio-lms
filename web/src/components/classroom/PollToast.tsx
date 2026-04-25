'use client';

import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { PollData } from './Poll';

export interface PollToastProps {
  poll: PollData;
  onVote: (pollId: string, optionId: string) => void;
  onDismiss: () => void;
}

export default function PollToast({ poll, onVote, onDismiss }: PollToastProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleVote = (optionId: string) => {
    setSelected(optionId);
    setShowResults(true);
    onVote(poll.id, optionId);
    setTimeout(onDismiss, 3000);
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[360px] max-w-[92vw]">
      <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700/60 rounded-2xl shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-engagio-400" />
          <span className="text-sm font-semibold text-white">New Poll</span>
        </div>
        <p className="text-sm text-gray-200 mb-3 leading-relaxed">{poll.question}</p>

        {showResults ? (
          <div className="space-y-2">
            {poll.options.map((opt) => (
              <div key={opt.id} className="relative">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-300">{opt.text}</span>
                  <span className="text-gray-400">{opt.voteCount} ({opt.percentage}%)</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div style={{ width: `${opt.percentage}%` }} className="h-full bg-engagio-500 rounded-full transition-all duration-500" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {poll.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleVote(opt.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700/50 text-left transition-colors"
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected === opt.id ? 'border-engagio-500 bg-engagio-500' : 'border-gray-500'
                }`}>
                  {selected === opt.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
                <span className="text-sm text-gray-200">{opt.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
