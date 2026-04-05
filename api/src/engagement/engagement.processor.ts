import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { Kafka, Consumer } from "kafkajs";
import { PrismaService } from "../prisma/prisma.service";

interface ClassroomEventPayload {
  tenantId: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  userId: string;
}

@Injectable()
export class EngagementProcessor implements OnModuleInit {
  private readonly logger = new Logger(EngagementProcessor.name);
  private consumer: Consumer;

  constructor(private readonly prisma: PrismaService) {
    const kafka = new Kafka({
      clientId: "engagio-engagement-processor",
      brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
    });
    this.consumer = kafka.consumer({ groupId: "engagement-processor" });
  }

  async onModuleInit() {
    // Spin up consumer in background so it does not block app bootstrap
    this.startConsumer().catch((err) => {
      this.logger.error("Failed to start Kafka consumer (will retry):", err);
      this.retryConsumer();
    });
  }

  private async startConsumer() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: "classroom-events", fromBeginning: true });

    const TRACKED_TYPES = new Set([
      "CHAT", "MOUSE_TRACK", "KEYSTROKE", "MIC", "SCREEN_SHARE",
    ]);

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;

        const event = JSON.parse(message.value.toString()) as ClassroomEventPayload;

        this.logger.log(
          `[${topic}/${message.offset}] ${event.type} tenant=${event.tenantId} session=${event.sessionId}`,
        );

        await this.prisma.engagementEvent.create({
          data: {
            tenantId: event.tenantId,
            sessionId: event.sessionId,
            type: event.type as any,
            payload: event.payload as any,
          },
        });

        if (TRACKED_TYPES.has(event.type)) {
          await this.prisma.session.update({
            where: { id: event.sessionId },
            data: { dwellTime: { increment: 10 } },
          });
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
}
