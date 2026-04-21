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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
var common_1 = require("@nestjs/common");
var AnalyticsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AnalyticsService = _classThis = /** @class */ (function () {
        function AnalyticsService_1(prisma) {
            this.prisma = prisma;
        }
        AnalyticsService_1.prototype.getEngagementOverview = function (tenantId, courseId) {
            return __awaiter(this, void 0, void 0, function () {
                var where, sessions, totalSessions, activeSessions, totalDwellTime, avgDwellTime, events, eventTypeCounts, eventsBySession;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = { tenantId: tenantId };
                            if (courseId)
                                where.courseId = courseId;
                            return [4 /*yield*/, this.prisma.session.findMany({ where: where })];
                        case 1:
                            sessions = _a.sent();
                            totalSessions = sessions.length;
                            activeSessions = sessions.filter(function (s) { return !s.endedAt; }).length;
                            totalDwellTime = sessions.reduce(function (sum, s) { return sum + s.dwellTime; }, 0);
                            avgDwellTime = totalSessions > 0 ? totalDwellTime / totalSessions : 0;
                            return [4 /*yield*/, this.prisma.engagementEvent.groupBy({
                                    where: { tenantId: tenantId },
                                    by: ["type"],
                                    _count: true,
                                })];
                        case 2:
                            events = _a.sent();
                            eventTypeCounts = events.reduce(function (acc, e) {
                                acc[e.type] = e._count;
                                return acc;
                            }, {});
                            return [4 /*yield*/, this.prisma.session.findMany({
                                    where: courseId ? { tenantId: tenantId, courseId: courseId } : { tenantId: tenantId },
                                    select: { id: true, dwellTime: true, _count: { select: { events: true } } },
                                    orderBy: { startedAt: "desc" },
                                    take: 20,
                                })];
                        case 3:
                            eventsBySession = _a.sent();
                            return [2 /*return*/, { totalSessions: totalSessions, activeSessions: activeSessions, totalDwellTime: totalDwellTime, avgDwellTime: avgDwellTime, eventTypeCounts: eventTypeCounts, eventsBySession: eventsBySession }];
                    }
                });
            });
        };
        AnalyticsService_1.prototype.getUserEngagement = function (tenantId, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var sessions, totalDwellTime, totalEvents, eventBreakdown;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.session.findMany({
                                where: { userId: userId, tenantId: tenantId },
                                select: { id: true, dwellTime: true, startedAt: true, endedAt: true, _count: { select: { events: true } }, course: { select: { id: true, title: true } } },
                                orderBy: { startedAt: "desc" },
                                take: 20,
                            })];
                        case 1:
                            sessions = _a.sent();
                            totalDwellTime = sessions.reduce(function (sum, s) { return sum + s.dwellTime; }, 0);
                            totalEvents = sessions.reduce(function (sum, s) { return sum + s._count.events; }, 0);
                            return [4 /*yield*/, this.prisma.engagementEvent.groupBy({
                                    where: { tenantId: tenantId, session: { userId: userId } },
                                    by: ["type"],
                                    _count: true,
                                })];
                        case 2:
                            eventBreakdown = _a.sent();
                            return [2 /*return*/, {
                                    totalDwellTime: totalDwellTime,
                                    totalEvents: totalEvents,
                                    totalSessions: sessions.length,
                                    sessions: sessions,
                                    eventBreakdown: eventBreakdown.reduce(function (acc, e) { acc[e.type] = e._count; return acc; }, {}),
                                }];
                    }
                });
            });
        };
        AnalyticsService_1.prototype.getCourseAnalytics = function (tenantId, courseId) {
            return __awaiter(this, void 0, void 0, function () {
                var course, enrollments, sessions, totalDwellTime, totalEvents, eventTypeBreakdown;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.course.findFirst({ where: { id: courseId, tenantId: tenantId }, select: { id: true, title: true } })];
                        case 1:
                            course = _a.sent();
                            if (!course)
                                return [2 /*return*/, null];
                            return [4 /*yield*/, this.prisma.enrollment.count({ where: { courseId: courseId } })];
                        case 2:
                            enrollments = _a.sent();
                            return [4 /*yield*/, this.prisma.session.findMany({ where: { courseId: courseId }, select: { dwellTime: true, _count: { select: { events: true } } } })];
                        case 3:
                            sessions = _a.sent();
                            totalDwellTime = sessions.reduce(function (sum, s) { return sum + s.dwellTime; }, 0);
                            totalEvents = sessions.reduce(function (sum, s) { return sum + s._count.events; }, 0);
                            return [4 /*yield*/, this.prisma.engagementEvent.groupBy({
                                    where: { tenantId: tenantId, session: { courseId: courseId } },
                                    by: ["type"], _count: true, _min: { timestamp: true }, _max: { timestamp: true },
                                })];
                        case 4:
                            eventTypeBreakdown = _a.sent();
                            return [2 /*return*/, { course: course, enrollments: enrollments, totalSessions: sessions.length, totalDwellTime: totalDwellTime, totalEvents: totalEvents, eventTypeBreakdown: eventTypeBreakdown }];
                    }
                });
            });
        };
        AnalyticsService_1.prototype.getRealtimeStats = function (tenantId) {
            return __awaiter(this, void 0, void 0, function () {
                var activeSessions, liveEvents, totalUsers;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.session.count({ where: { tenantId: tenantId, endedAt: null } })];
                        case 1:
                            activeSessions = _a.sent();
                            return [4 /*yield*/, this.prisma.engagementEvent.count({ where: { tenantId: tenantId, timestamp: { gte: new Date(Date.now() - 300000) } } })];
                        case 2:
                            liveEvents = _a.sent();
                            return [4 /*yield*/, this.prisma.user.count({ where: { tenantId: tenantId } })];
                        case 3:
                            totalUsers = _a.sent();
                            return [2 /*return*/, { activeSessions: activeSessions, liveEvents: liveEvents, totalUsers: totalUsers, timestamp: new Date() }];
                    }
                });
            });
        };
        AnalyticsService_1.prototype.getUsersByScore = function (tenantId) {
            return __awaiter(this, void 0, void 0, function () {
                var latestScores, seen, _i, latestScores_1, snap, userIds, users, userMap;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.engagementSnapshot.findMany({
                                where: { tenantId: tenantId },
                                orderBy: { timestamp: "desc" },
                            })];
                        case 1:
                            latestScores = _a.sent();
                            seen = new Map();
                            for (_i = 0, latestScores_1 = latestScores; _i < latestScores_1.length; _i++) {
                                snap = latestScores_1[_i];
                                if (!seen.has(snap.userId))
                                    seen.set(snap.userId, snap);
                            }
                            userIds = __spreadArray([], seen.keys(), true);
                            return [4 /*yield*/, this.prisma.user.findMany({
                                    where: { id: { in: userIds } },
                                    select: { id: true, email: true, role: true },
                                })];
                        case 2:
                            users = _a.sent();
                            userMap = new Map(users.map(function (u) { return [u.id, u]; }));
                            return [2 /*return*/, __spreadArray([], seen.values(), true).map(function (s) {
                                    var _a, _b, _c, _d;
                                    return ({
                                        userId: s.userId,
                                        email: (_b = (_a = userMap.get(s.userId)) === null || _a === void 0 ? void 0 : _a.email) !== null && _b !== void 0 ? _b : "Unknown",
                                        role: (_d = (_c = userMap.get(s.userId)) === null || _c === void 0 ? void 0 : _c.role) !== null && _d !== void 0 ? _d : "STUDENT",
                                        score: s.score,
                                        color: s.score > 70 ? "green" : s.score >= 40 ? "yellow" : "red",
                                        lastUpdate: s.timestamp,
                                    });
                                })];
                    }
                });
            });
        };
        AnalyticsService_1.prototype.getSessionScoreHistory = function (tenantId, sessionId) {
            return __awaiter(this, void 0, void 0, function () {
                var session, snapshots, byTime, _i, snapshots_1, snap, key, classPulse, byUser, _a, snapshots_2, snap, allUserIds, users, _b, users_1, u, entry;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.prisma.session.findFirst({ where: { id: sessionId, tenantId: tenantId } })];
                        case 1:
                            session = _c.sent();
                            if (!session)
                                throw new common_1.NotFoundException("Session not found");
                            return [4 /*yield*/, this.prisma.engagementSnapshot.findMany({
                                    where: { sessionId: sessionId },
                                    orderBy: { timestamp: "asc" },
                                    select: { userId: true, score: true, timestamp: true },
                                })];
                        case 2:
                            snapshots = _c.sent();
                            byTime = new Map();
                            for (_i = 0, snapshots_1 = snapshots; _i < snapshots_1.length; _i++) {
                                snap = snapshots_1[_i];
                                key = snap.timestamp.toISOString();
                                if (!byTime.has(key))
                                    byTime.set(key, []);
                                byTime.get(key).push(snap.score);
                            }
                            classPulse = __spreadArray([], byTime.entries(), true).map(function (_a) {
                                var time = _a[0], scores = _a[1];
                                return ({
                                    time: time,
                                    score: Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length),
                                });
                            });
                            byUser = new Map();
                            for (_a = 0, snapshots_2 = snapshots; _a < snapshots_2.length; _a++) {
                                snap = snapshots_2[_a];
                                if (!byUser.has(snap.userId)) {
                                    byUser.set(snap.userId, { email: "", history: [] });
                                }
                                byUser.get(snap.userId).history.push({ time: snap.timestamp.toISOString(), score: snap.score });
                            }
                            allUserIds = __spreadArray([], byUser.keys(), true);
                            if (!(allUserIds.length > 0)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.user.findMany({
                                    where: { id: { in: allUserIds } },
                                    select: { id: true, email: true },
                                })];
                        case 3:
                            users = _c.sent();
                            for (_b = 0, users_1 = users; _b < users_1.length; _b++) {
                                u = users_1[_b];
                                entry = byUser.get(u.id);
                                if (entry)
                                    entry.email = u.email;
                            }
                            _c.label = 4;
                        case 4: return [2 /*return*/, { session: session, classPulse: classPulse, byUser: Object.fromEntries(byUser) }];
                    }
                });
            });
        };
        AnalyticsService_1.prototype.getLiveScores = function (tenantId, sessionId) {
            return __awaiter(this, void 0, void 0, function () {
                var session, latest, seen, _i, latest_1, snap, userIds, users, userMap;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.session.findFirst({ where: { id: sessionId, tenantId: tenantId } })];
                        case 1:
                            session = _a.sent();
                            if (!session)
                                throw new common_1.NotFoundException("Session not found");
                            return [4 /*yield*/, this.prisma.engagementSnapshot.findMany({
                                    where: { sessionId: sessionId },
                                    orderBy: { timestamp: "desc" },
                                })];
                        case 2:
                            latest = _a.sent();
                            seen = new Map();
                            for (_i = 0, latest_1 = latest; _i < latest_1.length; _i++) {
                                snap = latest_1[_i];
                                if (!seen.has(snap.userId))
                                    seen.set(snap.userId, snap);
                            }
                            userIds = __spreadArray([], seen.keys(), true);
                            return [4 /*yield*/, this.prisma.user.findMany({
                                    where: { id: { in: userIds } },
                                    select: { id: true, email: true },
                                })];
                        case 3:
                            users = _a.sent();
                            userMap = new Map(users.map(function (u) { return [u.id, u]; }));
                            return [2 /*return*/, __spreadArray([], seen.values(), true).map(function (s) {
                                    var _a, _b;
                                    return ({
                                        userId: s.userId,
                                        email: (_b = (_a = userMap.get(s.userId)) === null || _a === void 0 ? void 0 : _a.email) !== null && _b !== void 0 ? _b : "Unknown",
                                        score: s.score,
                                        color: s.score > 70 ? "green" : s.score >= 40 ? "yellow" : "red",
                                    });
                                })];
                    }
                });
            });
        };
        AnalyticsService_1.prototype.getSessionFocusEvents = function (tenantId, sessionId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.engagementEvent.findMany({
                                where: {
                                    sessionId: sessionId,
                                    tenantId: tenantId,
                                    type: { in: ["FOCUS", "BLUR"] },
                                },
                                orderBy: { timestamp: "desc" },
                                select: { id: true, session: { select: { userId: true } }, type: true, timestamp: true },
                            })];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        return AnalyticsService_1;
    }());
    __setFunctionName(_classThis, "AnalyticsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AnalyticsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AnalyticsService = _classThis;
}();
exports.AnalyticsService = AnalyticsService;
