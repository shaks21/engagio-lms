'use client';

import { Wifi, Radio } from 'lucide-react';
import { motion } from 'framer-motion';

const metrics = [
  { icon: Radio, label: '18+ Engagement Signals Tracked', color: 'text-engagio-400' },
  { icon: Wifi, label: 'Low-Latency LiveKit Integration', color: 'text-green-400' },
];

export default function MetricBar() {
  return (
    <section className="relative border-y border-white/[0.05] bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
              className="flex items-center gap-3 text-sm font-medium text-gray-300"
            >
              <m.icon className={`w-5 h-5 ${m.color}`} />
              <span>{m.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
