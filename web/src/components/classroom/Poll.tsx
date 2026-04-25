'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, CheckCircle2, BarChart3, BarChart2 } from 'lucide-react';

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  percentage: number;
}

export interface PollData {
  id: string;
  question: string;
  totalVotes: number;
  status: 'active' | 'closed';
  options: PollOption[];
}

export interface PollProps {
  polls: PollData[];
  userId: string;
  isTeacher: boolean;
  onCreatePoll: (question: string, options: string[]) => void;
  onVote: (pollId: string, optionId: string) => void;
}

export default function Poll({ polls, userId, isTeacher, onCreatePoll, onVote }: PollProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [optionInputs, setOptionInputs] = useState(['', '', '', '']);
  const [collapsedPolls, setCollapsedPolls] = useState<Record<string, boolean>>({});
  const [hasVoted, setHasVoted] = useState<Record<string, boolean>>({});

  // Merge incoming polls with local collapse state
  useEffect(() => {
    setCollapsedPolls((prev) => {
      const next: Record<string, boolean> = {};
      polls.forEach((p) => {
        next[p.id] = prev[p.id] ?? (p.status === 'closed');
      });
      return next;
    });
  }, [polls.length]);

  const toggleCollapse = (pollId: string) => {
    setCollapsedPolls((prev) => ({ ...prev, [pollId]: !prev[pollId] }));
  };

  const handleCreate = () => {
    const trimmedOpts = optionInputs.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || trimmedOpts.length < 2) return;
    onCreatePoll(question.trim(), trimmedOpts);
    setQuestion('');
    setOptionInputs(['', '', '', '']);
    setIsCreating(false);
  };

  const handleVote = (pollId: string, optionId: string) => {
    if (hasVoted[pollId]) return;
    setHasVoted((prev) => ({ ...prev, [pollId]: true }));
    onVote(pollId, optionId);
  };

  return (
    <div data-testid="poll-container" className="flex-1 flex flex-col overflow-hidden bg-gray-900/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-engagio-400" />
          <span className="text-sm font-semibold text-white">Polls</span>
          {polls.length > 0 && (
            <span className="bg-engagio-600/30 text-engagio-300 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
              {polls.length}
            </span>
          )}
        </div>
        {isTeacher && (
          <button
            onClick={() => setIsCreating((s) => !s)}
            data-testid="create-poll-btn"
            className="text-xs bg-engagio-500 hover:bg-engagio-400 text-white px-3 py-1.5 rounded-md transition-colors font-medium"
          >
            {isCreating ? 'Cancel' : 'Create Poll'}
          </button>
        )}
      </div>

      {isTeacher && isCreating && (
        <div className="p-4 space-y-3 border-b border-gray-800">
          <input
            data-testid="poll-question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-engagio-500"
          />
          {optionInputs.map((opt, i) => (
            <input
              key={i}
              data-testid="poll-option"
              type="text"
              value={opt}
              onChange={(e) => {
                const next = [...optionInputs];
                next[i] = e.target.value;
                setOptionInputs(next);
              }}
              placeholder={`Option ${i + 1}`}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-engagio-500"
            />
          ))}
          <button
            onClick={handleCreate}
            disabled={!question.trim() || optionInputs.filter(Boolean).length < 2}
            className="w-full bg-engagio-500 hover:bg-engagio-400 disabled:bg-gray-700 disabled:text-gray-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Launch Poll
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence mode="popLayout">
          {polls.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <BarChart3 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No active polls</p>
            </motion.div>
          ) : (
            polls.map((poll) => {
              const collapsed = collapsedPolls[poll.id] ?? false;
              const userAlreadyVoted = hasVoted[poll.id];
              const showResults = userAlreadyVoted || poll.status === 'closed';

              return (
                <motion.div
                  key={poll.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden"
                >
                  <button
                    onClick={() => toggleCollapse(poll.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-sm font-medium text-gray-100 truncate pr-2">{poll.question}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] text-gray-400">{poll.totalVotes} votes</span>
                      {collapsed ? (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          {showResults
                            ? poll.options.map((opt) => (
                                <div key={opt.id} className="relative">
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-gray-300">{opt.text}</span>
                                    <span className="text-gray-400">{opt.voteCount} ({opt.percentage}%)</span>
                                  </div>
                                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${opt.percentage}%` }}
                                      transition={{ duration: 0.6, ease: 'easeOut' }}
                                      className="h-full bg-engagio-500 rounded-full"
                                    />
                                  </div>
                                </div>
                              ))
                            : poll.options.map((opt) => (
                                <button
                                  key={opt.id}
                                  onClick={() => handleVote(poll.id, opt.id)}
                                  disabled={userAlreadyVoted}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg border border-gray-600/30 text-left transition-colors disabled:opacity-50"
                                >
                                  <div className="w-4 h-4 rounded-full border-2 border-gray-500 flex-shrink-0" />
                                  <span className="text-sm text-gray-200">{opt.text}</span>
                                </button>
                              ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
