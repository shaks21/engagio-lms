'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';

export interface BroadcastMessage {
  id: string;
  content: string;
  senderId: string;
  timestamp: string;
}

interface BroadcastOverlayProps {
  socket?: any;
  isTeacher?: boolean;
  onSendBroadcast?: (content: string) => void;
}

export default function BroadcastOverlay({ socket, isTeacher, onSendBroadcast }: BroadcastOverlayProps) {
  const [toasts, setToasts] = useState<BroadcastMessage[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!socket) return;
    const onGlobalBroadcast = (data: { content: string; senderId: string; timestamp: string }) => {
      if (!data?.content) return;
      const msg: BroadcastMessage = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        content: data.content,
        senderId: data.senderId,
        timestamp: data.timestamp,
      };
      setToasts((prev) => [...prev, msg]);
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 5000);
    };
    socket.on('global-broadcast-chat', onGlobalBroadcast);
    return () => { socket.off('global-broadcast-chat', onGlobalBroadcast); };
  }, [socket]);

  const handleSend = () => {
    if (!input.trim() || !onSendBroadcast) return;
    onSendBroadcast(input.trim());
    setInput('');
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg space-y-2 pointer-events-none">
      {/* Incoming global broadcast toasts (shown to all) */}
      {toasts.map((msg) => (
        <div
          key={msg.id}
          className="pointer-events-auto bg-yellow-900/90 border border-yellow-500/40 rounded-lg px-4 py-3 shadow-xl backdrop-blur flex items-start gap-3"
        >
          <Megaphone className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-0.5">Teacher Broadcast</p>
            <p className="text-sm text-white leading-snug">{msg.content}</p>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== msg.id))}
            className="text-yellow-400/60 hover:text-yellow-400 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Teacher broadcast composer */}
      {isTeacher && onSendBroadcast && (
        <div className="pointer-events-auto bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 shadow-xl backdrop-blur flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-engagio-400 flex-shrink-0" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Send global broadcast..."
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="text-xs px-2.5 py-1 rounded bg-engagio-600/80 hover:bg-engagio-600 text-white disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
