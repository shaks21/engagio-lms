'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, ArrowRight, Volume2, Smartphone, Camera as CameraIcon } from 'lucide-react';
import { useMediaDevices } from '@/hooks/useMediaDevices';

export interface PreJoinConfig {
  micEnabled: boolean;
  cameraEnabled: boolean;
  facingMode?: 'user' | 'environment';
  audioInputId?: string | null;
  videoDeviceId?: string | null;
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
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    videoDevices,
    audioInputDevices,
    hasPermission,
    enumerate,
    facingMode,
    setFacingMode,
    selectedCameraId,
    selectedAudioInputId,
    getVideoConstraints,
    getAudioConstraints,
  } = useMediaDevices();

  useEffect(() => {
    enumerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [micLevel, setMicLevel] = useState(0);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number>(0);

  // Camera preview with facingMode + device constraints
  useEffect(() => {
    let active = true;

    if (cameraEnabled && hasPermission) {
      const constraints: MediaStreamConstraints = {
        video: getVideoConstraints(),
        audio: false,
      };
      getMediaDeviceStream(constraints)
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

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraEnabled, hasPermission, facingMode, selectedCameraId]);

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

  // Mic preview with audio-enhancement constraints + gain boost
  useEffect(() => {
    if (!micEnabled || !hasPermission) {
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

    const constraints: MediaStreamConstraints = {
      audio: getAudioConstraints(),
      video: false,
    };

    getMediaDeviceStream(constraints)
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

        // Boost audio gain for mobile (80% louder)
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.8;
        src.connect(gainNode);
        gainNode.connect(analyser);

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
  }, [micEnabled, hasPermission, selectedAudioInputId]);

  const handleFlipCamera = useCallback(() => {
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
  }, [facingMode, setFacingMode]);

  const handleJoin = useCallback(() => {
    if (previewStream) previewStream.getTracks().forEach((t) => t.stop());
    setLoading(true);
    onJoin({
      micEnabled,
      cameraEnabled,
      facingMode,
      audioInputId: selectedAudioInputId,
      videoDeviceId: selectedCameraId,
    });
  }, [micEnabled, cameraEnabled, previewStream, onJoin, facingMode, selectedAudioInputId, selectedCameraId]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-edu-slate border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 text-center border-b border-gray-800">
          <h2 className="text-xl font-bold text-white mb-1">Ready to join?</h2>
          <p className="text-sm text-gray-400">
            {roomName} · <span className="text-engagio-400">{userName}</span>
          </p>
        </div>

        <div className="aspect-video bg-gray-900 relative overflow-hidden">
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

          {cameraEnabled && videoDevices.length > 1 && (
            <button
              onClick={handleFlipCamera}
              className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm
                         border border-white/10 text-white flex items-center justify-center
                         hover:bg-black/80 active:scale-95 transition-all cursor-pointer"
              title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
            >
              {facingMode === 'user' ? (
                <Smartphone className="w-4 h-4" />
              ) : (
                <CameraIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        <div className="px-6 pt-5 pb-2 flex items-center justify-center gap-4">
          <button
            onClick={() => setMicEnabled((v) => !v)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all scale-100 hover:scale-105 active:scale-95 ${
              micEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white animate-mic-active'
                : 'bg-edu-danger hover:bg-red-700 text-white'
            }`}
          >
            {micEnabled && audioInputDevices.length > 0 ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <button
            onClick={() => setCameraEnabled((v) => !v)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all scale-100 hover:scale-105 active:scale-95 ${
              cameraEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white animate-camera-active'
                : 'bg-edu-danger hover:bg-red-700 text-white'
            }`}
          >
            {cameraEnabled && videoDevices.length > 0 ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
        </div>

        {micEnabled && audioInputDevices.length > 0 && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Mic Test</span>
              <span className="text-[11px] text-gray-500 ml-auto">{Math.round(micLevel / 2.55)}% input</span>
            </div>
            <div className="h-8 flex items-end gap-[2px]">
              {Array.from({ length: 20 }).map((_, i) => {
                const threshold = (i / 20) * 255;
                const filled = micLevel >= threshold;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm transition-all duration-75 ${
                      filled ? (i > 15 ? 'bg-red-400' : i > 10 ? 'bg-yellow-400' : 'bg-green-500') : 'bg-gray-700'
                    }`}
                    style={{ height: `${20 + Math.random() * 60}%`, opacity: filled ? 0.8 + (i / 20) * 0.2 : 0.3 }}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="px-6 pb-6 pt-2 space-y-3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}
          {!hasPermission && (
            <p className="text-yellow-400 text-xs">⚠ Allow camera and microphone access for best experience</p>
          )}
          {videoDevices.length === 0 && (
            <p className="text-yellow-400 text-xs">⚠ No camera detected</p>
          )}
          {audioInputDevices.length === 0 && (
            <p className="text-yellow-400 text-xs">⚠ No microphone detected</p>
          )}
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-3 bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            {loading ? 'Joining…' : 'Join Classroom'}
          </button>
        </div>
      </div>
    </div>
  );
}
