'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { BookOpen, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0b0f1a]">
      <div className="w-full max-w-md">
        <div className="bg-[#151b2b] rounded-2xl border border-[#232d42] shadow-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-engagio-500/20 text-engagio-400 mb-4">
              <BookOpen className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-gray-100 tracking-tight">
              Welcome to Engagio
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Sign in to your learning space
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm animate-fade-in">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link href="/register" className="text-engagio-400 hover:text-engagio-300 font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
