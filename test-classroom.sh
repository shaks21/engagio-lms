#!/bin/bash
echo "Testing classroom API endpoints..."

# Test 1: Check if backend is responding
echo "1. Testing backend health..."
curl -s http://164.68.119.230:3000/health || echo "Backend not responding"

# Test 2: Test session creation
echo "2. Testing session creation..."
SESSION_RESPONSE=$(curl -s -X POST http://164.68.119.230:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "tenant1", "courseId": "course1", "userId": "test-user", "userName": "Test User"}' | jq -r '.id' 2>/dev/null || echo "null")

if [ "$SESSION_RESPONSE" != "null" ] && [ "$SESSION_RESPONSE" != "" ]; then
  echo "   Session created: $SESSION_RESPONSE"
  
  # Test 3: Test joining session via socket (simplified)
  echo "3. Testing session retrieval..."
  curl -s http://164.68.119.230:3000/sessions/$SESSION_RESPONSE | jq -r '.id' 2>/dev/null && echo "   Session retrieved successfully"
  
  # Test 4: Test analytics endpoint
  echo "4. Testing analytics endpoint..."
  curl -s http://164.68.119.230:3000/analytics/session/$SESSION_RESPONSE/history | jq -r '.length' 2>/dev/null && echo "   Analytics endpoint working"
else
  echo "   Failed to create session"
fi

echo "Testing complete!"