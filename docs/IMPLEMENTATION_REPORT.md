# Engagio LMS — Implementation Status Report

**Date:** April 2026
**Repository:** https://github.com/shaks21/engagio-lms.git
**VPS:** 164.68.119.230 (vmi3206537)  
**Domain:** https://engagio.duckdns.org

---

## 1. Executive Summary

Engagio LMS is a production-grade, multi-tenant SaaS Learning Management System with a real-time virtual classroom powered by LiveKit SFU. It features JWT authentication, tenant isolation, course management, enrollment tracking, live session analytics, and WebRTC-based media streaming. The system is deployed on a VPS using Docker Compose for infrastructure and PM2 for application lifecycle management.

---

## 2. Technology Stack

### 2.1 Backend (API)
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | NestJS | ^10.x |
| Language | TypeScript | ^5.x |
| ORM | Prisma | ^7.8.0 |
| Database | PostgreSQL | 17-alpine |
| Cache / PubSub | Redis | 7-alpine |
| Message Broker | Apache Kafka | 7.6.1 (Confluent) |
| WebSockets | Socket.io + Redis Adapter | ^4.x |
| Media SFU | LiveKit Server | latest |
| Process Manager | PM2 | — |

### 2.2 Frontend (Web)
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.2 |
| Language | TypeScript | ^5.x |
| Styling | Tailwind CSS v4 | Next.js built-in |
| UI Library | LiveKit React Components | ^2.x |
| State | React Hooks (useState/useEffect/useCallback) | — |
| Auth Context | Custom JWT + localStorage | — |
| Icons | Lucide React | — |

### 2.3 Infrastructure
| Service | Container | Port |
|---------|-----------|------|
| PostgreSQL | `engagio-postgres` | 5432 |
| Redis | `engagio-redis` | 6379 |
| Zookeeper | `engagio-zookeeper` | 2181 |
| Kafka | `engagio-kafka` | 9092, 29092 |
| LiveKit Server | `livekit-server` (host network) | 7880, 7881, 7882 |
| pgAdmin | `engagio-pgadmin` | 5050 |

### 2.4 Deployment
- **API:** NestJS production build → PM2 (`engagio-api`) on port 3000
- **Web:** Next.js production build → PM2 (`engagio-web`) on port 3001
- **Reverse Proxy:** Cloudflare Quick Tunnel to DuckDNS (`engagio.duckdns.org`)
- **SSL:** Cloudflare-provided HTTPS on frontend; backend served behind same domain at `/api`

---

## 3. Database Schema (Prisma)

### 3.1 Core Models

```
Tenant
├── id (UUID PK)
├── name
└── Relations: users[], courses[], enrollments[], sessions[], events[], engagementSnapshots[]

User
├── id (UUID PK)
├── tenantId (FK)
├── email
├── password (hashed)
├── role: ADMIN | TEACHER | STUDENT
└── Relations: courses[] (as instructor), enrollments[], sessions[]

Course
├── id (UUID PK)
├── tenantId (FK)
├── title
├── description
├── instructorId (FK)
└── Relations: enrollments[], sessions[]

Enrollment
├── id (UUID PK)
├── tenantId (FK)
├── userId (FK)
├── courseId (FK)
├── status (default: "active")
└── Unique: [tenantId, userId, courseId]

Session
├── id (UUID PK)
├── tenantId (FK)
├── courseId (FK)
├── hostId (FK)
├── classroomCode (unique per tenant)
├── status: SCHEDULED | ACTIVE | ENDED
├── startedAt, endedAt
└── Relations: engagementEvents[], engagementSnapshots[]

EngagementEvent
├── id (UUID PK)
├── tenantId (FK)
├── sessionId (FK)
├── userId
├── type: EventType enum
├── metadata (JSON)
└── createdAt

EngagementSnapshot
├── id (UUID PK)
├── tenantId (FK)
├── sessionId (FK)
├── userId
├── score (Float, 0–100)
└── createdAt
```

### 3.2 EventType Enum
`MIC`, `CAMERA`, `CHAT`, `BLUR`, `FOCUS`, `JOIN`, `LEAVE`, `MOUSE_TRACK`, `KEYSTROKE`, `SCREEN_SHARE`

---

## 4. Backend (API) — Module Breakdown

### 4.1 Auth Module (`/auth`)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | — | Register new user with tenant |
| `/auth/login` | POST | — | Login, returns access + refresh tokens |
| `/auth/refresh` | POST | — | Refresh access token |
| `/auth/me` | GET | JWT | Get current user profile |

**Features:**
- Password hashing with bcrypt
- Role-based access (ADMIN, TEACHER, STUDENT)
- Multi-tenant isolation via `TenantGuard` (extracts `x-tenant-id` header)
- Token versioning for secure logout/revocation

### 4.2 Course Module (`/courses`)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/courses` | POST | JWT + Tenant | Create course |
| `/courses` | GET | JWT + Tenant | List all tenant courses |
| `/courses/:id` | GET | JWT + Tenant | Get course details |
| `/courses/:id` | PATCH | JWT + Tenant | Update course |
| `/courses/:id` | DELETE | JWT + Tenant | Delete course |

### 4.3 Enrollment Module (`/enrollments`)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/enrollments` | POST | JWT + Tenant | Enroll user in course |
| `/enrollments/course/:courseId` | GET | JWT + Tenant | List enrollments for course |
| `/enrollments/user/:userId` | GET | JWT + Tenant | List enrollments for user |
| `/enrollments/course/:courseId/user/:userId` | PATCH | JWT + Tenant | Update enrollment status |
| `/enrollments/course/:courseId/user/:userId` | DELETE | JWT + Tenant | Remove enrollment |

### 4.4 Session Module (`/sessions`)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/sessions/start` | POST | JWT + Tenant | Start a new live session |
| `/sessions/:id/end` | POST | JWT + Tenant | End active session |
| `/sessions/active` | GET | JWT + Tenant | Get active sessions |
| `/sessions/history` | GET | JWT + Tenant | Get session history |
| `/sessions/code/:classroomCode` | GET | JWT + Tenant | Find session by classroom code |
| `/sessions/:id` | GET | JWT + Tenant | Get session details |

### 4.5 Classroom Gateway (`/classroom` — WebSocket)

**Socket Events (Client → Server):**

| Event | Payload | Description |
|-------|---------|-------------|
| `joinClassroom` | `{ tenantId, sessionId, userId, userName, classroomCode }` | Join room |
| `engagementEvent` | `{ type: EventType, payload }` | Send engagement event |
| `webrtc-*` | various | Legacy WebRTC events (phased out) |

**Socket Events (Server → Client):**

| Event | Payload | Description |
|-------|---------|-------------|
| `chatMessage` | `{ userName, text, timestamp }` | Broadcast chat |
| `classroom-question` | `{ id, text, userId, userName, votes, answered }` | New Q&A question |
| `classroom-question-vote` | `{ id, votes }` | Question upvoted |
| `participant-hand-raise` | `{ userId, raised }` | Hand raise state |
| `participant-media-update` | `{ userId, hasAudio, hasVideo, isScreenSharing }` | Media status |

**Features:**
- Redis adapter for multi-node socket scaling
- Session-scoped room isolation
- Kafka producer: publishes engagement events to `classroom-events` topic

### 4.6 LiveKit Module (`/classroom/token/:sessionId`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/classroom/token/:sessionId?userId=&displayName=&role=` | GET | — | Generate LiveKit JWT token |

**Token permissions:**
- `roomJoin`, `room`, `canPublish`, `canSubscribe`, `canPublishData`
- `roomAdmin` + `roomRecord` for teachers
- 4-hour TTL

### 4.7 Analytics Module (`/analytics`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/analytics/overview` | GET | JWT + Tenant | Engagement overview |
| `/analytics/realtime` | GET | JWT + Tenant | Real-time stats |
| `/analytics/user/:userId` | GET | JWT + Tenant | Per-user engagement |
| `/analytics/course/:courseId` | GET | JWT + Tenant | Per-course analytics |
| `/analytics/users/scores` | GET | JWT + Tenant | User score leaderboard |
| `/analytics/session/:id/history` | GET | JWT + Tenant | Session score history |
| `/analytics/session/:id/live-scores` | GET | JWT + Tenant | Live session scores |

### 4.8 Engagement Processor (Kafka Consumer)

- **Group ID:** `engagement-processor`
- **Topic:** `classroom-events`
- **Logic:**
  1. Consumes engagement events from Kafka
  2. Persists events to PostgreSQL (`EngagementEvent` table)
  3. Computes engagement scores every 60 seconds:
     - `CHAT`: +10
     - `MIC` / `CAMERA` / `SCREEN_SHARE`: +20
     - `BLUR`: -30
     - `MOUSE_TRACK`: +2
     - `KEYSTROKE`: +3
  4. Scores clamped to 0–100 range
  5. Stores snapshot in `EngagementSnapshot`

---

## 5. Frontend (Web) — Page & Route Breakdown

### 5.1 Public Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Landing page | Hero section, product overview |
| `/login` | Login form | JWT authentication |
| `/register` | Registration form | New user signup |

### 5.2 Dashboard Routes (Protected by `AuthGuard`)

| Route | Description |
|-------|-------------|
| `/dashboard` | Main dashboard with realtime stats cards |
| `/dashboard/teacher` | Teacher-specific view |
| `/dashboard/courses` | Course list / management |
| `/dashboard/courses/:courseId` | Course detail page |
| `/dashboard/enrollments` | Enrollment management |
| `/dashboard/analytics` | Analytics dashboard (charts + metrics) |
| `/dashboard/pulse` | Real-time engagement pulse view |
| `/dashboard/classroom` | Classroom lobby / session starter |

### 5.3 Classroom Route

| Route | Description |
|-------|-------------|
| `/classroom/:sessionId` | Live virtual classroom |

---

## 6. Classroom Components — Detailed Breakdown

### 6.1 PreJoin.tsx (Device Check + Join Flow)

- **Camera preview** with real-time `getUserMedia` stream
- **Mic test visualizer**: Web Audio API (`AnalyserNode`) with 16-bar frequency meter
- **Device toggle buttons** (mic/camera) positioned below preview (not overlay)
- Generates `PreJoinConfig` passed to `LiveKitRoom`

### 6.2 ClassroomContent.tsx (Main Orchestrator)

- Fetches LiveKit token from `/classroom/token/:sessionId`
- Initializes Socket.io connection (`wss://engagio.duckdns.org/classroom`)
- Manages room state: `LiveKitRoom` with `audio`, `video`, `adaptiveStream`, `dynacast`
- **State managed:** `sidebarOpen` (default `true` on desktop), `sidebarTab`, `raisedHands`, `pinnedSid`, `handRaised`, `micMuted`, `cameraOff`
- **Hand raise listener:** Listens on `participant-hand-raise` (keyed by `userId`)

### 6.3 FocusLayout.tsx

- **View modes:** `focus`, `grid`, `immersive`
- **Pinned participant support**: Dedicated focus tile when participant pinned
- **Screen share priority**: Auto-focuses screen share track
- **Responsive grid**: 1×1 to 4×4 based on participant count
- **VideoTile.tsx**: Individual participant video with play/pause, object-fit, debug info

### 6.4 Toolbar.tsx

- **Media controls** (mic, camera, screen share) — active state = `bg-green-600 animate-pulse`
- **Engagement controls** (hand raise, chat, reactions)
- **Session controls** (sidebar toggle, leave)
- **Positioned inside `<main>`** so it never overlaps sidebar on desktop
- Custom `TooltipButton` with hover tooltips and keyboard shortcuts

### 6.5 GlassHeader.tsx

- Fixed top bar with class info, participant count, live timer, connection status
- View mode toggle: Focus / Grid / Immersive
- Leave button

### 6.6 Sidebar.tsx

- **Tabs:** Chat, People, Q&A
- **Desktop:** Always visible (`md:flex`, `w-72`)
- **Mobile:** Overlay panel (`fixed right-0`, `z-40`, `max-width: 320px`) with close button
- **Chat panel:** Socket-based messaging with `unreadChatCount` badge
- **Participants panel:** LiveKit `useParticipants` hook with:
  - Media indicators (mic, camera, screen share icons)
  - Speaking indicator (green dot + border)
  - Hand raise indicator (yellow `Hand` icon)
  - Pin-on-click
- **Q&A panel:**
  - Ask questions → emits `QUESTION` engagement event
  - Upvote questions → emits `QUESTION_VOTE`
  - Displays vote count, answered status, user name

### 6.7 RemoteVideo.tsx

- Wraps `VideoTrack` from LiveKit with proper `object-fit: cover`
- Debug overlay for `Track.SID` visibility

### 6.8 Filmstrip.tsx

- Horizontal row of small video thumbnails
- Active speaker highlighting

---

## 7. Authentication & Authorization

### 7.1 Flow
1. User registers/logs in via `/auth/register` or `/auth/login`
2. Server returns `{ accessToken, refreshToken, user }`
3. Frontend stores tokens in `localStorage`
4. `AuthContext` provides `user`, `userId`, `userName`, `role` throughout app
5. `AuthGuard` HOC protects dashboard routes (redirects unauthenticated to `/login`)
6. `api` axios instance auto-attaches `Authorization: Bearer <token>` header
7. `TenantGuard` extracts `x-tenant-id` from request for all API calls

### 7.2 Token Refresh
- Access token expires → frontend auto-refreshes via `/auth/refresh`
- Token version counter prevents stale tokens from working post-logout

---

## 8. Real-Time Engagement Scoring

### 8.1 Event Weights
```typescript
MIC: 20
CAMERA: 20
SCREEN_SHARE: 20
CHAT: 10
MOUSE_TRACK: 2
KEYSTROKE: 3
BLUR: -30
```

### 8.2 Pipeline
1. Client emits `engagementEvent` via Socket.io
2. Gateway publishes to Kafka topic `classroom-events`
3. `EngagementProcessor` (consumer group):
   - Persists to `EngagementEvent` table
   - Aggregates by user + session over 60s window
   - Computes weighted score → clamps 0–100
   - Saves to `EngagementSnapshot`
4. Frontend polls `/analytics/session/:id/live-scores` for real-time display

---

## 9. Deployment & DevOps

### 9.1 Docker Compose Services
```yaml
postgres:     Port 5432 — All app data
redis:        Port 6379 — Cache, Socket.io adapter, sessions
zookeeper:    Port 2181 — Kafka coordination
kafka:        Port 9092 — Event streaming
livekit-server: Host network — Media SFU
pgadmin:      Port 5050 — DB administration
```

### 9.2 PM2 Processes
```javascript
engagio-api:  // NestJS API on port 3000
engagio-web:  // Next.js frontend on port 3001
```

### 9.3 Deploy Script (`scripts/deploy.sh`)
1. Validates `web/.env.local` API URL
2. Builds API: `cd api && npm run build`
3. Builds Web: `cd web && npm run build`
4. Restarts PM2 services with `--update-env`
5. Health checks via `curl` to `/api/` and `/login`

### 9.4 Environment Variables

**Backend (`api/.env`):**
```env
DATABASE_URL="postgresql://engagio:engagio_secret@localhost:5432/engagio_db"
REDIS_HOST=localhost
KAFKA_BROKER=localhost:9092
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=<secret>
LIVEKIT_URL=wss://engagio.duckdns.org
JWT_SECRET=<secret>
```

**Frontend (`web/.env.local`):**
```env
NEXT_PUBLIC_API_URL=https://engagio.duckdns.org/api
NEXT_PUBLIC_SOCKET_URL=wss://engagio.duckdns.org/classroom
```

---

## 10. Git Commit History (Last 20)

| Commit | Date | Summary |
|--------|------|---------|
| `01346ce` | Apr 24 05:29 | Layout fixes: sidebar default open, toolbar inside main, hand raise identity key |
| `b9cbd52` | Apr 24 05:06 | Mic test, toolbar green pulse, sidebar Q&A, hand raise in participants |
| `019b2dd` | Apr 23 14:17 | Mobile camera visibility, PiP position, drag state fix |
| `b19b150` | Apr 23 13:19 | Draggable self PiP, minimize, pin self, mic/camera sync, participants panel |
| `991464a` | Apr 22 14:17 | VPS deployment scripts, DuckDNS HTTPS config |
| `9b4f13b` | Apr 21 20:41 | E2E classroom join fix: LiveKit connection, PreJoin UI, media controls, chat |
| `9670a63` | Apr 20 18:43 | PreJoin device prefs, live names, PiP, recording indicator, participant count |
| `249ca54` | Apr 19 02:52 | Engagio Slate dark theme restyle |
| `8a9275c` | Apr 18 20:41 | Dark Academia classroom theme |
| `1bc6b88` | Apr 17 00:52 | Classroom join + media streaming pipeline fix |
| `5f17020` | Apr 16 19:33 | SSR hydration fix: `next/dynamic ssr:false` + `VideoConference` |
| `927a56c` | Apr 16 17:30 | LiveKit module registration + session controller param fix |
| `a5b63dc` | Apr 15 23:41 | Full LiveKit SFU integration replacing manual WebRTC |
| `5ca9a81` | Apr 15 02:52 | LiveKit packages install |
| `eef0e16` | Apr 14 17:30 | Auth context re-authenticates after registration |
| `24373fd` | Apr 13 23:41 | Handle `participant-media-update` for late camera/mic enable |
| `50618a8` | Apr 8 02:52 | Additional STUN/TURN servers |
| `29ee0a8` | Apr 7 20:41 | TURN server for WebRTC relay |
| `32af84d` | Apr 6 17:30 | API URL handling in AuthProvider |

---

## 11. Recent Fixes Summary (This Session)

### 11.1 Todo List Completed
| # | Feature | Status |
|---|---------|--------|
| 1.1 | Pre-join mic test visualizer (16-bar real-time) | ✅ |
| 1.2 | Camera/mic buttons moved below preview | ✅ |
| 2.1 | Active mic/camera buttons → green + `animate-pulse` | ✅ |
| 2.2.1 | Mobile sidebar can close to reveal main panel | ✅ |
| 2.2.2 | Toolbar fixed in mobile; only on main panel in desktop | ✅ |
| 2.3 | Hand raise visible in participant list (identity-keyed) | ✅ |
| 2.4 | Q&A via socket events (`QUESTION`, `QUESTION_VOTE`) | ✅ |
| 2.5 | Desktop sidebar always visible (default `open=true`) | ✅ |

---

## 12. Known Limitations & TODO
| # | Item | Status |
|---|------|--------|
| 1 | LiveKit token endpoint currently has `role=teacher` hardcoded in URL | 🔧 Low priority |
| 2 | Engagement snapshots compute but frontend leaderboard not wired | 🔧 Low priority |
| 3 | Recording indicator UI present but no actual recording backend | 🔧 Low priority |
| 4 | Reactions button in toolbar is a stub | 🔧 Low priority |
| 5 | No admin/user management UI for tenants | 🔧 Future phase |

---

## 13. File Reference

### Key Source Files
```
engagio-lms/
├── api/
│   ├── src/
│   │   ├── auth/              # JWT auth (register, login, refresh, me)
│   │   ├── course/            # CRUD courses
│   │   ├── enrollment/        # Enrollments + status management
│   │   ├── session/           # Start/end/find sessions
│   │   ├── classroom/         # Socket.io gateway + Kafka producer
│   │   ├── livekit/           # Token generation service
│   │   ├── analytics/         # Engagement overview + live scores
│   │   ├── engagement/        # Kafka processor + score engine
│   │   ├── ingest/            # Kafka message ingestion
│   │   ├── prisma/            # PrismaService + PrismaPg adapter
│   │   └── tenancy/           # TenantGuard (x-tenant-id)
│   ├── prisma/schema.prisma   # Full DB schema
│   └── dist/                  # Compiled NestJS output
├── web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── classroom/[sessionId]/page.tsx
│   │   │   ├── dashboard/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   └── classroom/
│   │   │       ├── ClassroomContent.tsx   # Main orchestrator
│   │   │       ├── PreJoin.tsx          # Device check + join
│   │   │       ├── FocusLayout.tsx      # Video grid / views
│   │   │       ├── VideoTile.tsx        # Single video tile
│   │   │       ├── Toolbar.tsx          # Bottom controls
│   │   │       ├── GlassHeader.tsx      # Top bar
│   │   │       ├── Sidebar.tsx          # Chat/People/Q&A panel
│   │   │       ├── Chat.tsx             # Socket chat component
│   │   │       ├── ToastContainer.tsx   # Toast notifications
│   │   │       └── ParticipantGrid.tsx  # Grid layout helper
│   │   ├── lib/
│   │   │   ├── auth-context.tsx         # React auth context
│   │   │   └── api.ts                   # Axios API client
│   │   └── components/ui/               # Reusable UI components
│   ├── .env.local
│   └── next.config.js
├── docker-compose.yml         # All infrastructure services
├── ecosystem.config.js        # PM2 process definitions
└── scripts/deploy.sh          # VPS deployment automation
```

---

*Report generated: April 24, 2026*  
*Latest commit: `01346ce`*  
*VPS Status: API ✅ 200 | WEB ✅ 200*
