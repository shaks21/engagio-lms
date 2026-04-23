import React from 'react';

function MicrophoneIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'currentColor' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {active ? (
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </>
      ) : (
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <line x1="1" y1="1" x2="23" y2="23" stroke="red" />
        </>
      )}
    </svg>
  );
}

function CameraIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {active ? (
        <>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </>
      ) : (
        <>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          <line x1="1" y1="1" x2="23" y2="23" stroke="red" />
        </>
      )}
    </svg>
  );
}

function ScreenShareIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'currentColor' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="28" height="14" rx="2" ry="2" />
      {active ? (
        <>
          <path d="M8 18h8" />
          <path d="M12 21V18" />
        </>
      ) : (
        <line x1="1" y1="1" x2="23" y2="23" stroke="red" />
      )}
    </svg>
  );
}

function ChatIcon({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1 relative">
      💬
      {count > 0 && (
        <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </span>
  );
}

function LeaveIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="17" y2="12" />
    </svg>
  );
}

interface ToolbarProps {
  onToggleMic: (active: boolean) => void;
  onToggleCamera: (active: boolean) => void;
  onToggleScreenShare: (active: boolean) => void;
  onToggleChat?: () => void;
  onLeave: () => void;
  micActive?: boolean;
  cameraActive?: boolean;
  screenShareActive?: boolean;
  unreadMessages?: number;
}

export default function Toolbar({
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleChat,
  onLeave,
  micActive = true,
  cameraActive = false,
  screenShareActive = false,
  unreadMessages = 0,
}: ToolbarProps) {
  return (
    <div className="border-b border-gray-200 bg-gray-900 text-white px-4 py-3">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        {/* Left: branding */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">Engagio</span>
          <span className="text-gray-400">Virtual Classroom</span>
        </div>

        {/* Center: controls */}
        <div className="flex items-center gap-3">
          {/* Microphone */}
          <button
            onClick={() => onToggleMic(!micActive)}
            className={`p-3 rounded-lg transition-colors flex items-center gap-2 ${
              micActive
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
            aria-label={micActive ? 'Mute microphone' : 'Unmute microphone'}
          >
            <MicrophoneIcon active={micActive} />
            <span className="text-sm">{micActive ? 'Mic On' : 'Mic Off'}</span>
          </button>

          {/* Camera */}
          <button
            onClick={() => onToggleCamera(!cameraActive)}
            className={`p-3 rounded-lg transition-colors flex items-center gap-2 ${
              cameraActive
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title={cameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
            aria-label={cameraActive ? 'Turn off camera' : 'Turn on camera'}
          >
            <CameraIcon active={cameraActive} />
            <span className="text-sm">{cameraActive ? 'Cam On' : 'Cam Off'}</span>
          </button>

          {/* Screen Share */}
          <button
            onClick={() => onToggleScreenShare(!screenShareActive)}
            className={`p-3 rounded-lg transition-colors ${
              screenShareActive
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={screenShareActive ? 'Stop Sharing' : 'Share Screen'}
            aria-label={screenShareActive ? 'Stop screen share' : 'Share screen'}
          >
            <ScreenShareIcon active={screenShareActive} />
          </button>

          {/* Chat */}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
              title="Toggle Chat"
            >
              <ChatIcon count={unreadMessages} />
            </button>
          )}
        </div>

        {/* Right: leave */}
        <button
          onClick={onLeave}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
          title="Leave Classroom"
        >
          <LeaveIcon />
          <span>Leave</span>
        </button>
      </div>
    </div>
  );
}
