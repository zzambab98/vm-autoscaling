# Node Exporter 설치 및 PLG Stack 모니터링 등록 UI

**작성일**: 2025-11-20  
**버전**: 1.0

---

## 📋 개요

Node Exporter 설치와 PLG Stack 모니터링 등록을 위한 웹 UI를 개발했습니다.

---

## 🚀 실행 방법

### 1. Backend 서버 실행

```bash
cd backend
npm install
npm run dev
```

Backend 서버는 `http://localhost:4000`에서 실행됩니다.

### 2. Frontend 서버 실행

```bash
cd frontend
npm install
npm run dev
```

Frontend 서버는 `http://localhost:5173`에서 실행됩니다.

### 3. 통합 실행 (스크립트 사용)

```bash
./scripts/run-dev.sh
```

---

## 🎯 기능

### 1. Node Exporter 설치 화면

- **서버 목록 표시**: 테스트 서버 목록 (auto-vm-test-01, auto-vm-test-02)
- **SSH 설정**: SSH 사용자 및 Key 경로 입력
- **상태 확인**: 각 서버의 Node Exporter 설치 상태 확인
- **개별 설치**: 서버별로 개별 설치 가능
- **일괄 설치**: 모든 서버에 한 번에 설치
- **실시간 상태**: 설치 후 자동으로 상태 업데이트

### 2. PLG Stack 모니터링 등록 화면

- **Job 설정**: Prometheus Job 이름 및 Labels 설정
- **Target 관리**: 모니터링할 서버 목록 추가/삭제
- **Job 등록**: Prometheus 설정 파일에 자동 추가
- **상태 확인**: Target 상태 및 Health Check 결과 확인
- **Job 목록**: 등록된 모든 Job 목록 조회

---

## 📡 API 엔드포인트

### Node Exporter API

- `POST /api/node-exporter/install` - Node Exporter 설치
- `GET /api/node-exporter/status?serverIp=...` - 설치 상태 확인

### Prometheus API

- `POST /api/prometheus/jobs` - Prometheus Job 추가
- `GET /api/prometheus/jobs` - Job 목록 조회
- `GET /api/prometheus/targets?jobName=...` - Target 상태 확인

---

## 🔧 설정

### Backend 환경 변수

`.env` 파일 생성 (또는 환경 변수 설정):

```bash
PORT=4000
PLG_STACK_SERVER=10.255.1.254
PLG_STACK_USER=ubuntu
PLG_STACK_SSH_KEY=/path/to/ssh/key
```

### Frontend 환경 변수

`frontend/.env` 파일 생성:

```bash
VITE_API_URL=http://localhost:4000
```

---

## 📝 사용 방법

### 1. Node Exporter 설치

1. **Node Exporter 설치** 탭 선택
2. SSH 사용자 및 Key 경로 입력
3. **전체 상태 확인** 버튼으로 현재 상태 확인
4. **전체 설치** 버튼으로 모든 서버에 설치
   - 또는 개별 서버의 **설치** 버튼으로 개별 설치

### 2. PLG Stack 모니터링 등록

1. **PLG Stack 모니터링 등록** 탭 선택
2. Job 이름 입력 (예: `auto-vm-test-service`)
3. Labels 설정 (instance, service, environment)
4. Target 목록 설정:
   - IP 주소와 포트 입력
   - 체크박스로 활성화/비활성화
   - **추가** 버튼으로 새 Target 추가
5. **Prometheus Job 등록** 버튼 클릭
6. **Target 상태 확인** 버튼으로 등록 상태 확인

---

## 🐛 문제 해결

### Backend 서버가 시작되지 않음

- Node.js 버전 확인 (v16 이상 권장)
- `npm install` 실행 확인
- 포트 4000이 사용 중인지 확인

### Frontend 서버가 시작되지 않음

- `npm install` 실행 확인
- 포트 5173이 사용 중인지 확인

### SSH 연결 실패

- SSH Key 경로 확인
- SSH Key 권한 확인 (`chmod 600`)
- 서버 접속 가능 여부 확인

### Prometheus 설정 파일 수정 실패

- PLG Stack 서버 SSH 접속 가능 여부 확인
- Prometheus 설정 파일 경로 확인
- Docker 컨테이너 권한 확인

---

## 📦 파일 구조

```
VM-Autoscaling/
├── backend/
│   ├── src/
│   │   ├── server.js                    # 메인 서버
│   │   └── services/
│   │       ├── nodeExporterService.js   # Node Exporter 설치 서비스
│   │       └── prometheusMonitoringService.js  # Prometheus 연동 서비스
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                      # 메인 앱
│   │   ├── components/
│   │   │   ├── NodeExporterInstall.jsx  # Node Exporter 설치 컴포넌트
│   │   │   └── PrometheusMonitoring.jsx # Prometheus 등록 컴포넌트
│   │   └── services/
│   │       └── api.js                   # API 클라이언트
│   └── package.json
└── scripts/
    └── run-dev.sh                       # 개발 서버 실행 스크립트
```

---

## ✅ 다음 단계

1. **테스트**: 실제 서버에서 Node Exporter 설치 및 Prometheus 등록 테스트
2. **에러 처리 개선**: 더 상세한 에러 메시지 및 로깅
3. **UI 개선**: 로딩 상태, 진행률 표시 등
4. **인증 추가**: 사용자 인증 및 권한 관리

---

**작성자**: Dana Cloud Automation Team  
**최종 수정일**: 2025-11-20

