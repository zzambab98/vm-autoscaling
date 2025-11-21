# Node Exporter 설치 가이드

**작성일**: 2025-11-20  
**버전**: 1.0  
**대상 서버**: auto-vm-test-01, auto-vm-test-02

---

## 📋 개요

Prometheus가 VM 리소스(CPU, Memory, Disk 등)를 모니터링하기 위해 각 서버에 Node Exporter를 설치해야 합니다.

---

## 🔧 설치 방법

### 방법 1: systemd 서비스로 설치 (권장)

#### 1. Node Exporter 다운로드 및 설치

```bash
# 서버에 SSH 접속
ssh ubuntu@10.255.48.230  # 또는 10.255.48.231

# Node Exporter 다운로드
cd /tmp
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz

# 압축 해제
tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz

# 실행 파일 복사
sudo cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/

# 실행 권한 부여
sudo chmod +x /usr/local/bin/node_exporter
```

#### 2. systemd 서비스 파일 생성

```bash
# 서비스 파일 생성
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/local/bin/node_exporter
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# systemd 리로드
sudo systemctl daemon-reload

# 서비스 시작
sudo systemctl start node_exporter

# 자동 시작 설정
sudo systemctl enable node_exporter

# 서비스 상태 확인
sudo systemctl status node_exporter
```

#### 3. 방화벽 설정 (필요 시)

```bash
# UFW 사용 시
sudo ufw allow 9100/tcp

# 또는 iptables 사용 시
sudo iptables -A INPUT -p tcp --dport 9100 -j ACCEPT
```

#### 4. 메트릭 확인

```bash
# 로컬에서 확인
curl http://localhost:9100/metrics

# 다른 서버에서 확인
curl http://10.255.48.230:9100/metrics
curl http://10.255.48.231:9100/metrics
```

---

### 방법 2: Docker로 설치 (선택사항)

```bash
# Docker 설치 확인
docker --version

# Node Exporter 컨테이너 실행
docker run -d \
  --name=node_exporter \
  --restart=always \
  -p 9100:9100 \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /:/rootfs:ro \
  prom/node-exporter \
  --path.procfs=/host/proc \
  --path.sysfs=/host/sys \
  --collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)
```

---

## ✅ 설치 확인

### 1. 서비스 상태 확인

```bash
# 서비스 상태
sudo systemctl status node_exporter

# 예상 출력:
# ● node_exporter.service - Node Exporter
#    Loaded: loaded (/etc/systemd/system/node_exporter.service; enabled)
#    Active: active (running) since ...
```

### 2. 포트 확인

```bash
# 포트 리스닝 확인
sudo netstat -tlnp | grep 9100
# 또는
sudo ss -tlnp | grep 9100

# 예상 출력:
# tcp6  0  0 :::9100  :::*  LISTEN  12345/node_exporter
```

### 3. 메트릭 확인

```bash
# 기본 메트릭 확인
curl http://localhost:9100/metrics | head -20

# CPU 메트릭 확인
curl http://localhost:9100/metrics | grep node_cpu

# Memory 메트릭 확인
curl http://localhost:9100/metrics | grep node_memory
```

---

## 🔍 문제 해결

### 문제 1: 서비스가 시작되지 않음

```bash
# 로그 확인
sudo journalctl -u node_exporter -n 50

# 실행 파일 경로 확인
which node_exporter
ls -la /usr/local/bin/node_exporter

# 권한 확인
sudo chmod +x /usr/local/bin/node_exporter
```

### 문제 2: 포트가 열리지 않음

```bash
# 방화벽 상태 확인
sudo ufw status
# 또는
sudo iptables -L -n | grep 9100

# 방화벽 규칙 추가
sudo ufw allow 9100/tcp
```

### 문제 3: 메트릭이 조회되지 않음

```bash
# 서비스 재시작
sudo systemctl restart node_exporter

# 네트워크 연결 확인
curl -v http://localhost:9100/metrics

# 다른 서버에서 접속 테스트
curl http://10.255.48.230:9100/metrics
```

---

## 📝 두 서버 모두 설치

다음 스크립트를 사용하여 두 서버에 동시에 설치할 수 있습니다:

```bash
#!/bin/bash

# 서버 목록
SERVERS=("10.255.48.230" "10.255.48.231")
SSH_USER="ubuntu"
SSH_KEY="/path/to/ssh/key"  # SSH 키 경로 (선택사항)

for SERVER in "${SERVERS[@]}"; do
    echo "Installing Node Exporter on $SERVER..."
    
    ssh $SSH_USER@$SERVER << 'ENDSSH'
        # Node Exporter 다운로드 및 설치
        cd /tmp
        wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
        tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz
        sudo cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
        sudo chmod +x /usr/local/bin/node_exporter
        
        # systemd 서비스 파일 생성
        sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/local/bin/node_exporter
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
        
        # 서비스 시작
        sudo systemctl daemon-reload
        sudo systemctl start node_exporter
        sudo systemctl enable node_exporter
        
        # 방화벽 설정
        sudo ufw allow 9100/tcp || sudo iptables -A INPUT -p tcp --dport 9100 -j ACCEPT
        
        # 확인
        sleep 2
        curl http://localhost:9100/metrics | head -5
ENDSSH
    
    echo "Node Exporter installed on $SERVER"
done

echo "All servers configured!"
```

---

## ✅ 설치 완료 확인

두 서버 모두 설치 후 다음 명령어로 확인:

```bash
# 서버 1 확인
curl http://10.255.48.230:9100/metrics | head -10

# 서버 2 확인
curl http://10.255.48.231:9100/metrics | head -10
```

모든 서버에서 메트릭이 정상적으로 조회되면 설치 완료입니다.

---

**작성자**: Dana Cloud Automation Team  
**최종 수정일**: 2025-11-20

