import { IsUUID, IsOptional, IsString } from "class-validator";

export class StartSessionDto {
  @IsUUID()
  courseId: string;

  @IsOptional()
  @IsString()
  classroomCode?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class UpdateSessionDto {
  @IsOptional()
  endedAt?: string;
}
