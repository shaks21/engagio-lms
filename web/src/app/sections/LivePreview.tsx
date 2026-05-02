'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Activity, MousePointer, Mic, Eye } from 'lucide-react';

function randomScore(base: number) {
  const noise = Math.floor(Math.random() * 15) - 7;
  return Math.max(0, Math.min(100, base + noise));
}

export default function LivePreview() {
  const [score, setScore] = useState(72);
  const [events, setEvents] = useState<string[]>([]);

  const rawX = useMotionValue(0);
  const liveScore = useTransform(rawX, (v) => {
    const clamped = Math.min(v, 100);
    return Math.max(0, Math.min(100, Math.round(50 + (clamped / 100) * 50)));
  });

  const [displayScore, setDisplayScore] = useState(72);

  useEffect(() => {
    const unsub = liveScore.on('change', (v) => setDisplayScore(v));
    return () => unsub();
  }, [liveScore]);

  useEffect(() => {
    let s = 72;
    const interval = setInterval(() => {
      s = randomScore(s);
      setScore(s);
      const eventPool = ['mouse_track', 'mic', 'blur', 'focus', 'chat', 'keystroke'];
      const evt = eventPool[Math.floor(Math.random() * eventPool.length)];
      setEvents((prev) => [evt, ...prev].slice(0, 5));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const barColor =
    score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  const dotColor =
    score >= 70 ? 'bg-green-400 shadow-green-400/40' :
    score >= 40 ? 'bg-yellow-400 shadow-yellow-400/40' :
    'bg-red-400 shadow-red-400/40';

  return (
    <section className="relative py-24 sm:py-28 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            See the <span className="text-engagio-400">Heartbeat</span> in real-time
          </h2>
          <p className="mt-4 text-gray-400 max-w-xl mx-auto">
            A live preview of how Engagio tracks a student's engagement score as events stream in.
          </p>
        </div>

        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative w-full max-w-md rounded-3xl border border-white/[0.06] p-7"
            style={{ background: 'rgba(21,27,43,0.7)', backdropFilter: 'blur(16px)' }}
          >
            {/* Glow ring */}
            <div className="absolute -inset-[1px] rounded-3xl pointer-events-none" style={{ background: 'radial-gradient(600px circle at 50% 0%, rgba(14,165,233,0.12), transparent 60%)' }} />

            <div className="relative flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-3 h-3 rounded-full ${dotColor} shadow-[0_0_12px]`} />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" style={{ color: score >= 70 ? '#4ade80' : score >= 40 ? '#facc15' : '#f87171' }} />
                  </span>
                </div>
                <span className="text-sm font-semibold text-white">Alex R.</span>
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Student</span>
            </div>

            <div className="flex items-end gap-3 mb-6">
              <span className={`text-5xl font-extrabold tracking-tighter ${
                score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {score}
              </span>
              <span className="text-sm text-gray-500 mb-2 font-medium">
                / 100
              </span>
            </div>

            {/* Bar */}
            <div className="h-2.5 w-full rounded-full bg-white/[0.06] mb-6 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${barColor}`}
                initial={{ width: '72%' }}
                animate={{ width: `${score}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
              />
            </div>

            {/* Incoming event stream */}
            <div className="space-y-2">
              {events.map((evt, i) => {
                const icons: Record<string, React.ReactNode> = {
                  mouse_track: <MousePointer className="w-3.5 h-3.5" />,
                  mic: <Mic className="w-3.5 h-3.5" />,
                  blur: <Eye className="w-3.5 h-3.5" />,
                  focus: <Eye className="w-3.5 h-3.5" />,
                  chat: <Activity className="w-3.5 h-3.5" />,
                  keystroke: <Activity className="w-3.5 h-3.5" />,
                };
                const labels: Record<string, string> = {
                  mouse_track: 'Mouse move',
                  mic: 'Mic active',
                  blur: 'Tab blurred',
                  focus: 'Tab focused',
                  chat: 'Chat message',
                  keystroke: 'Keystroke',
                };
                return (
                  <motion.div
                    key={i + evt}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-gray-300 border border-white/[0.04]"
                  >
                    {icons[evt]}
                    <span className="font-medium">{labels[evt]}</span>
                    <span className="ml-auto text-[10px] text-gray-500">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
