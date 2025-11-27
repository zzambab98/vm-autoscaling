# Jenkins 파이프라인 스크립트 검토 결과

## 주요 문제점

### 1. **powershell-server 호스트명 문제**
- **문제**: `powershell-server` 호스트명이 존재하지 않아 SSH 연결 실패
- **해결**: 실제 Windows 서버 IP 주소나 호스트명으로 변경 필요
- **권장**: 환경 변수 `POWERSHELL_SERVER`로 설정 가능하도록 수정

### 2. **하드코딩된 환경 변수**
- **문제**: vCenter, F5, Network 설정이 모두 하드코딩되어 있음
- **해결**: 오토스케일링 설정에서 동적으로 가져오도록 수정
- **권장**: 백엔드 API에서 `autoscaleConfigId`로 설정 조회

### 3. **Alertmanager Payload 구조 불일치**
- **문제**: Generic Webhook Trigger 변수 파싱이 실제 Alertmanager payload와 맞지 않을 수 있음
- **현재 Alertmanager Payload 구조**:
  ```json
  {
    "receiver": "jenkins-webhook-auto-vm-test-service",
    "status": "firing",
    "alerts": [{
      "labels": {
        "alertname": "...",
        "service": "...",
        "instance": "all",  // max() 집계 사용으로 'all'로 설정됨
        "autoscaleConfigId": "..."
      }
    }]
  }
  ```
- **해결**: 변수 파싱 경로가 올바른지 확인 필요

### 4. **Config 정보 부재**
- **문제**: Alertmanager가 직접 Jenkins로 보내므로 `config` 정보가 payload에 없음
- **해결**: 백엔드 API에서 `autoscaleConfigId`로 설정 조회하도록 추가 Stage 생성

### 5. **Instance 정보 처리**
- **문제**: `instance: 'all'`로 설정되어 있어 특정 instance를 지정할 수 없음
- **해결**: VM 클론 시 모든 instance를 의미하는 것으로 처리하거나, Alert Rule 수정 필요

## 개선 사항

### 1. **오토스케일링 설정 조회 Stage 추가**
```groovy
stage('Get Autoscaling Config') {
    steps {
        script {
            // 백엔드 API에서 설정 조회
            def response = httpRequest(
                url: "${env.BACKEND_API_URL}/api/autoscaling/configs/${configId}",
                httpMode: 'GET'
            )
            def config = readJSON text: response.content
            
            // 환경 변수 설정
            env.VCENTER_TEMPLATE = config.templateName
            env.F5_POOL_NAME = config.f5?.poolName
            // ...
        }
    }
}
```

### 2. **powershell-server 호스트명 수정**
```groovy
def powershellServer = env.POWERSHELL_SERVER ?: '10.255.0.XXX'  // 실제 IP
```

### 3. **에러 처리 개선**
- 각 Stage에서 명확한 에러 메시지 제공
- F5 등록 실패 시에도 VM은 생성되었으므로 `UNSTABLE`로 처리

### 4. **변수 검증 강화**
- 필수 변수 (autoscaleConfigId, poolName 등) 검증 추가
- 누락된 경우 명확한 에러 메시지

## 수정된 스크립트

`jenkins/Jenkinsfile.autoscale.reviewed` 파일에 개선된 버전을 작성했습니다.

## 추가 확인 사항

1. **Jenkins Credential 설정**
   - `f5-credentials` Credential이 Jenkins에 등록되어 있는지 확인
   - SSH 키 (`/var/lib/jenkins/.ssh/id_rsa`)가 Windows 서버에 등록되어 있는지 확인

2. **백엔드 API 접근성**
   - Jenkins에서 백엔드 API (`http://192.168.200.30:6010`)에 접근 가능한지 확인
   - 또는 환경 변수로 설정 가능하도록 수정

3. **PowerCLI 스크립트 경로**
   - Windows 서버의 `C:\Scripts\scaleout.ps1` 경로 확인
   - 스크립트가 모든 파라미터를 올바르게 처리하는지 확인

4. **F5 스크립트 경로**
   - Linux: `/opt/scripts/f5-pool-add.py`
   - Windows: `C:\Scripts\f5-pool-add.ps1`
   - 스크립트 존재 여부 확인

