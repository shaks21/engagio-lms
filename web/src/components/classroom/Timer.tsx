'use client';

import React, { useState, useEffect, useRef } from 'react';

interface TimerProps {
  startTime?: Date;
  className?: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function Timer({ startTime, className = '' }: TimerProps) {
  const startTimeRef = useRef(startTime ? new Date(startTime).getTime() : Date.now());
  const [elapsed, setElapsed] = useState(Date.now() - startTimeRef.current);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Empty deps - only run once

  return (
    <div className={`font-mono text-sm flex items-center gap-2 text-white ${className}`}>
      <span className="text-red-500 text-xs animate-pulse">●</span>
      <span className="text-gray-300">LIVE</span>
      <span className="text-gray-500">|</span>
      <span className="text-white font-semibold">
        {formatDuration(elapsed)}
      </span>
    </div>
  );
}
