import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from "@nestjs/common";
import { PollsService } from "./polls.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../tenancy/tenant.guard";

export interface CreatePollBody {
  question: string;
  options: string[];
}

export interface VoteBody {
  optionId: string;
  userId: string;
}

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller("sessions/:sessionId/polls")
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: any,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: CreatePollBody,
  ) {
    return this.pollsService.create(req.tenantId, sessionId, body);
  }

  @Post(":pollId/vote")
  @HttpCode(HttpStatus.OK)
  async vote(
    @Request() req: any,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("pollId") pollId: string,
    @Body() body: VoteBody,
  ) {
    return this.pollsService.vote(req.tenantId, sessionId, pollId, body);
  }

  @Get(":pollId")
  async findOne(
    @Request() req: any,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("pollId") pollId: string,
  ) {
    return this.pollsService.findOne(req.tenantId, sessionId, pollId);
  }

  @Get()
  async findActive(
    @Request() req: any,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
  ) {
    return this.pollsService.findActiveBySession(req.tenantId, sessionId);
  }
}
