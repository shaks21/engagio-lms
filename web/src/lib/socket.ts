import io from 'socket.io-client';

const BASE_URL = (process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3000').replace(/\/$/, '');
const SOCKET_URL = `${BASE_URL}/classroom`;

let socketInstance: ReturnType<typeof io> | null = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket'],
    });
  }
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export type ClassroomEventHandlers = {
  'user-joined'?: (data: { userId: string; clientId: string }) => void;
  'user-left'?: (data: { clientId: string }) => void;
};

export function setupSocketListeners(handlers: ClassroomEventHandlers) {
  const socket = getSocket();

  if (handlers['user-joined']) {
    socket.on('user-joined', handlers['user-joined']!);
  }
  if (handlers['user-left']) {
    socket.on('user-left', handlers['user-left']!);
  }

  return () => {
    if (handlers['user-joined']) {
      socket.off('user-joined', handlers['user-joined']!);
    }
    if (handlers['user-left']) {
      socket.off('user-left', handlers['user-left']!);
    }
  };
}
