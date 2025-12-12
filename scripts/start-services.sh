#!/usr/bin/env bash
# VM Autoscaling 서비스 실행 스크립트
# 사용법: ./scripts/start-services.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT_DIR}"

# 환경 변수 설정
export VCENTER_URL="https://vc.danacloud.local"
export VCENTER_USERNAME="Administrator@VSPHERE.LOCAL"
export VCENTER_PASSWORD="VMware1!"

export GOVC_URL="${VCENTER_URL}"
export GOVC_USERNAME="${VCENTER_USERNAME}"
export GOVC_PASSWORD="${VCENTER_PASSWORD}"
export GOVC_INSECURE="1"

export F5_SERVERS="10.255.1.80"
export F5_USER="admin"
export F5_PASSWORD="Netcom123!@#"
export F5_PARTITION="Common"

export PROMETHEUS_URL="http://10.255.1.254:9090"
export ALERTMANAGER_URL="http://10.255.1.254:9093"
export GRAFANA_URL="http://10.255.1.254:3000"

export JENKINS_URL="http://10.255.0.103:8080"
export JENKINS_WEBHOOK_USER="danacloud"
export JENKINS_WEBHOOK_PASSWORD="!danacloud12"
export JENKINS_DEFAULT_WEBHOOK_TOKEN="plg-autoscale-token"
export JENKINS_DEFAULT_WEBHOOK_TOKEN_OUT="plg-autoscale-token"
export JENKINS_DEFAULT_WEBHOOK_TOKEN_IN="plg-autoscale-in-token"

export BACKEND_API_URL="http://10.255.48.253:6010"
export FRONTEND_BASE_URL="http://10.255.48.253:5520"

# PLG Stack SSH 접근 정보 (필요시)
export PLG_STACK_SERVER="10.255.1.254"
export PLG_STACK_USER="ubuntu"
export PLG_STACK_SSH_KEY="${ROOT_DIR}/pemkey/danainfra"

# 포트 설정
export BACKEND_PORT="6010"
export FRONTEND_PORT="5520"

echo "=========================================="
echo "VM Autoscaling 서비스 시작"
echo "=========================================="
echo "Backend: http://10.255.48.253:${BACKEND_PORT}"
echo "Frontend: http://10.255.48.253:${FRONTEND_PORT}"
echo ""

# 기존 서비스 종료
if [ -f "${ROOT_DIR}/scripts/stop-dev.sh" ]; then
    echo "[+] 기존 서비스 종료 중..."
    "${ROOT_DIR}/scripts/stop-dev.sh" || true
    sleep 2
fi

# run-dev.sh 실행
echo "[+] 서비스 시작 중..."
"${ROOT_DIR}/scripts/run-dev.sh"

echo ""
echo "=========================================="
echo "서비스 시작 완료"
echo "=========================================="
echo "Backend Health: curl http://localhost:${BACKEND_PORT}/health"
echo "Frontend: http://10.255.48.253:${FRONTEND_PORT}"
echo ""
echo "로그 확인:"
echo "  Backend: tail -f ${ROOT_DIR}/logs/backend.log"
echo "  Frontend: tail -f ${ROOT_DIR}/logs/frontend.log"
echo ""
echo "서비스 종료:"
echo "  ${ROOT_DIR}/scripts/stop-dev.sh"


