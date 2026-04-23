'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, ArrowRight } from 'lucide-react';

export interface PreJoinConfig {
  micEnabled: boolean;
  cameraEnabled: boolean;
}

interface PreJoinProps {
  roomName: string;
  userName: string;
  onJoin: (config: PreJoinConfig) => void;
}

function getMediaDeviceStream(constraints: MediaStreamConstraints) {
  return navigator.mediaDevices.getUserMedia(constraints);
}

export default function PreJoin({ roomName, userName, onJoin }: PreJoinProps) {
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check available devices
  useEffect(() => {
    let cancelled = false;
    const checkDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((d) => d.kind === 'audioinput');
        const cams = devices.filter((d) => d.kind === 'videoinput');
        if (!cancelled) {
          setMicAvailable(mics.length > 0);
          setCameraAvailable(cams.length > 0);
        }
      } catch {
        if (!cancelled) {
          setMicAvailable(false);
          setCameraAvailable(false);
        }
      }
    };
    checkDevices();
    return () => { cancelled = true; };
  }, []);

  // Update preview when camera enabled
  useEffect(() => {
    let stream: MediaStream | null = null;

    if (cameraEnabled && cameraAvailable) {
      getMediaDeviceStream({ video: true, audio: false })
        .then((s) => {
          stream = s;
          setPreviewStream(s);
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(() => setError('Unable to access camera'));
    } else {
      if (previewStream) {
        previewStream.getTracks().forEach((t) => t.stop());
        setPreviewStream(null);
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraEnabled, cameraAvailable]);

  // Toggle preview when enabling mic
  useEffect(() => {
    if (!micEnabled || !micAvailable) return;
    // Just verify mic works, don't attach
    let ts: MediaStream | null = null;
    getMediaDeviceStream({ audio: true, video: false })
      .then((s) => { ts = s; ts.getTracks().forEach((t) => t.stop()); })
      .catch(() => setError('Unable to access microphone'));
    return () => { ts?.getTracks().forEach((t) => t.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled, micAvailable]);

  const handleJoin = useCallback(() => {
    // Stop preview stream before joining
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
    }
    onJoin({ micEnabled, cameraEnabled });
  }, [micEnabled, cameraEnabled, previewStream, onJoin]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-edu-slate border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 text-center border-b border-gray-800">
          <h2 className="text-xl font-bold text-white mb-1">Ready to join?</h2>
          <p className="text-sm text-gray-400">
            {roomName} · <span className="text-engagio-400">{userName}</span>
          </p>
        </div>

        {/* Camera preview */}
        <div className="aspect-video bg-gray-900 relative">
          {cameraEnabled && previewStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
                  <VideoOff className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-gray-400 text-sm">Camera is off</p>
              </div>
            </div>
          )}

          {/* Preview overlay controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            <button
              onClick={() => setMicEnabled((v) => !v)}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                micEnabled
                  ? 'bg-gray-700/90 text-white'
                  : 'bg-edu-danger text-white'
              }`}
              aria-label={micEnabled ? 'Mute' : 'Unmute'}
            >
              {micEnabled && micAvailable ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => setCameraEnabled((v) => !v)}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                cameraEnabled
                  ? 'bg-gray-700/90 text-white'
                  : 'bg-edu-danger text-white'
              }`}
              aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            >
              {cameraEnabled && cameraAvailable ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 space-y-3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!micAvailable && (
            <p className="text-yellow-400 text-xs">⚠ No microphone detected</p>
          )}
          {!cameraAvailable && (
            <p className="text-yellow-400 text-xs">⚠ No camera detected</p>
          )}

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-3 bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            {loading ? 'Joining…' : 'Join Classroom'}
          </button>
        </div>
      </div>
    </div>
  );
}
