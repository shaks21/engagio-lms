'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

/* ------------------------------------------------------------------ */
/* Page shell: pure wrapper. Everything below the fold is loaded via  */
/* next/dynamic(…, { ssr:false }) so zero LiveKit code reaches SSR.   */
/* ------------------------------------------------------------------ */

const ClassroomContent = dynamic(
  () => import('@/components/classroom/ClassroomContent'),
  { ssr: false }
);

const LoadingFallback = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
      <p className="text-gray-400">Loading classroom…</p>
    </div>
  </div>
);

export default function ClassroomPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string | undefined;

  return (
    <React.Suspense fallback={<LoadingFallback />}>
      <ClassroomContent sessionId={sessionId || ''} />
    </React.Suspense>
  );
}
