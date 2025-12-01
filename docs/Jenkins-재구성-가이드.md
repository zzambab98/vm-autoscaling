## Jenkins plg-autoscale-out 재구성 가이드

- 대상 서버: `http://10.255.0.103:8080`
- 관리자 계정: `danacloud / !danacloud12`
- 목적: Alertmanager 웹훅을 받아 vCenter 클론 + F5 Pool 등록 파이프라인을 재구축

### 1. Jenkins 기본 설치 및 보안
1. 서버에 Jenkins LTS 설치 후 서비스 기동.
2. 초기 관리자 비밀번호로 로그인 → `danacloud` 계정 생성.
3. `Manage Jenkins → Plugins`에서 **Generic Webhook Trigger**, **Pipeline**, **Credentials Binding** 플러그인 확인/설치.

### 2. Credentials 생성
| ID | 유형 | 값/설명 |
|----|------|---------|
| `vcenter-server` | Secret text | `https://vc.danacloud.local` |
| `vcenter-user` | Secret text | `svc-auto` |
| `vcenter-password` | Secret text | `11c729d250790bec23d77c6144053e7b03` |
| `f5-credentials` | Username+Password | `admin / Netcom123!@#` |
| (선택) `jenkins-api-token` | Secret text | Alertmanager에서 Basic Auth가 필요할 경우 |

### 3. Job 생성
1. `New Item → Pipeline → 이름: plg-autoscale-out`.
2. `General → This project is parameterized` 비활성 (웹훅 데이터로 처리).
3. `Build Triggers → Generic Webhook Trigger` 체크 후:
   - Token: `plg-autoscale-token`
   - `POST content parameters` 그대로 사용 (JSONPath).
   - `Cause` 메시지: `Alert: $alertname - Service: $service - Instance: $instance`.
4. `Pipeline` 섹션에서 **Pipeline script** 선택 후 `jenkins/Jenkinsfile.autoscale.linux` 내용 전체를 복사하여 붙여넣기.

### 4. 환경 변수 조정
`environment { ... }` 블록 상단에서 다음 값들을 실제 서버에 맞게 수정:
- `BACKEND_API_URL = 'http://<새 백엔드 IP>:6010'`
- `F5_SERVER` / `F5_PARTITION` / `F5_HEALTH_MONITOR` 필요 시 변경
- `VCENTER_RESOURCE_POOL`, `VCENTER_DATASTORE` 기본값이 새 인프라와 다르면 업데이트

### 5. 시스템 도구 설치
Jenkins 노드(또는 에이전트)에 다음 도구 설치:
```bash
sudo apt install -y python3 python3-pip jq
sudo cp /home/ubuntu/workspace/vm-autoscaling/scripts/add-f5-pool-member.py /opt/scripts/f5-pool-add.py
sudo chmod +x /opt/scripts/f5-pool-add.py
```
또한 `/usr/local/bin/govc`가 설치되어 있어야 하며, `jenkins` 사용자 권한으로 실행 가능해야 한다.

### 6. Alertmanager 웹훅 연결
- URL: `http://10.255.0.103:8080/generic-webhook-trigger/invoke?token=plg-autoscale-token`
- 인증이 필요 없지만, 네트워크 ACL로 Alertmanager 서버만 접근 허용.
- Alert Rule에서 `labels.autoscaleConfigId`가 반드시 포함되도록 Backend가 생성한 룰을 사용.

### 7. 테스트 절차
1. Jenkins UI에서 `Replay` 또는 `Build with Parameters` 대신, Alertmanager에서 테스트 Alert을 발송:
   ```bash
   curl -X POST "http://10.255.0.103:8080/generic-webhook-trigger/invoke?token=plg-autoscale-token" \
        -H "Content-Type: application/json" \
        -d @tests/sample-alert.json
   ```
   (`tests/sample-alert.json` 예제 파일에서 서비스명/Config ID를 현재 환경에 맞게 조정)
2. 파이프라인 Stage별 로그를 확인하여 vCenter/govc 호출, IP 할당, F5 등록이 정상인지 검증.
3. Jenkins 작업이 성공하면 Backend 로그에 이벤트가 기록되는지, F5 Pool에 새 멤버가 추가되었는지 확인.

### 8. 트러블슈팅
- **Backend API 연결 실패**: Jenkins 서버에서 `curl http://<backend-ip>:6010/health` 테스트, 방화벽 확인.
- **govc 인증 오류**: Credentials가 environment에 제대로 주입되었는지, `GOVC_INSECURE=1`로 설정되었는지 확인.
- **IP 할당 실패**: IP Pool 범위를 재검토하고 `scripts/get-available-ip.py` 등 보조 스크립트 활용.
- **F5 등록 실패**: `python3 /opt/scripts/f5-pool-add.py --help`로 파라미터 확인, F5 API 접근 권한 점검.


