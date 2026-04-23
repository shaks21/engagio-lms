'use client';

import React, { useEffect } from 'react';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const iconMap = {
  info: <Info className="w-4 h-4 text-engagio-400" />,
  success: <CheckCircle className="w-4 h-4 text-edu-success" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  error: <AlertCircle className="w-4 h-4 text-edu-danger" />,
};

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  useEffect(() => {
    toasts.forEach((toast) => {
      const timer = setTimeout(() => onRemove(toast.id), 3000);
      return () => clearTimeout(timer);
    });
  }, [toasts, onRemove]);

  return (
    <div className="fixed top-20 right-4 z-[60] space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="glass-panel px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg animate-toast-in pointer-events-auto max-w-sm"
        >
          {iconMap[toast.type || 'info']}
          <span className="text-sm font-medium text-white">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="ml-auto text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
