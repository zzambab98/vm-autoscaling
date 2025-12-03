# PLG Stack 관리 접속 정보

## 서버 정보

### PLG Stack 서버 (모니터링 스택)
- **서버 IP**: `10.255.1.254`
- **SSH 사용자**: `ubuntu`
- **SSH 키**: `/home/ubuntu/workspace/vm-autoscaling/pemkey/danainfra`

## 서비스 접속 정보

### 1. Prometheus
- **URL**: `http://10.255.1.254:9090`
- **설정 파일 경로**: `/mnt/plg-stack/prometheus/prometheus.yml`
- **컨테이너 재시작**: `sudo docker restart prometheus`
- **기능**:
  - 메트릭 수집 및 저장
  - Alert Rule 관리
  - Target 상태 확인

### 2. Alertmanager
- **URL**: `http://10.255.1.254:9093`
- **설정 파일 경로**: `/mnt/plg-stack/alertmanager/config/alertmanager.yml`
- **컨테이너 재시작**: `sudo docker restart alertmanager`
- **기능**:
  - Alert 라우팅 규칙 관리
  - Webhook 수신자 관리
  - Alert 그룹화 및 전송

### 3. Loki (로그 수집)
- **URL**: `http://10.255.1.254:3100`
- **Push API**: `http://10.255.1.254:3100/loki/api/v1/push`
- **기능**:
  - 로그 수집 및 저장
  - Promtail로부터 로그 수신

### 4. Grafana
- **URL**: `http://10.255.1.254:3000`
- **기능**:
  - 대시보드 관리
  - Prometheus 메트릭 시각화
  - Loki 로그 조회
- **로그 조회 가이드**: [Promtail-Loki-로그-조회-가이드.md](./Promtail-Loki-로그-조회-가이드.md)

## Promtail 관리

### Promtail 설정 파일 위치
각 서버에 설치된 Promtail의 설정 파일:
- **설정 파일**: `/etc/promtail/config.yml`
- **서비스 파일**: `/etc/systemd/system/promtail.service`
- **바이너리**: `/usr/local/bin/promtail`

### Promtail에서 Loki로 전송되는 로그 삭제

Promtail은 로그를 Loki에 전송하는 역할만 하며, Loki에 저장된 로그 데이터는 Loki에서 직접 삭제해야 합니다.

#### 방법 1: Loki API를 통한 로그 삭제
```bash
# 특정 호스트의 로그 삭제
curl -X POST "http://10.255.1.254:3100/loki/api/v1/delete" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{hostname=\"auto-vm-test-01\"}",
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-12-31T23:59:59Z"
  }'
```

#### 방법 2: Loki 설정에서 보존 기간 조정
Loki의 보존 정책을 설정하여 오래된 로그를 자동으로 삭제할 수 있습니다.

#### 방법 3: Grafana UI를 통한 로그 조회 및 필터링
Grafana Explore에서 특정 호스트의 로그를 필터링하여 조회할 수 있습니다.

## Prometheus에서 Target 삭제

### Prometheus Job 삭제
```bash
# SSH 접속
ssh -i /home/ubuntu/workspace/vm-autoscaling/pemkey/danainfra ubuntu@10.255.1.254

# Prometheus 설정 파일 확인
cat /mnt/plg-stack/prometheus/prometheus.yml

# 설정 파일 편집 (필요한 Job 제거)
sudo vi /mnt/plg-stack/prometheus/prometheus.yml

# Prometheus 컨테이너 재시작
sudo docker restart prometheus
```

### API를 통한 Job 삭제
프론트엔드 UI의 "Prometheus 모니터링" 메뉴에서 Job을 삭제할 수 있습니다.

## Alertmanager에서 라우팅 규칙 삭제

### 라우팅 규칙 삭제
```bash
# SSH 접속
ssh -i /home/ubuntu/workspace/vm-autoscaling/pemkey/danainfra ubuntu@10.255.1.254

# Alertmanager 설정 파일 확인
cat /mnt/plg-stack/alertmanager/config/alertmanager.yml

# 설정 파일 편집 (필요한 라우팅 규칙 제거)
sudo vi /mnt/plg-stack/alertmanager/config/alertmanager.yml

# Alertmanager 컨테이너 재시작
sudo docker restart alertmanager
```

### API를 통한 라우팅 규칙 삭제
프론트엔드 UI의 "Alertmanager 라우팅" 메뉴에서 라우팅 규칙을 삭제할 수 있습니다.

## Promtail 서비스 관리

### 서비스 상태 확인
```bash
# 서버에 SSH 접속 후
systemctl status promtail
```

### 서비스 중지
```bash
sudo systemctl stop promtail
sudo systemctl disable promtail
```

### 서비스 시작
```bash
sudo systemctl start promtail
sudo systemctl enable promtail
```

### Promtail 완전 삭제
프론트엔드 UI의 "Node Exporter 설치" 메뉴에서 "삭제" 버튼을 클릭하거나, 서버에서 직접 실행:

```bash
# Promtail 서비스 중지 및 비활성화
sudo systemctl stop promtail
sudo systemctl disable promtail
sudo pkill -f promtail

# 실행 파일 삭제
sudo rm -f /usr/local/bin/promtail

# 설정 디렉토리 삭제
sudo rm -rf /etc/promtail

# systemd 서비스 파일 삭제
sudo rm -f /etc/systemd/system/promtail.service

# 접속 기록 변환 스크립트 삭제
sudo rm -f /usr/local/bin/export-login-history.sh
sudo rm -f /var/log/login_history.log

# cron 작업에서 제거
(crontab -l 2>/dev/null | grep -v "export-login-history" || true) | crontab -

# systemd 리로드
sudo systemctl daemon-reload
```

## 주의사항

1. **Loki 로그 삭제**: Promtail을 삭제해도 Loki에 이미 저장된 로그는 자동으로 삭제되지 않습니다. Loki의 보존 정책에 따라 자동 삭제되거나, 수동으로 삭제해야 합니다.

2. **Prometheus Target**: Promtail은 Prometheus에 직접 등록되지 않습니다. Promtail은 Loki에만 로그를 전송합니다.

3. **설정 파일 백업**: 설정 파일을 수정하기 전에 항상 백업을 생성하세요. 코드에서 자동으로 백업을 생성하지만, 수동 작업 시에도 백업을 권장합니다.

## 문제 해결

### Promtail이 Loki에 로그를 전송하지 않는 경우
1. Promtail 서비스 상태 확인: `systemctl status promtail`
2. Promtail 설정 파일 확인: `cat /etc/promtail/config.yml`
3. Loki URL 확인: 설정 파일의 `clients.url` 값 확인
4. 네트워크 연결 확인: `curl http://10.255.1.254:3100/ready`

### Loki에 로그가 보이지 않는 경우
1. Grafana에서 Loki 데이터 소스 연결 확인
2. Loki 서비스 상태 확인: `docker ps | grep loki`
3. Promtail이 실제로 로그를 전송하는지 확인: `journalctl -u promtail -f`

