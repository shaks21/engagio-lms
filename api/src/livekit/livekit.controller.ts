import { Controller, Get, Param, Query, UnauthorizedException, Logger } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/classroom')
export class LivekitController {
  private readonly logger = new Logger(LivekitController.name);

  constructor(
    private readonly livekitService: LivekitService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/classroom/token/:sessionId
   * 
   * Generates a LiveKit access token for a user to join a session/classroom room.
   * 
   * Query params:
   * - userId: The user's ID (required)
   * - displayName: The user's display name (required)
   * - role: 'teacher' | 'student' | 'assistant' | 'viewer' (optional, defaults to 'student')
   */
  @Get('token/:sessionId')
  async getToken(
    @Param('sessionId') sessionId: string,
    @Query('userId') userId: string,
    @Query('displayName') displayName: string,
    @Query('role') role: 'teacher' | 'student' | 'assistant' | 'viewer' = 'student',
  ) {
    if (!userId || !displayName) {
      throw new UnauthorizedException('userId and displayName are required');
    }

    // Validate session exists
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { course: { select: { tenantId: true } } },
    });

    if (!session) {
      // Allow joining even if session not found in DB (for flexibility)
      this.logger.warn(`Session ${sessionId} not found in DB, but allowing token generation`);
    }

    // Validate role
    const validRoles = ['teacher', 'student', 'assistant', 'viewer'];
    const userRole = validRoles.includes(role) ? role : 'student';

    try {
      const token = await this.livekitService.generateToken(
        sessionId,   // roomId = sessionId
        userId,
        displayName,
        userRole,
      );

      const livekitUrl = this.livekitService.getLivekitUrl();

      this.logger.log(`Token generated for user ${userId} to join session ${sessionId}`);

      return {
        token,
        livekitUrl,
        roomName: sessionId,
      };
    } catch (error) {
      this.logger.error(`Failed to generate token: ${error.message}`);
      throw error;
    }
  }
}
