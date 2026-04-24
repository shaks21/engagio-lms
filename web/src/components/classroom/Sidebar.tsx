'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
  raisedHands?: Record<string, boolean>;
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
  raisedHands,
}: {
  userId: string;
  pinnedSid?: string;
  onPinParticipant?: (sid: string) => void;
  raisedHands?: Record<string, boolean>;
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
            isHandRaised={raisedHands?.[p.sid]}
          />
        ))
      )}
    </div>
  );
}

/* ─── Q&A functional panel with socket ─── */
function QAPanel({
  socket,
  sessionId,
  userId,
  userName,
}: {
  socket: any;
  sessionId: string;
  userId: string;
  userName: string;
}) {
  const [questions, setQuestions] = useState<
    { id: string; userId: string; userName: string; text: string; votes: number; voted: boolean; answered: boolean }[]
  >([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!socket) return;
    const onQuestion = (data: any) => {
      if (!data?.id) return;
      setQuestions((prev) => {
        if (prev.some((q) => q.id === data.id)) return prev;
        return [
          ...prev,
          {
            id: data.id,
            userId: data.userId,
            userName: data.userName || data.userId?.slice(0, 8) || 'User',
            text: data.text || '',
            votes: data.votes || 0,
            voted: false,
            answered: data.answered || false,
          },
        ];
      });
    };
    const onVote = (data: any) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === data?.id ? { ...q, votes: data.votes ?? q.votes } : q))
      );
    };
    const onAnswer = (data: any) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === data?.id ? { ...q, answered: true } : q))
      );
    };
    socket.on('classroom-question', onQuestion);
    socket.on('classroom-question-vote', onVote);
    socket.on('classroom-question-answered', onAnswer);
    return () => {
      socket.off('classroom-question', onQuestion);
      socket.off('classroom-question-vote', onVote);
      socket.off('classroom-question-answered', onAnswer);
    };
  }, [socket]);

  const ask = () => {
    if (!text.trim() || !socket) return;
    const id = Date.now().toString();
    socket.emit('engagementEvent', {
      type: 'QUESTION',
      payload: { id, text: text.trim(), sessionId },
    });
    setQuestions((prev) => [
      ...prev,
      {
        id,
        userId,
        userName: userName || 'You',
        text: text.trim(),
        votes: 0,
        voted: false,
        answered: false,
      },
    ]);
    setText('');
  };

  const vote = (id: string) => {
    if (!socket) return;
    socket.emit('engagementEvent', {
      type: 'QUESTION_VOTE',
      payload: { id, sessionId },
    });
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id && !q.voted
          ? { ...q, votes: q.votes + 1, voted: true }
          : q
      )
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="Type your question..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-engagio-500"
          />
          <button
            onClick={ask}
            disabled={!text.trim()}
            className="bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-white text-sm font-medium transition-colors"
          >
            Ask
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {questions.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-10">
            <p className="mt-8">No questions yet.</p>
            <p className="text-xs mt-1">Be the first to ask a question!</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {questions.map((q) => (
              <div
                key={q.id}
                className={`p-3 rounded-lg border ${
                  q.answered
                    ? 'border-green-500/30 bg-green-900/10'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <p className="text-sm text-white leading-relaxed">{q.text}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-gray-500">{q.userName}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => vote(q.id)}
                      disabled={q.voted}
                      className={`text-xs px-2 py-1 rounded-md transition-colors ${
                        q.voted
                          ? 'bg-engagio-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      ▲ {q.votes}
                    </button>
                    {q.answered && (
                      <span className="text-[11px] text-green-400 font-medium">Answered ✓</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
  raisedHands,
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
              raisedHands={raisedHands}
            />
          )}

          {tab === 'qa' && <QAPanel socket={socket} sessionId={sessionId} userId={userId} userName={userName} />}
        </div>
      </div>
    </aside>
  );
}
