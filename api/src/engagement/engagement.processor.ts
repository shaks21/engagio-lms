import { Injectable, OnModuleInit, Logger, OnModuleDestroy } from "@nestjs/common";
import { Kafka, Consumer } from "kafkajs";
import { PrismaService } from "../prisma/prisma.service";

interface ClassroomEventPayload {
  tenantId: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  userId: string;
}

// Event weights for engagement scoring
const EVENT_WEIGHTS: Record<string, number> = {
  CHAT: 10,
  MIC: 20,
  CAMERA: 20,
  SCREEN_SHARE: 20,
  BLUR: -30,
  FOCUS: 0,
  JOIN: 5,
  LEAVE: 0,
  MOUSE_TRACK: 2,
  KEYSTROKE: 3,
};

@Injectable()
export class EngagementProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EngagementProcessor.name);
  private consumer: Consumer;
  private snapshotInterval: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {
    const kafka = new Kafka({
      clientId: "engagio-engagement-processor",
      brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
    });
    this.consumer = kafka.consumer({ groupId: "engagement-processor" });
  }

  async onModuleInit() {
    this.startConsumer().catch((err) => {
      this.logger.error("Failed to start Kafka consumer:", err);
      this.retryConsumer();
    });

    // Aggregate engagement snapshots every 60 seconds
    this.snapshotInterval = setInterval(() => this.computeSnapshots(), 60_000);
  }

  async onModuleDestroy() {
    clearInterval(this.snapshotInterval);
    await this.consumer.disconnect();
  }

  private async startConsumer() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: "classroom-events", fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;

        try {
          const event = JSON.parse(message.value.toString()) as ClassroomEventPayload;

          this.logger.log(
            `[${topic}/${message.offset}] ${event.type} tenant=${event.tenantId} session=${event.sessionId}`,
          );

          // GUARD: Skip events with null tenantId to prevent Prisma validation errors
          if (!event.tenantId || !event.sessionId) {
            this.logger.warn(
              `[${topic}/${message.offset}] Skipping event with missing tenantId or sessionId`,
            );
            return;
          }

          // Wrap Prisma write in try/catch so Kafka consumer doesn't crash on FK violations
          await this.prisma.engagementEvent.create({
            data: {
              tenantId: event.tenantId,
              sessionId: event.sessionId,
              type: event.type as any,
              payload: event.payload as any,
            },
          });
        } catch (err: any) {
          this.logger.error(
            `[${topic}/${message.offset}] Failed to process event: ${err?.message || err}`,
          );
          // Do NOT rethrow — swallow the error so KafkaJS doesn't crash and retry
        }
      },
    });
    this.logger.log("Kafka consumer running on classroom-events");
  }

  private retryConsumer() {
    setTimeout(() => {
      this.logger.log("Retrying Kafka consumer connection...");
      this.startConsumer().catch((err) => {
        this.logger.error("Retry failed:", err);
        this.retryConsumer();
      });
    }, 5000);
  }

  private async computeSnapshots() {
    this.logger.log("Computing engagement snapshots for last 60s window...");

    const oneMinAgo = new Date(Date.now() - 60_000);

    // Find all active sessions
    const activeSessions = await this.prisma.session.findMany({
      where: { endedAt: null },
      select: { id: true, userId: true, tenantId: true },
    });

    for (const session of activeSessions) {
      // Get events for this session in the last 60s
      const events = await this.prisma.engagementEvent.findMany({
        where: {
          sessionId: session.id,
          timestamp: { gte: oneMinAgo },
        },
        select: { type: true, payload: true },
      });

      if (events.length === 0) continue;

      // Compute score per user
      let score = 100; // Start neutral
      for (const event of events) {
        const weight = EVENT_WEIGHTS[event.type] ?? 0;
        score += weight;
      }

      // Clamp: 0-100
      score = Math.max(0, Math.min(100, score));

      await this.prisma.engagementSnapshot.create({
        data: {
          tenantId: session.tenantId,
          sessionId: session.id,
          userId: session.userId,
          score,
        },
      });
    }
  }
}
