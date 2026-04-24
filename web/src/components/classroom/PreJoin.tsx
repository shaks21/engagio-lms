'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, ArrowRight, Volume2 } from 'lucide-react';

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

  // Mic test state
  const [micLevel, setMicLevel] = useState(0);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number>(0);

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
    let active = true;

    if (cameraEnabled && cameraAvailable) {
      getMediaDeviceStream({ video: true, audio: false })
        .then((s) => {
          if (!active) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          setPreviewStream(s);
        })
        .catch(() => setError('Unable to access camera'));
    } else {
      setPreviewStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
    }

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraEnabled, cameraAvailable]);

  // Bind stream to video element whenever either changes
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (previewStream) {
      el.srcObject = previewStream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [previewStream]);

  // Toggle preview when enabling mic + setup mic test visualizer
  useEffect(() => {
    if (!micEnabled || !micAvailable) {
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      micAnalyserRef.current?.disconnect();
      micAudioCtxRef.current?.close().catch(() => {});
      micAnalyserRef.current = null;
      micAudioCtxRef.current = null;
      setMicLevel(0);
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;

    getMediaDeviceStream({ audio: true, video: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        src.connect(analyser);
        micAudioCtxRef.current = ctx;
        micAnalyserRef.current = analyser;

        const dataArr = new Uint8Array(analyser.frequencyBinCount);
        const update = () => {
          if (!micAnalyserRef.current) return;
          micAnalyserRef.current.getByteFrequencyData(dataArr);
          const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
          setMicLevel(avg);
          micRafRef.current = requestAnimationFrame(update);
        };
        micRafRef.current = requestAnimationFrame(update);
      })
      .catch(() => setError('Unable to access microphone'));

    return () => {
      cancelled = true;
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      micAnalyserRef.current?.disconnect();
      micAudioCtxRef.current?.close().catch(() => {});
      stream?.getTracks().forEach((t) => t.stop());
    };
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
        <div className="aspect-video bg-gray-900 relative rounded-t-none overflow-hidden">
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
        </div>

        {/* Controls row — OUTSIDE video so they don't cover it */}
        <div className="p-4 pb-2 flex items-center justify-center gap-3">
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

        {/* Mic test visualizer */}
        {micEnabled && micAvailable && (
          <div className="px-6 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Volume2 className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Mic Test</span>
            </div>
            <div className="h-8 flex items-end gap-0.5">
              {Array.from({ length: 16 }).map((_, i) => {
                const threshold = (i / 16) * 255;
                const filled = micLevel >= threshold;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm transition-all duration-75 ${
                      filled ? 'bg-green-500' : 'bg-gray-700'
                    }`}
                    style={{
                      height: `${20 + Math.random() * 60}%`,
                      opacity: filled ? 0.6 + (i / 16) * 0.4 : 0.3,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

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
