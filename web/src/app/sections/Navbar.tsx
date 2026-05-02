'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]"
      style={{ background: 'rgba(11,15,26,0.65)', backdropFilter: 'blur(16px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Engagio Home">
            <div className="w-8 h-8 rounded-lg bg-engagio-600 flex items-center justify-center shadow-lg shadow-engagio-600/20">
              <BookOpen className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Engagio</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="https://github.com/shaks21/engagio-lms" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex px-4 py-2 rounded-lg text-sm font-semibold text-engagio-400 border border-engagio-600/40 hover:bg-engagio-600/10 transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="inline-flex px-4 py-2 rounded-lg text-sm font-semibold bg-engagio-600 text-white hover:bg-engagio-700 transition-colors shadow-lg shadow-engagio-600/20"
            >
              Launch App
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
