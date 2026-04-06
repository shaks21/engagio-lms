import { Injectable, NotFoundException } from "@nestjs/common";
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
      select: { id: true, dwellTime: true, _count: { select: { events: true } } },
      orderBy: { startedAt: "desc" },
      take: 20,
    });

    return { totalSessions, activeSessions, totalDwellTime, avgDwellTime, eventTypeCounts, eventsBySession };
  }

  async getUserEngagement(tenantId: string, userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, tenantId },
      select: { id: true, dwellTime: true, startedAt: true, endedAt: true, _count: { select: { events: true } }, course: { select: { id: true, title: true } } },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    const totalDwellTime = sessions.reduce((sum, s) => sum + s.dwellTime, 0);
    const totalEvents = sessions.reduce((sum, s) => sum + s._count.events, 0);

    const eventBreakdown = await this.prisma.engagementEvent.groupBy({
      where: { tenantId, session: { userId } },
      by: ["type"],
      _count: true,
    });

    return {
      totalDwellTime, totalEvents, totalSessions: sessions.length, sessions,
      eventBreakdown: eventBreakdown.reduce((acc, e) => { acc[e.type] = e._count; return acc; }, {} as Record<string, number>),
    };
  }

  async getCourseAnalytics(tenantId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true, title: true } });
    if (!course) return null;

    const enrollments = await this.prisma.enrollment.count({ where: { courseId } });
    const sessions = await this.prisma.session.findMany({ where: { courseId }, select: { dwellTime: true, _count: { select: { events: true } } } });
    const totalDwellTime = sessions.reduce((sum, s) => sum + s.dwellTime, 0);
    const totalEvents = sessions.reduce((sum, s) => sum + s._count.events, 0);

    const eventTypeBreakdown = await this.prisma.engagementEvent.groupBy({
      where: { tenantId, session: { courseId } },
      by: ["type"], _count: true, _min: { timestamp: true }, _max: { timestamp: true },
    });

    return { course, enrollments, totalSessions: sessions.length, totalDwellTime, totalEvents, eventTypeBreakdown };
  }

  async getRealtimeStats(tenantId: string) {
    const activeSessions = await this.prisma.session.count({ where: { tenantId, endedAt: null } });
    const liveEvents = await this.prisma.engagementEvent.count({ where: { tenantId, timestamp: { gte: new Date(Date.now() - 300000) } } });
    const totalUsers = await this.prisma.user.count({ where: { tenantId } });
    return { activeSessions, liveEvents, totalUsers, timestamp: new Date() };
  }

  // HEATMAP: Get latest engagement score per user for the teacher dashboard
  async getUsersByScore(tenantId: string) {
    const latestScores = await this.prisma.engagementSnapshot.findMany({
      where: { tenantId },
      orderBy: { timestamp: "desc" },
    });

    // Deduplicate by userId, keep latest
    const seen = new Map<string, typeof latestScores[0]>();
    for (const snap of latestScores) {
      if (!seen.has(snap.userId)) {
        seen.set(snap.userId, snap);
      }
    }

    const userIds = [...seen.keys()];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return [...seen.values()].map((s) => ({
      userId: s.userId,
      email: userMap.get(s.userId)?.email ?? "Unknown",
      role: userMap.get(s.userId)?.role ?? "STUDENT",
      score: s.score,
      color: s.score > 70 ? "green" : s.score >= 40 ? "yellow" : "red",
      lastUpdate: s.timestamp,
    }));
  }

  // SESSION SCORE HISTORY: for Recharts line graph
  async getSessionScoreHistory(tenantId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException("Session not found");

    // Get score snapshots ordered by time
    const snapshots = await this.prisma.engagementSnapshot.findMany({
      where: { sessionId },
      orderBy: { timestamp: "asc" },
      select: { userId: true, score: true, timestamp: true },
    });

    // Build per-user time series and aggregate class average
    const byTime = new Map<string, number[]>();
    for (const snap of snapshots) {
      const key = snap.timestamp.toISOString();
      if (!byTime.has(key)) byTime.set(key, []);
      byTime.get(key)!.push(snap.score);
    }

    const classPulse = [...byTime.entries()].map(([time, scores]) => ({
      time,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));

    // Per-user data
    const byUser = new Map<string, { email: string; history: { time: string; score: number }[] }>();
    for (const snap of snapshots) {
      if (!byUser.has(snap.userId)) {
        byUser.set(snap.userId, { email: "", history: [] });
      }
      byUser.get(snap.userId)!.history.push({ time: snap.timestamp.toISOString(), score: snap.score });
    }

    // Fill in emails
    const allUserIds = [...byUser.keys()];
    if (allUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, email: true },
      });
      for (const u of users) {
        const entry = byUser.get(u.id);
        if (entry) entry.email = u.email;
      }
    }

    return { session, classPulse, byUser: Object.fromEntries(byUser) };
  }

  async getLiveScores(tenantId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new NotFoundException("Session not found");

    const latest = await this.prisma.engagementSnapshot.findMany({
      where: { sessionId },
      orderBy: { timestamp: "desc" },
    });

    const seen = new Map<string, typeof latest[0]>();
    for (const snap of latest) {
      if (!seen.has(snap.userId)) seen.set(snap.userId, snap);
    }

    const userIds = [...seen.keys()];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return [...seen.values()].map((s) => ({
      userId: s.userId,
      email: userMap.get(s.userId)?.email ?? "Unknown",
      score: s.score,
      color: s.score > 70 ? "green" : s.score >= 40 ? "yellow" : "red",
    }));
  }
}
