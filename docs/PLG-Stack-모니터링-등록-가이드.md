# PLG Stack 모니터링 등록 가이드

**작성일**: 2025-11-20  
**버전**: 1.0  
**대상 서비스**: auto-vm-test-service

---

## 📋 개요

Prometheus가 테스트 서버들을 모니터링하도록 설정을 추가합니다.

---

## 🔧 Prometheus 설정 추가

### 1. PLG Stack 서버 접속

```bash
ssh -i '/Users/jhlee/Desktop/Work/Dana-Cloud-Oper/DanaIX-신규 VM 생성/00. SSH-PemKey-List/danainfra' ubuntu@10.255.1.254
```

### 2. Prometheus 설정 파일 수정

```bash
# 설정 파일 위치
sudo vi /mnt/plg-stack/prometheus/prometheus.yml
```

### 3. 새 Job 추가

`scrape_configs` 섹션에 다음 내용을 추가:

```yaml
scrape_configs:
  # ... 기존 설정 ...

  # auto-vm-test 서비스 모니터링
  - job_name: 'auto-vm-test-service'
    static_configs:
      - targets: 
          - '10.255.48.230:9100'  # auto-vm-test-01
          - '10.255.48.231:9100'  # auto-vm-test-02
        labels:
          instance: 'auto-vm-test-service'
          service: 'auto-vm-test'
          environment: 'test'
```

### 4. Prometheus 재시작

```bash
# Prometheus 컨테이너 재시작
sudo docker restart prometheus

# 재시작 확인
sudo docker ps | grep prometheus
```

### 5. 설정 확인

```bash
# Prometheus UI에서 확인
# http://10.255.1.254:9090

# Targets 페이지에서 확인
# http://10.255.1.254:9090/targets

# 또는 API로 확인
curl 'http://10.255.1.254:9090/api/v1/targets' | jq '.data.activeTargets[] | select(.labels.job=="auto-vm-test-service")'
```

---

## ✅ 등록 확인

### 1. Prometheus UI에서 확인

1. 브라우저에서 `http://10.255.1.254:9090` 접속
2. **Status** → **Targets** 메뉴 클릭
3. `auto-vm-test-service` Job이 표시되는지 확인
4. 각 Target의 상태가 **UP**인지 확인

### 2. 메트릭 조회 확인

```bash
# Prometheus API로 메트릭 조회
curl 'http://10.255.1.254:9090/api/v1/query?query=up{job="auto-vm-test-service"}'

# 예상 결과:
# {
#   "status": "success",
#   "data": {
#     "result": [
#       {
#         "metric": {
#           "instance": "10.255.48.230:9100",
#           "job": "auto-vm-test-service"
#         },
#         "value": [1234567890, "1"]
#       },
#       {
#         "metric": {
#           "instance": "10.255.48.231:9100",
#           "job": "auto-vm-test-service"
#         },
#         "value": [1234567890, "1"]
#       }
#     ]
#   }
# }
```

### 3. CPU/Memory 메트릭 확인

```bash
# CPU 사용률 확인
curl 'http://10.255.1.254:9090/api/v1/query?query=100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle",job="auto-vm-test-service"}[5m])) * 100)'

# Memory 사용률 확인
curl 'http://10.255.1.254:9090/api/v1/query?query=100 - ((node_memory_MemAvailable_bytes{job="auto-vm-test-service"} / node_memory_MemTotal_bytes{job="auto-vm-test-service"}) * 100)'
```

---

## 🚨 문제 해결

### 문제 1: Target이 DOWN 상태

**원인**: Node Exporter가 설치되지 않았거나 포트가 열리지 않음

**해결**:
```bash
# 서버에서 Node Exporter 확인
ssh ubuntu@10.255.48.230
sudo systemctl status node_exporter
curl http://localhost:9100/metrics
```

### 문제 2: 메트릭이 수집되지 않음

**원인**: 네트워크 연결 문제 또는 방화벽

**해결**:
```bash
# PLG Stack 서버에서 서버로 접속 테스트
curl http://10.255.48.230:9100/metrics
curl http://10.255.48.231:9100/metrics

# 접속이 안 되면 방화벽 확인
```

### 문제 3: 설정이 반영되지 않음

**원인**: Prometheus 컨테이너가 재시작되지 않음

**해결**:
```bash
# Prometheus 로그 확인
sudo docker logs prometheus

# 강제 재시작
sudo docker restart prometheus
```

---

## 📝 전체 설정 예시

최종 `prometheus.yml` 파일 예시:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'plg-stack-prod'
    environment: 'production'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

rule_files:
  - "/etc/prometheus/rules/*.yml"

scrape_configs:
  # Prometheus 자체 모니터링
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Alertmanager 모니터링
  - job_name: 'alertmanager'
    static_configs:
      - targets: ['alertmanager:9093']

  # Loki 모니터링
  - job_name: 'loki'
    static_configs:
      - targets: ['loki:3100']

  # nginx-test 서버 모니터링
  - job_name: 'nginx-test-01'
    static_configs:
      - targets: ['10.255.1.253:9100']
        labels:
          instance: 'nginx-test-01'
          role: 'nginx'
          environment: 'test'

  - job_name: 'nginx-test-02'
    static_configs:
      - targets: ['10.255.1.102:9100']
        labels:
          instance: 'nginx-test-02'
          role: 'nginx'
          environment: 'test'

  # auto-vm-test 서비스 모니터링 (새로 추가)
  - job_name: 'auto-vm-test-service'
    static_configs:
      - targets: 
          - '10.255.48.230:9100'  # auto-vm-test-01
          - '10.255.48.231:9100'  # auto-vm-test-02
        labels:
          instance: 'auto-vm-test-service'
          service: 'auto-vm-test'
          environment: 'test'
```

---

## ✅ 등록 완료 확인

다음 항목을 모두 확인하세요:

- [ ] Prometheus 설정 파일에 Job 추가 완료
- [ ] Prometheus 컨테이너 재시작 완료
- [ ] Prometheus UI에서 Target 상태가 UP
- [ ] CPU/Memory 메트릭이 정상적으로 수집됨
- [ ] Grafana에서 메트릭 조회 가능 (선택사항)

---

**작성자**: Dana Cloud Automation Team  
**최종 수정일**: 2025-11-20

