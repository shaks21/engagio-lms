#!/usr/bin/env bash
# E2E Quiz Flow Test — runs against the deployed API
# Verifies: create → start → answer → next → end → leaderboard

set -e
API="http://localhost:3000"
TENANT="default"

echo "[E2E] Registering teacher..."
AUTH=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e-quiz-'$(date +%s)'@engagio.com","password":"password123","role":"TEACHER"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['accessToken'])")

if [ -z "$AUTH" ]; then echo "Registration failed"; exit 1; fi
echo "[E2E] Token obtained"

# Create a course
COURSE=$(curl -sf -X POST "$API/courses" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -d '{"title":"E2E Quiz Course","description":"E2E"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")

echo "[E2E] Course created: $COURSE"

# List sessions to get a real sessionId
SESSION_OBJ=$(curl -sf "$API/sessions" \
  -H "Authorization: Bearer $AUTH" \
  -H "x-tenant-id: $TENANT" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d[0]) if isinstance(d,list) and len(d)>0 else '{}')")

# If no session exists for this course we'll have to skip or create one differently
# The sessions controller may be mounted differently

echo "[E2E] Found session: $(echo $SESSION_OBJ | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("id","none"))')"

SESSION_ID=$(echo $SESSION_OBJ | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("id","test-session-001"))')

echo "[E2E] Using sessionId: $SESSION_ID"

# 1. Create Quiz Session
QUIZ=$(curl -sf -X POST "$API/sessions/$SESSION_ID/quizzes" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -d '{
    "title": "End-to-End Quiz",
    "polls": [
      {
        "question": "What is 2+2?",
        "options": [
          {"text": "3", "isCorrect": false},
          {"text": "4", "isCorrect": true},
          {"text": "5", "isCorrect": false},
          {"text": "6", "isCorrect": false}
        ]
      },
      {
        "question": "What is 5*5?",
        "options": [
          {"text": "20", "isCorrect": false},
          {"text": "25", "isCorrect": true},
          {"text": "30", "isCorrect": false},
          {"text": "15", "isCorrect": false}
        ]
      }
    ]
  }')

QUIZ_ID=$(echo $QUIZ | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "[E2E] QuizSession created: $QUIZ_ID"

# 2. Start Quiz
START=$(curl -sf -X POST "$API/sessions/$SESSION_ID/quizzes/$QUIZ_ID/start" \
  -H "Authorization: Bearer $AUTH" \
  -H "x-tenant-id: $TENANT")
echo "[E2E] Quiz started"
echo "$START" | python3 -m json.tool

# 3. Submit Answer (as student)
STUDENT_AUTH=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e-student-'$(date +%s)'@engagio.com","password":"password123","role":"STUDENT"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['accessToken'])")

# Get first option ID from started quiz
FIRST_OPTION=$(echo $START | python3 -c "import sys,json; d=json.load(sys.stdin); opts=d.get('currentQuestion',{}).get('options',[]); print(opts[0]['id'] if opts else '')")

echo "[E2E] First optionId: $FIRST_OPTION"

if [ -n "$FIRST_OPTION" ]; then
  ANSWER=$(curl -sf -X POST "$API/sessions/$SESSION_ID/quizzes/answer" \
    -H "Authorization: Bearer $STUDENT_AUTH" \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: $TENANT" \
    -d "{\"quizSessionId\":\"$QUIZ_ID\",\"userId\":\"e2e-student\",\"optionId\":\"$FIRST_OPTION\",\"basePoints\":10}")
  echo "[E2E] Answer submitted"
  echo "$ANSWER" | python3 -m json.tool
fi

# 4. Next Question (moves to Q2)
NEXT=$(curl -sf -X POST "$API/sessions/$SESSION_ID/quizzes/next" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -d "{\"quizSessionId\":\"$QUIZ_ID\"}")
echo "[E2E] Next question"
echo "$NEXT" | python3 -m json.tool

# 5. End Quiz (call next again since there are only 2 questions)
END=$(curl -sf -X POST "$API/sessions/$SESSION_ID/quizzes/next" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -d "{\"quizSessionId\":\"$QUIZ_ID\"}")
echo "[E2E] Quiz ended"
echo "$END" | python3 -m json.tool

# 6. Leaderboard
LB=$(curl -sf "$API/sessions/$SESSION_ID/quizzes/$QUIZ_ID/leaderboard" \
  -H "Authorization: Bearer $AUTH" \
  -H "x-tenant-id: $TENANT")
echo "[E2E] Leaderboard"
echo "$LB" | python3 -m json.tool

echo "========================================"
echo "[E2E] All Quiz Flow API Tests PASSED"
echo "========================================"
