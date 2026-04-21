"use strict";
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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
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
exports.EngagementProcessor = void 0;
var common_1 = require("@nestjs/common");
var kafkajs_1 = require("kafkajs");
// Event weights for engagement scoring
var EVENT_WEIGHTS = {
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
var EngagementProcessor = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var EngagementProcessor = _classThis = /** @class */ (function () {
        function EngagementProcessor_1(prisma) {
            this.prisma = prisma;
            this.logger = new common_1.Logger(EngagementProcessor.name);
            var kafka = new kafkajs_1.Kafka({
                clientId: "engagio-engagement-processor",
                brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
            });
            this.consumer = kafka.consumer({ groupId: "engagement-processor" });
        }
        EngagementProcessor_1.prototype.onModuleInit = function () {
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    this.startConsumer().catch(function (err) {
                        _this.logger.error("Failed to start Kafka consumer:", err);
                        _this.retryConsumer();
                    });
                    // Aggregate engagement snapshots every 60 seconds
                    this.snapshotInterval = setInterval(function () { return _this.computeSnapshots(); }, 60000);
                    return [2 /*return*/];
                });
            });
        };
        EngagementProcessor_1.prototype.onModuleDestroy = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            clearInterval(this.snapshotInterval);
                            return [4 /*yield*/, this.consumer.disconnect()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        EngagementProcessor_1.prototype.startConsumer = function () {
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.consumer.connect()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.consumer.subscribe({ topic: "classroom-events", fromBeginning: true })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.consumer.run({
                                    eachMessage: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                        var event;
                                        var topic = _b.topic, partition = _b.partition, message = _b.message;
                                        return __generator(this, function (_c) {
                                            switch (_c.label) {
                                                case 0:
                                                    if (!message.value)
                                                        return [2 /*return*/];
                                                    event = JSON.parse(message.value.toString());
                                                    this.logger.log("[".concat(topic, "/").concat(message.offset, "] ").concat(event.type, " tenant=").concat(event.tenantId, " session=").concat(event.sessionId));
                                                    // GUARD: Skip events with null tenantId to prevent Prisma validation errors
                                                    if (!event.tenantId || !event.sessionId) {
                                                        this.logger.warn("[".concat(topic, "/").concat(message.offset, "] Skipping event with missing tenantId or sessionId: ").concat(JSON.stringify(event)));
                                                        return [2 /*return*/];
                                                    }
                                                    return [4 /*yield*/, this.prisma.engagementEvent.create({
                                                            data: {
                                                                tenantId: event.tenantId,
                                                                sessionId: event.sessionId,
                                                                type: event.type,
                                                                payload: event.payload,
                                                            },
                                                        })];
                                                case 1:
                                                    _c.sent();
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); },
                                })];
                        case 3:
                            _a.sent();
                            this.logger.log("Kafka consumer running on classroom-events");
                            return [2 /*return*/];
                    }
                });
            });
        };
        EngagementProcessor_1.prototype.retryConsumer = function () {
            var _this = this;
            setTimeout(function () {
                _this.logger.log("Retrying Kafka consumer connection...");
                _this.startConsumer().catch(function (err) {
                    _this.logger.error("Retry failed:", err);
                    _this.retryConsumer();
                });
            }, 5000);
        };
        EngagementProcessor_1.prototype.computeSnapshots = function () {
            return __awaiter(this, void 0, void 0, function () {
                var oneMinAgo, activeSessions, _i, activeSessions_1, session, events, score, _a, events_1, event_1, weight;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            this.logger.log("Computing engagement snapshots for last 60s window...");
                            oneMinAgo = new Date(Date.now() - 60000);
                            return [4 /*yield*/, this.prisma.session.findMany({
                                    where: { endedAt: null },
                                    select: { id: true, userId: true, tenantId: true },
                                })];
                        case 1:
                            activeSessions = _c.sent();
                            _i = 0, activeSessions_1 = activeSessions;
                            _c.label = 2;
                        case 2:
                            if (!(_i < activeSessions_1.length)) return [3 /*break*/, 6];
                            session = activeSessions_1[_i];
                            return [4 /*yield*/, this.prisma.engagementEvent.findMany({
                                    where: {
                                        sessionId: session.id,
                                        timestamp: { gte: oneMinAgo },
                                    },
                                    select: { type: true, payload: true },
                                })];
                        case 3:
                            events = _c.sent();
                            if (events.length === 0)
                                return [3 /*break*/, 5];
                            score = 100;
                            for (_a = 0, events_1 = events; _a < events_1.length; _a++) {
                                event_1 = events_1[_a];
                                weight = (_b = EVENT_WEIGHTS[event_1.type]) !== null && _b !== void 0 ? _b : 0;
                                score += weight;
                            }
                            // Clamp: 0-100
                            score = Math.max(0, Math.min(100, score));
                            return [4 /*yield*/, this.prisma.engagementSnapshot.create({
                                    data: {
                                        tenantId: session.tenantId,
                                        sessionId: session.id,
                                        userId: session.userId,
                                        score: score,
                                    },
                                })];
                        case 4:
                            _c.sent();
                            _c.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 2];
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        return EngagementProcessor_1;
    }());
    __setFunctionName(_classThis, "EngagementProcessor");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        EngagementProcessor = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return EngagementProcessor = _classThis;
}();
exports.EngagementProcessor = EngagementProcessor;
