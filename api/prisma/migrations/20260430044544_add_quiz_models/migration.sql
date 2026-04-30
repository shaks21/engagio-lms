-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'HAND_RAISE';
ALTER TYPE "EventType" ADD VALUE 'TEACHER_INTERVENTION';
ALTER TYPE "EventType" ADD VALUE 'POLL_CREATED';
ALTER TYPE "EventType" ADD VALUE 'POLL_VOTE';
ALTER TYPE "EventType" ADD VALUE 'QUIZ_STARTED';
ALTER TYPE "EventType" ADD VALUE 'QUIZ_QUESTION_SENT';
ALTER TYPE "EventType" ADD VALUE 'QUIZ_ANSWER_SUBMITTED';
ALTER TYPE "EventType" ADD VALUE 'QUIZ_ENDED';

-- AlterTable
ALTER TABLE "PollOption" ADD COLUMN     "isCorrect" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "breakoutConfig" JSONB;

-- CreateTable
CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuizState" (
    "id" TEXT NOT NULL,
    "quizSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "answers" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuizState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizSession_tenantId_idx" ON "QuizSession"("tenantId");

-- CreateIndex
CREATE INDEX "QuizSession_sessionId_idx" ON "QuizSession"("sessionId");

-- CreateIndex
CREATE INDEX "QuizSession_status_idx" ON "QuizSession"("status");

-- CreateIndex
CREATE INDEX "UserQuizState_quizSessionId_idx" ON "UserQuizState"("quizSessionId");

-- CreateIndex
CREATE INDEX "UserQuizState_userId_idx" ON "UserQuizState"("userId");

-- CreateIndex
CREATE INDEX "UserQuizState_quizSessionId_totalScore_idx" ON "UserQuizState"("quizSessionId", "totalScore");

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuizState" ADD CONSTRAINT "UserQuizState_quizSessionId_fkey" FOREIGN KEY ("quizSessionId") REFERENCES "QuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
