#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PORT="${PORT:-4410}"
FRONTEND_PORT="${FRONTEND_PORT:-5520}"

# F5 환경 변수 (기본값 설정)
F5_SERVERS="${F5_SERVERS:-10.255.1.80}"
F5_USER="${F5_USER:-admin}"
F5_PASSWORD="${F5_PASSWORD:-Netcom123!@#}"
F5_PARTITION="${F5_PARTITION:-Common}"

# 로그 디렉토리 생성
LOG_DIR="${ROOT_DIR}/logs"
mkdir -p "${LOG_DIR}"

# PID 파일 경로
PID_DIR="${ROOT_DIR}/.pids"
mkdir -p "${PID_DIR}"
BACKEND_PID_FILE="${PID_DIR}/backend.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend.pid"

# 로그 파일 경로
BACKEND_LOG="${LOG_DIR}/backend.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "=== VM 오토스케일링 개발 서버 시작 ==="
echo "    Backend: ${ROOT_DIR}/backend (PORT=${BACKEND_PORT})"
echo "    Frontend: ${ROOT_DIR}/frontend (PORT=${FRONTEND_PORT})"
echo "    로그 파일:"
echo "      - Backend: ${BACKEND_LOG}"
echo "      - Frontend: ${FRONTEND_LOG}"
echo ""

# 기존 서비스 종료 함수
stop_existing_services() {
  echo "[+] 기존 서비스 종료 중..."
  
  # PID 파일에서 읽어서 종료
  if [[ -f "${BACKEND_PID_FILE}" ]]; then
    OLD_PID=$(cat "${BACKEND_PID_FILE}" 2>/dev/null || true)
    if [[ -n "${OLD_PID}" ]] && kill -0 "${OLD_PID}" 2>/dev/null; then
      echo "    백엔드 프로세스 종료 (PID: ${OLD_PID})"
      kill "${OLD_PID}" 2>/dev/null || true
      sleep 1
    fi
    rm -f "${BACKEND_PID_FILE}"
  fi
  
  if [[ -f "${FRONTEND_PID_FILE}" ]]; then
    OLD_PID=$(cat "${FRONTEND_PID_FILE}" 2>/dev/null || true)
    if [[ -n "${OLD_PID}" ]] && kill -0 "${OLD_PID}" 2>/dev/null; then
      echo "    프론트엔드 프로세스 종료 (PID: ${OLD_PID})"
      kill "${OLD_PID}" 2>/dev/null || true
      sleep 1
    fi
    rm -f "${FRONTEND_PID_FILE}"
  fi
  
  # 포트 기반으로 프로세스 종료
  echo "    포트 ${BACKEND_PORT} 사용 프로세스 종료 중..."
  lsof -ti:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true
  
  echo "    포트 ${FRONTEND_PORT} 사용 프로세스 종료 중..."
  lsof -ti:${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true
  
  # 프로세스 이름 기반으로 종료 (VM-Autoscaling 경로 포함)
  echo "    관련 프로세스 종료 중..."
  pkill -f "VM-Autoscaling.*backend.*server.js" 2>/dev/null || true
  pkill -f "VM-Autoscaling.*frontend.*vite" 2>/dev/null || true
  pkill -f "VM-Autoscaling.*frontend.*npm.*dev" 2>/dev/null || true
  
  sleep 2
  echo "[+] 기존 서비스 종료 완료"
  echo ""
}

# 기존 서비스 종료
stop_existing_services

# 기존 로그 파일 백업 (선택사항)
if [[ -f "${BACKEND_LOG}" ]]; then
  mv "${BACKEND_LOG}" "${LOG_DIR}/backend_${TIMESTAMP}.log" 2>/dev/null || true
fi
if [[ -f "${FRONTEND_LOG}" ]]; then
  mv "${FRONTEND_LOG}" "${LOG_DIR}/frontend_${TIMESTAMP}.log" 2>/dev/null || true
fi

# 백엔드 실행 (백그라운드, 로그 저장)
echo "[+] 백엔드 서버 시작 중... (로그: ${BACKEND_LOG})"
pushd "${ROOT_DIR}/backend" >/dev/null
  PORT="${BACKEND_PORT}" \
  F5_SERVERS="${F5_SERVERS}" \
  F5_USER="${F5_USER}" \
  F5_PASSWORD="${F5_PASSWORD}" \
  F5_PARTITION="${F5_PARTITION}" \
  nohup npm run dev > "${BACKEND_LOG}" 2>&1 &
  BACKEND_PID=$!
  echo "${BACKEND_PID}" > "${BACKEND_PID_FILE}"
  echo "    백엔드 PID: ${BACKEND_PID}"
popd >/dev/null

# 프론트엔드 실행 (백그라운드, 로그 저장)
echo "[+] 프론트엔드 서버 시작 중... (로그: ${FRONTEND_LOG})"
pushd "${ROOT_DIR}/frontend" >/dev/null
  PORT="${FRONTEND_PORT}" nohup npm run dev -- --host 0.0.0.0 --port ${FRONTEND_PORT} > "${FRONTEND_LOG}" 2>&1 &
  FRONTEND_PID=$!
  echo "${FRONTEND_PID}" > "${FRONTEND_PID_FILE}"
  echo "    프론트엔드 PID: ${FRONTEND_PID}"
popd >/dev/null

# 서버 시작 대기
sleep 3

# 서버 실행 확인
echo ""
echo "[+] 서버 실행 확인 중..."
if kill -0 "${BACKEND_PID}" 2>/dev/null; then
  echo "    ✅ 백엔드 실행 중 (PID: ${BACKEND_PID})"
else
  echo "    ❌ 백엔드 실행 실패"
  echo "    로그 확인: tail -20 ${BACKEND_LOG}"
fi

if kill -0 "${FRONTEND_PID}" 2>/dev/null; then
  echo "    ✅ 프론트엔드 실행 중 (PID: ${FRONTEND_PID})"
else
  echo "    ❌ 프론트엔드 실행 실패"
  echo "    로그 확인: tail -20 ${FRONTEND_LOG}"
fi

echo ""
echo "✅ 서버가 백그라운드로 시작되었습니다!"
echo "   - Backend: http://localhost:${BACKEND_PORT}"
echo "   - Frontend: http://localhost:${FRONTEND_PORT}"
echo ""
echo "로그 확인:"
echo "   - Backend: tail -f ${BACKEND_LOG}"
echo "   - Frontend: tail -f ${FRONTEND_LOG}"
echo ""
echo "서버 종료:"
echo "   - ./scripts/stop-dev.sh"
echo "   - 또는: kill \$(cat ${BACKEND_PID_FILE}) \$(cat ${FRONTEND_PID_FILE})"
echo ""
