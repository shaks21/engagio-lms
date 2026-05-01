'use client';

import React, { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Sidebar from '@/components/ui/sidebar';
import Card from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { getProfile, updateProfile, getUserAnalytics } from '@/lib/api';
import { Calendar, Edit3, Save, X, User, BookOpen, Activity, Clock, Mail, Shield, Building } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  role: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

interface UserAnalytics {
  totalSessions: number;
  totalEvents: number;
  totalDwellTime: number;
  sessions: any[];
}

export default function ProfilePage() {
  const { user, setUser, userName } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', avatar: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profileData = await getProfile();
      setProfile(profileData);
      setForm({
        name: profileData.name || '',
        bio: profileData.bio || '',
        avatar: profileData.avatar || '',
      });
      // Only load analytics for non-guest users
      if (profileData.role !== 'GUEST') {
        try {
          const analyticData = await getUserAnalytics(profileData.id);
          setAnalytics(analyticData);
        } catch {
          // Analytics may not be available
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      const updates: { name?: string; bio?: string; avatar?: string } = {};
      if (form.name.trim()) updates.name = form.name.trim();
      if (form.bio.trim()) updates.bio = form.bio.trim();
      if (form.avatar.trim()) updates.avatar = form.avatar.trim();

      const updated = await updateProfile(updates);
      setProfile(updated);
      // Also update auth context
      if (user) {
        setUser({ ...user, name: updated.name, bio: updated.bio, avatar: updated.avatar });
      }
      setEditMode(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile?.name || profile?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(/[\s._-]/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#0b0f1a]">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="w-8 h-8 border-2 border-engagio-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Page Title */}
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-100">Profile</h1>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-engagio-600 hover:bg-engagio-700 text-white text-sm font-medium transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Profile
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Profile Header Card */}
              <Card>
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  {/* Avatar */}
                  <div className="shrink-0">
                    {profile?.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={displayName}
                        className="w-24 h-24 rounded-full object-cover border-2 border-engagio-500/30"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-engagio-600/20 border-2 border-engagio-500/30 flex items-center justify-center text-2xl font-bold text-engagio-400">
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-white">{displayName}</h2>
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-engagio-900/30 text-engagio-400 uppercase tracking-wider">
                        {profile?.role}
                      </span>
                      {profile?.role === 'GUEST' && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          Guest User
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{profile?.email}</p>
                    {profile?.bio && (
                      <p className="text-gray-300 text-sm leading-relaxed">{profile.bio}</p>
                    )}
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Member since {memberSince}
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        Role: {profile?.role}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" />
                        Org: {profile?.tenantId?.slice(0, 8)}…
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Edit Mode Form */}
              {editMode && (
                <Card title="Edit Profile" badge="Editing">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Display Name</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Your display name"
                        className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-white text-sm focus:outline-none focus:border-engagio-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Avatar URL</label>
                      <input
                        type="text"
                        value={form.avatar}
                        onChange={(e) => setForm((f) => ({ ...f, avatar: e.target.value }))}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-white text-sm focus:outline-none focus:border-engagio-500 transition-colors"
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter a direct image URL. Leave blank to use initials.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Bio</label>
                      <textarea
                        value={form.bio}
                        onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                        placeholder="Tell us about yourself..."
                        rows={3}
                        maxLength={500}
                        className="w-full px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-white text-sm focus:outline-none focus:border-engagio-500 transition-colors resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1 text-right">{form.bio.length}/500</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setError('');
                          if (profile) {
                            setForm({
                              name: profile.name || '',
                              bio: profile.bio || '',
                              avatar: profile.avatar || '',
                            });
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Activity Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card title="Total Sessions" badge="📊">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-engagio-600/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-engagio-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{analytics?.totalSessions ?? 0}</p>
                      <p className="text-xs text-gray-500">Class sessions attended</p>
                    </div>
                  </div>
                </Card>
                <Card title="Engagement Events" badge="🎯">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{analytics?.totalEvents ?? 0}</p>
                      <p className="text-xs text-gray-500">Total interactions</p>
                    </div>
                  </div>
                </Card>
                <Card title="Time Spent" badge="⏱">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{analytics ? formatDuration(analytics.totalDwellTime) : '0m'}</p>
                      <p className="text-xs text-gray-500">Total learning time</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Account Information */}
              <Card title="Account Information">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Email Address</label>
                      <p className="text-white flex items-center gap-2 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {profile?.email}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">User ID</label>
                      <p className="text-gray-300 font-mono text-xs mt-0.5">{profile?.id}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Role</label>
                      <p className="text-white mt-0.5">{profile?.role}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Last Updated</label>
                      <p className="text-gray-300 text-xs mt-0.5">
                        {profile?.updatedAt
                          ? new Date(profile.updatedAt).toLocaleString('en-US')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
