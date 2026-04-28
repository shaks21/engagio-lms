import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient, ParticipantPermission } from 'livekit-server-sdk';
import { PrismaService } from '../prisma/prisma.service';

export interface BreakoutAssignments {
  assignments: Record<string, string>;
}

interface BreakoutConfig {
  assignments: Record<string, string>;
  groupCount?: number;
  assignmentMode?: 'AUTO' | 'MANUAL' | 'SELF_SELECT';
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
    const livekitApiUrl = this.configService.get<string>('LIVEKIT_API_URL', 'http://localhost:7880');
    this.roomService = new RoomServiceClient(livekitApiUrl, apiKey, apiSecret);
  }

  /**
   * Normalize breakoutConfig from Prisma: backward-compat for plain map.
   */
  private normalizeConfig(raw: any): BreakoutConfig {
    if (!raw) return { assignments: {} };
    if (typeof raw === 'object' && !Array.isArray(raw) && 'assignments' in raw) {
      return raw as BreakoutConfig;
    }
    // Legacy: plain Record<string, string>
    return { assignments: raw as Record<string, string> };
  }

  /**
   * Grant elevated privileges to a participant moved into a breakout room.
   */
  static getBreakoutPermissions() {
    return {
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };
  }

  /**
   * Revoke publishing privileges when returning to main room (lecture mode).
   */
  static getMainRoomPermissions() {
    return {
      canPublish: false,
      canPublishData: false,
      canSubscribe: true,
    };
  }

  /**
   * Assign participants to breakout rooms via LiveKit metadata + permissions.
   */
  async assignBreakouts(
    tenantId: string,
    sessionId: string,
    userId: string,
    assignments: Record<string, string>,
    grantPermissions?: boolean,
  ): Promise<Record<string, string>> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: { course: { select: { instructorId: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.course.instructorId !== userId) {
      throw new ForbiddenException('Only the course instructor can manage breakout rooms');
    }

    // Update each participant's metadata + permissions in LiveKit
    for (const [participantId, breakoutRoomId] of Object.entries(assignments)) {
      try {
        const metadata = JSON.stringify({ breakoutRoomId });
        if (grantPermissions && breakoutRoomId && breakoutRoomId !== 'main') {
          await this.roomService.updateParticipant(
            sessionId,
            participantId,
            metadata,
            BreakoutService.getBreakoutPermissions(),
          );
          this.logger.log(`Assigned ${participantId}\u0020\u2192 ${breakoutRoomId} (+elevated permissions)`);
        } else {
          await this.roomService.updateParticipant(sessionId, participantId, metadata);
          this.logger.log(`Assigned ${participantId}\u0020\u2192 ${breakoutRoomId}`);
        }
      } catch (e: any) {
        this.logger.warn(`Failed to update ${participantId}: ${e.message}`);
      }
    }

    // Persist in Prisma
    const current = await this.prisma.session.findFirst({
      where: { id: sessionId },
      select: { breakoutConfig: true },
    });
    const config = this.normalizeConfig(current?.breakoutConfig);
    config.assignments = { ...config.assignments, ...assignments };
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { breakoutConfig: config as any },
    });

    // Emit Kafka-style analytics event (log, in production this would use @nestjs/microservices)
    this.logger.log(`[Analytics] room-switch session=${sessionId} count=${Object.keys(assignments).length}`);

    return assignments;
  }

  /**
   * Self-select: any participant can assign themselves to a room (teacher must enable mode).
   */
  async selfSelect(
    tenantId: string,
    sessionId: string,
    userId: string,
    breakoutRoomId: string | null,
  ): Promise<Record<string, string>> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const config = this.normalizeConfig(session.breakoutConfig);
    if (config.assignmentMode !== 'SELF_SELECT') {
      throw new ForbiddenException('Self-selection is not enabled');
    }

    try {
      const metadata = JSON.stringify({ breakoutRoomId });
      if (breakoutRoomId && breakoutRoomId !== 'main') {
        await this.roomService.updateParticipant(
          sessionId,
          userId,
          metadata,
          BreakoutService.getBreakoutPermissions(),
        );
      } else {
        await this.roomService.updateParticipant(
          sessionId,
          userId,
          metadata,
          BreakoutService.getMainRoomPermissions(),
        );
      }
      this.logger.log(`[SelfSelect] ${userId}\u0020\u2192 ${breakoutRoomId || 'main'}`);
    } catch (e: any) {
      this.logger.warn(`Self-select failed for ${userId}: ${e.message}`);
    }

    config.assignments = { ...config.assignments, [userId]: breakoutRoomId || 'main' };
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { breakoutConfig: config as any },
    });

    return config.assignments;
  }

  /**
   * Read current assignments from Prisma.
   */
  async getBreakouts(
    tenantId: string,
    sessionId: string,
    userId: string,
  ): Promise<BreakoutConfig> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: { course: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    return this.normalizeConfig(session.breakoutConfig);
  }

  /**
   * Clear all breakout assignments (Close All Rooms) + revoke privileges.
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

    const config = this.normalizeConfig(session.breakoutConfig);
    const participantIds = Object.keys(config.assignments);

    for (const participantId of participantIds) {
      try {
        await this.roomService.updateParticipant(
          sessionId,
          participantId,
          JSON.stringify({ breakoutRoomId: null }),
          BreakoutService.getMainRoomPermissions(),
        );
        this.logger.log(`Revoked permissions for ${participantId} (back to main)`);
      } catch { /* participant may be gone */ }
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { breakoutConfig: { assignments: {} } as any },
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
   * Round-robin assign participants across N rooms for even distribution.
   */
  static roundRobin(participants: string[], groupCount: number): Record<string, string> {
    const MAX_ROOMS = 25;
    if (groupCount < 2 || groupCount > MAX_ROOMS) groupCount = Math.min(Math.max(groupCount, 2), MAX_ROOMS);
    groupCount = Math.min(groupCount, MAX_ROOMS);

    // Fisher-Yates shuffle for randomness
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const assignments: Record<string, string> = {};
    shuffled.forEach((pid, idx) => {
      const roomIdx = idx % groupCount;
      assignments[pid] = `room-${String.fromCharCode(97 + roomIdx)}`;
    });

    return assignments;
  }

  /**
   * Legacy auto-shuffle returning grouped objects (kept for compat).
   */
  static autoShuffle(participants: string[], groupCount: number): Record<string, string>[] {
    const assignments = BreakoutService.roundRobin(participants, groupCount);
    if (Object.keys(assignments).length === 0) {
      // Empty-room pre-provisioning: return stub rooms with no members
      const roomCount = Math.min(Math.max(groupCount, 2), 25);
      return Array.from({ length: roomCount }, (_, i) => ({
        [`room-${String.fromCharCode(97 + i)}`]: `room-${String.fromCharCode(97 + i)}`,
      }));
    }

    // Group back into per-room objects for controller compat
    const groups = new Map<string, Record<string, string>>();
    for (const [pid, room] of Object.entries(assignments)) {
      if (!groups.has(room)) groups.set(room, {});
      groups.get(room)![pid] = room;
    }
    return Array.from(groups.values());
  }
}
