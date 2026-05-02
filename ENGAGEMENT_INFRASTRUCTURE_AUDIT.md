# Engagio LMS — Engagement Infrastructure Audit Report

**Generated:** 2026-05-02
**Scope:** Full-stack engagement tracking audit — Frontend hooks, LiveKit signals, Kafka pipeline, Prisma storage, analytics API, and gap analysis.

---

## 1. DATA SOURCE AUDIT

### 1.1 LiveKit Signals Captured

The platform uses **LiveKit Client SDK** for real-time media. The following signals are currently tapped:

| Signal | Source | Used For | Notes |
|--------|--------|----------|-------|
| `isSpeaking` | `@livekit/components-react` `useIsSpeaking()` | Voice-activity ring on avatars | Surface-level; no VAD duration tracking |
| `participant.metadata` | `RoomServiceClient` / local participant | `breakoutRoomId`, `role` injection | Read for room assignment; not actively tracked for analytics |
| `trackMuted` / `trackUnmuted` | **NOT tracked** | — | Mic/camera toggles are emitted from **React handlers**, not LiveKit events |
| `trackSubscribed` | **NOT tracked** | — | No subscription analytics |
| `connectionQuality` | **NOT tracked** | — | No network quality metrics in engagement pipeline |
| `RoomEvent.Connected/Disconnected` | `livekit-wrapper.tsx` | Connection logging only | Console logs; not sent to Kafka |

**Key Finding:** LiveKit-native signals (`connectionQuality`, `trackSubscribed`, `trackMuted` via SDK events) are **not wired into the engagement pipeline**. The platform relies on **React component-level event emission** (e.g., clicking a mic toggle button fires a `MIC` engagementEvent) rather than observing actual LiveKit state changes.

### 1.2 Frontend Trackers — `useEngagementTracker.ts`

**File:** `web/src/hooks/useEngagementTracker.ts`

| Event | Trigger | Throttle/Aggregation | Emitted To |
|-------|---------|---------------------|------------|
| `MOUSE_TRACK` | `document.mousemove` | 10s throttle | `socket.emit('engagementEvent', ...)` |
| `KEYSTROKE` | `document.keydown` | Aggregated every 30s (count only) | `socket.emit('engagementEvent', ...)` |
| `FOCUS`/`BLUR` | `document.visibilitychange`, `window.focus/blur` | 5s interval blur checker | `socket.emit('engagementEvent', ...)` |
| `CHAT` | Chat message send / reaction | Real-time | `socket.emit('engagementEvent', ...)` |

**Additional Frontend Event Emitters:**

| File | Events |
|------|--------|
| `ClassroomContent.tsx` | `MIC`, `CAMERA`, `SCREEN_SHARE`, `HAND_RAISE`, `POLL_CREATED`, `POLL_VOTE` |
| `Chat.tsx` | `CHAT` |
| `Sidebar.tsx` | `QUESTION`, `QUESTION_VOTE` |

**Redundancy Issue:** Three separate hooks track blur/focus:
- `useEngagementTracker.ts` — primary (mousemove, keystroke, focus/blur)
- `useEngagementTracking.ts` — secondary (visibilitychange + window focus)
- `useBlurDetection.ts` — legacy (simple window blur/focus)

### 1.3 BreakoutTab Health Dots — Score Calculation

**File:** `web/src/components/classroom/BreakoutTab.tsx` (lines 32-36, 201-214)

```typescript
function getHealthStatus(avg: number): 'green' | 'yellow' | 'red' {
  if (avg >= 70) return 'green';
  if (avg >= 40) return 'yellow';
  return 'red';
}
```

**Room Health Computation (per room):**
1. Fetch `engagementScores` from `useEngagement(sessionId, ..., true)` — polls `/analytics/session/{id}/live-scores` every **8s**
2. Group participants by their assigned `breakoutRoomId`
3. For each room, calculate average of member `score` values
4. Map average to color:
   - **Green** ≥ 70
   - **Yellow** ≥ 40
   - **Red** < 40

**Source of scores:** Backend `EngagementSnapshot` table (computed every 60s by `engagement.processor.ts`).

---

## 2. PIPELINE TRACE

### 2.1 Kafka Events — EventType Enum

**File:** `api/prisma/schema.prisma`

```
MIC, CAMERA, CHAT, BLUR, FOCUS, JOIN, LEAVE,
MOUSE_TRACK, KEYSTROKE, SCREEN_SHARE, HAND_RAISE,
TEACHER_INTERVENTION, POLL_CREATED, POLL_VOTE,
QUIZ_STARTED, QUIZ_QUESTION_SENT, QUIZ_ANSWER_SUBMITTED, QUIZ_ENDED
```

**Pipeline Flow:**

```
Frontend (socket.emit 'engagementEvent')
  ↓
Classroom Gateway (@SubscribeMessage 'engagementEvent')
  ├─ Enriches payload with breakoutRoomId (from Session.breakoutConfig)
  ├─ Broadcasts real-time updates (participant-media-update, etc.)
  ↓
Ingest Service (ingest.service.ts)
  ├─ Kafka Producer → topic: "classroom-events"
  └─ Key: {tenantId}:{sessionId}
  ↓
Engagement Processor (engagement.processor.ts)
  ├─ Kafka Consumer on "classroom-events"
  ├─ Writes to Prisma EngagementEvent table
  └─ Computes EngagementSnapshot every 60s
  ↓
Analytics Service (analytics.service.ts)
  ├─ GET /analytics/session/{id}/live-scores
  └─ GET /analytics/session/{id}/history
```

### 2.2 Prisma Schema — Engagement Tables

| Table | Fields | Purpose |
|-------|--------|---------|
| **EngagementEvent** | `id`, `tenantId`, `sessionId`, `type` (EventType enum), `payload` (JSON), `timestamp` | Raw event log — every emitted event lands here |
| **EngagementSnapshot** | `id`, `tenantId`, `sessionId`, `userId`, `score` (Int), `timestamp` | Computed 0-100 score per user per 60s window |
| **Session** | `id`, `tenantId`, `courseId`, `userId`, `classroomCode`, `startedAt`, `endedAt`, `dwellTime`, `breakoutConfig` (JSON) | Session metadata + breakout room map |
| **UserQuizState** | `id`, `quizSessionId`, `userId`, `totalScore`, `answers` (JSON) | Quiz performance data |
| **Poll** / **PollOption** / **PollVote** | — | Poll/quiz event storage (counts only, no timestamps in vote table) |

---

## 3. METRIC DEFINITION TABLE

| Metric Name | Definition / Formula | Trigger Event | Storage Location |
|-------------|----------------------|---------------|------------------|
| **Engagement Score** | `100 + Σ(eventWeight × count)` per 60s window, clamped 0-100. Decay: `round(50 + (score - 50) × 0.8)` if no events. | All events in window | `EngagementSnapshot.score` |
| **Participation (VAD)** | Surface-level `isSpeaking` boolean from LiveKit | LiveKit `useIsSpeaking` hook | NOT persisted — ephemeral UI only |
| **Tab Focus Ratio** | Count of `FOCUS` vs `BLUR` events per window | `document.visibilitychange`, `window.focus/blur` | `EngagementEvent` (type: FOCUS/BLUR) |
| **Chat Activity** | Count of `CHAT` events per window | Chat message send / emoji reaction | `EngagementEvent` (type: CHAT) |
| **Mouse Activity** | Count of `MOUSE_TRACK` events (throttled 10s) | `document.mousemove` | `EngagementEvent` (type: MOUSE_TRACK) |
| **Keystroke Activity** | Count of `KEYSTROKE` events (aggregated 30s) | `document.keydown` | `EngagementEvent` (type: KEYSTROKE) |
| **Hand Raise** | Boolean state from latest `HAND_RAISE` event payload | Click hand-raise button | `EngagementEvent` (type: HAND_RAISE) |
| **Breakout Room Health** | `avg(score)` of members in room → green/yellow/red | Derived from `EngagementSnapshot` | Computed on frontend at render time |
| **Dwell Time** | Total seconds in session (`endedAt - startedAt` or accumulated) | Session start/end | `Session.dwellTime` |
| **Teacher Intervention** | Count of forced mutes/camera disables/kicks | Moderation actions | `EngagementEvent` (type: TEACHER_INTERVENTION) |
| **Quiz Score** | Sum of correct answers × points | Quiz submission | `UserQuizState.totalScore` |
| **Poll Participation** | Count of votes per poll | Poll vote click | `PollVote` table |
| **Breakout Assignment** | Map of `userId → breakoutRoomId` | Room creation / manual assign | `Session.breakoutConfig` (JSON) |

### Weighted Scoring Formula (from `engagement.processor.ts`)

```typescript
const EVENT_WEIGHTS = {
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
  // HAND_RAISE, TEACHER_INTERVENTION, POLL_*, QUIZ_* have no weights defined
};
```

---

## 4. VISUAL VALIDATION — Sample Data

### 4.1 Analytics API Response — Live Scores

**Endpoint:** `GET /analytics/session/{id}/live-scores`

**Response structure (from `analytics.service.ts` line 198-206):**

```json
[
  {
    "userId": "user-abc-123",
    "email": "student1@example.com",
    "score": 85,
    "color": "green",
    "isHandRaised": false,
    "handRaisedAt": null,
    "breakoutRoomId": "room-a"
  },
  {
    "userId": "user-def-456",
    "email": "student2@example.com",
    "score": 32,
    "color": "red",
    "isHandRaised": true,
    "handRaisedAt": "2026-05-02T01:15:00.000Z",
    "breakoutRoomId": null
  }
]
```

**Score computation per user:**
- Base: 100
- Add weight for each event in 60s window
- Clamp: `Math.max(0, Math.min(100, score))`
- Color mapping: >70 = green, ≥40 = yellow, <40 = red

### 4.2 Engagement Snapshot Computation (60s window)

**From `engagement.processor.ts` lines 109-176:**

```
For each active session:
  1. Find all EngagementEvent rows with timestamp >= now - 60s
  2. Group events by userId (extracted from payload.userId)
  3. For each user:
     a. score = 100 + Σ(EVENT_WEIGHTS[event.type])
     b. If no events: score = round(50 + (score - 50) * 0.8)  // passive decay
     c. Clamp score to [0, 100]
  4. Insert new EngagementSnapshot row per user
```

### 4.3 Teacher Heatmap Sorting

**File:** `TeacherHeatmap.tsx`

- Polls every **10 seconds**
- Sort order:
  1. Hand-raised first (oldest raise first)
  2. Then **lowest score first** (disengaged students prioritized)

---

## 5. GAP ANALYSIS — Three Critical Missing Metrics

### 5.1 Screen Share Duration ⏱️

**Why it's missing:** The `SCREEN_SHARE` event is emitted when a user toggles screen sharing on/off, but there is **no duration tracking**. The event only records the toggle action, not how long the screen was shared.

**How to add it:**
- Add `startTime` to the `SCREEN_SHARE` payload when `active: true`
- On `active: false`, compute `duration = now - startTime`
- Emit `SCREEN_SHARE_DURATION` event or store duration in the payload
- Add `SCREEN_SHARE_DURATION` weight to `EVENT_WEIGHTS` (suggest 15 per minute)

**Architecture readiness:** ✅ Ready — event type exists, payload is JSON, processor can extract duration.

### 5.2 Chat Frequency / Response Latency 💬

**Why it's missing:** Chat events (`CHAT`) are recorded but only as a count. There is no analysis of:
- Messages per minute (frequency)
- Time between messages (burst detection)
- Response time to teacher questions

**How to add it:**
- In `engagement.processor.ts`, add a `chatFrequency` metric per window:
  ```typescript
  const chatEvents = userEvents.filter(e => e.type === 'CHAT');
  const frequency = chatEvents.length; // per 60s window
  // Bonus weight for sustained chat activity
  ```
- Add `CHAT_BURST` weight: +5 for ≥3 messages in a window
- Track `firstResponseTime`: time between `POLL_CREATED`/`QUIZ_QUESTION_SENT` and first `CHAT` response

**Architecture readiness:** ✅ Ready — all data exists in `EngagementEvent` table.

### 5.3 Audio Activity Duration (VAD) 🎤

**Why it's missing:** `isSpeaking` from LiveKit is only used for **UI decoration** (green ring on avatars). The actual Voice Activity Detection (VAD) duration is never sent to the engagement pipeline. A student could speak for 30 seconds but only get a `MIC` event (+20) if they toggled the mic, not if they actually spoke.

**How to add it:**
- In `ClassroomContent.tsx` or a new hook, subscribe to `participant.on(ParticipantEvent.IsSpeakingChanged, ...)`
- Track `speakingStartTime` and `speakingEndTime`
- Emit `SPEAKING_DURATION` event every 10s with accumulated seconds
- Add weight: `+1 per 5 seconds of active speech` (encourages verbal participation)
- Enrich `getLiveScores` to include `speakingDuration` alongside `score`

**Architecture readiness:** ⚠️ Needs LiveKit SDK event subscription — `@livekit/components-react` exposes `useIsSpeaking()` but this is a boolean snapshot, not a duration tracker. Would need to wire `RoomEvent.ActiveSpeakersChanged` or track timestamps manually in a hook.

---

## Appendix A: Full File Inventory

### Frontend (web/src)
- `hooks/useEngagement.ts` — Polls live-scores API
- `hooks/useEngagementTracker.ts` — DOM event tracking (mouse, keystroke, focus)
- `hooks/useEngagementTracking.ts` — Blur/focus tracking (redundant)
- `hooks/useBlurDetection.ts` — Legacy blur detection
- `components/classroom/ClassroomContent.tsx` — Mic/camera/screen/hand/poll events
- `components/classroom/Chat.tsx` — Chat events
- `components/classroom/Sidebar.tsx` — Question events
- `components/classroom/BreakoutTab.tsx` — Room health display
- `components/dashboard/TeacherHeatmap.tsx` — Score-based student sorting
- `components/dashboard/ClassPulseChart.tsx` — Class average over time

### Backend (api/src)
- `engagement/engagement.processor.ts` — Kafka consumer + score computation
- `ingest/ingest.service.ts` — Kafka producer
- `classroom/classroom.gateway.ts` — WebSocket engagement event handler
- `analytics/analytics.service.ts` — Analytics aggregation queries
- `analytics/analytics.controller.ts` — REST API endpoints
- `prisma/schema.prisma` — Data model definitions

### Kafka
- **Topic:** `classroom-events`
- **Key:** `{tenantId}:{sessionId}`
- **Producer:** `IngestService`
- **Consumer:** `EngagementProcessor` (group: `engagement-processor`)

---

*End of Report*
