'use client';

import { ArrowRight, Play, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-engagio-500/10 blur-[120px]" />
        <div className="absolute top-40 right-0 w-[300px] h-[300px] rounded-full bg-secondary/10 blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-engagio-500/25 bg-engagio-600/10 px-4 py-1.5 text-xs font-medium text-engagio-300 mb-8">
            <Zap className="w-3.5 h-3.5" />
            <span>Now with 18+ real-time engagement signals</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight text-white">
            Stop Broadcasting.
            <br />
            <span className="bg-gradient-to-r from-engagio-400 to-secondary bg-clip-text text-transparent">
              Start Engaging.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            The LMS that <em>reads the room</em>. Transform passive video calls into
            data-driven classrooms with real-time student tracking, intelligent breakout
            rooms, and live engagement scoring.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <motion.a
              href="/register"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-engagio-600 text-white font-semibold text-sm shadow-xl shadow-engagio-600/25 hover:bg-engagio-700 transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </motion.a>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-gray-600/60 text-gray-300 font-semibold text-sm hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Watch Demo
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
