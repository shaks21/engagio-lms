'use client';

import React from 'react';
import {
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
} from '@livekit/components-react';
import {
  MessageSquare,
  Users,
  HelpCircle,
  BarChart3,
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Pin,
  Hand,
  Layers,
} from 'lucide-react';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import Chat from './Chat';
import Poll, { type PollData } from './Poll';
import BreakoutTab from './BreakoutTab';

import { BrainCircuit, Trophy } from 'lucide-react';
import QuizPanel from './QuizPanel';

export type SidebarTab = 'chat' | 'participants' | 'qa' | 'poll' | 'quiz' | 'breakout' | 'broadcast';

import ToastContainer, { type Toast } from './ToastContainer';

export interface SidebarProps {
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
  chatMessages: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: Date;
    isOwn: boolean;
    breakoutRoomId: string | null;
  }>;
  onAddChatMessage: (msg: {
    id: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: Date;
    isOwn: boolean;
    breakoutRoomId: string | null;
  }) => void;
  isTeacher?: boolean;
  polls?: PollData[];
  onCreatePoll?: (question: string, options: string[]) => void;
  onVotePoll?: (pollId: string, optionId: string) => void;
  breakoutRoomId?: string | null;
  availableRooms?: string[];
  onToast?: (toast: Toast) => void;
}

/* ─── Live participant row ─── */
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

  // Breakout room label for mobile / participants list
  const roomLabel = (() => {
    try {
      const meta = JSON.parse(participant.metadata || '{}');
      return meta.breakoutRoomId || null;
    } catch { return null; }
  })();

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
      } ${isHandRaised ? 'bg-yellow-500/5' : ''}`}
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
        {isHandRaised && !isSpeaking && (
          <span className="absolute -bottom-0 -right-0 w-3.5 h-3.5 bg-yellow-500 rounded-full border-2 border-gray-900 flex items-center justify-center"
                title="Hand raised">
            <Hand className="w-2 h-2 text-black" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
          {name}
          {isLocal && <span className="text-engagio-400 text-xs">(You)</span>}
          {isPinned && <Pin className="w-3 h-3 text-engagio-400 flex-shrink-0" />}
          {roomLabel ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-engagio-600/30 text-engagio-300 border border-engagio-500/30 whitespace-nowrap">
              {roomLabel === 'main' ? 'Main Room' : roomLabel}
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/40 text-gray-300 border border-gray-600/30 whitespace-nowrap">Main Room</span>
          )}
          {isHandRaised && <span className="text-yellow-400 text-xs font-medium ml-1">🙋 Hand Raised</span>}
        </p>
        <p className="text-[11px] text-gray-500 capitalize">{isLocal ? 'Host' : 'Participant'}</p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!audioMuted ? <Mic className="w-3.5 h-3.5 text-green-400" /> : <MicOff className="w-3.5 h-3.5 text-gray-500" />}
        {!cameraOff ? <Video className="w-3.5 h-3.5 text-green-400" /> : <VideoOff className="w-3.5 h-3.5 text-gray-500" />}
        {screenSharing && <MonitorUp className="w-3.5 h-3.5 text-blue-400" />}
      </div>
    </button>
  );
}

/* ─── Participants panel ─── */
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

  const sortedParticipants = React.useMemo(() => {
    const list: Participant[] = [];
    if (localParticipant) list.push(localParticipant);
    participants.forEach((p) => {
      if (p.sid !== localParticipant?.sid) list.push(p);
    });
    list.sort((a, b) => {
      const aHand = raisedHands?.[a.identity] ? 1 : 0;
      const bHand = raisedHands?.[b.identity] ? 1 : 0;
      if (bHand !== aHand) return bHand - aHand;
      return (a.name || a.identity).localeCompare(b.name || b.identity);
    });
    return list;
  }, [participants, localParticipant, raisedHands]);

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
            isHandRaised={raisedHands?.[p.identity]}
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
  const [questions, setQuestions] = React.useState<
    { id: string; userId: string; userName: string; text: string; votes: number; voted: boolean; answered: boolean }[]
  >([]);
  const [text, setText] = React.useState('');

  React.useEffect(() => {
    if (!socket) return;
    const onQuestion = (data: any) => {
      if (!data?.id) return;
      setQuestions((prev) => {
        if (prev.some((q) => q.id === data.id)) return prev;
        return [...prev, {
          id: data.id,
          userId: data.userId,
          userName: data.userName || data.userId?.slice(0, 8) || 'User',
          text: data.text || '',
          votes: data.votes || 0,
          voted: false,
          answered: data.answered || false,
        }];
      });
    };
    const onVote = (data: any) => {
      setQuestions((prev) => prev.map((q) => (q.id === data?.id ? { ...q, votes: data.votes ?? q.votes } : q)));
    };
    const onAnswer = (data: any) => {
      setQuestions((prev) => prev.map((q) => (q.id === data?.id ? { ...q, answered: true } : q)));
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
    socket.emit('engagementEvent', { type: 'QUESTION', payload: { id, text: text.trim(), sessionId } });
    setQuestions((prev) => [...prev, { id, userId, userName: userName || 'You', text: text.trim(), votes: 0, voted: false, answered: false }]);
    setText('');
  };

  const vote = (id: string) => {
    if (!socket) return;
    socket.emit('engagementEvent', { type: 'QUESTION_VOTE', payload: { id, sessionId } });
    setQuestions((prev) => prev.map((q) => q.id === id && !q.voted ? { ...q, votes: q.votes + 1, voted: true } : q));
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
              <div key={q.id} className={`p-3 rounded-lg border ${q.answered ? 'border-green-500/30 bg-green-900/10' : 'border-gray-700 bg-gray-800/50'}`}>
                <p className="text-sm text-white leading-relaxed">{q.text}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-gray-500">{q.userName}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => vote(q.id)}
                      disabled={q.voted}
                      className={`text-xs px-2 py-1 rounded-md transition-colors ${q.voted ? 'bg-engagio-600 text-white' : 'bg-gray-700 text-gray-300 hover:text-white'}`}
                    >
                      ▲ {q.votes}
                    </button>
                    {q.answered && <span className="text-[11px] text-green-400 font-medium">Answered ✓</span>}
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

/* ─── Icon rail button ─── */
function IconRailButton({
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
      data-testid={`rail-btn-${id}`}
      onClick={onClick}
      className={`w-full flex flex-col items-center justify-center gap-1 py-3 px-1 transition-colors ${
        active ? '' : 'hover:bg-gray-800/50'
      }`}
      aria-label={label}
      title={label}
    >
      <div
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          active
            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
            : 'text-gray-400'
        }`}
      >
        <Icon className="w-5 h-5" />
        {badge && badge > 0 && (
          <span className="absolute -top-1 -right-1 bg-engagio-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span
        className={`text-[10px] font-medium leading-none mt-0.5 ${
          active ? 'text-gray-300' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

const TAB_CONFIG: { id: SidebarTab; label: string; icon: React.ElementType; teacherOnly?: boolean }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'participants', label: 'People', icon: Users },
  { id: 'qa', label: 'Q&A', icon: HelpCircle },
  { id: 'poll', label: 'Polls', icon: BarChart3 },
  { id: 'quiz', label: 'Quizzes', icon: BrainCircuit },
  { id: 'breakout', label: 'Rooms', icon: Layers },
];

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
  chatMessages,
  onAddChatMessage,
  isTeacher,
  polls,
  onCreatePoll,
  onVotePoll,
  breakoutRoomId,
  availableRooms,
  onToast,
}: SidebarProps) {
  const pollCount = polls?.filter((p) => p.status === 'active').length ?? 0;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="sidebar-backdrop md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        data-testid="classroom-sidebar"
        className={`sidebar-panel bg-edu-slate border-l border-gray-800 flex overflow-hidden transition-[width] duration-300 ${
          open ? 'w-auto' : 'w-0'
        }`}
        aria-label="Chat and participants panel"
      >
        <div className="flex h-full">
          {/* ── Left icon rail ── */}
          <div
            data-testid="sidebar-icon-rail"
            className="w-16 sm:w-[72px] flex-shrink-0 flex flex-col border-r border-gray-800 bg-[#121218] py-2 overflow-y-auto"
          >
            {TAB_CONFIG.filter(
              (t) => !t.teacherOnly || isTeacher
            ).map((t) => (
              <IconRailButton
                key={t.id}
                id={t.id}
                label={t.label}
                icon={t.icon}
                active={tab === t.id}
                onClick={() => {
                  onTabChange(t.id);
                  if (t.id === 'chat') onResetChatCount?.();
                }}
                badge={
                  t.id === 'chat' && tab !== 'chat'
                    ? unreadChatCount > 0
                      ? unreadChatCount
                      : undefined
                    : t.id === 'poll'
                    ? pollCount > 0
                      ? pollCount
                      : undefined
                    : undefined
                }
              />
            ))}
          </div>

          {/* ── Right content panel ── */}
          <div className="w-64 sm:w-72 h-full flex flex-col">
            {/* Header */}
            <div
              data-testid="sidebar-content-header"
              className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800 bg-[#151520]"
            >
              <span className="text-sm font-semibold text-white">
                {TAB_CONFIG.find((t) => t.id === tab)?.label || tab}
              </span>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"
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
                    messages={chatMessages}
                    onAddMessage={onAddChatMessage}
                    breakoutRoomId={breakoutRoomId || 'main'}
                    roomTitle={isTeacher ? 'All Rooms' : undefined}
                    isTeacher={isTeacher}
                    availableRooms={availableRooms || [breakoutRoomId || 'main']}
                  />
                </div>
              )}
              {tab === 'broadcast' && (
                <div className="h-full">
                  <Chat
                    userId={userId || ''}
                    userName={userName || 'Anonymous'}
                    socket={socket}
                    sessionId={sessionId}
                    messages={chatMessages}
                    onAddMessage={onAddChatMessage}
                    isBroadcastChat={true}
                    isTeacher={isTeacher}
                    roomTitle="Broadcast to All Rooms"
                    readOnly={!isTeacher}
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
              {tab === 'poll' && <Poll
                polls={polls || []}
                userId={userId}
                isTeacher={isTeacher || false}
                onCreatePoll={onCreatePoll || (() => {})}
                onVote={onVotePoll || (() => {})}
              />}
              {tab === 'quiz' && (
                <div className="h-full">
                  <QuizPanel sessionId={sessionId} socket={socket} isTeacher={!!isTeacher} />
                </div>
              )}
              {tab === 'breakout' && isTeacher && (
                <div className="h-full">
                  <BreakoutTab roomName={sessionId} socket={socket} onToast={onToast} />
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
