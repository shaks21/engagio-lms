import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { PrismaService } from "../prisma/prisma.service";
import { IngestService } from "../ingest/ingest.service";

@WebSocketGateway({
  cors: { origin: "*", credentials: true },
  namespace: "/classroom",
  adapter: createAdapter(
    new Redis({ host: process.env.REDIS_HOST || "localhost" }),
    new Redis({ host: process.env.REDIS_HOST || "localhost" }),
  ),
})
export class ClassroomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ClassroomGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingest: IngestService,
  ) {}

  async onModuleInit() {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const tenantId = client.data.tenantId as string | undefined;
    const sessionId = client.data.sessionId as string | undefined;

    if (tenantId) {
      this.server.to(tenantId).emit("user-left", { clientId: client.id });
    }
    if (sessionId) {
      this.server.to(`session::${sessionId}`).emit("user-left", { clientId: client.id });
    }
  }

  @SubscribeMessage("joinClassroom")
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { 
      tenantId: string; 
      sessionId: string; 
      courseId: string; 
      userId: string; 
      userName?: string; 
      classroomCode?: string 
    },
  ) {
    const { tenantId, sessionId, courseId, userId, userName, classroomCode } = data;

    client.data.tenantId = tenantId;
    client.data.sessionId = sessionId;
    client.data.userId = userId;

    client.join(tenantId);
    client.join(`session::${sessionId}`);

    this.logger.log(`User ${userId} (${userName}) joined tenant ${tenantId}, session ${sessionId}`);

    // Upsert session
    try {
      await this.prisma.session.upsert({
        where: { id: sessionId },
        update: {},
        create: {
          id: sessionId,
          tenantId,
          userId,
          courseId,
          classroomCode: classroomCode || sessionId,
          dwellTime: 0,
        },
      });
    } catch (e) {
      this.logger.error(`Session upsert failed: ${e}`);
    }

    // Emit engagement event to Kafka
    await this.ingest.emitEvent({
      tenantId,
      sessionId,
      type: "JOIN",
      payload: { userId, clientId: client.id },
      userId,
    });

    this.server.to(tenantId).emit("user-joined", { userId, clientId: client.id });

    return { status: "ok", message: "joined classroom" };
  }

  @SubscribeMessage("engagementEvent")
  async handleEngagementEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { type: string; payload: Record<string, unknown> },
  ) {
    const tenantId = client.data.tenantId as string | undefined;
    const sessionId = client.data.sessionId as string | undefined;
    const userId = client.data.userId as string | undefined;
    const userName = client.data.userName as string | undefined;

    if (!tenantId || !sessionId) {
      this.logger.warn(`Engagement event without context: type=${data.type}, clientId=${client.id}`);
      return { status: "error", message: "Not joined to a classroom" };
    }

    await this.ingest.emitEvent({
      tenantId,
      sessionId,
      type: data.type,
      payload: data.payload,
      userId: userId || "unknown",
    });

    // Broadcast real-time events to all participants in the session
    if (data.type === "CHAT") {
      this.logger.log(`Broadcasting chat message from ${userId} in session ${sessionId}`);
      this.server.to(`session::${sessionId}`).emit("chat-message", {
        id: Date.now().toString(),
        userId,
        clientId: client.id,
        userName: userName || userId?.slice(0, 8) || "User",
        text: data.payload.text || data.payload.message,
        timestamp: new Date().toISOString(),
      });
    } else if (data.type === "MIC") {
      this.server.to(`session::${sessionId}`).emit("participant-media-update", {
        userId,
        clientId: client.id,
        micActive: data.payload.active,
      });
    } else if (data.type === "CAMERA") {
      this.server.to(`session::${sessionId}`).emit("participant-media-update", {
        userId,
        clientId: client.id,
        cameraActive: data.payload.active,
      });
    } else if (data.type === "SCREEN_SHARE") {
      this.server.to(`session::${sessionId}`).emit("participant-media-update", {
        userId,
        clientId: client.id,
        screenShareActive: data.payload.active,
      });
    }

    return { status: "ok" };
  }

  // WebRTC Signaling: Receive offer from a peer and forward to target
  @SubscribeMessage("webrtc-offer")
  async handleWebRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; offer: RTCSessionDescriptionInit; sessionId: string },
  ) {
    const { targetClientId, offer, sessionId } = data;
    this.logger.log(`Forwarding WebRTC offer from ${client.id} to ${targetClientId}`);
    
    // Forward offer to target peer
    this.server.to(targetClientId).emit("webrtc-offer", {
      offer,
      senderClientId: client.id,
      sessionId,
    });
    
    return { status: "ok" };
  }

  // WebRTC Signaling: Receive answer from a peer and forward to target
  @SubscribeMessage("webrtc-answer")
  async handleWebRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; answer: RTCSessionDescriptionInit; sessionId: string },
  ) {
    const{ targetClientId, answer, sessionId } = data;
    this.logger.log(`Forwarding WebRTC answer from ${client.id} to ${targetClientId}`);
    
    // Forward answer to target peer
    this.server.to(targetClientId).emit("webrtc-answer", {
      answer,
      senderClientId: client.id,
      sessionId,
    });
    
    return { status: "ok" };
  }

  // WebRTC Signaling: Receive ICE candidate from a peer and forward to target
  @SubscribeMessage("webrtc-ice-candidate")
  async handleWebRTCIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; candidate: RTCIceCandidateInit; sessionId: string },
  ) {
    const{ targetClientId, candidate, sessionId } = data;
    this.logger.log(`Forwarding ICE candidate from ${client.id} to ${targetClientId}`);
    
    // Forward ICE candidate to target peer
    this.server.to(targetClientId).emit("webrtc-ice-candidate", {
      candidate,
      senderClientId: client.id,
      sessionId,
    });
    
    return { status: "ok" };
  }
}
