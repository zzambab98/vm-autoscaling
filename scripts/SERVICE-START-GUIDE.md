# VM Autoscaling 서비스 실행 가이드

## 빠른 시작

### 방법 1: 통합 스크립트 사용 (권장)

```bash
cd /home/ubuntu/workspace/vm-autoscaling
./scripts/start-services.sh
```

이 스크립트는 모든 환경 변수를 자동으로 설정하고 Backend/Frontend를 동시에 실행합니다.

### 방법 2: 개별 실행

#### Backend 실행

```bash
cd /home/ubuntu/workspace/vm-autoscaling/backend

# 환경 변수 설정
export VCENTER_URL="https://vc.danacloud.local"
export VCENTER_USERNAME="svc-auto"
export VCENTER_PASSWORD="11c729d250790bec23d77c6144053e7b03"
export GOVC_URL="${VCENTER_URL}"
export GOVC_USERNAME="${VCENTER_USERNAME}"
export GOVC_PASSWORD="${VCENTER_PASSWORD}"
export GOVC_INSECURE="1"
export F5_SERVERS="10.255.1.80"
export F5_USER="admin"
export F5_PASSWORD="Netcom123!@#"
export PROMETHEUS_URL="http://10.255.1.254:9090"
export ALERTMANAGER_URL="http://10.255.1.254:9093"
export GRAFANA_URL="http://10.255.1.254:3000"
export JENKINS_URL="http://10.255.0.103:8080"
export JENKINS_WEBHOOK_USER="danacloud"
export JENKINS_WEBHOOK_PASSWORD="!danacloud12"
export JENKINS_DEFAULT_WEBHOOK_TOKEN="plg-autoscale-token"
export PORT="6010"

# 실행
npm run start
```

#### Frontend 실행

```bash
cd /home/ubuntu/workspace/vm-autoscaling/frontend

# 빌드 (처음 한 번만)
npm run build

# 실행
npm run preview -- --host 0.0.0.0 --port 5520
```

또는 개발 모드:

```bash
npm run dev -- --host 0.0.0.0 --port 5520
```

## 서비스 접속

- **Backend API**: http://10.255.48.253:6010
- **Frontend UI**: http://10.255.48.253:5520
- **Health Check**: http://10.255.48.253:6010/health

## 서비스 종료

```bash
cd /home/ubuntu/workspace/vm-autoscaling
./scripts/stop-dev.sh
```

또는 PID 파일을 직접 사용:

```bash
kill $(cat /home/ubuntu/workspace/vm-autoscaling/.pids/backend.pid) \
     $(cat /home/ubuntu/workspace/vm-autoscaling/.pids/frontend.pid)
```

## 로그 확인

```bash
# Backend 로그
tail -f /home/ubuntu/workspace/vm-autoscaling/logs/backend.log

# Frontend 로그
tail -f /home/ubuntu/workspace/vm-autoscaling/logs/frontend.log
```

## 환경 변수 설명

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `VCENTER_URL` | vCenter 서버 URL | `https://vc.danacloud.local` |
| `VCENTER_USERNAME` | vCenter 사용자명 | `svc-auto` |
| `VCENTER_PASSWORD` | vCenter 비밀번호 | - |
| `F5_SERVERS` | F5 서버 주소 | `10.255.1.80` |
| `F5_USER` | F5 사용자명 | `admin` |
| `F5_PASSWORD` | F5 비밀번호 | - |
| `PROMETHEUS_URL` | Prometheus URL | `http://10.255.1.254:9090` |
| `ALERTMANAGER_URL` | Alertmanager URL | `http://10.255.1.254:9093` |
| `GRAFANA_URL` | Grafana URL | `http://10.255.1.254:3000` |
| `JENKINS_URL` | Jenkins URL | `http://10.255.0.103:8080` |
| `BACKEND_PORT` | Backend 포트 | `6010` |
| `FRONTEND_PORT` | Frontend 포트 | `5520` |

## 문제 해결

### 포트가 이미 사용 중인 경우

```bash
# 포트 사용 프로세스 확인
lsof -i :6010
lsof -i :5520

# 프로세스 종료
kill -9 <PID>
```

### 서비스가 시작되지 않는 경우

1. 로그 파일 확인
2. 환경 변수 확인
3. 의존성 설치 확인: `npm install` (backend, frontend 각각)

### Backend가 Jenkins/PLG에 접근하지 못하는 경우

- 네트워크 연결 확인
- 방화벽 규칙 확인
- Credentials 확인



