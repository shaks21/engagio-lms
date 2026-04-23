'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import type { Socket } from 'socket.io-client';

interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
  isOwn: boolean;
}

interface ChatProps {
  userId: string;
  userName: string;
  socket: Socket | null;
  sessionId: string;
  embedded?: boolean;
  onUnreadChange?: (count: number) => void;
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

  return (
    <div className={`flex gap-3 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar name={msg.userName} isOwn={msg.isOwn} />
      <div className={`max-w-[75%] ${msg.isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`flex items-center gap-2 mb-1 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
          <span className={`text-xs font-semibold ${msg.isOwn ? 'text-engagio-400' : 'text-gray-300'}`}>
            {msg.isOwn ? 'You' : msg.userName}
          </span>
          <span className="text-[11px] text-gray-500">{timeStr}</span>
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
            msg.isOwn
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
  embedded = true,
  onUnreadChange,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus on mount
  useEffect(() => {
    if (embedded) {
      inputRef.current?.focus();
      setUnreadCount(0);
      onUnreadChange?.(0);
    }
  }, [embedded, onUnreadChange]);

  // Socket listener
  useEffect(() => {
    if (!socket) return;

    const onChatMessage = (data: {
      id: string;
      userId: string;
      userName: string;
      text: string;
      timestamp: string;
    }) => {
      if (data.userId === userId) return; // already shown optimistically

      const msg: Message = {
        id: data.id,
        userId: data.userId,
        userName: data.userName,
        text: data.text,
        timestamp: new Date(data.timestamp),
        isOwn: false,
      };

      setMessages((prev) => [...prev, msg]);
      setUnreadCount((prev) => {
        const next = prev + 1;
        onUnreadChange?.(next);
        return next;
      });
    };

    socket.on('chat-message', onChatMessage);
    return () => {
      socket.off('chat-message', onChatMessage);
    };
  }, [socket, userId, onUnreadChange]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !socket) return;

    const text = input.trim();
    const msgId = Date.now().toString();

    const ownMsg: Message = {
      id: msgId,
      userId,
      userName: userName || 'You',
      text,
      timestamp: new Date(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, ownMsg]);

    socket.emit('engagementEvent', {
      type: 'CHAT',
      payload: { text, sessionId },
    });

    setInput('');
  }, [input, socket, userId, userName, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReaction = (emoji: string) => {
    const msgId = Date.now().toString();
    const ownMsg: Message = {
      id: msgId,
      userId,
      userName: userName || 'You',
      text: emoji,
      timestamp: new Date(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, ownMsg]);

    socket?.emit('engagementEvent', {
      type: 'CHAT',
      payload: { text: emoji, sessionId },
    });
  };

  return (
    <div className={`flex flex-col ${embedded ? 'h-full bg-transparent' : 'h-full'}`} ref={containerRef}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.length === 0 ? (
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
          messages.map((msg) => <ChatMessage key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-800 bg-edu-dark/80">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-engagio-500 transition-colors"
          />
          <button
            onClick={handleSend}
            className="p-2 bg-engagio-600 hover:bg-engagio-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Quick reactions */}
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
      </div>
    </div>
  );
}
