import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient } from 'livekit-server-sdk';
import { PrismaService } from '../prisma/prisma.service';

export interface BreakoutAssignments {
  assignments: Record<string, string>;
}

@Injectable()
export class BreakoutService {
  private readonly logger = new Logger(BreakoutService.name);
  private roomService: RoomServiceClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey    = this.configService.get<string>('LIVEKIT_API_KEY', 'devkey');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET', '');
    // Use internal LiveKit API endpoint (localhost:7880) for RoomServiceClient.
    // LIVEKIT_URL is public WS endpoint for clients; API needs direct HTTP.
    const livekitApiUrl = this.configService.get<string>('LIVEKIT_API_URL', 'http://localhost:7880');
    this.roomService = new RoomServiceClient(livekitApiUrl, apiKey, apiSecret);
  }

  /**
   * Assign participants to breakout rooms via LiveKit metadata.
   * @returns updated assignments map
   */
  async assignBreakouts(
    tenantId: string,
    sessionId: string,
    userId: string,
    assignments: Record<string, string>,
  ): Promise<Record<string, string>> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: { course: { select: { instructorId: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.course.instructorId !== userId) {
      throw new ForbiddenException('Only the course instructor can manage breakout rooms');
    }

    // Update each participant's metadata in LiveKit
    for (const [participantId, breakoutRoomId] of Object.entries(assignments)) {
      try {
        await this.roomService.updateParticipant(
          sessionId,
          participantId,
          JSON.stringify({ breakoutRoomId }),
        );
        this.logger.log(`Assigned ${participantId} → ${breakoutRoomId}`);
      } catch (e: any) {
        this.logger.warn(`Failed to update ${participantId}: ${e.message}`);
        // Continue — participant may not have joined LiveKit yet
      }
    }

    // Persist in Prisma as source-of-truth fallback
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { breakoutConfig: assignments as any },
    });

    return assignments;
  }

  /**
   * Read current assignments from Prisma.
   */
  async getBreakouts(
    tenantId: string,
    sessionId: string,
    userId: string,
  ): Promise<Record<string, string>> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: { course: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    const config = (session.breakoutConfig ?? {}) as Record<string, string>;
    return config;
  }

  /**
   * Clear all breakout assignments (Close All Rooms).
   */
  async clearBreakouts(
    tenantId: string,
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: { course: { select: { instructorId: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.course.instructorId !== userId) {
      throw new ForbiddenException('Only the course instructor can manage breakout rooms');
    }

    const config = (session.breakoutConfig ?? {}) as Record<string, string>;
    for (const participantId of Object.keys(config)) {
      try {
        await this.roomService.updateParticipant(
          sessionId,
          participantId,
          JSON.stringify({ breakoutRoomId: null }),
        );
      } catch { /* participant may be gone */ }
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { breakoutConfig: {} },
    });
    this.logger.log(`Cleared all breakouts for session ${sessionId}`);
  }

  /**
   * List LiveKit room participants (to auto-shuffle).
   */
  async listParticipants(sessionId: string): Promise<string[]> {
    try {
      const participants = await this.roomService.listParticipants(sessionId);
      return participants.map((p) => p.identity).filter((id) => !!id);
    } catch (e: any) {
      this.logger.warn(`Failed to list participants for ${sessionId}: ${e.message}`);
      return [];
    }
  }

  /**
   * Auto-shuffle participants into N groups.
   */
  autoShuffle(participants: string[], groupCount: number): Record<string, string>[] {
    if (participants.length === 0 || groupCount < 2) return [];
    // Fisher-Yates shuffle
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const groups: Record<string, string>[] = [];
    const baseSize = Math.floor(shuffled.length / groupCount);
    const remainder = shuffled.length % groupCount;

    let idx = 0;
    for (let g = 0; g < groupCount; g++) {
      const size = baseSize + (g < remainder ? 1 : 0);
      const group: Record<string, string> = {};
      for (let s = 0; s < size; s++) {
        group[shuffled[idx]] = `room-${String.fromCharCode(97 + g)}`; // room-a, room-b, ...
        idx++;
      }
      if (Object.keys(group).length > 0) groups.push(group);
    }
    return groups;
  }
}
