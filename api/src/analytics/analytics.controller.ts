import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../tenancy/tenant.guard";

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("overview")
  async getOverview(@Request() req, @Query("courseId") courseId?: string) {
    return this.analyticsService.getEngagementOverview(req.tenantId, courseId);
  }

  @Get("realtime")
  async getRealtime(@Request() req) {
    return this.analyticsService.getRealtimeStats(req.tenantId);
  }

  @Get("user/:userId")
  async getUserEngagement(
    @Request() req,
    @Param("userId") userId: string,
  ) {
    return this.analyticsService.getUserEngagement(req.tenantId, userId);
  }

  @Get("course/:courseId")
  async getCourseAnalytics(
    @Request() req,
    @Param("courseId") courseId: string,
  ) {
    return this.analyticsService.getCourseAnalytics(req.tenantId, courseId);
  }
}
