import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { CourseService } from "./course.service";
import { CreateCourseDto, UpdateCourseDto } from "./dto/course.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../tenancy/tenant.guard";

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller("courses")
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateCourseDto) {
    return this.courseService.create(req.tenantId, dto);
  }

  @Get()
  async findAll(@Request() req, @Query("instructorId") instructorId?: string) {
    return this.courseService.findAll(req.tenantId, { instructorId });
  }

  @Get(":id")
  async findOne(@Request() req, @Param("id") id: string) {
    return this.courseService.findOne(req.tenantId, id);
  }

  @Patch(":id")
  async update(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courseService.update(req.tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req, @Param("id") id: string) {
    return this.courseService.remove(req.tenantId, id);
  }
}
