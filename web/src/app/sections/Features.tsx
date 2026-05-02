'use client';

import { Monitor, Users, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: Monitor,
    title: 'The Intelligence Plane',
    color: 'text-engagio-400',
    bg: 'bg-engagio-600/10',
    border: 'border-engagio-600/20',
    description:
      'Real-time 0–100 Engagement Scoring powered by 18+ behavioral signals. Teachers see "Health Dots" on every participant — green for focused, yellow for drifting, red for disengaged. Turn intuition into data.',
    highlights: ['Mouse tracking', 'Keystroke frequency', 'Focus/blur events', 'Mic & camera time'],
  },
  {
    icon: Users,
    title: 'Synchronous Orchestration',
    color: 'text-secondary',
    bg: 'bg-secondary/10',
    border: 'border-secondary/20',
    description:
      'Advanced breakout rooms with physical sharding and permission escalation. Auto-shuffle students, manually assign groups, or let them self-select. Each room runs as an isolated LiveKit context with seamless teacher monitoring.',
    highlights: ['Auto-shuffle', 'Manual assignment', 'Self-select', '25 rooms max'],
  },
  {
    icon: MessageSquare,
    title: 'Interactive Loops',
    color: 'text-green-400',
    bg: 'bg-green-600/10',
    border: 'border-green-600/20',
    description:
      'Launch live polls and quizzes that drive immediate student participation. See answers stream in real-time, trigger nudges for inactive students, and export session analytics for longitudinal insight.',
    highlights: ['Instant polls', 'Timed quizzes', 'Live results', 'Session exports'],
  },
];

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.15 },
  },
};

const card = {
  hidden: { y: 30, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.33, 1, 0.68, 1] as const } },
};

export default function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Built for <span className="text-engagio-400">Synchronous Learning</span>
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Three pillars that turn a video call into a high-fidelity classroom.
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={card}
              whileHover={{ y: -4 }}
              className={`rounded-2xl border ${f.border} p-7 transition-colors duration-300`}
              style={{ background: 'rgba(21,27,43,0.7)', backdropFilter: 'blur(12px)' }}
            >
              <div
                className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-5`}
              >
                <f.icon className={`w-5.5 h-5.5 ${f.color}`} />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-5">
                {f.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {f.highlights.map((h) => (
                  <span
                    key={h}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.05] text-gray-300 border border-white/[0.06]"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
