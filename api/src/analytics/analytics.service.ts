import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEngagementOverview(tenantId: string, courseId?: string) {
    const where: any = { tenantId };
    if (courseId) where.courseId = courseId;

    const sessions = await this.prisma.session.findMany({ where });

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter((s) => !s.endedAt).length;
    const totalDwellTime = sessions.reduce((sum, s) => sum + s.dwellTime, 0);
    const avgDwellTime = totalSessions > 0 ? totalDwellTime / totalSessions : 0;

    const events = await this.prisma.engagementEvent.groupBy({
      where: { tenantId },
      by: ["type"],
      _count: true,
    });

    const eventTypeCounts = events.reduce((acc, e) => {
      acc[e.type] = e._count;
      return acc;
    }, {} as Record<string, number>);

    const eventsBySession = await this.prisma.session.findMany({
      where: courseId ? { tenantId, courseId } : { tenantId },
      select: {
        id: true,
        dwellTime: true,
        _count: { select: { events: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    });

    return {
      totalSessions,
      activeSessions,
      totalDwellTime,
      avgDwellTime,
      eventTypeCounts,
      eventsBySession,
    };
  }

  async getUserEngagement(tenantId: string, userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, tenantId },
      select: {
        id: true,
        dwellTime: true,
        startedAt: true,
        endedAt: true,
        _count: { select: { events: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    });

    const totalDwellTime = sessions.reduce((sum, s) => sum + s.dwellTime, 0);
    const totalEvents = sessions.reduce((sum, s) => sum + s._count.events, 0);

    const eventBreakdown = await this.prisma.engagementEvent.groupBy({
      where: {
        tenantId,
        session: { userId },
      },
      by: ["type"],
      _count: true,
    });

    return {
      totalDwellTime,
      totalEvents,
      totalSessions: sessions.length,
      sessions,
      eventBreakdown: eventBreakdown.reduce((acc, e) => {
        acc[e.type] = e._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async getCourseAnalytics(tenantId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId },
      select: { id: true, title: true },
    });

    if (!course) return null;

    const enrollments = await this.prisma.enrollment.count({
      where: { courseId },
    });

    const sessions = await this.prisma.session.findMany({
      where: { courseId },
      select: { dwellTime: true, _count: { select: { events: true } } },
    });

    const totalDwellTime = sessions.reduce((sum, s) => sum + s.dwellTime, 0);
    const totalEvents = sessions.reduce((sum, s) => sum + s._count.events, 0);

    const eventTypeBreakdown = await this.prisma.engagementEvent.groupBy({
      where: {
        tenantId,
        session: { courseId },
      },
      by: ["type"],
      _count: true,
      _min: { timestamp: true },
      _max: { timestamp: true },
    });

    return {
      course,
      enrollments,
      totalSessions: sessions.length,
      totalDwellTime,
      totalEvents,
      eventTypeBreakdown: eventTypeBreakdown.map((e) => ({
        type: e.type,
        count: e._count,
        firstEvent: e._min.timestamp,
        lastEvent: e._max.timestamp,
      })),
    };
  }

  async getRealtimeStats(tenantId: string) {
    const activeSessions = await this.prisma.session.count({
      where: { tenantId, endedAt: null },
    });

    const liveEvents = await this.prisma.engagementEvent.count({
      where: {
        tenantId,
        timestamp: { gte: new Date(Date.now() - 300000) }, // last 5 min
      },
    });

    const totalUsers = await this.prisma.user.count({
      where: { tenantId },
    });

    return {
      activeSessions,
      liveEvents,
      totalUsers,
      timestamp: new Date(),
    };
  }
}
