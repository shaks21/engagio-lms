import { Module } from "@nestjs/common";
import { ClassroomGateway } from "./classroom.gateway";
import { IngestModule } from "../ingest/ingest.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuizModule } from "../quiz/quiz.module";

@Module({
  imports: [IngestModule, PrismaModule, QuizModule],
  providers: [ClassroomGateway],
  exports: [ClassroomGateway],
})
export class ClassroomModule {}
