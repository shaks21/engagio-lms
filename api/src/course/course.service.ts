import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCourseDto, UpdateCourseDto } from "./dto/course.dto";

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        instructorId: dto.instructorId,
      },
    });
  }

  async findAll(tenantId: string, query?: { instructorId?: string }) {
    const where: any = { tenantId };

    if (query?.instructorId) {
      where.instructorId = query.instructorId;
    }

    return this.prisma.course.findMany({
      where,
      include: {
        instructor: { select: { id: true, email: true } },
        enrollments: { select: { id: true, status: true } },
        sessions: { select: { id: true, startedAt: true, endedAt: true } },
        _count: {
          select: { enrollments: true, sessions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, tenantId },
      include: {
        instructor: { select: { id: true, email: true, role: true } },
        enrollments: {
          include: { user: { select: { id: true, email: true, role: true } } },
        },
        sessions: {
          select: {
            id: true,
            classroomCode: true,
            startedAt: true,
            endedAt: true,
            dwellTime: true,
          },
          orderBy: { startedAt: "desc" },
        },
        _count: {
          select: { enrollments: true, sessions: true },
        },
      },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    return course;
  }

  async update(tenantId: string, id: string, dto: UpdateCourseDto) {
    const existing = await this.prisma.course.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException("Course not found");
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.instructorId && { instructorId: dto.instructorId }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.course.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException("Course not found");
    }

    // Delete enrollments and sessions first (cascading relations)
    await this.prisma.enrollment.deleteMany({
      where: { courseId: id },
    });
    await this.prisma.session.deleteMany({
      where: { courseId: id },
    });

    return this.prisma.course.delete({
      where: { id },
    });
  }
}
