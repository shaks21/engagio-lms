import { Test, TestingModule } from '@nestjs/testing';
import { QuizService } from './quiz.service';
import { PollsService } from '../polls/polls.service';
import { PrismaService } from '../prisma/prisma.service';
import { IngestService } from '../ingest/ingest.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('QuizService (RED → GREEN)', () => {
  let service: QuizService;
  let pollsService: jest.Mocked<Partial<PollsService>>;
  let prisma: any;
  let ingest: jest.Mocked<Partial<IngestService>>;

  const TENANT_ID = 'tenant_001';
  const SESSION_ID = 'sess-abc';
  const QUIZ_SESSION_ID = 'quiz-123';
  const USER_ID = 'user-001';

  beforeEach(async () => {
    pollsService = {
      create: jest.fn(),
      vote: jest.fn(),
      findOne: jest.fn(),
    };

    prisma = {
      quizSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      userQuizState: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      pollOption: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    ingest = {
      emitEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: PollsService, useValue: pollsService },
        { provide: PrismaService, useValue: prisma },
        { provide: IngestService, useValue: ingest },
      ],
    }).compile();

    service = module.get(QuizService);
  });

  describe('createQuizSession', () => {
    it('should create a quiz session with pending status and store poll IDs', async () => {
      const polls = [
        { question: 'What is 2+2?', options: [{ text: '3', isCorrect: false }, { text: '4', isCorrect: true }] },
      ];

      pollsService.create = jest.fn().mockResolvedValue({
        id: 'poll-1',
        options: [{ id: 'opt-1' }, { id: 'opt-2' }],
      });

      prisma.quizSession.create.mockResolvedValue({
        id: QUIZ_SESSION_ID,
        sessionId: SESSION_ID,
        currentQuestionIndex: 0,
        status: 'pending',
        questions: [{ pollId: 'poll-1', createdAt: expect.any(String) }],
        createdAt: new Date(),
      });

      const result = await service.createQuizSession(TENANT_ID, SESSION_ID, polls);

      expect(result.status).toBe('pending');
      expect(result.currentQuestionIndex).toBe(0);
      expect(ingest.emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'QUIZ_STARTED',
          sessionId: SESSION_ID,
        }),
      );
    });

    it('should throw BadRequestException if polls array is empty', async () => {
      await expect(service.createQuizSession(TENANT_ID, SESSION_ID, [])).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if a poll has no correct option', async () => {
      const polls = [
        { question: 'Bad?', options: [{ text: 'A', isCorrect: false }, { text: 'B', isCorrect: false }] },
      ];
      await expect(service.createQuizSession(TENANT_ID, SESSION_ID, polls)).rejects.toThrow(BadRequestException);
    });
  });

  describe('startQuiz', () => {
    it('should set status to active and return first question', async () => {
      const quizSession = {
        id: QUIZ_SESSION_ID,
        status: 'pending',
        currentQuestionIndex: 0,
        questions: JSON.stringify([{ pollId: 'poll-1' }, { pollId: 'poll-2' }]),
        sessionId: SESSION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.quizSession.findFirst.mockResolvedValue(quizSession);
      prisma.quizSession.update.mockResolvedValue({ ...quizSession, status: 'active' });
      pollsService.findOne = jest.fn().mockResolvedValue({
        id: 'poll-1', question: 'What is 2+2?', options: [{ id: 'opt-a', text: '4', isCorrect: true }] },
      );

      const result = await service.startQuiz(TENANT_ID, QUIZ_SESSION_ID);

      expect(result.status).toBe('active');
      expect(result.currentQuestion).toBeDefined();
      expect(ingest.emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'QUIZ_QUESTION_SENT',
          sessionId: SESSION_ID,
        }),
      );
    });

    it('should throw NotFoundException for non-existent quiz session', async () => {
      prisma.quizSession.findFirst.mockResolvedValue(null);
      await expect(service.startQuiz(TENANT_ID, 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitAnswer', () => {
    it('should award points for correct answer', async () => {
      const quizSession = {
        id: QUIZ_SESSION_ID,
        status: 'active',
        currentQuestionIndex: 0,
        questions: JSON.stringify([{ pollId: 'poll-1' }]),
        sessionId: SESSION_ID,
      };

      prisma.quizSession.findFirst.mockResolvedValue(quizSession);
      prisma.pollOption.findFirst.mockResolvedValue(
        { id: 'opt-a', pollId: 'poll-1', isCorrect: true }
      );
      prisma.userQuizState.findFirst.mockResolvedValue(null);
      prisma.userQuizState.upsert.mockResolvedValue({
        userId: USER_ID,
        sessionId: QUIZ_SESSION_ID,
        totalScore: 10,
      });

      const result = await service.submitAnswer(TENANT_ID, QUIZ_SESSION_ID, USER_ID, 'opt-a', 10);

      expect(result.score).toBe(10);
      expect(result.correct).toBe(true);
      expect(pollsService.vote).toHaveBeenCalled();
      expect(ingest.emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'QUIZ_ANSWER_SUBMITTED',
          sessionId: SESSION_ID,
        }),
      );
    });

    it('should award zero points for incorrect answer', async () => {
      const quizSession = {
        id: QUIZ_SESSION_ID,
        status: 'active',
        currentQuestionIndex: 0,
        questions: JSON.stringify([{ pollId: 'poll-1' }]),
        sessionId: SESSION_ID,
      };

      prisma.quizSession.findFirst.mockResolvedValue(quizSession);
      prisma.pollOption.findFirst.mockResolvedValue(
        { id: 'opt-b', pollId: 'poll-1', isCorrect: false }
      );
      prisma.userQuizState.findFirst.mockResolvedValue(null);
      prisma.userQuizState.upsert.mockResolvedValue({
        userId: USER_ID,
        sessionId: QUIZ_SESSION_ID,
        totalScore: 0,
      });

      const result = await service.submitAnswer(TENANT_ID, QUIZ_SESSION_ID, USER_ID, 'opt-b', 10);

      expect(result.score).toBe(0);
      expect(result.correct).toBe(false);
    });
  });

  describe('nextQuestion', () => {
    it('should increment question index and broadcast next question', async () => {
      const quizSession = {
        id: QUIZ_SESSION_ID,
        status: 'active',
        currentQuestionIndex: 0,
        questions: JSON.stringify([{ pollId: 'poll-1' }, { pollId: 'poll-2' }]),
        sessionId: SESSION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.quizSession.findFirst.mockResolvedValue(quizSession);
      prisma.quizSession.update.mockResolvedValue({
        ...quizSession,
        currentQuestionIndex: 1,
      });
      pollsService.findOne = jest.fn().mockResolvedValue({ id: 'poll-2', question: 'Next Q' });

      const result = await service.nextQuestion(TENANT_ID, QUIZ_SESSION_ID) as any;

      expect(result.currentQuestionIndex).toBe(1);
      expect(result.currentQuestion).toBeDefined();
    });

    it('should end quiz when on last question', async () => {
      const quizSession = {
        id: QUIZ_SESSION_ID,
        status: 'active',
        currentQuestionIndex: 0,
        questions: JSON.stringify([{ pollId: 'poll-1' }]),
        sessionId: SESSION_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.quizSession.findFirst.mockResolvedValue(quizSession);
      prisma.quizSession.update.mockResolvedValue({
        ...quizSession,
        status: 'completed',
        currentQuestionIndex: 0,
      });

      const result = await service.nextQuestion(TENANT_ID, QUIZ_SESSION_ID) as any;

      expect(result.status).toBe('completed');
      expect(ingest.emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'QUIZ_ENDED',
          sessionId: SESSION_ID,
        }),
      );
    });
  });

  describe('getLeaderboard', () => {
    it('should return top users sorted by score descending', async () => {
      prisma.userQuizState.findMany.mockResolvedValue([
        { userId: 'user-c', totalScore: 50 },
        { userId: 'user-a', totalScore: 30 },
        { userId: 'user-b', totalScore: 20 },
      ]);

      const leaderboard = await service.getLeaderboard(TENANT_ID, QUIZ_SESSION_ID, 10);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].userId).toBe('user-c');
      expect(leaderboard[0].totalScore).toBe(50);
      expect(leaderboard[1].userId).toBe('user-a');
      expect(leaderboard[2].userId).toBe('user-b');
    });
  });
});
