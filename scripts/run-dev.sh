#!/bin/bash

# VM 오토스케일링 개발 서버 실행 스크립트

echo "=== VM 오토스케일링 개발 서버 시작 ==="

# Backend 실행
echo "Backend 서버 시작 중..."
cd "$(dirname "$0")/../backend"
npm run dev &
BACKEND_PID=$!

# Frontend 실행
echo "Frontend 서버 시작 중..."
cd "$(dirname "$0")/../frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 서버가 시작되었습니다!"
echo "   - Backend: http://localhost:4000"
echo "   - Frontend: http://localhost:5173"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."

# 종료 시그널 처리
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

# 프로세스 대기
wait


