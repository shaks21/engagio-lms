import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEnrollmentDto, EnrollmentStatusDto } from "./dto/enrollment.dto";

@Injectable()
export class EnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

  async enroll(tenantId: string, dto: CreateEnrollmentDto) {
    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, tenantId },
    });
    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { tenantId_userId_courseId: { tenantId, userId: dto.userId, courseId: dto.courseId } },
    });
    if (existing) {
      throw new ConflictException("User already enrolled in this course");
    }

    return this.prisma.enrollment.create({
      data: {
        tenantId,
        userId: dto.userId,
        courseId: dto.courseId,
        status: "active",
      },
      include: {
        user: { select: { id: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    });
  }

  async findByCourse(tenantId: string, courseId: string) {
    return this.prisma.enrollment.findMany({
      where: { courseId, tenantId },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async findByUser(tenantId: string, userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId, tenantId },
      include: {
        course: {
          include: {
            instructor: { select: { id: true, email: true } },
            _count: { select: { sessions: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateStatus(
    tenantId: string,
    userId: string,
    courseId: string,
    dto: EnrollmentStatusDto,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
    });
    if (!enrollment) {
      throw new NotFoundException("Enrollment not found");
    }

    return this.prisma.enrollment.update({
      where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
      data: { status: dto.status },
    });
  }

  async unenroll(tenantId: string, userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
    });
    if (!enrollment) {
      throw new NotFoundException("Enrollment not found");
    }

    return this.prisma.enrollment.delete({
      where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
    });
  }
}
