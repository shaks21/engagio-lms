import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BreakoutService } from './breakout.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenancy/tenant.guard';

interface BreakoutPatchBody {
  assignments: Record<string, string>;
}

interface BreakoutAutoBody {
  groupCount: number;
  participants?: string[];
}

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('sessions/:sessionId/breakouts')
export class BreakoutController {
  constructor(private readonly breakoutService: BreakoutService) {}

  @Patch()
  @HttpCode(HttpStatus.OK)
  async assign(
    @Request() req,
    @Param('sessionId') sessionId: string,
    @Body() body: BreakoutPatchBody,
  ) {
    const assignments = await this.breakoutService.assignBreakouts(
      req.tenantId,
      sessionId,
      req.user.id,
      body.assignments,
    );
    return { success: true, assignments };
  }

  @Get()
  async get(@Request() req, @Param('sessionId') sessionId: string) {
    const assignments = await this.breakoutService.getBreakouts(
      req.tenantId,
      sessionId,
      req.user.id,
    );
    return { assignments };
  }

  @Post('clear')
  @HttpCode(HttpStatus.OK)
  async clear(@Request() req, @Param('sessionId') sessionId: string) {
    await this.breakoutService.clearBreakouts(
      req.tenantId,
      sessionId,
      req.user.id,
    );
    return { success: true };
  }

  @Post('auto')
  @HttpCode(HttpStatus.OK)
  async auto(
    @Request() req,
    @Param('sessionId') sessionId: string,
    @Body() body: BreakoutAutoBody,
  ) {
    // Fetch participants from LiveKit if not provided in body
    let participants: string[] = body.participants ?? [];
    if (participants.length === 0) {
      const roomInfo = await this.breakoutService.listParticipants(sessionId);
      participants = roomInfo.filter((p) => p !== req.user.id);
    }

    const groups = this.breakoutService.autoShuffle(
      participants,
      body.groupCount,
    );

    let result: Record<string, string> = {};
    for (const group of groups) {
      const assigned = await this.breakoutService.assignBreakouts(
        req.tenantId,
        sessionId,
        req.user.id,
        group,
      );
      result = { ...result, ...assigned };
    }
    return { success: true, assignments: result, groups };
  }
}
