# Phase 3 Execution Plan: Engagement Engine & Teacher Dashboard

## Tasks:
1. Update Prisma schema - Add EngagementSnapshot model
2. Update EngagementProcessor - Add 60s scoring aggregation with weights
3. Create API - GET /analytics/session/:id for score history
4. Implement useEngagementTracking hook - window blur/focus tracking
5. Teacher Heatmap - Live grid with color-coded student cards
6. Charts - Recharts for class pulse
7. Install Recharts dependency