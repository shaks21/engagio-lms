'use client';

import React from 'react';
import { GraduationCap, Users, Clock, Circle, Settings, Monitor, Video } from 'lucide-react';
import Timer from './Timer';

export type ViewMode = 'focus' | 'grid' | 'immersive';

interface GlassHeaderProps {
  title?: string;
  instructor?: string;
  participantCount?: number;
  connected: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onLeave: () => void;
  /** Whether to show the recording indicator */
  showRecording?: boolean;
  /** Whether the session is currently being recorded */
  isRecording?: boolean;
}

export default function GlassHeader({
  title = 'Virtual Classroom',
  instructor = 'Instructor',
  participantCount = 1,
  connected,
  viewMode,
  onViewModeChange,
  onLeave,
  showRecording = false,
  isRecording = false,
}: GlassHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 glass-panel z-50 flex items-center justify-between px-4 lg:px-6">
      {/* Left: Class Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-engagio-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-white leading-tight">{title}</h1>
            <p className="text-xs text-gray-400">{instructor}</p>
          </div>
        </div>

        <div className="h-6 w-px bg-gray-700 hidden sm:block" />

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{participantCount}</span>
          </span>
          <span className="flex items-center gap-1 text-engagio-400">
            <Clock className="w-3.5 h-3.5" />
            <Timer startTime={new Date(Date.now())} />
          </span>
          <span
            className={`flex items-center gap-1 ${connected ? 'text-edu-success' : 'text-yellow-500'}`}
            title={connected ? 'Connected' : 'Connecting...'}
          >
            <Circle className={`w-2 h-2 fill-current ${connected ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{connected ? 'Live' : 'Connecting'}</span>
          </span>
        </div>
      </div>

      {/* Center: View Mode Toggles */}
      <div className="hidden md:flex items-center bg-gray-800/50 rounded-lg p-1 gap-1">
        {(
          [
            { mode: 'focus', label: 'Focus', Icon: Video },
            { mode: 'grid', label: 'Grid', Icon: Users },
            { mode: 'immersive', label: 'Immersive', Icon: Monitor },
          ] as { mode: ViewMode; label: string; Icon: React.ElementType }[]
        ).map(({ mode, label, Icon }) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={`control-btn px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
              viewMode === mode
                ? 'bg-edu-slate text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            title={`${label} view`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Right: Session Controls */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-px bg-gray-700 hidden sm:block" />

        {showRecording && isRecording && (
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20 animate-pulse">
            <Circle className="w-2 h-2 fill-current" />
            <span className="hidden sm:inline">REC</span>
          </button>
        )}

        <button
          onClick={onLeave}
          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 ml-2"
        >
          Leave
        </button>

        <button className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors ml-1">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
