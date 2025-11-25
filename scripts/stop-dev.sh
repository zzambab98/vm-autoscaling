#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="${ROOT_DIR}/.pids"
BACKEND_PID_FILE="${PID_DIR}/backend.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend.pid"
BACKEND_PORT="${PORT:-4410}"
FRONTEND_PORT="${FRONTEND_PORT:-5520}"

echo "=== VM 오토스케일링 개발 서버 종료 ==="

# PID 파일에서 읽어서 종료
if [[ -f "${BACKEND_PID_FILE}" ]]; then
  BACKEND_PID=$(cat "${BACKEND_PID_FILE}" 2>/dev/null || true)
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    echo "[+] 백엔드 프로세스 종료 중 (PID: ${BACKEND_PID})"
    kill "${BACKEND_PID}" 2>/dev/null || true
    sleep 1
  fi
  rm -f "${BACKEND_PID_FILE}"
fi

if [[ -f "${FRONTEND_PID_FILE}" ]]; then
  FRONTEND_PID=$(cat "${FRONTEND_PID_FILE}" 2>/dev/null || true)
  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    echo "[+] 프론트엔드 프로세스 종료 중 (PID: ${FRONTEND_PID})"
    kill "${FRONTEND_PID}" 2>/dev/null || true
    sleep 1
  fi
  rm -f "${FRONTEND_PID_FILE}"
fi

# 포트 기반으로 프로세스 종료
echo "[+] 포트 ${BACKEND_PORT} 사용 프로세스 종료 중..."
lsof -ti:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true

echo "[+] 포트 ${FRONTEND_PORT} 사용 프로세스 종료 중..."
lsof -ti:${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true

# 프로세스 이름 기반으로 종료 (VM-Autoscaling 경로 포함)
echo "[+] 관련 프로세스 종료 중..."
pkill -f "VM-Autoscaling.*backend.*server.js" 2>/dev/null || true
pkill -f "VM-Autoscaling.*frontend.*vite" 2>/dev/null || true
pkill -f "VM-Autoscaling.*frontend.*npm.*dev" 2>/dev/null || true

sleep 2

# 강제 종료 (필요한 경우)
if lsof -ti:${BACKEND_PORT} > /dev/null 2>&1 || lsof -ti:${FRONTEND_PORT} > /dev/null 2>&1; then
  echo "[!] 일부 프로세스가 종료되지 않았습니다. 강제 종료합니다..."
  lsof -ti:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true
  lsof -ti:${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true
fi

echo "[+] 서버가 종료되었습니다."

