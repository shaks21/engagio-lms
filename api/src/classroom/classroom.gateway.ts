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
import * as process from 'process';

interface Participant {
  clientId: string;
  socketId: string;
  userId: string;
  userName?: string;
  tenantId: string;
  sessionId: string;
  joinedAt: Date;
  mediaState: {
    hasVideo: boolean;
    hasAudio: boolean;
    isScreenSharing: boolean;
  };
}

interface SessionRoom {
  participants: Map<string, Participant>; // key by clientId
}

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

  // In-memory participant tracking per session
  // Key: sessionId, Value: Map<clientId, Participant>
  private sessions = new Map<string, SessionRoom>();

  // Map socket.id -> clientId for quick lookup on disconnect
  private socketToClientId = new Map<string, string>();

  // Production TURN servers for NAT traversal
  private readonly hasTurn = !!(process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingest: IngestService,
  ) {}

  async onModuleInit() {}

  // Helper: Get or create a session room
  private getOrCreateSession(sessionId: string): SessionRoom {
    let room = this.sessions.get(sessionId);
    if (!room) {
      room = { participants: new Map() };
      this.sessions.set(sessionId, room);
    }
    return room;
  }

  // Helper: Remove participant from session
  private removeParticipantFromSession(sessionId: string, clientId: string): Participant | undefined {
    const room = this.sessions.get(sessionId);
    if (!room) return undefined;
    
    const participant = room.participants.get(clientId);
    room.participants.delete(clientId);
    
    // Clean up empty sessions
    if (room.participants.size === 0) {
      this.sessions.delete(sessionId);
    }
    
    return participant;
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Look up participant by socket id
    const clientId = this.socketToClientId.get(client.id);
    
    if (clientId) {
      // Get participant info before removing
      const room = this.sessions.get(client.data.sessionId);
      const participant = room?.participants.get(clientId);
      
      if (participant) {
        const { tenantId, sessionId, userId, userName } = participant;
        
        // Remove from session tracking
        this.removeParticipantFromSession(sessionId, clientId);
        this.socketToClientId.delete(client.id);
        
        // Clean up socket.io room membership
        client.leave(tenantId);
        client.leave(`session::${sessionId}`);
        
        // Emit user-left to remaining participants in the session
        this.server.to(`session::${sessionId}`).emit("user-left", { 
          clientId, 
          userId,
          userName 
        });
        
        this.logger.log(`User ${userId} (${userName}) left session ${sessionId}`);
      }
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
      classroomCode?: string;
    },
  ) {
    const { tenantId, sessionId, courseId, userId, userName, classroomCode } = data;

    // Store connection data
    client.data.tenantId = tenantId;
    client.data.sessionId = sessionId;
    client.data.userId = userId;
    client.data.userName = userName;

    // Get or create session room
    const room = this.getOrCreateSession(sessionId);
    
    // IDEMPOTENCY: Check if this user already has an active connection
    // If so, remove the old entry before adding the new one
    let existingParticipant: Participant | undefined;
    for (const [clientId, participant] of room.participants.entries()) {
      if (participant.userId === userId) {
        // User already in session - remove old entry (handles refresh/reconnect)
        this.logger.log(`Removing stale participant entry for user ${userId}`);
        existingParticipant = participant;
        room.participants.delete(clientId);
        this.socketToClientId.forEach((cid, socketId) => {
          if (cid === clientId) this.socketToClientId.delete(socketId);
        });
        break;
      }
    }

    // Join socket.io rooms
    client.join(tenantId);
    client.join(`session::${sessionId}`);

    // Generate a stable clientId for this user in this session
    // Use userId + sessionId hash for consistency across reconnects
    const clientId = `${userId}-${sessionId}`.slice(0, 36);

    // Create participant entry
    const participant: Participant = {
      clientId,
      socketId: client.id,
      userId,
      userName: userName || userId.slice(0, 8),
      tenantId,
      sessionId,
      joinedAt: new Date(),
      mediaState: {
        hasVideo: false,
        hasAudio: false,
        isScreenSharing: false,
      },
    };

    // Add participant to session
    room.participants.set(clientId, participant);
    this.socketToClientId.set(client.id, clientId);

    this.logger.log(`User ${userId} (${userName}) joined tenant ${tenantId}, session ${sessionId}`);

    // Persist session in database
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

    // BROADCAST: Send user-joined to OTHERS (not to the joining user)
    client.broadcast.to(`session::${sessionId}`).emit("user-joined", { 
      userId, 
      clientId,
      userName: userName || userId.slice(0, 8)
    });

    // HYDRATION: Build current participants list for the joining user
    const currentParticipants = Array.from(room.participants.values()).map(p => ({
      clientId: p.clientId,
      userId: p.userId,
      userName: p.userName,
      joinedAt: p.joinedAt.toISOString(),
      mediaState: p.mediaState,
    }));

    // EMIT: Send classroom-ready with full participant list to the JOINING user directly
    // This is the key fix - explicitly emit the event to the client
    this.server.to(client.id).emit("classroom-joined", { 
      status: "ok", 
      message: "joined classroom",
      clientId,
      currentParticipants
    });

    return { status: "ok" };
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
    const sessionSocket = `session::${sessionId}`;

    if (data.type === "MIC") {
      this.server.to(sessionSocket).emit("participant-media-update", {
        userId: userId,
        clientId: client.id,
        micActive: (data.payload as { active?: boolean })?.active ?? true,
      });
    } else if (data.type === "CAMERA") {
      this.server.to(sessionSocket).emit("participant-media-update", {
        userId: userId,
        clientId: client.id,
        cameraActive: (data.payload as { active?: boolean })?.active ?? true,
      });
    } else if (data.type === "SCREEN_SHARE") {
      this.server.to(sessionSocket).emit("participant-media-update", {
        userId: userId,
        clientId: client.id,
        screenShareActive: (data.payload as { active?: boolean })?.active ?? true,
      });
    } else if (data.type === "BLUR") {
      this.server.to(sessionSocket).emit("participant-engagement-update", {
        userId: userId,
        clientId: client.id,
        blurActive: true,
      });
    } else if (data.type === "FOCUS") {
      this.server.to(sessionSocket).emit("participant-engagement-update", {
        userId: userId,
        clientId: client.id,
        focusActive: (data.payload as { status?: string })?.status === "focus",
      });
    } else if (data.type === "CHAT") {
      this.server.to(sessionSocket).emit("chat-message", {
        id: Date.now().toString(),
        userId,
        clientId: client.id,
        userName: userName || userId?.slice(0, 8) || "User",
        text: (data.payload as { message?: string })?.message || "",
        timestamp: new Date().toISOString(),
      });
    } else if (data.type === "MOUSE_TRACK") {
      this.server.to(sessionSocket).emit("participant-mouse-move", {
        userId,
        clientId: client.id,
        x: (data.payload as { x?: number })?.x ?? 0,
        y: (data.payload as { y?: number })?.y ?? 0,
      });
    } else if (data.type === "KEYSTROKE") {
      this.server.to(sessionSocket).emit("participant-keystroke", {
        userId,
        clientId: client.id,
        count: (data.payload as { count?: number })?.count ?? 1,
      });
    }

    return { status: "ok" };
  }

  // WebRTC Signaling
  @SubscribeMessage("webrtc-offer")
  async handleWebRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; offer: any; sessionId: string },
  ) {
    const { targetClientId, offer, sessionId } = data;
    this.logger.log(`Forwarding WebRTC offer from ${client.id} to ${targetClientId}`);

    this.server.to(targetClientId).emit("webrtc-offer", {
      offer,
      senderClientId: client.id,
      sessionId,
    });

    return { status: "ok" };
  }

  @SubscribeMessage("webrtc-answer")
  async handleWebRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; answer: any; sessionId: string },
  ) {
    const { targetClientId, answer, sessionId } = data;
    this.logger.log(`Forwarding WebRTC answer from ${client.id} to ${targetClientId}`);

    this.server.to(targetClientId).emit("webrtc-answer", {
      answer,
      senderClientId: client.id,
      sessionId,
    });

    return { status: "ok" };
  }

  @SubscribeMessage("webrtc-ice-candidate")
  async handleWebRTCIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; candidate: any; sessionId: string },
  ) {
    const { targetClientId, candidate, sessionId } = data;
    this.logger.log(`Forwarding ICE candidate from ${client.id} to ${targetClientId}`);

    this.server.to(targetClientId).emit("webrtc-ice-candidate", {
      candidate,
      senderClientId: client.id,
      sessionId,
    });

    return { status: "ok" };
  }

  @SubscribeMessage("media-ready")
  async handleMediaReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { clientId: string; hasVideo: boolean; hasAudio: boolean },
  ) {
    const sessionId = client.data.sessionId as string | undefined;
    if (!sessionId) {
      return { status: "error", message: "Not in a session" };
    }

    const tenantId = client.data.tenantId as string | undefined;
    const userId = client.data.userId as string | undefined;

    // Update participant's media state
    const room = this.sessions.get(sessionId);
    if (room) {
      for (const [clientIdKey, participant] of room.participants.entries()) {
        if (participant.socketId === client.id || participant.userId === userId) {
          participant.mediaState = {
            hasVideo: data.hasVideo,
            hasAudio: data.hasAudio,
            isScreenSharing: participant.mediaState.isScreenSharing,
          };
          break;
        }
      }
    }

    this.logger.log(`Client ${client.id} media-ready in session ${sessionId}: video=${data.hasVideo}, audio=${data.hasAudio}`);

    // Broadcast media state to other participants in the session (NOT to self)
    client.broadcast.to(`session::${sessionId}`).emit("participant-media-update", {
      clientId: data.clientId,
      hasVideo: data.hasVideo,
      hasAudio: data.hasAudio,
      userId,
    });

    // Also emit participant-joined-media event to trigger WebRTC connection from other participants
    client.broadcast.to(`session::${sessionId}`).emit("participant-joined-media", {
      clientId: data.clientId,
      userId,
      hasVideo: data.hasVideo,
      hasAudio: data.hasAudio,
    });

    return { status: "ok" };
  }
}
