'use client';

import React, { useMemo } from 'react';
import {
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
} from '@livekit/components-react';
import {
  MessageSquare,
  Users,
  HelpCircle,
  X,
} from 'lucide-react';
import type { Participant } from 'livekit-client';
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

/* ─── Live participant row ─── */
function LiveParticipantRow({
  participant,
  isLocal,
}: {
  participant: Participant;
  isLocal: boolean;
}) {
  const isSpeaking = useIsSpeaking(participant);
  // Prefer display name, fallback to identity
  const name = participant.name || participant.identity || 'Anonymous';
  const audioMuted = !participant.isMicrophoneEnabled;

  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50">
      <div className="relative">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
            isSpeaking ? 'bg-green-600' : 'bg-gray-700'
          } transition-colors`}
        >
          {initials}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {name} {isLocal && <span className="text-engagio-400 text-xs">(You)</span>}
        </p>
        <p className="text-[11px] text-gray-500 capitalize">
          {isLocal ? 'Host' : 'Participant'}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            audioMuted ? 'bg-edu-danger' : 'bg-edu-success'
          }`}
        />
      </div>
    </div>
  );
}

/* ─── Participants panel using LiveKit hook ─── */
function ParticipantsPanel({ userId }: { userId: string }) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const sortedParticipants = useMemo(() => {
    const list: Participant[] = [];
    // Local first
    if (localParticipant) list.push(localParticipant);
    // Then remotes
    participants.forEach((p) => {
      if (p.sid !== localParticipant?.sid) list.push(p);
    });
    return list;
  }, [participants, localParticipant]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      {sortedParticipants.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">No participants yet</p>
      ) : (
        sortedParticipants.map((p) => (
          <LiveParticipantRow
            key={p.sid}
            participant={p}
            isLocal={p.sid === localParticipant?.sid}
          />
        ))
      )}
    </div>
  );
}

/* ─── Q&A stub ─── */
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
            <ParticipantsPanel userId={userId} />
          )}

          {tab === 'qa' && <QAPanel />}
        </div>
      </div>
    </aside>
  );
}
