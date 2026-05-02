'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Footer() {
  const [email, setEmail] = useState('');

  return (
    <footer className="relative border-t border-white/[0.06] mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Engagio</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              The LMS that reads the room. Built for instructors who refuse to lecture into the void.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Link
                href="https://github.com/shaks21/engagio-lms"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                GitHub
              </Link>
              <span className="text-gray-600">|</span>
              <Link href="/docs" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Documentation
              </Link>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Product</h4>
            <ul className="space-y-2.5">
              {['Features', 'Pricing', 'Changelog', 'Roadmap'].map((item) => (
                <li key={item}>
                  <a href={`#${item.toLowerCase()}`} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Stay in the loop</h4>
            <p className="text-sm text-gray-400">
              Get product updates and release notes. No spam.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) {
                  setEmail('');
                }
              }}
              className="flex gap-2"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-lg border border-gray-600/60 bg-[#0b0f1a] text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors"
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-engagio-600 text-white text-sm font-semibold hover:bg-engagio-700 transition-colors cursor-pointer"
              >
                Subscribe
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.button>
            </form>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/[0.06] text-center">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Engagio LMS. Open-source on{' '}
            <a href="https://github.com/shaks21/engagio-lms" className="text-gray-400 hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>.
          </p>
        </div>
      </div>
    </footer>
  );
}
