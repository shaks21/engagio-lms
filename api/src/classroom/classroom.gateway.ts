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

  // Helper: Find socket ID by stable clientId
  private getSocketIdByClientId(clientId: string, sessionId: string): string | undefined {
    const room = this.sessions.get(sessionId);
    if (!room) return undefined;
    
    const participant = room.participants.get(clientId);
    return participant?.socketId;
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

    // VALIDATION: Reject join if missing critical fields
    if (!tenantId || !userId || !sessionId) {
      this.logger.warn(`Rejecting join - missing required fields: tenantId=${tenantId}, userId=${userId}, sessionId=${sessionId}`);
      client.emit("join-error", { 
        status: "error", 
        message: "Missing required fields: tenantId, userId, and sessionId are required" 
      });
      return { status: "error", message: "Missing required fields" };
    }

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
    // Also check Socket.io rooms for participants that might have connected before server restart
    // Note: With Redis adapter, rooms may not be directly accessible
    let socketRoomMembers: Set<string> | undefined;
    try {
      socketRoomMembers = this.server.sockets?.adapter?.rooms?.get(`session::${sessionId}`);
    } catch (e) {
      // Redis adapter may not expose rooms directly
      this.logger.warn(`Cannot access socket rooms: ${e}`);
    }
    const knownParticipants = Array.from(room.participants.values());
    const socketMemberIds = socketRoomMembers ? Array.from(socketRoomMembers).filter(id => id !== client.id) : [];
    
    // Build participant list from both in-memory state AND socket room members
    const currentParticipantsMap = new Map();
    
    // Add known participants from in-memory store
    for (const p of knownParticipants) {
      currentParticipantsMap.set(p.clientId, {
        clientId: p.clientId,
        userId: p.userId,
        userName: p.userName,
        joinedAt: p.joinedAt.toISOString(),
        mediaState: p.mediaState,
      });
    }
    
    // Also check if there are socket room members we don't know about (e.g., after server restart)
    // For these, we need to emit a request to get their info
    for (const socketId of socketMemberIds) {
      const sock = this.server.sockets.sockets.get(socketId);
      if (sock && sock.data.userId) {
        const tempClientId = `${sock.data.userId}-${sessionId}`.slice(0, 36);
        if (!currentParticipantsMap.has(tempClientId)) {
          // New participant we don't have info for - add with minimal info
          currentParticipantsMap.set(tempClientId, {
            clientId: tempClientId,
            userId: sock.data.userId,
            userName: sock.data.userName || sock.data.userId.slice(0, 8),
            joinedAt: new Date().toISOString(),
            mediaState: { hasVideo: false, hasAudio: false, isScreenSharing: false },
          });
        }
      }
    }
    
    const currentParticipants = Array.from(currentParticipantsMap.values());

    // EMIT: Send classroom-joined with full participant list to the JOINING user directly
    this.server.to(client.id).emit("classroom-joined", { 
      status: "ok", 
      message: "joined classroom",
      clientId,
      currentParticipantCount: knownParticipants.length + 1, // +1 for self
      currentParticipants
    });

    // CRITICAL: Tell the NEW user about EXISTING participants who have media
    // This triggers them to create WebRTC offers TO those participants
    for (const p of knownParticipants) {
      if (p.mediaState.hasAudio || p.mediaState.hasVideo) {
        this.logger.log(`Notifying new user about participant ${p.userId} with media: video=${p.mediaState.hasVideo}, audio=${p.mediaState.hasAudio}`);
        this.server.to(client.id).emit("participant-joined-media", {
          clientId: p.clientId,
          userId: p.userId,
          hasVideo: p.mediaState.hasVideo,
          hasAudio: p.mediaState.hasAudio,
        });
      }
    }

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
    
    // Get stable clientId for this user in this session
    const stableClientId = this.socketToClientId.get(client.id);

    if (data.type === "MIC") {
      this.server.to(sessionSocket).emit("participant-media-update", {
        userId: userId,
        clientId: stableClientId || client.id,
        micActive: (data.payload as { active?: boolean })?.active ?? true,
      });
    } else if (data.type === "CAMERA") {
      this.server.to(sessionSocket).emit("participant-media-update", {
        userId: userId,
        clientId: stableClientId || client.id,
        cameraActive: (data.payload as { active?: boolean })?.active ?? true,
      });
    } else if (data.type === "SCREEN_SHARE") {
      this.server.to(sessionSocket).emit("participant-media-update", {
        userId: userId,
        clientId: stableClientId || client.id,
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
        text: (data.payload as { text?: string; message?: string })?.text ||
            (data.payload as { text?: string; message?: string })?.message || "",
        timestamp: new Date().toISOString(),
      });
    } else if (data.type === "QUESTION") {
      this.server.to(sessionSocket).emit("classroom-question", {
        id: (data.payload as { id?: string })?.id || Date.now().toString(),
        userId,
        clientId: stableClientId || client.id,
        userName: userName || userId?.slice(0, 8) || "User",
        text: (data.payload as { text?: string })?.text || "",
        votes: 0,
        answered: false,
        timestamp: new Date().toISOString(),
      });
    } else if (data.type === "QUESTION_VOTE") {
      this.server.to(sessionSocket).emit("classroom-question-vote", {
        id: (data.payload as { id?: string })?.id || "",
        userId,
        votes: 1,
        timestamp: new Date().toISOString(),
      });
    } else if (data.type === "HAND_RAISE") {
      this.server.to(sessionSocket).emit("participant-hand-raise", {
        userId,
        clientId: stableClientId || client.id,
        raised: (data.payload as { raised?: boolean })?.raised ?? true,
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
    } else if (data.type === "POLL_CREATED") {
      /* ── TEACHER-ONLY: validate sender is session instructor ── */
      const sessionDoc = await this.prisma.session.findFirst({
        where: { id: sessionId },
        include: { course: { select: { instructorId: true } } },
      });
      const isTeacher = sessionDoc?.course?.instructorId === userId;
      if (!isTeacher) {
        return { status: "error", message: "Forbidden: only the teacher can create polls" };
      }
      this.server.to(sessionSocket).emit("poll-created", {
        id: (data.payload as { id?: string })?.id || "",
        question: (data.payload as { question?: string })?.question || "",
        options: (data.payload as { options?: Array<{ id: string; text: string; voteCount: number; percentage: number }> })?.options || [],
        totalVotes: (data.payload as { totalVotes?: number })?.totalVotes || 0,
        status: "active",
        timestamp: new Date().toISOString(),
      });
    } else if (data.type === "POLL_VOTE") {
      this.server.to(sessionSocket).emit("poll-vote", {
        pollId: (data.payload as { pollId?: string })?.pollId || "",
        optionId: (data.payload as { optionId?: string })?.optionId || "",
        userId,
        timestamp: new Date().toISOString(),
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

    // Find the target socket by clientId
    const targetSocketId = this.getSocketIdByClientId(targetClientId, sessionId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit("webrtc-offer", {
        offer,
        senderClientId: client.id,
        sessionId,
      });
    } else {
      this.logger.warn(`Target client ${targetClientId} not found in session ${sessionId}`);
    }

    return { status: "ok" };
  }

  @SubscribeMessage("webrtc-answer")
  async handleWebRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; answer: any; sessionId: string },
  ) {
    const { targetClientId, answer, sessionId } = data;
    this.logger.log(`Forwarding WebRTC answer from ${client.id} to ${targetClientId}`);

    // Find the target socket by clientId
    const targetSocketId = this.getSocketIdByClientId(targetClientId, sessionId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit("webrtc-answer", {
        answer,
        senderClientId: client.id,
        sessionId,
      });
    } else {
      this.logger.warn(`Target client ${targetClientId} not found in session ${sessionId}`);
    }

    return { status: "ok" };
  }

  @SubscribeMessage("webrtc-ice-candidate")
  async handleWebRTCIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetClientId: string; candidate: any; sessionId: string },
  ) {
    const { targetClientId, candidate, sessionId } = data;
    this.logger.log(`Forwarding ICE candidate from ${client.id} to ${targetClientId}`);

    // Find the target socket by clientId
    const targetSocketId = this.getSocketIdByClientId(targetClientId, sessionId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit("webrtc-ice-candidate", {
        candidate,
        senderClientId: client.id,
        sessionId,
      });
    } else {
      this.logger.warn(`Target client ${targetClientId} not found in session ${sessionId}`);
    }

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

  /* ──────── Private Nudge ──────── */
  @SubscribeMessage("send-nudge")
  async handleSendNudge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; targetUserId: string },
  ) {
    const sessionId = data.sessionId;
    const targetUserId = data.targetUserId;
    const senderUserId = client.data.userId as string | undefined;

    if (!sessionId || !targetUserId) {
      return { status: "error", message: "Missing sessionId or targetUserId" };
    }

    // Resolve tenantId from session (dashboard may not have done joinClassroom)
    const session = await this.prisma.session.findFirst({ where: { id: sessionId } });
    if (!session) return { status: "error", message: "Session not found" };

    const tenantId = session.tenantId;

    /* ── PRIVATE NUDGE: send only to target user ── */
    // Find the target participant's socket to send directly
    const room = this.sessions.get(sessionId);
    let targetSocketId: string | undefined;
    if (room) {
      for (const participant of room.participants.values()) {
        if (participant.userId === targetUserId) {
          targetSocketId = participant.socketId;
          break;
        }
      }
    }

    const nudgePayload = {
      message: "Your teacher is checking in on you",
      from: senderUserId,
      timestamp: new Date().toISOString(),
    };

    if (targetSocketId) {
      // Send directly to target socket (private)
      this.server.to(targetSocketId).emit("nudge-received", nudgePayload);
    } else {
      // Fallback: user not currently in room, store for later
      this.logger.log(`User ${targetUserId} not connected; nudge could not be delivered`);
    }

    // Persist TEACHER_INTERVENTION to Kafka for analytics
    await this.ingest.emitEvent({
      tenantId,
      sessionId,
      type: "TEACHER_INTERVENTION",
      payload: { targetUserId, senderUserId: senderUserId || "unknown", action: "NUDGE" },
      userId: senderUserId || "unknown",
    });

    return { status: "ok", delivered: true };
  }

  /* ──────── Host Moderation ──────── */
  @SubscribeMessage("room-command")
  async handleRoomCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; targetUserId: string; action: 'MUTE_MIC' | 'DISABLE_CAM' | 'KICK' | 'LOWER_HAND' },
  ) {
    const { sessionId, targetUserId, action } = data;
    const senderUserId = client.data.userId as string | undefined;
    this.logger.log(`[ROOM-COMMAND] Received: action=${action}, session=${sessionId}, target=${targetUserId}, sender=${senderUserId}`);

    if (!sessionId || !targetUserId || !action) {
      return { status: "error", message: "Missing sessionId, targetUserId, or action" };
    }

    // Verify sender is the TEACHER for this session
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId },
      include: { course: { select: { instructorId: true } } },
    });
    if (!session) return { status: "error", message: "Session not found" };

    const isTeacher = session.course?.instructorId === senderUserId;
    if (!isTeacher) {
      return { status: "error", message: "Forbidden: only the instructor can issue room commands" };
    }

    const tenantId = session.tenantId;

    // Find target participant's socket id
    const room = this.sessions.get(sessionId);
    let targetSocketId: string | undefined;
    if (room) {
      for (const participant of room.participants.values()) {
        if (participant.userId === targetUserId) {
          targetSocketId = participant.socketId;
          break;
        }
      }
    }

    // Emit command to target socket specifically
    const payload = { action, from: senderUserId, timestamp: new Date().toISOString() };
    if (targetSocketId) {
      this.server.to(targetSocketId).emit("room-command", payload);
    }
    // Fallback: broadcast to session room with targetUserId in payload
    // so client-side can filter
    this.server.to(`session::${sessionId}`).emit("room-command", { ...payload, targetUserId });

    // Persist event to Kafka
    await this.ingest.emitEvent({
      tenantId,
      sessionId,
      type: "TEACHER_INTERVENTION",
      payload: { targetUserId, senderUserId: senderUserId || "unknown", action },
      userId: senderUserId || "unknown",
    });

    // If LOWER_HAND: persist a HAND_RAISE event with raised:false to DB
    if (action === 'LOWER_HAND') {
      await this.prisma.engagementEvent.create({
        data: {
          tenantId,
          sessionId,
          type: "HAND_RAISE" as any,
          payload: { userId: targetUserId, raised: false },
          timestamp: new Date(),
        },
      });
    }

    return { status: "ok", action, targetUserId };
  }

  // ── In-memory broadcast state (sessionId -> isBroadcasting) ──
  private broadcastState = new Map<string, boolean>();

  @SubscribeMessage("toggle-broadcast")
  async handleToggleBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; enable: boolean },
  ) {
    const { sessionId, enable } = data;
    const senderUserId = client.data.userId as string | undefined;
    this.logger.log(`[TOGGLE-BROADCAST] session=${sessionId}, enable=${enable}, sender=${senderUserId}`);

    if (!sessionId) {
      return { status: "error", message: "Missing sessionId" };
    }

    // Verify sender is instructor
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId },
      include: { course: { select: { instructorId: true } } },
    });
    if (!session) return { status: "error", message: "Session not found" };

    const isTeacher = session.course?.instructorId === senderUserId;
    if (!isTeacher) {
      return { status: "error", message: "Forbidden: only the instructor can toggle broadcast" };
    }

    this.broadcastState.set(sessionId, enable);

    // Broadcast state change to ALL participants in session
    this.server.to(`session::${sessionId}`).emit("broadcast-state-changed", {
      isBroadcasting: enable,
      teacherUserId: senderUserId,
    });

    return { status: "ok", isBroadcasting: enable };
  }

  @SubscribeMessage("get-broadcast-state")
  async handleGetBroadcastState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const isBroadcasting = this.broadcastState.get(data.sessionId) ?? false;
    return { status: "ok", isBroadcasting };
  }


  /* ──────── Host Transfer ──────── */
  @SubscribeMessage("transfer-host")
  async handleTransferHost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; targetUserId: string },
  ) {
    const { sessionId, targetUserId } = data;
    const senderUserId = client.data.userId as string | undefined;
    this.logger.log(`[TRANSFER-HOST] Received: session=${sessionId}, target=${targetUserId}, sender=${senderUserId}`);

    if (!sessionId || !targetUserId) {
      return { status: "error", message: "Missing sessionId or targetUserId" };
    }

    // Verify sender is the current host (instructor or session owner)
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId },
      include: { course: { select: { instructorId: true } } },
    });
    if (!session) return { status: "error", message: "Session not found" };

    const isHost = session.course?.instructorId === senderUserId || session.userId === senderUserId;
    if (!isHost) {
      return { status: "error", message: "Forbidden: only the current host can transfer host privileges" };
    }

    // Verify target user exists in the session
    const room = this.sessions.get(sessionId);
    let targetInSession = false;
    if (room) {
      for (const p of room.participants.values()) {
        if (p.userId === targetUserId) {
          targetInSession = true;
          break;
        }
      }
    }
    if (!targetInSession) {
      return { status: "error", message: "Target user is not currently in the session" };
    }

    // Update session ownership in DB
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { userId: targetUserId },
    });

    // Optionally update course instructor
    // await this.prisma.course.update({
    //   where: { id: session.courseId },
    //   data: { instructorId: targetUserId },
    // });

    const tenantId = session.tenantId;
    const transferPayload = {
      action: 'TRANSFER_HOST',
      newHostId: targetUserId,
      from: senderUserId,
      timestamp: new Date().toISOString(),
    };

    // Notify the new host
    let targetSocketId: string | undefined;
    if (room) {
      for (const p of room.participants.values()) {
        if (p.userId === targetUserId) {
          targetSocketId = p.socketId;
          break;
        }
      }
    }
    if (targetSocketId) {
      this.server.to(targetSocketId).emit("room-command", transferPayload);
    }

    // Broadcast to session so all clients know host changed
    this.server.to(`session::${sessionId}`).emit("host-transferred", {
      newHostId: targetUserId,
      from: senderUserId,
      timestamp: new Date().toISOString(),
    });

    // Persist event
    await this.ingest.emitEvent({
      tenantId,
      sessionId,
      type: "TEACHER_INTERVENTION",
      payload: { targetUserId, senderUserId: senderUserId || "unknown", action: "TRANSFER_HOST" },
      userId: senderUserId || "unknown",
    });

    return { status: "ok", newHostId: targetUserId };
  }

}
