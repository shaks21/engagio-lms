import { IsUUID, IsOptional } from "class-validator";

export class StartSessionDto {
  @IsUUID()
  courseId: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  classroomCode?: string;
}

export class UpdateSessionDto {
  @IsOptional()
  endedAt?: string;
}
