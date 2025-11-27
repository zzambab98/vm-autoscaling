# Jenkins 파이프라인 스크립트 (Linux 환경용 - govc 사용)

## 주요 변경 사항

### 1. **PowerShell/PowerCLI 제거**
- Windows 서버가 없으므로 PowerShell 스크립트 제거
- `govc` 명령어를 직접 사용하여 vCenter API 호출

### 2. **govc 사용**
- `govc`는 Linux에서 직접 사용 가능한 vCenter CLI 도구
- 이미 백엔드에서 사용 중인 도구와 동일

### 3. **주요 Stage**

#### Stage 1: Parse Alert
- Alertmanager에서 전달된 Alert 데이터 파싱
- 필수 정보 검증

#### Stage 2: Get Autoscaling Config
- 백엔드 API에서 오토스케일링 설정 조회
- Template, Network, F5 설정 정보 가져오기

#### Stage 3: Allocate IP Address
- IP Pool에서 사용 가능한 IP 주소 할당
- ping 테스트로 IP 사용 가능 여부 확인

#### Stage 4: VM Clone (govc 사용)
- `govc vm.clone` 명령어로 VM 클론
- Datastore, Resource Pool, Network 설정
- VM 전원 켜기 및 IP 주소 확인

#### Stage 5: F5 Pool Registration
- F5 API를 사용하여 Pool Member 추가
- Python 스크립트 사용

#### Stage 6: Summary
- 작업 결과 요약

## 필요한 설정

### 1. **Jenkins Credentials**
- `vcenter-url`: vCenter URL (예: `https://vc.danacloud.local`)
- `vcenter-username`: vCenter 사용자명
- `vcenter-password`: vCenter 비밀번호
- `f5-credentials`: F5 인증 정보

### 2. **환경 변수**
- `BACKEND_API_URL`: 백엔드 API URL (기본값: `http://192.168.200.30:6010`)
- `GOVC_INSECURE`: SSL 인증서 검증 비활성화 (기본값: `1`)

### 3. **필수 도구**
- `govc`: vCenter CLI 도구 (Jenkins 서버에 설치 필요)
- `python3`: F5 API 스크립트 실행용
- `/opt/scripts/f5-pool-add.py`: F5 Pool Member 추가 스크립트

## govc 설치 방법

```bash
# Jenkins 서버에서 govc 설치
wget https://github.com/vmware/govmomi/releases/latest/download/govc_linux_amd64.gz
gunzip govc_linux_amd64.gz
chmod +x govc_linux_amd64
sudo mv govc_linux_amd64 /usr/local/bin/govc
```

## 주의 사항

### 1. **IP 주소 설정**
- `govc vm.clone`은 IP 주소를 직접 설정하지 않음
- vCenter Customization Spec을 사용하거나 별도 스크립트 필요
- 현재는 VM 전원 켜기 후 IP 주소를 확인하는 방식 사용

### 2. **Customization Spec**
- IP 주소를 자동으로 설정하려면 vCenter Customization Spec 설정 필요
- 또는 VM 생성 후 별도 스크립트로 IP 설정

### 3. **F5 스크립트**
- `/opt/scripts/f5-pool-add.py` 스크립트가 존재해야 함
- 스크립트가 없으면 F5 등록 단계에서 실패

## 개선 가능한 사항

1. **IP 주소 자동 설정**: vCenter Customization Spec 통합
2. **에러 처리 강화**: 각 단계별 상세한 에러 메시지
3. **재시도 로직**: VM IP 확인 시 재시도 로직 추가
4. **롤백 기능**: 실패 시 생성된 VM 삭제

