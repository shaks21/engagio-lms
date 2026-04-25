import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface CreatePollDto {
  question: string;
  options: string[];
}

export interface VoteDto {
  optionId: string;
  userId: string;
}

@Injectable()
export class PollsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, sessionId: string, dto: CreatePollDto) {
    if (!dto.question?.trim()) {
      throw new BadRequestException("Poll question is required");
    }
    const opts = dto.options ?? [];
    if (opts.length < 2 || opts.length > 4) {
      throw new BadRequestException("Poll must have 2–4 options");
    }

    return this.prisma.poll.create({
      data: {
        tenantId,
        sessionId,
        question: dto.question.trim(),
        status: "active",
        options: {
          create: opts.map((text, i) => ({
            text: text.trim(),
            sortOrder: i,
          })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        _count: { select: { votes: true } },
      },
    });
  }

  async vote(
    tenantId: string,
    sessionId: string,
    pollId: string,
    dto: VoteDto,
  ) {
    const poll = await this.prisma.poll.findFirst({
      where: { id: pollId, tenantId, sessionId, status: "active" },
      include: { options: true },
    });
    if (!poll) {
      throw new NotFoundException("Poll not found or inactive");
    }
    const validOption = poll.options.find((o) => o.id === dto.optionId);
    if (!validOption) {
      throw new BadRequestException("Invalid option");
    }

    // Upsert vote (one per user per poll)
    await this.prisma.pollVote.upsert({
      where: {
        pollId_userId: {
          pollId,
          userId: dto.userId,
        },
      },
      update: { optionId: dto.optionId },
      create: {
        pollId,
        optionId: dto.optionId,
        userId: dto.userId,
      },
    });

    return this.findOne(tenantId, sessionId, pollId);
  }

  async findOne(tenantId: string, sessionId: string, pollId: string) {
    const poll = await this.prisma.poll.findFirst({
      where: { id: pollId, tenantId, sessionId },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
          include: {
            _count: { select: { votes: true } },
          },
        },
        _count: { select: { votes: true } },
      },
    });
    if (!poll) {
      throw new NotFoundException("Poll not found");
    }

    const totalVotes = poll._count.votes;
    return {
      id: poll.id,
      sessionId: poll.sessionId,
      question: poll.question,
      status: poll.status,
      totalVotes,
      options: poll.options.map((o) => ({
        id: o.id,
        text: o.text,
        voteCount: o._count.votes,
        percentage: totalVotes > 0 ? Math.round((o._count.votes / totalVotes) * 100) : 0,
      })),
    };
  }

  async findActiveBySession(tenantId: string, sessionId: string) {
    const polls = await this.prisma.poll.findMany({
      where: { tenantId, sessionId, status: "active" },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
          include: {
            _count: { select: { votes: true } },
          },
        },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return polls.map((poll) => {
      const totalVotes = poll._count.votes;
      return {
        id: poll.id,
        sessionId: poll.sessionId,
        question: poll.question,
        status: poll.status,
        totalVotes,
        options: poll.options.map((o) => ({
          id: o.id,
          text: o.text,
          voteCount: o._count.votes,
          percentage: totalVotes > 0 ? Math.round((o._count.votes / totalVotes) * 100) : 0,
        })),
      };
    });
  }

  async close(tenantId: string, sessionId: string, pollId: string) {
    const poll = await this.prisma.poll.findFirst({
      where: { id: pollId, tenantId, sessionId },
    });
    if (!poll) {
      throw new NotFoundException("Poll not found");
    }
    return this.prisma.poll.update({
      where: { id: pollId },
      data: { status: "closed" },
    });
  }
}
