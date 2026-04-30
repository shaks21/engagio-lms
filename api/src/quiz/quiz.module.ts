import { Module } from "@nestjs/common";
import { QuizService } from "./quiz.service";
import { PollsModule } from "../polls/polls.module";
import { PrismaModule } from "../prisma/prisma.module";
import { IngestModule } from "../ingest/ingest.module";
import { QuizController } from "./quiz.controller";

@Module({
  imports: [PollsModule, PrismaModule, IngestModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
