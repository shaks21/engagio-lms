# Classroom Debugging Notes

## Current State
- **Branch**: main (1 commit ahead of origin/main)
- **Services**: PM2 running `engagio-web` (3001) and `engagio-api` (3000)
- **Database**: Tables exist, users exist, sessions can be created
- **Site**: `https://engagio.duckdns.org/` — login/register works

## Known Issues
1. **Participants panel empty** — no real users showing even when others join
2. **Leave button not working** — `handleLeave` fires but socket disconnect logic may not propagate correctly
3. **Mic/camera not sharing** — tracks may not propagate to remote peers after initial join

## Files Reviewed
- `web/src/app/classroom/[sessionId]/page.tsx` — full classroom page (restored from HEAD)
- `web/src/components/classroom/Participants.tsx` — participant list component
- `web/src/components/classroom/Chat.tsx` — chat component with socket listener
- `web/src/components/classroom/Toolbar.tsx` — toolbar with leave button
- `web/src/lib/livekit-context.tsx` — `useParticipants` hook using LiveKit engine
- `web/src/hooks/useWebRTC.ts` — WebRTC signaling (offer/answer/ICE)
- `web/src/lib/MediaManager.ts` — media device management
- `api/src/classroom/classroom.gateway.ts` — Socket.IO gateway (join/leave/media events)

## Quick Fixes to Apply
1. **Leave button**: ensure `handleLeave` calls `router.push('/dashboard/classroom')` after disconnect
2. **Participants**: remove fallback `getParticipants` reliance on `room.activeSpeakers` — use socket-based participants for real-time
3. **Media sharing**: ensure `media-ready` and `participant-joined-media` events trigger WebRTC offers from both sides
4. **Socket cleanup**: prevent reconnect loops by clearing `initializedRef` on disconnect

## Testing Steps
1. Login as teacher, create course + session
2. Login as student in another browser
3. Student joins session — should see teacher in participants
4. Teacher starts video — student should receive `participant-joined-media`
5. Student clicks leave — should be removed from participants and redirected
6. Chat messages should appear in real-time for both users