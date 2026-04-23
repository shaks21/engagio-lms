'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  HelpCircle,
  X,
} from 'lucide-react';
import Chat from './Chat';

export type SidebarTab = 'chat' | 'participants' | 'qa';

interface SidebarProps {
  open: boolean;
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
  sessionId: string;
  socket: any;
  userId: string;
  userName: string;
  unreadChatCount: number;
  onResetChatCount?: () => void;
}

function TabButton({
  id,
  label,
  icon: Icon,
  active,
  onClick,
  badge,
}: {
  id: SidebarTab;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
        active
          ? 'text-engagio-400 border-b-2 border-engagio-500'
          : 'text-gray-400 hover:text-white'
      }`}
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge && badge > 0 && (
        <span className="bg-engagio-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

/* ─── Simple participant list for sidebar ─── */
function ParticipantRow({
  name,
  isHost,
  isYou,
  muted,
  speaking,
}: {
  name: string;
  isHost?: boolean;
  isYou?: boolean;
  muted?: boolean;
  speaking?: boolean;
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50">
      <div className="relative">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
          speaking ? 'bg-green-600' : 'bg-gray-700'
        } transition-colors`}>
          {initials}
        </div>
        {isHost && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-engagio-500 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {name} {isYou && <span className="text-engagio-400 text-xs">(You)</span>}
        </p>
        <p className="text-[11px] text-gray-500 capitalize">{isHost ? 'Host' : 'Student'}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${muted ? 'bg-edu-danger' : 'bg-edu-success'}`} />
        {muted && (
          <svg className="w-3.5 h-3.5 text-edu-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        )}
      </div>
    </div>
  );
}

/* ─── Simple Q&A stub ─── */
function QAPanel() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <button className="w-full py-2 bg-engagio-600 hover:bg-engagio-700 rounded-lg text-sm font-medium transition-colors text-white flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Ask a Question
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide text-center text-gray-500">
        <p className="text-sm mt-8">No questions yet.</p>
      </div>
    </div>
  );
}

/* ─── Main Sidebar ─── */
export default function Sidebar({
  open,
  tab,
  onTabChange,
  onClose,
  sessionId,
  socket,
  userId,
  userName,
  unreadChatCount,
  onResetChatCount,
}: SidebarProps) {
  return (
    <aside
      className={`sidebar-panel bg-edu-slate border-l border-gray-800 flex flex-col overflow-hidden transition-[width] duration-300 ${
        open ? 'w-72 sm:w-80' : 'w-0'
      }`}
      aria-label="Chat and participants panel"
    >
      <div className="w-72 sm:w-80 h-full flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <TabButton
            id="chat"
            label="Chat"
            icon={MessageSquare}
            active={tab === 'chat'}
            onClick={() => {
              onTabChange('chat');
              onResetChatCount?.();
            }}
            badge={tab !== 'chat' ? unreadChatCount : 0}
          />
          <TabButton
            id="participants"
            label="People"
            icon={Users}
            active={tab === 'participants'}
            onClick={() => onTabChange('participants')}
          />
          <TabButton
            id="qa"
            label="Q&A"
            icon={HelpCircle}
            active={tab === 'qa'}
            onClick={() => onTabChange('qa')}
          />

          <button
            onClick={onClose}
            className="px-3 text-gray-400 hover:text-white transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panels */}
        <div className="flex-1 overflow-hidden">
          {tab === 'chat' && (
            <div className="h-full">
              <Chat
                userId={userId || ''}
                userName={userName || 'Anonymous'}
                socket={socket}
                sessionId={sessionId}
                embedded
              />
            </div>
          )}

          {tab === 'participants' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <ParticipantRow name="Prof. Sarah Chen" isHost speaking />
              <ParticipantRow name="Alex Johnson" isYou />
              <ParticipantRow name="Maria Garcia" muted />
              {/* TODO: hook into useParticipants() to render actual list */}
            </div>
          )}

          {tab === 'qa' && <QAPanel />}
        </div>
      </div>
    </aside>
  );
}
