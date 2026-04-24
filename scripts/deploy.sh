#!/bin/bash
# Engagio LMS VPS Deploy Script
# Usage: cd ~/engagio-lms && ./scripts/deploy.sh

set -e

echo "=== Engagio LMS VPS Deploy ==="
echo ""

# Validation
echo "[1/5] Validating .env.local..."
if ! grep -q "NEXT_PUBLIC_API_URL=https://engagio.duckdns.org/api" web/.env.local 2>/dev/null; then
    echo "ERROR: web/.env.local missing or has wrong API URL."
    echo "Expected: NEXT_PUBLIC_API_URL=https://engagio.duckdns.org/api"
    echo "See web/.env.local.example"
    exit 1
fi
echo "✓ .env.local OK"

# Build API
echo ""
echo "[2/5] Building API..."
cd api
npm run build 2>&1 | tail -5
echo "✓ API built"

# Build Web
echo ""
echo "[3/5] Building Web..."
cd ../web
npm run build 2>&1 | tail -5
echo "✓ Web built"

# Restart services
echo ""
echo "[4/5] Restarting PM2 services..."
pm2 restart engagio-api --update-env
pm2 restart engagio-web --update-env
echo "✓ Services restarted"

# Health checks
echo ""
echo "[5/5] Health checks..."
sleep 3
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://engagio.duckdns.org/api/ || echo "FAIL")
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://engagio.duckdns.org/login || echo "FAIL")

if [ "$API_STATUS" = "200" ] && [ "$WEB_STATUS" = "200" ]; then
    echo "✓ All systems operational"
    echo ""
    echo "  Frontend: https://engagio.duckdns.org/login"
    echo "  Backend:  https://engagio.duckdns.org/api/"
else
    echo "⚠ Health check failed: API=$API_STATUS WEB=$WEB_STATUS"
    echo "   Check: pm2 logs"
    exit 1
fi

echo ""
echo "=== Deploy Complete ==="
