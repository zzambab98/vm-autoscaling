# Promtail → Loki 로그 등록 및 조회 가이드

## Promtail이 Loki에 등록되는 방식

### 1. Promtail 설치 시 등록 과정

Promtail이 설치되면 다음과 같은 과정으로 Loki에 로그를 전송합니다:

1. **Promtail 설정 파일 생성** (`/etc/promtail/config.yml`)
   - 각 서버의 호스트명(`hostname`)이 자동으로 라벨로 설정됨
   - 예: `hostname: auto-vm-test-01`, `instance: auto-vm-test-01`

2. **로그 수집 시작**
   - Promtail이 서버의 로그 파일들을 읽기 시작
   - 수집되는 로그:
     - `/var/log/auth.log` (인증 로그)
     - `/var/log/syslog` (시스템 로그)
     - `/var/log/login_history.log` (접속 기록)
     - `/var/log/cron` (크론 작업 로그)
     - 기타 시스템 로그

3. **Loki로 전송**
   - Promtail이 수집한 로그를 Loki API(`http://10.255.1.254:3100/loki/api/v1/push`)로 전송
   - 각 로그 라인에 `hostname`, `instance`, `job`, `log_type` 등의 라벨이 자동으로 붙음

### 2. 로그 라벨 구조

Promtail이 Loki에 전송하는 로그는 다음과 같은 라벨 구조를 가집니다:

```
{
  "hostname": "auto-vm-test-01",      // 서버 호스트명
  "instance": "auto-vm-test-01",      // 인스턴스명 (hostname과 동일)
  "job": "auth",                      // 로그 유형 (auth, syslog, login_history 등)
  "log_type": "authentication"       // 로그 분류
}
```

### 3. 주요 라벨 설명

- **hostname**: 서버의 호스트명 (각 서버마다 고유)
- **instance**: 인스턴스 식별자 (보통 hostname과 동일)
- **job**: 로그 소스 유형
  - `auth`: 인증 로그
  - `syslog`: 시스템 로그
  - `login_history`: 접속 기록
  - `cron`: 크론 작업 로그
  - `apache_access`, `nginx_access`: 웹 서버 접근 로그
  - 등등
- **log_type**: 로그 분류
  - `authentication`: 인증 관련
  - `system`: 시스템 관련
  - `access`: 접근 관련
  - `scheduled_task`: 예약 작업
  - 등등

## Grafana에서 호스트별 로그 조회 방법

### 방법 1: Label Browser 사용 - 의존성 필터링 (가장 추천)

Grafana의 Label Browser를 사용하면 **호스트명을 먼저 선택하면 해당 호스트의 로그 종류(job)만 자동으로 필터링**되어 표시됩니다.

1. **Grafana 접속**
   - URL: `http://10.255.1.254:3000`
   - Explore 메뉴로 이동 (왼쪽 사이드바의 컴패스 아이콘)

2. **데이터 소스 선택**
   - 상단에서 "Loki" 데이터 소스를 선택

3. **Label Browser 열기**
   - "Label browser" 버튼 클릭

4. **호스트명 선택 (첫 번째 필터)**
   - `hostname` 라벨을 클릭
   - 등록된 모든 호스트 목록이 표시됨
   - 원하는 호스트명을 클릭 (예: `auto-vm-test-01`)
   - 자동으로 `hostname="auto-vm-test-01"` 필터가 적용됨

5. **로그 종류(job) 선택 (두 번째 필터)**
   - `job` 라벨을 클릭
   - **선택한 호스트명에 해당하는 job만 자동으로 필터링되어 표시됨**
   - 예: `auto-vm-test-01`을 선택하면 해당 호스트의 `auth`, `syslog`, `login_history` 등만 표시
   - 원하는 job을 선택 (예: `auth`)

6. **로그 조회**
   - "Run query" 버튼을 클릭하면 선택한 호스트의 선택한 로그 종류만 표시됨
   - 예: `{hostname="auto-vm-test-01", job="auth"}`

**장점:**
- 호스트명을 먼저 선택하면 해당 호스트에 실제로 존재하는 로그 종류만 표시됨
- 불필요한 옵션을 선택할 수 없어 사용자 실수 방지
- 직관적이고 사용하기 쉬움

### 방법 2: Label Filters 사용 (수동 입력)

Label Browser 대신 Label Filters를 직접 사용할 수도 있습니다:

1. **Grafana Explore 접속**
   - URL: `http://10.255.1.254:3000/explore`

2. **첫 번째 필터: 호스트명**
   - "Label filters" 섹션에서:
     - Label: `hostname` 선택
     - Operator: `=` 선택
     - Value: 호스트명 입력 또는 드롭다운에서 선택 (예: `auto-vm-test-01`)

3. **두 번째 필터: 로그 종류(job)**
   - "+" 버튼을 클릭하여 필터 추가
   - Label: `job` 선택
   - Operator: `=` 선택
   - Value: 드롭다운에서 선택하면 **선택한 hostname에 해당하는 job만 표시됨**
   - 예: `auth`, `syslog`, `login_history` 등

4. **추가 필터 (선택사항)**
   - 특정 키워드 검색:
     - "Line contains" 섹션에 검색어 입력 (예: `jenkins`, `error`)

5. **쿼리 실행**
   - "Run query" 버튼 클릭

**참고:** Label Filters에서도 Value 드롭다운을 사용하면 의존성 필터링이 자동으로 적용됩니다.

### 방법 3: LogQL 쿼리 직접 입력

Grafana Explore의 쿼리 입력창에 LogQL 쿼리를 직접 입력할 수 있습니다:

```
# 특정 호스트의 모든 로그
{hostname="auto-vm-test-01"}

# 특정 호스트의 인증 로그만
{hostname="auto-vm-test-01", job="auth"}

# 특정 호스트의 로그에서 키워드 검색
{hostname="auto-vm-test-01"} |= "jenkins"

# 특정 호스트의 에러 로그만
{hostname="auto-vm-test-01"} |= "error"

# 여러 호스트의 로그 조회
{hostname=~"auto-vm-test-01|auto-vm-test-02"}

# 특정 시간 범위의 로그
{hostname="auto-vm-test-01"} [5m]
```

## 등록된 호스트 목록 확인 방법

### 방법 1: Grafana Label Browser 사용

1. Grafana Explore → Loki 데이터 소스 선택
2. "Label browser" 버튼 클릭
3. `hostname` 라벨 클릭
4. 드롭다운에서 등록된 모든 호스트 목록 확인

### 방법 2: Loki API 사용

```bash
# 등록된 모든 hostname 라벨 값 조회
curl -s "http://10.255.1.254:3100/loki/api/v1/label/hostname/values" | jq

# 등록된 모든 라벨 조회
curl -s "http://10.255.1.254:3100/loki/api/v1/labels" | jq
```

### 방법 3: Promtail 상태 확인

각 서버에서 Promtail이 정상적으로 실행 중인지 확인:

```bash
# 서버에 SSH 접속 후
systemctl status promtail

# Promtail 설정 파일 확인
cat /etc/promtail/config.yml | grep hostname
```

## 로그 조회 예시

### 예시 1: 특정 호스트의 모든 로그

```
{hostname="auto-vm-test-01"}
```

### 예시 2: 특정 호스트의 인증 로그만

```
{hostname="auto-vm-test-01", job="auth"}
```

### 예시 3: 특정 호스트의 로그에서 "jenkins" 키워드 검색

```
{hostname="auto-vm-test-01"} |= "jenkins"
```

### 예시 4: 특정 호스트의 에러 로그만

```
{hostname="auto-vm-test-01"} |= "error" or {hostname="auto-vm-test-01"} |= "ERROR"
```

### 예시 5: 여러 호스트의 로그 비교

```
{hostname=~"auto-vm-test-01|auto-vm-test-02|auto-vm-test-03"}
```

## 문제 해결

### 호스트가 목록에 나타나지 않는 경우

1. **Promtail 서비스 상태 확인**
   ```bash
   systemctl status promtail
   ```

2. **Promtail 설정 파일 확인**
   ```bash
   cat /etc/promtail/config.yml
   ```
   - `hostname` 라벨이 올바르게 설정되어 있는지 확인
   - `clients.url`이 Loki 서버 주소를 가리키는지 확인

3. **Promtail 로그 확인**
   ```bash
   journalctl -u promtail -f
   ```
   - 에러 메시지가 있는지 확인

4. **네트워크 연결 확인**
   ```bash
   curl http://10.255.1.254:3100/ready
   ```

### 로그가 표시되지 않는 경우

1. **시간 범위 확인**
   - Grafana Explore에서 시간 범위를 확인
   - 최근 로그를 보려면 "Last 1 hour" 또는 "Last 5 minutes" 선택

2. **라벨 필터 확인**
   - `hostname` 라벨 값이 정확한지 확인 (대소문자 구분)
   - 호스트명에 특수문자가 있는 경우 따옴표로 감싸기

3. **Loki 서비스 상태 확인**
   ```bash
   # PLG Stack 서버에서
   docker ps | grep loki
   docker logs loki
   ```

## Grafana 대시보드에서 변수 사용하기 (고급)

더 나은 사용자 경험을 위해 Grafana 대시보드를 만들어 변수를 사용할 수 있습니다:

### 대시보드 변수 설정

1. **새 대시보드 생성**
   - Grafana → Dashboards → New Dashboard

2. **호스트명 변수 생성**
   - Dashboard settings (톱니바퀴 아이콘) → Variables → Add variable
   - Name: `hostname`
   - Type: `Query`
   - Data source: `Loki`
   - Query: `label_values(hostname)`
   - 이렇게 하면 모든 호스트명이 드롭다운으로 표시됨

3. **로그 종류(job) 변수 생성 (의존성 필터링)**
   - Add variable
   - Name: `job`
   - Type: `Query`
   - Data source: `Loki`
   - Query: `label_values(job, hostname="$hostname")`
   - **중요:** `hostname="$hostname"`을 사용하면 선택한 호스트명에 해당하는 job만 표시됨

4. **패널에서 변수 사용**
   - 새 패널 생성 → Data source: `Loki`
   - Query: `{hostname="$hostname", job="$job"}`
   - 이제 대시보드 상단에서 호스트명과 로그 종류를 선택할 수 있음

**장점:**
- 대시보드를 저장하여 재사용 가능
- 여러 패널에서 동일한 변수 사용 가능
- 더 나은 사용자 경험 제공

## 참고사항

- **로그 보존 기간**: Loki의 설정에 따라 오래된 로그는 자동으로 삭제될 수 있습니다
- **로그 수집 지연**: Promtail이 로그를 수집하고 Loki로 전송하는 데 몇 초의 지연이 있을 수 있습니다
- **대용량 로그**: 많은 양의 로그를 조회할 때는 시간 범위를 좁히거나 필터를 추가하여 성능을 개선할 수 있습니다
- **의존성 필터링**: Grafana는 자동으로 라벨 간 의존성을 인식하여, 호스트명을 선택하면 해당 호스트의 로그 종류만 표시합니다

