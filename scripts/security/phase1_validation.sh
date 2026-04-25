#!/bin/bash
set -e

echo "🔍 Phase 1 Security Validation"
echo "=============================="

# Check if server is running
if ! curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    echo "⚠️  Server not running. Starting server in background..."
    go run ./cmd/pacta &
    SERVER_PID=$!
    sleep 3
    CLEANUP=true
fi

trap 'if [ "$CLEANUP" = true ]; then kill $SERVER_PID 2>/dev/null; fi' EXIT

# 1. Test CORS headers
echo "1️⃣  Testing CORS headers..."
CORS_TEST=$(curl -s -I -H "Origin: http://127.0.0.1:3000" http://localhost:3000/api/v1/health)
echo "$CORS_TEST" | grep -q "Access-Control-Allow-Origin: http://127.0.0.1:3000" && echo "✅ CORS Origin" || echo "❌ CORS Origin FAILED"
echo "$CORS_TEST" | grep -q "Access-Control-Allow-Credentials: true" && echo "✅ CORS Credentials" || echo "❌ CORS Credentials FAILED"

# 2. Test Security Headers
echo ""
echo "2️⃣  Testing Security Headers..."
SECURITY_TEST=$(curl -s -I http://localhost:3000/api/v1/health)
echo "$SECURITY_TEST" | grep -q "X-Frame-Options: DENY" && echo "✅ X-Frame-Options" || echo "❌ X-Frame-Options FAILED"
echo "$SECURITY_TEST" | grep -q "X-Content-Type-Options: nosniff" && echo "✅ X-Content-Type-Options" || echo "❌ X-Content-Type-Options FAILED"
echo "$SECURITY_TEST" | grep -q "Content-Security-Policy" && echo "✅ CSP" || echo "❌ CSP FAILED"
echo "$SECURITY_TEST" | grep -q "X-XSS-Protection: 1; mode=block" && echo "✅ X-XSS-Protection" || echo "❌ X-XSS FAILED"

# 3. Test CSRF Protection
echo ""
echo "3️⃣  Testing CSRF protection..."
CSRF_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/contracts -H "Content-Type: application/json" -d '{"name":"test"}' 2>&1)
echo "$CSRF_RESPONSE" | grep -qi "csrf\|forbidden" && echo "✅ CSRF blocking works" || echo "❌ CSRF protection FAILED"

# 4. Test Rate Limiting
echo ""
echo "4️⃣  Testing Rate Limiting..."
RATE_LIMIT_HIT=false
for i in $(seq 1 25); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health)
    if [ "$STATUS" = "429" ]; then
        RATE_LIMIT_HIT=true
        break
    fi
    sleep 0.1
done
$RATE_LIMIT_HIT && echo "✅ Rate limiting triggered" || echo "⚠️  Rate limit not triggered (may need tuning)"

echo ""
echo "✅ Phase 1 validation complete!"
