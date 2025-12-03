# 오토스케일링 테스트 가이드

## 테스트 환경
- 서비스: auto-vm-test-service
- Prometheus Job: auto-vm-test-service-job
- 최소 VM 수: 2
- 최대 VM 수: 4

## 스케일아웃 조건
- CPU 임계값: 80%
- Memory 임계값: 80%
- 지속 시간: 1분
- 조건: 한 대라도 임계치 초과 시 스케일아웃

## 스케일인 조건
- CPU 임계값: 30%
- Memory 임계값: 30%
- 지속 시간: 10분
- 조건: 모든 서버가 임계치 이하여야 스케일인

## 테스트 순서

### 1단계: 스케일아웃 테스트

#### 1.1 현재 상태 확인
```bash
# Prometheus에서 현재 VM 목록 확인
curl -s "http://10.255.1.254:9090/api/v1/targets" | \
  python3 -c "import sys, json; data = json.load(sys.stdin); \
  targets = [t for t in data.get('data', {}).get('activeTargets', []) \
             if t.get('labels', {}).get('job') == 'auto-vm-test-service-job']; \
  print(f'현재 VM 개수: {len(targets)}'); \
  [print(f'  - {t.get(\"labels\", {}).get(\"instance\")}') for t in targets]"
```

#### 1.2 서버에 부하 주기
```bash
# 각 VM에 SSH 접속하여 CPU/Memory 부하 생성
# 예: stress-ng 사용
ssh -i /path/to/key ubuntu@<VM_IP> "sudo apt-get update && sudo apt-get install -y stress-ng"
ssh -i /path/to/key ubuntu@<VM_IP> "stress-ng --cpu 4 --timeout 300s &"
```

#### 1.3 Prometheus 메트릭 확인
```bash
# CPU 사용률 확인
curl -s "http://10.255.1.254:9090/api/v1/query?query=100%20-%20(avg%20by%20(instance)%20(rate(node_cpu_seconds_total{mode=\"idle\",job=\"auto-vm-test-service-job\"}[5m]))%20*%20100)" | python3 -m json.tool

# Memory 사용률 확인
curl -s "http://10.255.1.254:9090/api/v1/query?query=(1%20-%20(avg%20by%20(instance)%20(node_memory_MemAvailable_bytes{job=\"auto-vm-test-service-job\"})%20/%20avg%20by%20(instance)%20(node_memory_MemTotal_bytes{job=\"auto-vm-test-service-job\"})))%20*%20100" | python3 -m json.tool
```

#### 1.4 Alert 확인
```bash
# Prometheus Alert 확인
curl -s "http://10.255.1.254:9090/api/v1/alerts" | python3 -m json.tool | grep -A 10 "auto-vm-test-service"

# Alertmanager Alert 확인
curl -s "http://10.255.1.254:9093/api/v2/alerts" | python3 -m json.tool | grep -A 10 "auto-vm-test-service"
```

#### 1.5 Jenkins 파이프라인 실행 확인
- Jenkins UI에서 `plg-autoscale-out` 파이프라인 실행 로그 확인
- VM 생성 확인
- F5 Pool에 추가 확인

### 2단계: 스케일인 테스트

#### 2.1 부하 제거
```bash
# stress-ng 프로세스 종료
ssh -i /path/to/key ubuntu@<VM_IP> "sudo pkill stress-ng"
```

#### 2.2 메트릭 확인 (10분 이상 모니터링)
- CPU/Memory 사용률이 30% 이하로 유지되는지 확인
- 모든 서버가 조건을 만족하는지 확인

#### 2.3 스케일인 Alert 확인
- 10분 후 스케일인 Alert 발생 확인
- Alertmanager가 `plg-autoscale-in` 파이프라인 호출 확인

#### 2.4 Jenkins 파이프라인 실행 확인
- Jenkins UI에서 `plg-autoscale-in` 파이프라인 실행 로그 확인
- VM 선택 및 제거 확인
- F5 Pool에서 제거 확인
- Prometheus target 제거 확인
- vCenter에서 VM 삭제 확인

## 체크리스트

### 스케일아웃 테스트
- [ ] 현재 VM 개수 확인
- [ ] 부하 생성 (CPU/Memory 80% 이상)
- [ ] 1분 이상 지속 확인
- [ ] Alert 발생 확인
- [ ] Jenkins 파이프라인 실행 확인
- [ ] 새 VM 생성 확인
- [ ] F5 Pool에 추가 확인
- [ ] Prometheus target 추가 확인

### 스케일인 테스트
- [ ] 부하 제거
- [ ] CPU/Memory 30% 이하로 유지 (10분 이상)
- [ ] 모든 서버가 조건 만족 확인
- [ ] 스케일인 Alert 발생 확인
- [ ] Jenkins 파이프라인 실행 확인
- [ ] VM 선택 및 제거 확인
- [ ] F5 Pool에서 제거 확인
- [ ] Prometheus target 제거 확인
- [ ] vCenter에서 VM 삭제 확인
- [ ] 최소 VM 수(2) 보호 확인


