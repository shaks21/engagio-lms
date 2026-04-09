'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';

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
}

export default function Chat({ userId, userName, socket, sessionId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    // Mark as read when chat is opened
    setUnreadCount(0);
  }, [isOpen]);

  // Listen for chat messages from the server
  useEffect(() => {
    if (!socket) return;

    const onChatMessage = (data: {
      id: string;
      userId: string;
      userName: string;
      text: string;
      timestamp: string;
    }) => {
      const isOwn = data.userId === userId;
      // Skip own messages if already added optimistically
      if (isOwn) return;

      const msg: Message = {
        id: data.id,
        userId: data.userId,
        userName: data.userName,
        text: data.text,
        timestamp: new Date(data.timestamp),
        isOwn,
      };

      setMessages((prev) => [...prev, msg]);
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on('chat-message', onChatMessage);
    return () => {
      socket.off('chat-message', onChatMessage);
    };
  }, [socket, isOpen, userId]);

  const handleSend = () => {
    if (!input.trim()) return;
    if (!socket) return;

    const text = input.trim();
    const msgId = Date.now().toString();

    // Optimistically show own message
    const ownMsg: Message = {
      id: msgId,
      userId,
      userName: userName || 'You',
      text,
      timestamp: new Date(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, ownMsg]);

    // Broadcast to server
    socket.emit('engagementEvent', {
      type: 'CHAT',
      payload: { text, sessionId },
    });

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="Open Chat"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 w-80 h-96 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div>
          <h3 className="font-semibold text-sm">Classroom Chat</h3>
          {unreadCount > 0 && (
            <span className="text-xs opacity-80">{unreadCount} unread</span>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  msg.isOwn
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-700 text-gray-100 rounded-bl-none'
                }`}
              >
                {!msg.isOwn && (
                  <div className="text-xs text-blue-300 mb-0.5">{msg.userName}</div>
                )}
                {msg.text}
              </div>
              <span className="text-[10px] text-gray-500 mt-0.5 px-1">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 p-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={!input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
