"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassroomGateway = void 0;
var websockets_1 = require("@nestjs/websockets");
var common_1 = require("@nestjs/common");
var ioredis_1 = require("ioredis");
var redis_adapter_1 = require("@socket.io/redis-adapter");
var process = require("process");
var ClassroomGateway = function () {
    var _classDecorators = [(0, websockets_1.WebSocketGateway)({
            cors: { origin: "*", credentials: true },
            namespace: "/classroom",
            adapter: (0, redis_adapter_1.createAdapter)(new ioredis_1.Redis({ host: process.env.REDIS_HOST || "localhost" }), new ioredis_1.Redis({ host: process.env.REDIS_HOST || "localhost" })),
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _server_decorators;
    var _server_initializers = [];
    var _server_extraInitializers = [];
    var _handleJoinRoom_decorators;
    var _handleEngagementEvent_decorators;
    var _handleWebRTCOffer_decorators;
    var _handleWebRTCAnswer_decorators;
    var _handleWebRTCIceCandidate_decorators;
    var _handleMediaReady_decorators;
    var ClassroomGateway = _classThis = /** @class */ (function () {
        function ClassroomGateway_1(prisma, ingest) {
            this.prisma = (__runInitializers(this, _instanceExtraInitializers), prisma);
            this.ingest = ingest;
            this.server = __runInitializers(this, _server_initializers, void 0);
            this.logger = (__runInitializers(this, _server_extraInitializers), new common_1.Logger(ClassroomGateway.name));
            // In-memory participant tracking per session
            // Key: sessionId, Value: Map<clientId, Participant>
            this.sessions = new Map();
            // Map socket.id -> clientId for quick lookup on disconnect
            this.socketToClientId = new Map();
            // Production TURN servers for NAT traversal
            this.hasTurn = !!(process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL);
        }
        ClassroomGateway_1.prototype.onModuleInit = function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/];
            }); });
        };
        // Helper: Get or create a session room
        ClassroomGateway_1.prototype.getOrCreateSession = function (sessionId) {
            var room = this.sessions.get(sessionId);
            if (!room) {
                room = { participants: new Map() };
                this.sessions.set(sessionId, room);
            }
            return room;
        };
        // Helper: Find socket ID by stable clientId
        ClassroomGateway_1.prototype.getSocketIdByClientId = function (clientId, sessionId) {
            var room = this.sessions.get(sessionId);
            if (!room)
                return undefined;
            var participant = room.participants.get(clientId);
            return participant === null || participant === void 0 ? void 0 : participant.socketId;
        };
        // Helper: Remove participant from session
        ClassroomGateway_1.prototype.removeParticipantFromSession = function (sessionId, clientId) {
            var room = this.sessions.get(sessionId);
            if (!room)
                return undefined;
            var participant = room.participants.get(clientId);
            room.participants.delete(clientId);
            // Clean up empty sessions
            if (room.participants.size === 0) {
                this.sessions.delete(sessionId);
            }
            return participant;
        };
        ClassroomGateway_1.prototype.handleConnection = function (client) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    this.logger.log("Client connected: ".concat(client.id));
                    return [2 /*return*/];
                });
            });
        };
        ClassroomGateway_1.prototype.handleDisconnect = function (client) {
            return __awaiter(this, void 0, void 0, function () {
                var clientId, room, participant, tenantId, sessionId, userId, userName;
                return __generator(this, function (_a) {
                    this.logger.log("Client disconnected: ".concat(client.id));
                    clientId = this.socketToClientId.get(client.id);
                    if (clientId) {
                        room = this.sessions.get(client.data.sessionId);
                        participant = room === null || room === void 0 ? void 0 : room.participants.get(clientId);
                        if (participant) {
                            tenantId = participant.tenantId, sessionId = participant.sessionId, userId = participant.userId, userName = participant.userName;
                            // Remove from session tracking
                            this.removeParticipantFromSession(sessionId, clientId);
                            this.socketToClientId.delete(client.id);
                            // Clean up socket.io room membership
                            client.leave(tenantId);
                            client.leave("session::".concat(sessionId));
                            // Emit user-left to remaining participants in the session
                            this.server.to("session::".concat(sessionId)).emit("user-left", {
                                clientId: clientId,
                                userId: userId,
                                userName: userName
                            });
                            this.logger.log("User ".concat(userId, " (").concat(userName, ") left session ").concat(sessionId));
                        }
                    }
                    return [2 /*return*/];
                });
            });
        };
        ClassroomGateway_1.prototype.handleJoinRoom = function (client, data) {
            return __awaiter(this, void 0, void 0, function () {
                var tenantId, sessionId, courseId, userId, userName, classroomCode, room, existingParticipant, _loop_1, this_1, _i, _a, _b, clientId_1, participant_1, state_1, clientId, participant, e_1, socketRoomMembers, knownParticipants, socketMemberIds, currentParticipantsMap, _c, knownParticipants_1, p, _d, socketMemberIds_1, socketId, sock, tempClientId, currentParticipants, _e, knownParticipants_2, p;
                var _this = this;
                var _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0:
                            tenantId = data.tenantId, sessionId = data.sessionId, courseId = data.courseId, userId = data.userId, userName = data.userName, classroomCode = data.classroomCode;
                            // VALIDATION: Reject join if missing critical fields
                            if (!tenantId || !userId || !sessionId) {
                                this.logger.warn("Rejecting join - missing required fields: tenantId=".concat(tenantId, ", userId=").concat(userId, ", sessionId=").concat(sessionId));
                                client.emit("join-error", {
                                    status: "error",
                                    message: "Missing required fields: tenantId, userId, and sessionId are required"
                                });
                                return [2 /*return*/, { status: "error", message: "Missing required fields" }];
                            }
                            // Store connection data
                            client.data.tenantId = tenantId;
                            client.data.sessionId = sessionId;
                            client.data.userId = userId;
                            client.data.userName = userName;
                            room = this.getOrCreateSession(sessionId);
                            _loop_1 = function (clientId_1, participant_1) {
                                if (participant_1.userId === userId) {
                                    // User already in session - remove old entry (handles refresh/reconnect)
                                    this_1.logger.log("Removing stale participant entry for user ".concat(userId));
                                    existingParticipant = participant_1;
                                    room.participants.delete(clientId_1);
                                    this_1.socketToClientId.forEach(function (cid, socketId) {
                                        if (cid === clientId_1)
                                            _this.socketToClientId.delete(socketId);
                                    });
                                    return "break";
                                }
                            };
                            this_1 = this;
                            for (_i = 0, _a = room.participants.entries(); _i < _a.length; _i++) {
                                _b = _a[_i], clientId_1 = _b[0], participant_1 = _b[1];
                                state_1 = _loop_1(clientId_1, participant_1);
                                if (state_1 === "break")
                                    break;
                            }
                            // Join socket.io rooms
                            client.join(tenantId);
                            client.join("session::".concat(sessionId));
                            clientId = "".concat(userId, "-").concat(sessionId).slice(0, 36);
                            participant = {
                                clientId: clientId,
                                socketId: client.id,
                                userId: userId,
                                userName: userName || userId.slice(0, 8),
                                tenantId: tenantId,
                                sessionId: sessionId,
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
                            this.logger.log("User ".concat(userId, " (").concat(userName, ") joined tenant ").concat(tenantId, ", session ").concat(sessionId));
                            _j.label = 1;
                        case 1:
                            _j.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this.prisma.session.upsert({
                                    where: { id: sessionId },
                                    update: {},
                                    create: {
                                        id: sessionId,
                                        tenantId: tenantId,
                                        userId: userId,
                                        courseId: courseId,
                                        classroomCode: classroomCode || sessionId,
                                        dwellTime: 0,
                                    },
                                })];
                        case 2:
                            _j.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _j.sent();
                            this.logger.error("Session upsert failed: ".concat(e_1));
                            return [3 /*break*/, 4];
                        case 4: 
                        // Emit engagement event to Kafka
                        return [4 /*yield*/, this.ingest.emitEvent({
                                tenantId: tenantId,
                                sessionId: sessionId,
                                type: "JOIN",
                                payload: { userId: userId, clientId: client.id },
                                userId: userId,
                            })];
                        case 5:
                            // Emit engagement event to Kafka
                            _j.sent();
                            // BROADCAST: Send user-joined to OTHERS (not to the joining user)
                            client.broadcast.to("session::".concat(sessionId)).emit("user-joined", {
                                userId: userId,
                                clientId: clientId,
                                userName: userName || userId.slice(0, 8)
                            });
                            try {
                                socketRoomMembers = (_h = (_g = (_f = this.server.sockets) === null || _f === void 0 ? void 0 : _f.adapter) === null || _g === void 0 ? void 0 : _g.rooms) === null || _h === void 0 ? void 0 : _h.get("session::".concat(sessionId));
                            }
                            catch (e) {
                                // Redis adapter may not expose rooms directly
                                this.logger.warn("Cannot access socket rooms: ".concat(e));
                            }
                            knownParticipants = Array.from(room.participants.values());
                            socketMemberIds = socketRoomMembers ? Array.from(socketRoomMembers).filter(function (id) { return id !== client.id; }) : [];
                            currentParticipantsMap = new Map();
                            // Add known participants from in-memory store
                            for (_c = 0, knownParticipants_1 = knownParticipants; _c < knownParticipants_1.length; _c++) {
                                p = knownParticipants_1[_c];
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
                            for (_d = 0, socketMemberIds_1 = socketMemberIds; _d < socketMemberIds_1.length; _d++) {
                                socketId = socketMemberIds_1[_d];
                                sock = this.server.sockets.sockets.get(socketId);
                                if (sock && sock.data.userId) {
                                    tempClientId = "".concat(sock.data.userId, "-").concat(sessionId).slice(0, 36);
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
                            currentParticipants = Array.from(currentParticipantsMap.values());
                            // EMIT: Send classroom-joined with full participant list to the JOINING user directly
                            this.server.to(client.id).emit("classroom-joined", {
                                status: "ok",
                                message: "joined classroom",
                                clientId: clientId,
                                currentParticipantCount: knownParticipants.length + 1, // +1 for self
                                currentParticipants: currentParticipants
                            });
                            // CRITICAL: Tell the NEW user about EXISTING participants who have media
                            // This triggers them to create WebRTC offers TO those participants
                            for (_e = 0, knownParticipants_2 = knownParticipants; _e < knownParticipants_2.length; _e++) {
                                p = knownParticipants_2[_e];
                                if (p.mediaState.hasAudio || p.mediaState.hasVideo) {
                                    this.logger.log("Notifying new user about participant ".concat(p.userId, " with media: video=").concat(p.mediaState.hasVideo, ", audio=").concat(p.mediaState.hasAudio));
                                    this.server.to(client.id).emit("participant-joined-media", {
                                        clientId: p.clientId,
                                        userId: p.userId,
                                        hasVideo: p.mediaState.hasVideo,
                                        hasAudio: p.mediaState.hasAudio,
                                    });
                                }
                            }
                            return [2 /*return*/, { status: "ok" }];
                    }
                });
            });
        };
        ClassroomGateway_1.prototype.handleEngagementEvent = function (client, data) {
            return __awaiter(this, void 0, void 0, function () {
                var tenantId, sessionId, userId, userName, sessionSocket;
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                return __generator(this, function (_q) {
                    switch (_q.label) {
                        case 0:
                            tenantId = client.data.tenantId;
                            sessionId = client.data.sessionId;
                            userId = client.data.userId;
                            userName = client.data.userName;
                            if (!tenantId || !sessionId) {
                                this.logger.warn("Engagement event without context: type=".concat(data.type, ", clientId=").concat(client.id));
                                return [2 /*return*/, { status: "error", message: "Not joined to a classroom" }];
                            }
                            return [4 /*yield*/, this.ingest.emitEvent({
                                    tenantId: tenantId,
                                    sessionId: sessionId,
                                    type: data.type,
                                    payload: data.payload,
                                    userId: userId || "unknown",
                                })];
                        case 1:
                            _q.sent();
                            sessionSocket = "session::".concat(sessionId);
                            if (data.type === "MIC") {
                                this.server.to(sessionSocket).emit("participant-media-update", {
                                    userId: userId,
                                    clientId: client.id,
                                    micActive: (_b = (_a = data.payload) === null || _a === void 0 ? void 0 : _a.active) !== null && _b !== void 0 ? _b : true,
                                });
                            }
                            else if (data.type === "CAMERA") {
                                this.server.to(sessionSocket).emit("participant-media-update", {
                                    userId: userId,
                                    clientId: client.id,
                                    cameraActive: (_d = (_c = data.payload) === null || _c === void 0 ? void 0 : _c.active) !== null && _d !== void 0 ? _d : true,
                                });
                            }
                            else if (data.type === "SCREEN_SHARE") {
                                this.server.to(sessionSocket).emit("participant-media-update", {
                                    userId: userId,
                                    clientId: client.id,
                                    screenShareActive: (_f = (_e = data.payload) === null || _e === void 0 ? void 0 : _e.active) !== null && _f !== void 0 ? _f : true,
                                });
                            }
                            else if (data.type === "BLUR") {
                                this.server.to(sessionSocket).emit("participant-engagement-update", {
                                    userId: userId,
                                    clientId: client.id,
                                    blurActive: true,
                                });
                            }
                            else if (data.type === "FOCUS") {
                                this.server.to(sessionSocket).emit("participant-engagement-update", {
                                    userId: userId,
                                    clientId: client.id,
                                    focusActive: ((_g = data.payload) === null || _g === void 0 ? void 0 : _g.status) === "focus",
                                });
                            }
                            else if (data.type === "CHAT") {
                                this.server.to(sessionSocket).emit("chat-message", {
                                    id: Date.now().toString(),
                                    userId: userId,
                                    clientId: client.id,
                                    userName: userName || (userId === null || userId === void 0 ? void 0 : userId.slice(0, 8)) || "User",
                                    text: ((_h = data.payload) === null || _h === void 0 ? void 0 : _h.message) || "",
                                    timestamp: new Date().toISOString(),
                                });
                            }
                            else if (data.type === "MOUSE_TRACK") {
                                this.server.to(sessionSocket).emit("participant-mouse-move", {
                                    userId: userId,
                                    clientId: client.id,
                                    x: (_k = (_j = data.payload) === null || _j === void 0 ? void 0 : _j.x) !== null && _k !== void 0 ? _k : 0,
                                    y: (_m = (_l = data.payload) === null || _l === void 0 ? void 0 : _l.y) !== null && _m !== void 0 ? _m : 0,
                                });
                            }
                            else if (data.type === "KEYSTROKE") {
                                this.server.to(sessionSocket).emit("participant-keystroke", {
                                    userId: userId,
                                    clientId: client.id,
                                    count: (_p = (_o = data.payload) === null || _o === void 0 ? void 0 : _o.count) !== null && _p !== void 0 ? _p : 1,
                                });
                            }
                            return [2 /*return*/, { status: "ok" }];
                    }
                });
            });
        };
        // WebRTC Signaling
        ClassroomGateway_1.prototype.handleWebRTCOffer = function (client, data) {
            return __awaiter(this, void 0, void 0, function () {
                var targetClientId, offer, sessionId, targetSocketId;
                return __generator(this, function (_a) {
                    targetClientId = data.targetClientId, offer = data.offer, sessionId = data.sessionId;
                    this.logger.log("Forwarding WebRTC offer from ".concat(client.id, " to ").concat(targetClientId));
                    targetSocketId = this.getSocketIdByClientId(targetClientId, sessionId);
                    if (targetSocketId) {
                        this.server.to(targetSocketId).emit("webrtc-offer", {
                            offer: offer,
                            senderClientId: client.id,
                            sessionId: sessionId,
                        });
                    }
                    else {
                        this.logger.warn("Target client ".concat(targetClientId, " not found in session ").concat(sessionId));
                    }
                    return [2 /*return*/, { status: "ok" }];
                });
            });
        };
        ClassroomGateway_1.prototype.handleWebRTCAnswer = function (client, data) {
            return __awaiter(this, void 0, void 0, function () {
                var targetClientId, answer, sessionId, targetSocketId;
                return __generator(this, function (_a) {
                    targetClientId = data.targetClientId, answer = data.answer, sessionId = data.sessionId;
                    this.logger.log("Forwarding WebRTC answer from ".concat(client.id, " to ").concat(targetClientId));
                    targetSocketId = this.getSocketIdByClientId(targetClientId, sessionId);
                    if (targetSocketId) {
                        this.server.to(targetSocketId).emit("webrtc-answer", {
                            answer: answer,
                            senderClientId: client.id,
                            sessionId: sessionId,
                        });
                    }
                    else {
                        this.logger.warn("Target client ".concat(targetClientId, " not found in session ").concat(sessionId));
                    }
                    return [2 /*return*/, { status: "ok" }];
                });
            });
        };
        ClassroomGateway_1.prototype.handleWebRTCIceCandidate = function (client, data) {
            return __awaiter(this, void 0, void 0, function () {
                var targetClientId, candidate, sessionId, targetSocketId;
                return __generator(this, function (_a) {
                    targetClientId = data.targetClientId, candidate = data.candidate, sessionId = data.sessionId;
                    this.logger.log("Forwarding ICE candidate from ".concat(client.id, " to ").concat(targetClientId));
                    targetSocketId = this.getSocketIdByClientId(targetClientId, sessionId);
                    if (targetSocketId) {
                        this.server.to(targetSocketId).emit("webrtc-ice-candidate", {
                            candidate: candidate,
                            senderClientId: client.id,
                            sessionId: sessionId,
                        });
                    }
                    else {
                        this.logger.warn("Target client ".concat(targetClientId, " not found in session ").concat(sessionId));
                    }
                    return [2 /*return*/, { status: "ok" }];
                });
            });
        };
        ClassroomGateway_1.prototype.handleMediaReady = function (client, data) {
            return __awaiter(this, void 0, void 0, function () {
                var sessionId, tenantId, userId, room, _i, _a, _b, clientIdKey, participant;
                return __generator(this, function (_c) {
                    sessionId = client.data.sessionId;
                    if (!sessionId) {
                        return [2 /*return*/, { status: "error", message: "Not in a session" }];
                    }
                    tenantId = client.data.tenantId;
                    userId = client.data.userId;
                    room = this.sessions.get(sessionId);
                    if (room) {
                        for (_i = 0, _a = room.participants.entries(); _i < _a.length; _i++) {
                            _b = _a[_i], clientIdKey = _b[0], participant = _b[1];
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
                    this.logger.log("Client ".concat(client.id, " media-ready in session ").concat(sessionId, ": video=").concat(data.hasVideo, ", audio=").concat(data.hasAudio));
                    // Broadcast media state to other participants in the session (NOT to self)
                    client.broadcast.to("session::".concat(sessionId)).emit("participant-media-update", {
                        clientId: data.clientId,
                        hasVideo: data.hasVideo,
                        hasAudio: data.hasAudio,
                        userId: userId,
                    });
                    // Also emit participant-joined-media event to trigger WebRTC connection from other participants
                    client.broadcast.to("session::".concat(sessionId)).emit("participant-joined-media", {
                        clientId: data.clientId,
                        userId: userId,
                        hasVideo: data.hasVideo,
                        hasAudio: data.hasAudio,
                    });
                    return [2 /*return*/, { status: "ok" }];
                });
            });
        };
        return ClassroomGateway_1;
    }());
    __setFunctionName(_classThis, "ClassroomGateway");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _server_decorators = [(0, websockets_1.WebSocketServer)()];
        _handleJoinRoom_decorators = [(0, websockets_1.SubscribeMessage)("joinClassroom")];
        _handleEngagementEvent_decorators = [(0, websockets_1.SubscribeMessage)("engagementEvent")];
        _handleWebRTCOffer_decorators = [(0, websockets_1.SubscribeMessage)("webrtc-offer")];
        _handleWebRTCAnswer_decorators = [(0, websockets_1.SubscribeMessage)("webrtc-answer")];
        _handleWebRTCIceCandidate_decorators = [(0, websockets_1.SubscribeMessage)("webrtc-ice-candidate")];
        _handleMediaReady_decorators = [(0, websockets_1.SubscribeMessage)("media-ready")];
        __esDecorate(_classThis, null, _handleJoinRoom_decorators, { kind: "method", name: "handleJoinRoom", static: false, private: false, access: { has: function (obj) { return "handleJoinRoom" in obj; }, get: function (obj) { return obj.handleJoinRoom; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleEngagementEvent_decorators, { kind: "method", name: "handleEngagementEvent", static: false, private: false, access: { has: function (obj) { return "handleEngagementEvent" in obj; }, get: function (obj) { return obj.handleEngagementEvent; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleWebRTCOffer_decorators, { kind: "method", name: "handleWebRTCOffer", static: false, private: false, access: { has: function (obj) { return "handleWebRTCOffer" in obj; }, get: function (obj) { return obj.handleWebRTCOffer; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleWebRTCAnswer_decorators, { kind: "method", name: "handleWebRTCAnswer", static: false, private: false, access: { has: function (obj) { return "handleWebRTCAnswer" in obj; }, get: function (obj) { return obj.handleWebRTCAnswer; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleWebRTCIceCandidate_decorators, { kind: "method", name: "handleWebRTCIceCandidate", static: false, private: false, access: { has: function (obj) { return "handleWebRTCIceCandidate" in obj; }, get: function (obj) { return obj.handleWebRTCIceCandidate; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleMediaReady_decorators, { kind: "method", name: "handleMediaReady", static: false, private: false, access: { has: function (obj) { return "handleMediaReady" in obj; }, get: function (obj) { return obj.handleMediaReady; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, null, _server_decorators, { kind: "field", name: "server", static: false, private: false, access: { has: function (obj) { return "server" in obj; }, get: function (obj) { return obj.server; }, set: function (obj, value) { obj.server = value; } }, metadata: _metadata }, _server_initializers, _server_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ClassroomGateway = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ClassroomGateway = _classThis;
}();
exports.ClassroomGateway = ClassroomGateway;
