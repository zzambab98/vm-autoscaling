# Node Exporter 설치 기능 문제점 정리

## 📋 문제 목록 및 분석

### 1. Node Exporter 설치 조회가 안됨
**문제**: 상태 확인 기능이 작동하지 않음

**원인 분석**:
- `checkNodeExporterStatus` 함수가 정상적으로 작동하는지 확인 필요
- SSH 연결 문제일 가능성
- API 엔드포인트 문제일 가능성

**확인 필요 사항**:
- 백엔드 로그 확인 (`/api/node-exporter/status` API 호출 확인)
- SSH 키 및 사용자 정보 확인
- 네트워크 연결 상태 확인

**수정 방향**:
- 상태 확인 로직 검증 및 개선
- 에러 메시지 상세화
- 재시도 로직 추가

---

### 2. Node Exporter 설치가 안됨
**문제**: 설치 기능이 작동하지 않음

**원인 분석**:
- SSH 연결 실패 가능성
- 설치 스크립트 실행 권한 문제
- 네트워크 연결 문제 (wget 다운로드 실패 등)

**확인 필요 사항**:
- 백엔드 로그에서 설치 스크립트 실행 결과 확인
- SSH 연결 테스트
- 타임아웃 설정 확인 (현재 5분)

**수정 방향**:
- 설치 전 SSH 연결 테스트 추가
- 상세한 에러 로깅
- 설치 단계별 진행 상황 표시

---

### 3. VM IP 조회 문제
**문제**: `auto-vm-test-01`, `auto-vm-test-02` VM을 동시에 전원을 켰는데 1번은 IP 조회가 안됨

**원인 분석**:
- `govc vm.ip` 명령어가 VM이 부팅 중일 때 IP를 가져오지 못함
- 타임아웃이 3초로 너무 짧음 (병렬 처리로 인해)
- VM이 부팅 완료되기 전에 IP 조회 시도
- Guest Tools가 아직 초기화되지 않음

**현재 코드 문제점**:
```javascript
timeout: 3000 // 3초 타임아웃 (병렬 처리로 짧게 설정)
```
- VM 부팅 후 IP 할당까지 시간이 필요함
- Guest Tools 초기화 시간 고려 필요

**수정 방향**:
- IP 조회 재시도 로직 추가 (최대 3-5회, 간격 5-10초)
- 타임아웃 시간 증가 (10-15초)
- VM 전원 상태 확인 후 IP 조회
- IP 조회 실패 시 빈 배열 반환 (현재와 동일하지만 재시도 추가)

---

### 4. Promtail 설치 문제
**문제**: Node Exporter와 Promtail을 모두 선택하고 설치 버튼을 누르면 Node Exporter만 설치되고 Promtail은 설치가 안됨

**원인 분석**:
- `installNodeExporter` 함수 내부에서 `installPromtail` 함수를 호출하는데, 순환 참조 문제 가능성
- `installPromtail` 함수가 같은 파일에 정의되어 있지만, import/require 문제일 수 있음
- 프론트엔드에서 `installPromtail: true` 옵션을 전달하지만, 백엔드에서 제대로 처리되지 않을 수 있음

**현재 코드 흐름**:
1. 프론트엔드: `nodeExporterApi.install(serverIp, { installPromtail: true })`
2. 백엔드: `installNodeExporter` 함수에서 `installPromtail` 옵션 확인
3. 백엔드: `installPromtail` 함수 호출 (같은 파일 내)

**문제점**:
- `installPromtail` 함수가 `nodeExporterService.js`에 정의되어 있지만, 실제로는 별도 API로 호출되어야 할 수도 있음
- 프론트엔드에서 두 도구를 모두 선택했을 때, Node Exporter API만 호출하고 Promtail API를 별도로 호출하지 않음

**수정 방향**:
- **옵션 1**: Node Exporter와 Promtail을 별도로 설치하도록 변경
  - 프론트엔드에서 두 도구를 모두 선택했을 때, 각각 별도 API 호출
  - 설치 순서: Node Exporter 먼저, 그 다음 Promtail
- **옵션 2**: Node Exporter API 내부에서 Promtail도 함께 설치하도록 유지하되, 로직 수정
  - `installPromtail` 함수 호출 부분 확인 및 수정
  - 에러 처리 개선

**권장 방향**: 
- 사용자 요구사항에 따라 **옵션 1** 권장 (명확한 분리)
- UI도 두 도구를 별도로 선택/설치할 수 있도록 개선

---

### 5. Grafana 대시보드 자동 생성 문제
**문제**: Node Exporter 설치 후 자동으로 Grafana 대시보드가 생성되어야 하는데 생성이 안됨

**원인 분석**:
- Grafana 대시보드 생성은 `prometheusMonitoringService.addPrometheusJob` 함수 내부에서 수행됨
- 하지만 `nodeExporterService.installNodeExporter` 함수에서 `autoRegisterPrometheus` 옵션이 기본값 `false`
- 프론트엔드에서 `autoRegisterPrometheus: true` 옵션을 전달하지 않음

**현재 코드 흐름**:
1. `installNodeExporter` 함수에서 `autoRegisterPrometheus` 확인 (기본값: false)
2. `autoRegisterPrometheus`가 true일 때만 `addPrometheusJob` 호출
3. `addPrometheusJob` 내부에서 Grafana 대시보드 생성

**문제점**:
- 프론트엔드에서 `autoRegisterPrometheus` 옵션을 전달하지 않음
- 기본값이 false로 설정되어 있어서 자동 등록이 안됨

**수정 방향**:
- 프론트엔드에서 Node Exporter 설치 시 `autoRegisterPrometheus: true` 옵션 전달
- 또는 백엔드에서 기본값을 `true`로 변경 (환경 변수로 제어 가능하도록)
- Grafana 대시보드 생성 실패 시에도 상세한 에러 로그 출력

---

### 6. 하드코딩 제거
**문제**: 코드에 하드코딩된 값들이 있음

**현재 하드코딩된 부분**:
1. ✅ **SSH 키 경로** - 이미 수정 완료 (환경 변수로 변경)
2. ✅ **SSH 사용자 기본값** - 이미 수정 완료 (환경 변수로 변경)
3. ❌ **Node Exporter 버전** (`nodeExporterVersion = '1.7.0'`) - 환경 변수로 변경 필요
4. ❌ **Promtail 버전** - 환경 변수로 변경 필요
5. ❌ **Grafana URL/사용자/비밀번호** - 일부 환경 변수 사용 중이지만 기본값 하드코딩
6. ❌ **포트 번호** (9100, 9080 등) - 환경 변수로 변경 필요
7. ❌ **타임아웃 값** (3000ms, 300000ms 등) - 환경 변수로 변경 필요

**수정 방향**:
- 모든 하드코딩된 값을 환경 변수로 변경
- 환경 변수 기본값은 `nodemon.json` 또는 `.env` 파일에서 관리
- 프로덕션 환경에서는 환경 변수 필수로 설정

---

## 🔧 수정 우선순위

1. **높음**: 
   - 문제 4 (Promtail 설치 문제) - 사용자 경험에 직접 영향
   - 문제 5 (Grafana 대시보드 자동 생성) - 핵심 기능
   - 문제 3 (VM IP 조회 문제) - 데이터 정확성

2. **중간**:
   - 문제 1, 2 (조회/설치 문제) - 디버깅 후 수정
   - 문제 6 (하드코딩 제거) - 점진적 개선

---

## ✅ 수정 완료 사항

### 1. Promtail 설치 로직 수정 ✅
- **수정 내용**: Node Exporter와 Promtail을 별도 API로 분리
- **변경 파일**: `frontend/src/components/NodeExporterInstall.jsx`
- **주요 변경**:
  - `installOnServer`: Node Exporter와 Promtail을 순차적으로 별도 API 호출
  - `installOnAll`: 동일하게 별도 API 호출로 변경
  - 각 설치 결과를 개별적으로 확인하고 메시지 표시

### 2. Grafana 대시보드 자동 생성 활성화 ✅
- **수정 내용**: 프론트엔드에서 `autoRegisterPrometheus: true` 옵션 전달
- **변경 파일**: `frontend/src/components/NodeExporterInstall.jsx`
- **주요 변경**:
  - Node Exporter 설치 시 `autoRegisterPrometheus: true` 옵션 추가
  - Prometheus Job 등록 시 Grafana 대시보드 자동 생성

### 3. VM IP 조회 개선 ✅
- **수정 내용**: 재시도 로직 추가 및 타임아웃 증가
- **변경 파일**: `backend/src/services/templateService.js`
- **주요 변경**:
  - VM 전원 상태 확인 후 IP 조회
  - 전원이 켜진 경우 최대 3회 재시도 (5초 간격)
  - 타임아웃 3초 → 15초로 증가
  - 전원이 꺼진 경우 1회만 시도

### 4. 상태 확인 및 설치 에러 처리 개선 ✅
- **수정 내용**: 상세한 로깅 및 사용자 친화적인 에러 메시지
- **변경 파일**: `backend/src/services/nodeExporterService.js`
- **주요 변경**:
  - SSH 연결 테스트 추가 (설치/상태 확인 전)
  - 타임아웃, 인증 실패, 연결 실패 등 구체적인 에러 메시지
  - 상세한 에러 로깅 (디버깅용)
  - 환경 변수로 타임아웃 설정 가능

### 5. 하드코딩 제거 ✅
- **수정 내용**: 모든 하드코딩된 값을 환경 변수로 변경
- **변경 파일**: 
  - `backend/src/services/nodeExporterService.js`
  - `backend/nodemon.json`
- **주요 변경**:
  - Node Exporter 버전: `NODE_EXPORTER_VERSION` (기본값: 1.7.0)
  - Node Exporter 포트: `NODE_EXPORTER_PORT` (기본값: 9100)
  - Promtail 버전: `PROMTAIL_VERSION` (기본값: 2.9.3)
  - Promtail 포트: `PROMTAIL_PORT` (기본값: 9080)
  - SSH 사용자: `DEFAULT_SSH_USER` (기본값: ubuntu)
  - 설치 타임아웃: `NODE_EXPORTER_INSTALL_TIMEOUT` (기본값: 300000ms)
  - 상태 확인 타임아웃: `NODE_EXPORTER_STATUS_CHECK_TIMEOUT` (기본값: 15000ms)
  - Loki URL: `LOKI_URL`
  - Grafana 설정: `GRAFANA_USER`, `GRAFANA_PASSWORD`, `GRAFANA_PROMETHEUS_DATASOURCE`

## 📝 수정 계획 요약

### ✅ 완료된 수정
1. ✅ **Promtail 설치 로직 수정** - Node Exporter와 Promtail을 별도 API로 분리
2. ✅ **Grafana 대시보드 자동 생성 활성화** - `autoRegisterPrometheus: true` 옵션 추가
3. ✅ **VM IP 조회 개선** - 재시도 로직 추가 및 타임아웃 증가
4. ✅ **하드코딩 제거** - 환경 변수로 모든 설정값 이동
5. ✅ **에러 처리 개선** - 상세한 로깅 및 사용자 친화적인 에러 메시지

---

## 🧪 테스트 계획

각 문제 수정 후 다음 테스트 수행:
1. Node Exporter 단독 설치 테스트
2. Promtail 단독 설치 테스트
3. Node Exporter + Promtail 동시 설치 테스트
4. VM IP 조회 테스트 (부팅 직후)
5. Grafana 대시보드 자동 생성 테스트
6. 상태 확인 기능 테스트

