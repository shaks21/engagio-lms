'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { UserPlus, ArrowRight, Loader2 } from 'lucide-react';

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const { login } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      await axios.post(`${API}/auth/register`, { email, password, role });
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.errors?.join(', ') || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0b0f1a]">
      <div className="w-full max-w-md">
        <div className="bg-[#151b2b] rounded-2xl border border-[#232d42] shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-engagio-500/20 text-engagio-400 mb-4">
              <UserPlus className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Create Account</h1>
            <p className="mt-2 text-sm text-gray-400">Join the Engagio learning community</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
              <input
                id="email" type="email" required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors"
                placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <input
                id="password" type="password" required minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors"
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-1.5">Role</label>
              <select
                id="role" required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-600 bg-[#0b0f1a] text-gray-100 focus:outline-none focus:ring-2 focus:ring-engagio-500 focus:border-transparent transition-colors"
                value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={submitting}
              >
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</>
              ) : (
                <>Create Account<ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-engagio-400 hover:text-engagio-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
