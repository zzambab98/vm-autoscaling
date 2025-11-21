# F5 L4 Pool 확인 가이드

**작성일**: 2025-11-20  
**버전**: 1.0  
**대상 Pool**: auto-vm-test-pool

---

## 📋 개요

F5 L4 Pool의 상세 정보를 확인하여 오토스케일링 설정에 필요한 정보를 수집합니다.

---

## 🔍 F5 Pool 정보 확인 방법

### 방법 1: F5 BIG-IP Web UI에서 확인

1. F5 BIG-IP Web UI 접속
   - URL: `https://10.255.1.80` (또는 F5 서버 IP)
   - 로그인: admin / (비밀번호)

2. Pool 정보 확인
   - **Local Traffic** → **Pools** → **Pool List**
   - `auto-vm-test-pool` 선택
   - Pool 상세 정보 확인

3. Virtual Server 정보 확인
   - **Local Traffic** → **Virtual Servers** → **Virtual Server List**
   - Pool과 연결된 Virtual Server 찾기
   - VIP 주소 및 포트 확인

### 방법 2: F5 iControl REST API로 확인

```bash
# F5 서버 정보
F5_SERVER="10.255.1.80"
F5_USER="admin"
F5_PASSWORD="your_password"

# 인증 토큰 획득
TOKEN=$(curl -sk -X POST \
  "https://${F5_SERVER}/mgmt/shared/authn/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${F5_USER}\",\"password\":\"${F5_PASSWORD}\",\"loginProviderName\":\"tmos\"}" \
  | jq -r '.token.token')

# Pool 정보 조회
curl -sk -H "X-F5-Auth-Token: ${TOKEN}" \
  "https://${F5_SERVER}/mgmt/tm/ltm/pool/~Common~auto-vm-test-pool" \
  | jq '.'

# Pool Member 목록 조회
curl -sk -H "X-F5-Auth-Token: ${TOKEN}" \
  "https://${F5_SERVER}/mgmt/tm/ltm/pool/~Common~auto-vm-test-pool/members" \
  | jq '.'

# Virtual Server 정보 조회 (Pool과 연결된 VS 찾기)
curl -sk -H "X-F5-Auth-Token: ${TOKEN}" \
  "https://${F5_SERVER}/mgmt/tm/ltm/virtual" \
  | jq '.items[] | select(.pool == "/Common/auto-vm-test-pool")'
```

### 방법 3: Python 스크립트로 확인

```python
#!/usr/bin/env python3
import requests
import json
import sys

F5_SERVER = "10.255.1.80"
F5_USER = "admin"
F5_PASSWORD = "your_password"
POOL_NAME = "auto-vm-test-pool"

# 인증
auth_url = f"https://{F5_SERVER}/mgmt/shared/authn/login"
auth_data = {
    "username": F5_USER,
    "password": F5_PASSWORD,
    "loginProviderName": "tmos"
}

response = requests.post(auth_url, json=auth_data, verify=False)
token = response.json()['token']['token']

headers = {
    "X-F5-Auth-Token": token,
    "Content-Type": "application/json"
}

# Pool 정보 조회
pool_url = f"https://{F5_SERVER}/mgmt/tm/ltm/pool/~Common~{POOL_NAME}"
pool_response = requests.get(pool_url, headers=headers, verify=False)
pool_data = pool_response.json()

print("=== Pool 정보 ===")
print(f"Pool 이름: {pool_data['name']}")
print(f"Load Balancing: {pool_data.get('loadBalancingMode', 'N/A')}")
print(f"Monitor: {pool_data.get('monitor', 'N/A')}")

# Pool Member 조회
members_url = f"{pool_url}/members"
members_response = requests.get(members_url, headers=headers, verify=False)
members_data = members_response.json()

print("\n=== Pool Member 목록 ===")
for member in members_data.get('items', []):
    print(f"Member: {member['name']}")
    print(f"  Address: {member.get('address', 'N/A')}")
    print(f"  Port: {member.get('port', 'N/A')}")
    print(f"  State: {member.get('state', 'N/A')}")

# Virtual Server 조회
vs_url = f"https://{F5_SERVER}/mgmt/tm/ltm/virtual"
vs_response = requests.get(vs_url, headers=headers, verify=False)
vs_list = vs_response.json()

print("\n=== 연결된 Virtual Server ===")
for vs in vs_list.get('items', []):
    if vs.get('pool') == f"/Common/{POOL_NAME}":
        print(f"Virtual Server 이름: {vs['name']}")
        print(f"Destination: {vs.get('destination', 'N/A')}")
        print(f"VIP: {vs.get('destination', '').split('/')[-1]}")
        print(f"Port: {vs.get('destination', '').split(':')[-1] if ':' in vs.get('destination', '') else 'N/A'}")
```

---

## 📝 확인해야 할 정보

### 1. Pool 기본 정보
- [x] Pool 이름: `auto-vm-test-pool`
- [x] Load Balancing 알고리즘: `Round Robin`
- [x] Health Monitor 타입: `HTTP` (`/Common/http`)
- [x] Health Check 간격: `5초`
- [x] Health Check 타임아웃: `16초`
- [x] VLAN 이름: `vlan_1048`

### 2. Pool Member 정보
- [ ] 기존 Member 목록 확인
  - 예상: `10.255.48.230:80`, `10.255.48.231:80`
- [ ] Member 상태 확인 (available/unavailable)

### 3. Virtual Server (VIP) 정보
- [ ] Virtual Server 이름
- [ ] VIP 주소 (예: 10.255.48.100)
- [ ] VIP 포트 (예: 80)
- [ ] Virtual Server 상태

### 4. Health Check 정보
- [ ] Health Check 경로 (예: `/health`)
- [ ] Health Check 응답 확인

### 5. Self IP 정보 (선택사항)
- [ ] Self IP 주소 (VIP와 같은 서브넷)
- [ ] Self IP VLAN

---

## ✅ 확인 완료 후 정보 제공

다음 형식으로 정보를 제공해주세요:

```
VIP 정보:
- Virtual Server 이름: 
- VIP 주소: 
- VIP 포트: 

기존 Member 목록:
- 10.255.48.230:80 (auto-vm-test-01)
- 10.255.48.231:80 (auto-vm-test-02)

Health Check:
- 경로: (예: /health)
```

---

## 🔍 빠른 확인 명령어

F5 서버에 접속 가능한 경우:

```bash
# Pool Member 목록 확인
curl -sk -u admin:password \
  "https://10.255.1.80/mgmt/tm/ltm/pool/~Common~auto-vm-test-pool/members" \
  | jq '.items[] | {name: .name, address: .address, port: .port, state: .state}'

# Virtual Server 확인
curl -sk -u admin:password \
  "https://10.255.1.80/mgmt/tm/ltm/virtual" \
  | jq '.items[] | select(.pool == "/Common/auto-vm-test-pool") | {name: .name, destination: .destination}'
```

---

**작성자**: Dana Cloud Automation Team  
**최종 수정일**: 2025-11-20

