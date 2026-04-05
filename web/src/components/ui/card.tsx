'use client';

import React, { ReactNode } from 'react';

interface CardProps {
  title?: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, badge, children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          {badge && (
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
