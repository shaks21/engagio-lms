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
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Pin,
  Hand,
} from 'lucide-react';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
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
  pinnedParticipantSid?: string;
  onPinParticipant?: (sid: string) => void;
}

/* ─── Live participant row with media indicators ─── */
function LiveParticipantRow({
  participant,
  isLocal,
  isPinned,
  onClick,
  isHandRaised,
}: {
  participant: Participant;
  isLocal: boolean;
  isPinned?: boolean;
  onClick?: () => void;
  isHandRaised?: boolean;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const name = participant.name || participant.identity || 'Anonymous';

  const audioMuted = !participant.isMicrophoneEnabled;
  const cameraPub = participant.getTrackPublication(Track.Source.Camera);
  const cameraOff = !cameraPub || !cameraPub.isSubscribed || cameraPub.isMuted;
  const ssPub = participant.getTrackPublication(Track.Source.ScreenShare);
  const screenSharing = !!ssPub && ssPub.isSubscribed && !ssPub.isMuted;

  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 text-left ${
        isPinned ? 'bg-engagio-900/30 border-l-2 border-l-engagio-500' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
            isSpeaking ? 'bg-green-600' : 'bg-gray-700'
          }`}
        >
          {initials}
        </div>
        {isSpeaking && (
          <span className="absolute -bottom-0 -right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-gray-900" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
          {name}
          {isLocal && <span className="text-engagio-400 text-xs">(You)</span>}
          {isPinned && <Pin className="w-3 h-3 text-engagio-400 flex-shrink-0" />}
        </p>
        <p className="text-[11px] text-gray-500 capitalize">
          {isLocal ? 'Host' : 'Participant'}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!audioMuted ? <Mic className="w-3.5 h-3.5 text-green-400" /> : <MicOff className="w-3.5 h-3.5 text-gray-500" />}
        {!cameraOff ? <Video className="w-3.5 h-3.5 text-green-400" /> : <VideoOff className="w-3.5 h-3.5 text-gray-500" />}
        {screenSharing && <MonitorUp className="w-3.5 h-3.5 text-blue-400" />}
        {isHandRaised && <Hand className="w-3.5 h-3.5 text-yellow-400" />}
      </div>
    </button>
  );
}

/* ─── Participants panel using LiveKit hook ─── */
function ParticipantsPanel({
  userId,
  pinnedSid,
  onPinParticipant,
}: {
  userId: string;
  pinnedSid?: string;
  onPinParticipant?: (sid: string) => void;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const sortedParticipants = useMemo(() => {
    const list: Participant[] = [];
    if (localParticipant) list.push(localParticipant);
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
            isPinned={p.sid === pinnedSid}
            onClick={() => onPinParticipant?.(p.sid)}
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
  pinnedParticipantSid,
  onPinParticipant,
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
            <ParticipantsPanel
              userId={userId}
              pinnedSid={pinnedParticipantSid}
              onPinParticipant={onPinParticipant}
            />
          )}

          {tab === 'qa' && <QAPanel />}
        </div>
      </div>
    </aside>
  );
}
