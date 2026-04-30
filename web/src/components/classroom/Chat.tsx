'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Megaphone } from 'lucide-react';
import type { Socket } from 'socket.io-client';

export interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
  isOwn: boolean;
  breakoutRoomId: string | null;
}

interface ChatProps {
  userId: string;
  userName: string;
  socket: Socket | null;
  sessionId: string;
  messages: Message[];
  onAddMessage: (msg: Message) => void;
  breakoutRoomId?: string | null;       // default: shows current room + broadcasts
  isBroadcastChat?: boolean;             // if true, show ALL messages + broadcast composer
  roomTitle?: string;
  isTeacher?: boolean;
  availableRooms?: string[];             // list of room IDs for teacher to switch between
  readOnly?: boolean;                  // if true, hide composer (e.g. student broadcast tab)
}

const REACTIONS = ['👍', '❓', '🎉', '💡'];

function Avatar({ name, isOwn }: { name: string; isOwn?: boolean }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
        isOwn ? 'bg-engagio-600 text-white' : 'bg-gray-700 text-gray-200'
      }`}
    >
      {initial}
    </div>
  );
}

function ChatMessage({ msg }: { msg: Message }) {
  const timeStr = msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isBroadcast = msg.breakoutRoomId === 'broadcast';

  return (
    <div className={`flex gap-3 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar name={msg.userName} isOwn={msg.isOwn} />
      <div className={`max-w-[75%] ${msg.isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`flex items-center gap-2 mb-1 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
          <span className={`text-xs font-semibold ${msg.isOwn ? 'text-engagio-400' : isBroadcast ? 'text-yellow-400' : 'text-gray-300'}`}>
            {msg.isOwn ? 'You' : msg.userName}
          </span>
          <span className="text-[11px] text-gray-500">{timeStr}</span>
          {isBroadcast && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-500/20">
              Broadcast
            </span>
          )}
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
            isBroadcast
              ? 'bg-yellow-900/30 text-yellow-100 rounded-tl-sm border border-yellow-500/20'
              : msg.isOwn
                ? 'bg-engagio-600 text-white rounded-tr-sm'
                : 'bg-gray-800 text-gray-100 rounded-tl-sm'
          }`}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
}

export default function Chat({
  userId,
  userName,
  socket,
  sessionId,
  messages,
  onAddMessage,
  breakoutRoomId = null,
  isBroadcastChat = false,
  roomTitle,
  isTeacher = false,
  availableRooms: externalRooms = [],
  readOnly = false,
}: ChatProps) {
  const [input, setInput] = React.useState('');
  const [activeRoom, setActiveRoom] = React.useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default active room — always sync with user's current breakout room
  useEffect(() => {
    if (!isBroadcastChat && breakoutRoomId) {
      setActiveRoom(breakoutRoomId);
    }
  }, [breakoutRoomId, isBroadcastChat]);

  // Auto-derive available rooms from message breakoutRoomIds so tabs appear
  // even if parent doesn't pass an explicit list. Merge with externalRooms.
  const availableRooms = useMemo(() => {
    const set = new Set<string>(externalRooms);
    messages.forEach((m) => {
      if (m.breakoutRoomId && m.breakoutRoomId !== 'broadcast') {
        set.add(m.breakoutRoomId);
      }
    });
    return Array.from(set);
  }, [externalRooms, messages]);

  // All room tabs — teachers see all rooms, students see Main Room + their breakout room
  const roomTabs = useMemo(() => {
    if (isBroadcastChat) return [];
    const tabs: string[] = [];
    if (isTeacher) {
      tabs.push('main');
      const rooms = new Set(availableRooms);
      rooms.delete('main');
      rooms.delete('broadcast');
      tabs.push(...Array.from(rooms).sort());
    } else {
      // Students see Main Room tab and their current breakout room tab
      tabs.push('main');
      const myRoom = breakoutRoomId || 'main';
      if (myRoom !== 'main') tabs.push(myRoom);
    }
    return tabs;
  }, [isBroadcastChat, availableRooms, isTeacher, breakoutRoomId]);

  // Filter messages
  // Teachers see all rooms; students see only Main Room + their allocated room + broadcasts
  const filteredMessages = useMemo(() => {
    if (isBroadcastChat) {
      // Show only global broadcasts
      return messages.filter((m) => m.breakoutRoomId === 'broadcast');
    }
    if (isTeacher) {
      const targetRoom = activeRoom || breakoutRoomId || 'main';
      return messages.filter((m) => m.breakoutRoomId === targetRoom || m.breakoutRoomId === 'broadcast');
    }
    // Student: show ONLY the selected tab's room messages + broadcasts
    const targetRoom = activeRoom || breakoutRoomId || 'main';
    return messages.filter((m) => m.breakoutRoomId === targetRoom || m.breakoutRoomId === 'broadcast');
  }, [messages, breakoutRoomId, activeRoom, isBroadcastChat, isTeacher]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() || !socket) return;

    const text = input.trim();
    const msgId = Date.now().toString();
    const room = activeRoom || breakoutRoomId || 'main';

    const ownMsg: Message = {
      id: msgId,
      userId,
      userName: userName || 'You',
      text,
      timestamp: new Date(),
      isOwn: true,
      breakoutRoomId: room,
    };

    onAddMessage(ownMsg);

    socket.emit('engagementEvent', {
      type: 'CHAT',
      payload: { text, sessionId, breakoutRoomId: room },
    });

    setInput('');
  }, [input, socket, userId, userName, sessionId, onAddMessage, breakoutRoomId, activeRoom]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReaction = (emoji: string) => {
    const msgId = Date.now().toString();
    const room = activeRoom || breakoutRoomId || 'main';
    const ownMsg: Message = {
      id: msgId,
      userId,
      userName: userName || 'You',
      text: emoji,
      timestamp: new Date(),
      isOwn: true,
      breakoutRoomId: room,
    };

    onAddMessage(ownMsg);
    socket?.emit('engagementEvent', {
      type: 'CHAT',
      payload: { text: emoji, sessionId, breakoutRoomId: room },
    });
  };

  const sendBroadcast = useCallback(() => {
    if (!input.trim() || !socket || !isTeacher) return;
    const text = input.trim();
    socket.emit('broadcast-chat', { sessionId, content: text }, (res: any) => {
      if (res?.status === 'ok') {
        onAddMessage({
          id: `bc_${Date.now()}`,
          userId,
          userName: userName || 'You',
          text,
          timestamp: new Date(),
          isOwn: true,
          breakoutRoomId: 'broadcast',
        });
      }
    });
    setInput('');
  }, [input, socket, sessionId, userId, userName, onAddMessage, isTeacher]);

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Room tabs — teachers AND students */}
      {!isBroadcastChat && roomTabs.length > 1 && (
        <div className="flex border-b border-gray-800 overflow-x-auto scrollbar-hide">
          {roomTabs.map((roomId) => (
            <button
              key={roomId}
              onClick={() => setActiveRoom(roomId)}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
                (activeRoom || breakoutRoomId || 'main') === roomId
                  ? 'text-engagio-400 border-b-2 border-engagio-500 bg-engagio-900/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {roomId === 'main' ? 'Main Room' : roomId}
            </button>
          ))}
        </div>
      )}

      {/* Room title header */}
      {roomTitle && (
        <div className="px-3 py-1.5 border-b border-gray-800 bg-gray-800/50">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{roomTitle}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-10">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p>No messages yet.</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          filteredMessages.map((msg) => <ChatMessage key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — hidden when readOnly (student in broadcast tab) */}
      {!readOnly && (
        <div className="p-3 border-t border-gray-800 bg-edu-dark/80">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isBroadcastChat ? "Broadcast to all rooms..." : "Type a message..."}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-engagio-500 transition-colors"
            />
            {isBroadcastChat && isTeacher ? (
              <button
                onClick={sendBroadcast}
                className="p-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                disabled={!input.trim()}
                aria-label="Send broadcast"
              >
                <Megaphone className="w-4 h-4 text-white" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                className="p-2 bg-engagio-600 hover:bg-engagio-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {/* Quick reactions */}
          {!isBroadcastChat && (
            <div className="flex gap-2 mt-2">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
