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
    <div className={`bg-[#151b2b] rounded-xl border border-[#232d42] shadow-sm overflow-hidden transition-colors hover:border-gray-600 ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-[#232d42] bg-[#151b2b]/80 flex items-center justify-between">
          <h3 className="font-semibold text-gray-100">{title}</h3>
          {badge && (
            <span className="bg-engagio-900/30 text-engagio-400 text-xs font-medium px-2 py-1 rounded-full">
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
