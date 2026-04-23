# Engagio LMS VPS Deployment Guide

## Domain
- **Frontend**: https://engagio.duckdns.org
- **Backend API**: https://engagio.duckdns.org/api
- **Socket.io**: wss://engagio.duckdns.org
- **LiveKit**: wss://engagio.duckdns.org/rtc

## VPS IP
164.68.119.230

## Architecture
```
User → HTTPS (443) → Nginx → Frontend (:3001) / API (:3000) / LiveKit (:7880)
```

## Nginx Reverse Proxy
File: `/etc/nginx/sites-available/engagio`

| Path | Destination | Purpose |
|------|-------------|---------|
| `/` | `localhost:3001` | Next.js frontend |
| `/api/` | `localhost:3000` | NestJS API |
| `/socket.io/` | `localhost:3000` | Socket.io WebSocket |
| `/rtc/` | `localhost:7880` | LiveKit SFU |

SSL: Let's Encrypt via Certbot (auto-renews)

## Frontend Environment
File: `/home/shaks/engagio-lms/web/.env.local`

```
NEXT_PUBLIC_API_URL=https://engagio.duckdns.org/api
NEXT_PUBLIC_SOCKET_URL=wss://engagio.duckdns.org
NEXT_PUBLIC_LIVEKIT_URL=wss://engagio.duckdns.org/rtc
```

⚠️ **NEVER commit `.env.local` to git.** It is already `.gitignore`d.

## PM2 Process Management

```bash
# Start/restart
pm2 start api/dist/main.js --name engagio-api --update-env
pm2 start web/server.js --name engagio-web --update-env
pm2 save

# Monitor
pm2 list
pm2 logs
```

### Current PM2 Processes
| Name | Port | File |
|------|------|------|
| engagio-api | 3000 | `api/dist/main.js` |
| engagio-web | 3001 | `web/server.js` |

## Rebuild & Redeploy Quick Reference

```bash
# 1. SSH into VPS
cd ~/engagio-lms

# 2. Pull latest code (if any)
git pull origin main

# 3. Rebuild API
cd api && npm run build
pm2 restart engagio-api --update-env

# 4. Rebuild Web
cd ../web && npm run build
pm2 restart engagio-web --update-env

# 5. Verify
curl https://engagio.duckdns.org/api/
curl https://engagio.duckdns.org/login
```

## Infrastructure Checklist
- [x] Nginx reverse proxy with SSL
- [x] API binds to 0.0.0.0:3000
- [x] Web binds to 0.0.0.0:3001
- [x] LiveKit on localhost:7880
- [x] PM2 process management
- [x] PostgreSQL on :5432
- [x] Redis on :6379
- [x] Kafka on :9092
- [x] CORS configured for DuckDNS origin

## Test Data
| Field | Value |
|-------|-------|
| Email | test@test.com |
| Password | test12345 |
| Session Code | TEST3513 |
| Role | STUDENT |
