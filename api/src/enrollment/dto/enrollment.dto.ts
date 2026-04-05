import { IsString, IsUUID, IsOptional, IsEnum } from "class-validator";

export class CreateEnrollmentDto {
  @IsUUID()
  courseId: string;

  @IsUUID()
  userId: string;
}

export class EnrollmentStatusDto {
  @IsEnum(["active", "suspended", "completed", "withdrawn"])
  status: string;
}
