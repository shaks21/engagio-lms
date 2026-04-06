# ENGAGIO MASTER MISSION: PHASE 2 & 3
Goal: Build a fully functional, real-time Engagement Engine and Teacher Dashboard.

## 1. BACKEND: THE BRAIN (NestJS)
- **Scoring Logic**: Update 'EngagementProcessor' to aggregate Kafka events every 60s.
- **Weights**: Chat (+10), Mic/Cam (+20), Tab Blur (-30).
- **Persistence**: Create 'EngagementSnapshot' model in Prisma (id, sessionId, userId, score, timestamp).
- **API**: Create 'GET /analytics/session/:id' to return score history for charts.

## 2. FRONTEND: THE EYES (Next.js 16)
- **Tracking Hook**: Implement 'useEngagementTracking' to emit 'window_blur' and 'window_focus' events via Socket.io.
- **Teacher Heatmap**: Build a live dashboard grid showing student cards that change color based on their real-time score (Green > 70, Yellow 40-70, Red < 40).
- **Charts**: Integrate 'Recharts' to show a line graph of the overall class pulse.

## 3. AUTONOMOUS RULES
- **Build First**: Always run 'npm run build' in 'api' and 'web' before pushing.
- **Git**: Commit with 'feat: [feature name]' and push to 'origin main'.
- **Persistence**: If the VPS disk space hits < 2GB, STOP and log to 'DISK_ALARM.txt'.
- **Errors**: If a bug persists for 3 attempts, move to the next sub-task and document in 'TODO.md'.
- **Resource Management**: Before running npm run build, stop any active dev servers (pkill node) to free up RAM.
- **Serial Execution**: Do not build the 'api' and 'web' at the same time. Build one, then the other.
