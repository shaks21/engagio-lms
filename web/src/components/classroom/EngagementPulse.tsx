'use client';

import React from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Activity, TrendingDown, Minus } from 'lucide-react';
import { type EngagementState } from '@/hooks/useEngagement';

interface EngagementPulseProps {
  state: EngagementState;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const pulseConfig: Record<
  EngagementState,
  { color: string; speed: number; opacity: number; label: string; icon: React.ReactNode }
> = {
  green: {
    color: '#22c55e',
    speed: 2,
    opacity: 0.6,
    label: 'Engaged',
    icon: <Activity className="w-full h-full" />,
  },
  yellow: {
    color: '#eab308',
    speed: 0.8,
    opacity: 0.8,
    label: 'Distracted',
    icon: <Minus className="w-full h-full" />,
  },
  red: {
    color: '#ef4444',
    speed: 4,
    opacity: 0.4,
    label: 'Disengaged',
    icon: <TrendingDown className="w-full h-full" />,
  },
};

const sizeMap = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
};

export default function EngagementPulse({
  state,
  showIcon = true,
  size = 'md',
}: EngagementPulseProps) {
  const config = pulseConfig[state];
  const controls = useAnimation();

  React.useEffect(() => {
    void controls.start({
      scale: [0.85, 1.2, 0.85],
      opacity: [config.opacity, 1, config.opacity],
      transition: {
        duration: config.speed,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    });
  }, [state, controls, config.opacity, config.speed]);

  return (
    <motion.div
      className={`relative ${sizeMap[size]} flex items-center justify-center`}
      initial={{ scale: 0.9 }}
      animate={controls}
      title={config.label}
    >
      {/* Outer glow */}
      {state === 'green' && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: config.color }}
          animate={{ opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: config.speed, repeat: Infinity }}
        />
      )}

      {state === 'yellow' && (
        <motion.div
          className="absolute -inset-1 rounded-full border-2"
          style={{ borderColor: config.color }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: config.speed, repeat: Infinity }}
        />
      )}

      {state === 'red' && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: config.color }}
          animate={{ opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: config.speed, repeat: Infinity }}
        />
      )}

      {/* Core dot */}
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: size === 'lg' ? '60%' : size === 'md' ? '55%' : '50%',
          height: size === 'lg' ? '60%' : size === 'md' ? '55%' : '50%',
          backgroundColor: config.color,
          boxShadow: `0 0 ${size === 'lg' ? '10px' : '6px'} ${config.color}`,
        }}
      >
        {showIcon && (
          <span className="text-white" style={{ fontSize: '55%' }}>
            {config.icon}
          </span>
        )}
      </div>
    </motion.div>
  );
}
