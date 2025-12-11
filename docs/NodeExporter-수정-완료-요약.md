# Node Exporter 설치 기능 수정 완료 요약

## 📋 수정 완료된 문제 목록

### ✅ 문제 1: Node Exporter 설치 조회가 안됨
**수정 내용**:
- SSH 연결 테스트 추가 (상태 확인 전)
- 타임아웃 설정을 환경 변수로 변경 (기본값: 15초)
- 상세한 에러 로깅 추가
- 사용자 친화적인 에러 메시지 생성

**변경 파일**: `backend/src/services/nodeExporterService.js`

---

### ✅ 문제 2: Node Exporter 설치가 안됨
**수정 내용**:
- SSH 연결 테스트 추가 (설치 전)
- 타임아웃 설정을 환경 변수로 변경 (기본값: 5분)
- 상세한 에러 로깅 추가
- 사용자 친화적인 에러 메시지 생성 (타임아웃, 인증 실패, 연결 실패 등)

**변경 파일**: `backend/src/services/nodeExporterService.js`

---

### ✅ 문제 3: VM IP 조회 문제
**수정 내용**:
- VM 전원 상태 확인 후 IP 조회
- 전원이 켜진 경우 최대 3회 재시도 (5초 간격)
- 타임아웃 3초 → 15초로 증가
- 전원이 꺼진 경우 1회만 시도

**변경 파일**: `backend/src/services/templateService.js`

**주요 개선사항**:
```javascript
// VM 전원 상태 확인
let isPoweredOn = false;
// ... 전원 상태 확인 로직 ...

// 전원이 켜진 경우 재시도 로직
if (isPoweredOn) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // IP 조회 시도
    // 성공 시 break
    // 실패 시 재시도 대기
  }
}
```

---

### ✅ 문제 4: Promtail 설치 문제 (중요)
**수정 내용**:
- Node Exporter와 Promtail을 별도 API로 분리
- 프론트엔드에서 두 도구를 모두 선택했을 때:
  1. Node Exporter 먼저 설치
  2. 성공하면 Promtail 설치
  3. 각각의 설치 결과를 확인하고 상태 업데이트

**변경 파일**: `frontend/src/components/NodeExporterInstall.jsx`

**주요 변경사항**:
```javascript
// Node Exporter 설치 (선택된 경우)
if (installNodeExporter) {
  const nodeExporterResult = await nodeExporterApi.install(serverIp, {
    ...sshOptions,
    autoRegisterPrometheus: true,
    installPromtail: false // Promtail은 별도로 설치
  });
  // 결과 확인 및 에러 처리
}

// Promtail 설치 (선택된 경우)
if (installPromtail) {
  const promtailResult = await promtailApi.install(serverIp, sshOptions);
  // 결과 확인 및 에러 처리
}
```

---

### ✅ 문제 5: Grafana 대시보드 자동 생성 문제 (중요)
**수정 내용**:
- 프론트엔드에서 Node Exporter 설치 시 `autoRegisterPrometheus: true` 옵션 전달
- Prometheus Job 등록 시 Grafana 대시보드 자동 생성

**변경 파일**: `frontend/src/components/NodeExporterInstall.jsx`

**주요 변경사항**:
```javascript
const nodeExporterOptions = {
  ...sshOptions,
  autoRegisterPrometheus: true, // Grafana 대시보드 자동 생성 활성화
  installPromtail: false
};
```

---

### ✅ 문제 6: 하드코딩 제거
**수정 내용**: 모든 하드코딩된 값을 환경 변수로 변경

**변경 파일**:
- `backend/src/services/nodeExporterService.js`
- `backend/nodemon.json`

**환경 변수 목록**:
| 환경 변수 | 기본값 | 설명 |
|----------|--------|------|
| `NODE_EXPORTER_VERSION` | `1.7.0` | Node Exporter 버전 |
| `NODE_EXPORTER_PORT` | `9100` | Node Exporter 포트 |
| `PROMTAIL_VERSION` | `2.9.3` | Promtail 버전 |
| `PROMTAIL_PORT` | `9080` | Promtail 포트 |
| `DEFAULT_SSH_USER` | `ubuntu` | 기본 SSH 사용자 |
| `NODE_EXPORTER_INSTALL_TIMEOUT` | `300000` | 설치 타임아웃 (ms) |
| `NODE_EXPORTER_STATUS_CHECK_TIMEOUT` | `15000` | 상태 확인 타임아웃 (ms) |
| `LOKI_URL` | `http://10.255.1.254:3100/loki/api/v1/push` | Loki 서버 URL |
| `GRAFANA_USER` | `admin` | Grafana 사용자 |
| `GRAFANA_PASSWORD` | `admin123` | Grafana 비밀번호 |
| `GRAFANA_PROMETHEUS_DATASOURCE` | `Prometheus` | Grafana Prometheus 데이터소스 이름 |

---

## 🔧 주요 개선사항

### 1. 에러 처리 개선
- SSH 연결 테스트 추가 (설치/상태 확인 전)
- 구체적인 에러 메시지:
  - 타임아웃: "설치 시간 초과: 네트워크 연결이 느리거나 서버 응답이 없습니다."
  - 인증 실패: "SSH 인증 실패: 올바른 SSH 키를 선택했는지 확인하세요."
  - 연결 실패: "서버 연결 실패: 서버 IP 주소와 네트워크 연결을 확인하세요."
- 상세한 에러 로깅 (디버깅용)

### 2. 설치 로직 개선
- Node Exporter와 Promtail을 명확하게 분리
- 각 설치 결과를 개별적으로 확인
- 설치 실패 시 명확한 메시지 표시

### 3. VM IP 조회 개선
- VM 전원 상태 확인 후 IP 조회
- 재시도 로직으로 부팅 중인 VM의 IP도 정확히 조회 가능
- 타임아웃 증가로 안정성 향상

### 4. 환경 변수 관리
- 모든 설정값을 환경 변수로 관리
- `nodemon.json`에 기본값 설정
- 프로덕션 환경에서는 환경 변수로 오버라이드 가능

---

## 🧪 테스트 권장 사항

1. **Node Exporter 단독 설치 테스트**
   - Node Exporter만 선택하고 설치
   - Grafana 대시보드 자동 생성 확인

2. **Promtail 단독 설치 테스트**
   - Promtail만 선택하고 설치
   - Loki 연결 확인

3. **Node Exporter + Promtail 동시 설치 테스트**
   - 두 도구 모두 선택하고 설치
   - 각각의 설치 결과 확인

4. **VM IP 조회 테스트**
   - VM 전원 켜기 직후 IP 조회
   - 재시도 로직 동작 확인

5. **에러 처리 테스트**
   - 잘못된 SSH 키로 설치 시도
   - 네트워크 연결 실패 시나리오
   - 타임아웃 발생 시나리오

---

## 📝 추가 개선 가능 사항

1. **설치 진행 상황 표시**
   - 설치 단계별 진행률 표시
   - 실시간 로그 스트리밍

2. **일괄 설치 개선**
   - 병렬 설치 옵션 추가
   - 실패한 서버만 재시도 기능

3. **설치 검증 강화**
   - 설치 후 자동 검증 테스트
   - 메트릭 수집 확인

4. **설정 관리 UI**
   - 환경 변수 설정 UI 추가
   - 설정값 검증 기능






