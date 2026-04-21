'use client';

import { useLiveKit } from '@/lib/livekit-context';
import { LiveKitProvider } from '@/lib/livekit-context';

export function ClassroomWithLiveKit({ children }: { children: React.ReactNode }) {
  const { room } = useLiveKit();
  return <LiveKitProvider room={room}>{children}</LiveKitProvider>;
}
