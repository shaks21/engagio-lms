// src/lib/MediaManager.ts
class MediaManager {
  private stream: MediaStream | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private audioEnabled = true;
  private videoEnabled = false;

  async initialize({ audio, video }: { audio?: boolean; video?: boolean } = {}): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser does not support media devices');
    }

    const constraints: MediaStreamConstraints = {
      audio: audio ?? this.audioEnabled,
      video: video ?? this.videoEnabled
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioTrack = this.stream.getAudioTracks()[0] || null;
      this.videoTrack = this.stream.getVideoTracks()[0] || null;
      return this.stream;
    } catch (error) {
      await this.handleMediaError(error);
      throw error;
    }
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
