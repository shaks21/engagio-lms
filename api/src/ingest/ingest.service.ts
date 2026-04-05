import { Injectable, Inject, Logger, OnModuleInit } from "@nestjs/common";
import { ClientKafka } from "@nestjs/microservices";

export interface ClassroomEvent {
  tenantId: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  userId: string;
}

@Injectable()
export class IngestService implements OnModuleInit {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    @Inject("KAFKA_CLIENT") private readonly kafkaClient: ClientKafka,
  ) {}

  onModuleInit() {
    this.kafkaClient.subscribeToResponseOf("classroom-events");
  }

  async emitEvent(event: ClassroomEvent) {
    this.logger.log(
      `Publishing event: ${event.type} for session ${event.sessionId}`,
    );
    this.kafkaClient.emit("classroom-events", {
      key: `${event.tenantId}:${event.sessionId}`,
      value: event,
    });
  }
}
