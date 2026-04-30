import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PollsService } from "../polls/polls.service";
import { PrismaService } from "../prisma/prisma.service";
import { IngestService } from "../ingest/ingest.service";

export interface QuizPoll {
  question: string;
  options: { text: string; isCorrect: boolean }[];
}

export interface CreateQuizSessionResult {
  id: string;
  sessionId: string;
  status: string;
  currentQuestionIndex: number;
  questions: { pollId: string; createdAt: string }[];
  createdAt: Date;
}

export interface QuizAnswerResult {
  score: number;
  correct: boolean;
  totalScore: number;
}

export interface LeaderboardEntry {
  userId: string;
  totalScore: number;
  rank: number;
}

@Injectable()
export class QuizService {
  constructor(
    private readonly pollsService: PollsService,
    private readonly prisma: PrismaService,
    private readonly ingest: IngestService,
  ) {}

  /**
   * Create a QuizSession from an array of poll definitions.
   * Each poll definition is validated: must have exactly one correct answer.
   * Underlying Poll and PollOption records are created via PollsService.
   */
  async createQuizSession(
    tenantId: string,
    sessionId: string,
    polls: QuizPoll[],
  ): Promise<CreateQuizSessionResult> {
    if (!polls || polls.length === 0) {
      throw new BadRequestException("Quiz must have at least one question");
    }

    const questions: { pollId: string; createdAt: string }[] = [];

    for (const p of polls) {
      const correctCount = p.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException(
          `Each poll must have exactly one correct option (found ${correctCount} for "${p.question}")`,
        );
      }

      // Reuse pollsService.create — but it does not accept isCorrect. We must create the poll
      // via pollsService first (inserts Poll + PollOptions without isCorrect), then patch isCorrect.
      const created = await this.pollsService.create(tenantId, sessionId, {
        question: p.question,
        options: p.options.map((o) => o.text),
      });

      // Patch isCorrect onto each PollOption based on the order they were created
      const optionIds = (created as any).options.map(
        (o: { id: string }) => o.id,
      );
      for (let i = 0; i < optionIds.length; i++) {
        await this.prisma.pollOption.update({
          where: { id: optionIds[i] },
          data: { isCorrect: p.options[i].isCorrect },
        });
      }

      questions.push({
        pollId: (created as any).id,
        createdAt: new Date().toISOString(),
      });
    }

    const quizSession = await this.prisma.quizSession.create({
      data: {
        tenantId,
        sessionId,
        questions: JSON.parse(JSON.stringify(questions)),
        status: "pending",
        currentQuestionIndex: 0,
      },
    });

    await this.ingest.emitEvent({
      tenantId,
      sessionId,
      type: "QUIZ_STARTED",
      payload: { quizSessionId: quizSession.id, questionCount: questions.length },
      userId: "system",
    });

    return {
      id: quizSession.id,
      sessionId: quizSession.sessionId,
      status: quizSession.status,
      currentQuestionIndex: quizSession.currentQuestionIndex,
      questions,
      createdAt: quizSession.createdAt,
    };
  }

  /** Start an existing quiz (status -> active, broadcasts first question). */
  async startQuiz(
    tenantId: string,
    quizSessionId: string,
  ): Promise<CreateQuizSessionResult & { currentQuestion: any }> {
    const quizSession = await this.prisma.quizSession.findFirst({
      where: { id: quizSessionId, tenantId },
    });
    if (!quizSession) {
      throw new NotFoundException("Quiz session not found");
    }
    if (quizSession.status !== "pending") {
      throw new BadRequestException(`Quiz is already ${quizSession.status}`);
    }

    const questions = this.parseQuestions(quizSession.questions);
    if (questions.length === 0) {
      throw new BadRequestException("Quiz has no questions");
    }

    const updated = await this.prisma.quizSession.update({
      where: { id: quizSessionId },
      data: { status: "active" },
    });

    const currentPoll = await this.pollsService.findOne(
      tenantId,
      quizSession.sessionId,
      questions[0].pollId,
    );

    await this.ingest.emitEvent({
      tenantId,
      sessionId: quizSession.sessionId,
      type: "QUIZ_QUESTION_SENT",
      payload: {
        quizSessionId,
        questionIndex: 0,
        pollId: questions[0].pollId,
      },
      userId: "system",
    });

    return {
      id: updated.id,
      sessionId: updated.sessionId,
      status: updated.status,
      currentQuestionIndex: updated.currentQuestionIndex,
      questions,
      createdAt: updated.createdAt,
      currentQuestion: currentPoll,
    };
  }

  /**
   * Submit an answer for the current question.
   * Returns { score, correct, totalScore }.
   * Reuses PollsService.vote for the vote recording.
   */
  async submitAnswer(
    tenantId: string,
    quizSessionId: string,
    userId: string,
    optionId: string,
    basePoints: number = 10,
  ): Promise<QuizAnswerResult> {
    const quizSession = await this.prisma.quizSession.findFirst({
      where: { id: quizSessionId, tenantId, status: "active" },
    });
    if (!quizSession) {
      throw new NotFoundException("Quiz session not found or not active");
    }

    const questions = this.parseQuestions(quizSession.questions);
    const currentQ = questions[quizSession.currentQuestionIndex];
    if (!currentQ) {
      throw new BadRequestException("No active question");
    }

    // Validate option belongs to this poll
    const option = await this.prisma.pollOption.findFirst({
      where: { id: optionId, pollId: currentQ.pollId },
    });
    if (!option) {
      throw new BadRequestException("Invalid option for this question");
    }

    const correct = option.isCorrect;
    const score = correct ? basePoints : 0;

    // Reuse polls vote to record the vote
    await this.pollsService.vote(tenantId, quizSession.sessionId, currentQ.pollId, {
      optionId,
      userId,
    });

    // Upsert user quiz state
    const existingState = await this.prisma.userQuizState.findFirst({
      where: { quizSessionId, userId },
    });

    const oldAnswers: Array<{
      pollId: string;
      optionId: string;
      correct: boolean;
      score: number;
      timestamp: string;
    }> = existingState ? (existingState.answers as any) : [];

    const newAnswers = [
      ...oldAnswers,
      {
        pollId: currentQ.pollId,
        optionId,
        correct,
        score,
        timestamp: new Date().toISOString(),
      },
    ];

    const totalScore = newAnswers.reduce((sum, a) => sum + a.score, 0);

    await this.prisma.userQuizState.upsert({
      where: {
        id: existingState?.id || "new", // fallback
      },
      update: {
        totalScore,
        answers: JSON.parse(JSON.stringify(newAnswers)),
      },
      create: {
        quizSessionId,
        userId,
        totalScore,
        answers: JSON.parse(JSON.stringify(newAnswers)),
      },
    });

    await this.ingest.emitEvent({
      tenantId,
      sessionId: quizSession.sessionId,
      type: "QUIZ_ANSWER_SUBMITTED",
      payload: {
        quizSessionId,
        userId,
        pollId: currentQ.pollId,
        optionId,
        correct,
        score,
      },
      userId,
    });

    return { score, correct, totalScore };
  }

  /**
   * Advance to next question. If on the last question, end the quiz.
   */
  async nextQuestion(
    tenantId: string,
    quizSessionId: string,
  ): Promise<
    | (CreateQuizSessionResult & { currentQuestion: any })
    | { status: string; quizSessionId: string }
  > {
    const quizSession = await this.prisma.quizSession.findFirst({
      where: { id: quizSessionId, tenantId, status: "active" },
    });
    if (!quizSession) {
      throw new NotFoundException("Quiz session not found or not active");
    }

    const questions = this.parseQuestions(quizSession.questions);
    const nextIndex = quizSession.currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      // End quiz
      await this.prisma.quizSession.update({
        where: { id: quizSessionId },
        data: { status: "completed" },
      });

      await this.ingest.emitEvent({
        tenantId,
        sessionId: quizSession.sessionId,
        type: "QUIZ_ENDED",
        payload: { quizSessionId, totalQuestions: questions.length },
        userId: "system",
      });

      return { status: "completed", quizSessionId };
    }

    const updated = await this.prisma.quizSession.update({
      where: { id: quizSessionId },
      data: { currentQuestionIndex: nextIndex },
    });

    const currentPoll = await this.pollsService.findOne(
      tenantId,
      quizSession.sessionId,
      questions[nextIndex].pollId,
    );

    await this.ingest.emitEvent({
      tenantId,
      sessionId: quizSession.sessionId,
      type: "QUIZ_QUESTION_SENT",
      payload: {
        quizSessionId,
        questionIndex: nextIndex,
        pollId: questions[nextIndex].pollId,
      },
      userId: "system",
    });

    return {
      id: updated.id,
      sessionId: updated.sessionId,
      status: updated.status,
      currentQuestionIndex: updated.currentQuestionIndex,
      questions,
      createdAt: updated.createdAt,
      currentQuestion: currentPoll,
    };
  }

  /** Aggregate top-N leaderboard from UserQuizState. */
  async getLeaderboard(
    tenantId: string,
    quizSessionId: string,
    limit: number = 10,
  ): Promise<LeaderboardEntry[]> {
    const states = await this.prisma.userQuizState.findMany({
      where: { quizSessionId },
      orderBy: { totalScore: "desc" },
      take: limit,
    });

    return states.map((s, i) => ({ userId: s.userId, totalScore: s.totalScore, rank: i + 1 }));
  }

  private parseQuestions(questionsJson: any): { pollId: string; createdAt: string }[] {
    if (questionsJson === null || questionsJson === undefined) return [];
    if (Array.isArray(questionsJson)) return questionsJson;
    if (typeof questionsJson === "string") return JSON.parse(questionsJson);
    return questionsJson;
  }
}
