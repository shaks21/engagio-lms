import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from "@nestjs/common";
import { QuizService, QuizPoll } from "./quiz.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../tenancy/tenant.guard";

export interface CreateQuizBody {
  questions: QuizPoll[];
}

export interface StartQuizBody {
  quizSessionId: string;
}

export interface SubmitAnswerBody {
  quizSessionId: string;
  optionId: string;
}

export interface NextQuestionBody {
  quizSessionId: string;
}

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller("sessions/:sessionId/quizzes")
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: any,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: CreateQuizBody,
  ) {
    return this.quizService.createQuizSession(req.tenantId, sessionId, body.questions);
  }

  @Post(":quizSessionId/start")
  async start(
    @Request() req: any,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("quizSessionId") quizSessionId: string,
  ) {
    return this.quizService.startQuiz(req.tenantId, quizSessionId);
  }

  @Post("answer")
  @HttpCode(HttpStatus.OK)
  async submitAnswer(
    @Request() req: any,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: SubmitAnswerBody,
  ) {
    return this.quizService.submitAnswer(
      req.tenantId,
      body.quizSessionId,
      req.user?.id || req.user?.sub || "anonymous",
      body.optionId,
    );
  }

  @Post("next")
  async nextQuestion(
    @Request() req: any,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: NextQuestionBody,
  ) {
    return this.quizService.nextQuestion(req.tenantId, body.quizSessionId);
  }

  @Get(":quizSessionId/leaderboard")
  async getLeaderboard(
    @Request() req: any,
    @Param("quizSessionId") quizSessionId: string,
  ) {
    return this.quizService.getLeaderboard(req.tenantId, quizSessionId);
  }
}
