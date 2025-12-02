## PLG Stack 재배포 가이드 (전용 서버용)

- 대상 서버: `10.255.1.254` (Prometheus/Alertmanager/Grafana 전용)
- SSH 키: `pemkey/danainfra`
- 목적: 애플리케이션 서버 재구축 시에도 기존 PLG 스택을 동일 서버에서 유지하면서 설정만 동기화

### 1. 접속 및 기본 점검
```bash
ssh -i ~/workspace/vm-autoscaling/pemkey/danainfra ubuntu@10.255.1.254
docker ps | grep -E 'prometheus|alertmanager|grafana'
```

### 2. 설정 백업
```bash
sudo mkdir -p /mnt/plg-stack/backups/$(date +%Y%m%d)
sudo cp /mnt/plg-stack/prometheus/prometheus.yml /mnt/plg-stack/backups/$(date +%Y%m%d)/
sudo cp /mnt/plg-stack/alertmanager/alertmanager.yml /mnt/plg-stack/backups/$(date +%Y%m%d)/
sudo tar czf /mnt/plg-stack/backups/$(date +%Y%m%d)/grafana.tgz /mnt/plg-stack/grafana
```

### 3. Prometheus 설정 업데이트
1. 로컬 레포(`vm-autoscaling`)에서 생성된 Job/Target 정보를 참고.
2. 전용 서버의 `/mnt/plg-stack/prometheus/prometheus.yml` 및 `/mnt/plg-stack/prometheus/file_sd/*.yml`에 변경 사항 반영.
3. 변경 후 구문 검사:
   ```bash
   promtool check config /mnt/plg-stack/prometheus/prometheus.yml
   ```
4. 컨테이너 재시작:
   ```bash
   sudo docker restart prometheus
   ```

### 4. Alertmanager 라우팅 업데이트
1. `/mnt/plg-stack/alertmanager/alertmanager.yml`에 Jenkins Webhook 수신 라우트가 존재하는지 확인.
2. Backend가 autoscaling 설정을 활성화하면 Alert Rule/Route 파일을 자동으로 생성하므로, 해당 경로(`/mnt/plg-stack/alertmanager/routes/*.yml`)가 백엔드에서 접근 가능하도록 권한 유지.
3. 변경 후:
   ```bash
   amtool check-config /mnt/plg-stack/alertmanager/alertmanager.yml
   sudo docker restart alertmanager
   ```

### 5. Grafana 자동 대시보드 동기화
1. Backend가 생성하는 대시보드 JSON 위치(`/mnt/plg-stack/grafana/dashboards`)를 확인.
2. `provisioning/dashboards/*.yml`이 해당 폴더를 가리키는지 점검.
3. Grafana 재시작:
   ```bash
   sudo docker restart grafana
   ```

### 6. Jenkins Webhook 연계 확인
1. Alertmanager Webhook URL: `http://10.255.0.103:8080/generic-webhook-trigger/invoke?token=plg-autoscale-token`
2. Alertmanager에서 Jenkins까지 통신이 되는지 `curl` 테스트:
   ```bash
   curl -X POST "http://10.255.0.103:8080/generic-webhook-trigger/invoke?token=plg-autoscale-token" \
        -H "Content-Type: application/json" \
        -d '{"service":"plg-autoscale-test","severity":"warning"}'
   ```

### 7. 검증 체크리스트
- [ ] Prometheus Targets 페이지에서 신규 Job/Target이 `UP` 상태인지 확인.
- [ ] Alertmanager Routes에 Jenkins 전용 라우트가 활성화되었는지 확인.
- [ ] Grafana 자동 생성 대시보드가 최신 상태인지 확인.
- [ ] Jenkins 파이프라인이 Alertmanager 웹훅을 수신하는지 테스트.

### 8. 참고 문서
- `docs/PLG-Stack-모니터링-등록-가이드.md`
- `docs/현재-상태-및-남은-작업.md` (Phase 5 이후 항목)








