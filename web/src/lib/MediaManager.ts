// src/lib/MediaManager.ts

// Create a mock video track (black frame) for headless environments
function createMockVideoTrack(): MediaStreamTrack {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666666';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No Camera', canvas.width / 2, canvas.height / 2);
  }
  
  const stream = canvas.captureStream(15);
  const track = stream.getVideoTracks()[0];
  (track as any).isMockTrack = true;
  return track;
}

// Create a mock audio track (silent) for headless environments
function createMockAudioTrack(): MediaStreamTrack {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const dest = ctx.createMediaStreamDestination();
  oscillator.connect(dest);
  oscillator.start();
  oscillator.stop();
  
  const track = dest.stream.getAudioTracks()[0];
  (track as any).isMockTrack = true;
  return track;
}

class MediaManager {
  private stream: MediaStream | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private audioEnabled = true;
  private videoEnabled = false;
  private isUsingMockTracks = false;

  async initialize({ audio, video }: { audio?: boolean; video?: boolean } = {}): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Browser does not support media devices - using mock tracks');
      return this.createMockStream(audio, video);
    }

    const constraints: MediaStreamConstraints = {
      audio: audio ?? this.audioEnabled,
      video: video ?? this.videoEnabled
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioTrack = this.stream.getAudioTracks()[0] || null;
      this.videoTrack = this.stream.getVideoTracks()[0] || null;
      this.isUsingMockTracks = false;
      return this.stream;
    } catch (error) {
      console.warn('getUserMedia failed, falling back to mock tracks:', error);
      return this.createMockStream(audio, video);
    }
  }

  private async createMockStream(audio?: boolean, video?: boolean): Promise<MediaStream> {
    const tracks: MediaStreamTrack[] = [];
    
    if (audio ?? this.audioEnabled) {
      try {
        this.audioTrack = createMockAudioTrack();
        tracks.push(this.audioTrack);
      } catch (e) {
        console.warn('Could not create mock audio track:', e);
      }
    }
    
    if (video ?? this.videoEnabled) {
      this.videoTrack = createMockVideoTrack();
      tracks.push(this.videoTrack);
    }

    this.stream = new MediaStream(tracks);
    this.isUsingMockTracks = true;
    return this.stream;
  }

  async retry(): Promise<MediaStream | null> {
    if (this.stream) {
      this.stop();
    }
    return this.initialize({ audio: this.audioEnabled, video: this.videoEnabled });
  }

  setAudio(enabled: boolean): void {
    this.audioEnabled = enabled;
    if (this.audioTrack) {
      this.audioTrack.enabled = enabled;
    }
  }

  setVideo(enabled: boolean): void {
    this.videoEnabled = enabled;
    if (this.videoTrack && this.stream) {
      this.videoTrack.enabled = enabled;
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.audioTrack = null;
    this.videoTrack = null;
  }

  getTrack(kind: 'audio' | 'video'): MediaStreamTrack | null {
    return kind === 'audio' ? this.audioTrack : this.videoTrack;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  private async handleMediaError(error: any): Promise<void> {
    // No-op, error is re-thrown
  }
}

export { MediaManager };
