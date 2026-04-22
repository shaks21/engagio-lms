import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly livekitUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY', 'devkey');
    this.apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET', '');
    this.livekitUrl = this.configService.get<string>('LIVEKIT_URL', 'wss://engagio.duckdns.org');

    if (!this.apiSecret) {
      this.logger.warn('LIVEKIT_API_SECRET not configured - token generation will fail');
    }
  }

  /**
   * Generate a LiveKit access token for a user to join a room.
   * 
   * @param roomId - The session/classroom ID (will be used as LiveKit room name)
   * @param userId - The user's unique identifier
   * @param displayName - User's display name
   * @param role - User's role (teacher, student, etc.)
   */
  async generateToken(
    roomId: string,
    userId: string,
    displayName: string,
    role: 'teacher' | 'student' | 'assistant' | 'viewer' = 'student',
  ): Promise<string> {
    if (!this.apiSecret) {
      throw new Error('LIVEKIT_API_SECRET is not configured');
    }

    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: displayName,
      ttl: '4h', // Token valid for 4 hours
    });

    // Grant permissions based on role
    const canPublish = role !== 'viewer';
    const canSubscribe = true;
    const canPublishData = true;

    token.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish,
      canSubscribe,
      canPublishData,
      // For teachers, also allow room management
      roomAdmin: role === 'teacher',
      roomRecord: role === 'teacher',
    });

    // Add metadata with role info
    token.metadata = JSON.stringify({
      displayName,
      role,
      userId,
    });

    this.logger.log(`Generating LiveKit token for user ${userId} (${role}) to join room ${roomId}`);

    return token.toJwt();
  }

  /**
   * Get the LiveKit server URL
   */
  getLivekitUrl(): string {
    return this.livekitUrl;
  }
}
