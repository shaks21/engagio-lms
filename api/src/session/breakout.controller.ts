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
import {
  BreakoutPatchBody,
  BreakoutAutoBody,
  BreakoutSelfSelectBody,
  BreakoutModeBody,
} from './dto/breakout.dto';

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
      body.grantPermissions !== false, // default true
    );
    return { success: true, assignments };
  }

  @Get()
  async get(@Request() req, @Param('sessionId') sessionId: string) {
    const config = await this.breakoutService.getBreakouts(
      req.tenantId,
      sessionId,
      req.user.id,
    );
    return config;
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
    let participants: string[] = body.participants ?? [];
    if (participants.length === 0) {
      const roomInfo = await this.breakoutService.listParticipants(sessionId);
      participants = roomInfo; // include everyone — teacher included for allocation
    }

    const algorithm = body.algorithm ?? 'ROUND_ROBIN';
    const assignments = algorithm === 'ROUND_ROBIN'
      ? BreakoutService.roundRobin(participants, body.groupCount)
      : BreakoutService.roundRobin(participants, body.groupCount); // both use roundRobin for even

    const result = await this.breakoutService.assignBreakouts(
      req.tenantId,
      sessionId,
      req.user.id,
      assignments,
      true,
    );

    return { success: true, assignments: result, algorithm };
  }

  @Post('self-select')
  @HttpCode(HttpStatus.OK)
  async selfSelect(
    @Request() req,
    @Param('sessionId') sessionId: string,
    @Body() body: BreakoutSelfSelectBody,
  ) {
    const assignments = await this.breakoutService.selfSelect(
      req.tenantId,
      sessionId,
      req.user.id,
      body.breakoutRoomId ?? null,
    );
    return { success: true, assignments };
  }

  @Post('mode')
  @HttpCode(HttpStatus.OK)
  async setMode(
    @Request() req,
    @Param('sessionId') sessionId: string,
    @Body() body: BreakoutModeBody,
  ) {
    const result = await this.breakoutService.setMode(
      req.tenantId,
      sessionId,
      req.user.id,
      body.assignmentMode,
      body.groupCount,
    );
    return result;
  }
}
