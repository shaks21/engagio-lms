import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { EnrollmentService } from "./enrollment.service";
import { CreateEnrollmentDto, EnrollmentStatusDto } from "./dto/enrollment.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../tenancy/tenant.guard";

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller("enrollments")
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async enroll(@Request() req, @Body() dto: CreateEnrollmentDto) {
    return this.enrollmentService.enroll(req.tenantId, dto);
  }

  @Get("course/:courseId")
  async findByCourse(@Request() req, @Param("courseId") courseId: string) {
    return this.enrollmentService.findByCourse(req.tenantId, courseId);
  }

  @Get("user/:userId")
  async findByUser(@Request() req, @Param("userId") userId: string) {
    return this.enrollmentService.findByUser(req.tenantId, userId);
  }

  @Patch("course/:courseId/user/:userId")
  async updateStatus(
    @Request() req,
    @Param("courseId") courseId: string,
    @Param("userId") userId: string,
    @Body() dto: EnrollmentStatusDto,
  ) {
    return this.enrollmentService.updateStatus(req.tenantId, userId, courseId, dto);
  }

  @Delete("course/:courseId/user/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async unenroll(
    @Request() req,
    @Param("courseId") courseId: string,
    @Param("userId") userId: string,
  ) {
    return this.enrollmentService.unenroll(req.tenantId, userId, courseId);
  }
}
