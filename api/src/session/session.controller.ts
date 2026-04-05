import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from "@nestjs/common";
import { SessionService } from "./session.service";
import { StartSessionDto } from "./dto/session.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../tenancy/tenant.guard";

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller("sessions")
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post("start")
  @HttpCode(HttpStatus.CREATED)
  async start(@Request() req, @Body() dto: StartSessionDto) {
    return this.sessionService.start(req.tenantId, dto);
  }

  @Post(":id/end")
  @HttpCode(HttpStatus.OK)
  async end(@Request() req, @Param("id") id: string) {
    return this.sessionService.end(req.tenantId, id);
  }

  @Get("active")
  async findActive(
    @Request() req,
    @Query("courseIds") courseIds?: string,
  ) {
    const ids = courseIds ? courseIds.split(",") : undefined;
    return this.sessionService.findAll(req.tenantId, ids);
  }

  @Get("history")
  async findHistory(
    @Request() req,
    @Query("courseId") courseId?: string,
  ) {
    return this.sessionService.findHistory(req.tenantId, courseId);
  }

  @Get("code/:classroomCode")
  async findByCode(
    @Request() req,
    @Param("classroomCode") classroomCode: string,
  ) {
    return this.sessionService.findByCode(req.tenantId, classroomCode);
  }

  @Get(":id")
  async findOne(@Request() req, @Param("id") id: string) {
    return this.sessionService.findOne(req.tenantId, id);
  }
}
