import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StartSessionDto } from "./dto/session.dto";
import { randomUUID } from "crypto";

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async start(tenantId: string, userId: string, dto: StartSessionDto) {
    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, tenantId },
    });
    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const classroomCode = dto.classroomCode || randomUUID().slice(0, 8).toUpperCase();

    return this.prisma.session.create({
      data: {
        tenantId,
        courseId: dto.courseId,
        userId,
        classroomCode,
        dwellTime: 0,
      },
      include: {
        course: { select: { id: true, title: true } },
        user: { select: { id: true, email: true } },
      },
    });
  }

  async end(tenantId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) {
      throw new NotFoundException("Session not found");
    }

    return this.prisma.session.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
  }

  async findAll(tenantId: string, courseIds?: string[]) {
    const where: any = { tenantId, endedAt: null } as any;
    if (courseIds && courseIds.length > 0) {
      where.courseId = { in: courseIds };
    }

    return this.prisma.session.findMany({
      where,
      include: {
        course: { select: { id: true, title: true } },
        user: { select: { id: true, email: true } },
        _count: { select: { events: true } },
      },
      orderBy: { startedAt: "desc" },
    });
  }

  async findHistory(tenantId: string, courseId?: string) {
    const where: any = { tenantId };
    if (courseId) {
      where.courseId = courseId;
    }

    return this.prisma.session.findMany({
      where: { ...where },
      include: {
        course: { select: { title: true } },
        user: { select: { email: true } },
        _count: { select: { events: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
  }

  async findByCode(tenantId: string, classroomCode: string) {
    const session = await this.prisma.session.findFirst({
      where: { classroomCode, tenantId, endedAt: null },
      include: {
        course: { select: { id: true, title: true } },
        user: { select: { id: true, email: true } },
      },
    });
    if (!session) {
      throw new NotFoundException("Active session not found with this code");
    }
    return session;
  }

  async findOne(tenantId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        course: { select: { id: true, title: true } },
        user: { select: { id: true, email: true } },
        _count: { select: { events: true } },
      },
    });
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    return session;
  }

  async recordDwellTime(tenantId: string, sessionId: string, seconds: number) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session || session.endedAt) {
      return null;
    }
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { dwellTime: { increment: seconds } },
    });
  }
}
