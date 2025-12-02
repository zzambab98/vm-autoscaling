const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { addPrometheusJob } = require('./prometheusMonitoringService');

/**
 * Node Exporter 설치
 * @param {string} serverIp - 서버 IP 주소
 * @param {object} options - 설치 옵션
 * @returns {Promise<object>} 설치 결과
 */
async function installNodeExporter(serverIp, options = {}) {
  const {
    sshUser = 'ubuntu',
    sshKey = null,
    sshPassword = null,
    nodeExporterVersion = '1.7.0',
    autoRegisterPrometheus = false, // Prometheus 자동 등록 옵션
    prometheusJobName = null, // Job 이름 (자동 생성 또는 지정)
    prometheusLabels = {}, // 추가 labels (service, environment 등)
    installPromtail = true, // Promtail도 함께 설치 (기본값: true)
    lokiUrl = null // Loki 서버 URL
  } = options;

  try {
    // SSH 접속 명령어 구성
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      // sshpass 사용 (설치 필요)
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    // Node Exporter 설치 스크립트를 임시 파일로 전송하여 실행
    const installScript = `#!/bin/bash
set -e

# 기존 Node Exporter 서비스 중지 (이미 설치된 경우)
sudo systemctl stop node_exporter 2>/dev/null || true
sudo systemctl disable node_exporter 2>/dev/null || true

# 실행 중인 프로세스 종료
sudo pkill -f node_exporter 2>/dev/null || true
sleep 2

# Node Exporter 다운로드
cd /tmp
wget -q https://github.com/prometheus/node_exporter/releases/download/v${nodeExporterVersion}/node_exporter-${nodeExporterVersion}.linux-amd64.tar.gz

# 압축 해제
tar xvfz node_exporter-${nodeExporterVersion}.linux-amd64.tar.gz

# 실행 파일 복사 (기존 파일이 있으면 먼저 삭제)
sudo rm -f /usr/local/bin/node_exporter
sudo cp node_exporter-${nodeExporterVersion}.linux-amd64/node_exporter /usr/local/bin/
sudo chmod +x /usr/local/bin/node_exporter

# systemd 서비스 파일 생성
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<'SERVICEEOF'
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
SERVICEEOF

# systemd 리로드 및 서비스 시작
sudo systemctl daemon-reload
sudo systemctl start node_exporter
sudo systemctl enable node_exporter

# 방화벽 설정 (UFW 또는 iptables)
sudo ufw allow 9100/tcp 2>/dev/null || sudo iptables -A INPUT -p tcp --dport 9100 -j ACCEPT 2>/dev/null || true

# 설치 확인
sleep 2
curl -s http://localhost:9100/metrics | head -5 || echo "Node Exporter 설치 완료 (메트릭 확인 실패)"
`;

    // 스크립트를 base64로 인코딩하여 전송
    const scriptBase64 = Buffer.from(installScript).toString('base64');
    
    // 원격에서 스크립트를 디코딩하고 실행
    const command = `${sshCommand} "echo '${scriptBase64}' | base64 -d | bash"`;
    
    const { stdout, stderr } = await execPromise(command, {
      timeout: 300000, // 5분 타임아웃
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    const result = {
      success: true,
      serverIp: serverIp,
      message: `Node Exporter가 성공적으로 설치되었습니다.`,
      output: stdout,
      error: stderr || null,
      prometheusRegistered: false,
      promtailInstalled: false
    };

    // Promtail 설치 (기본적으로 함께 설치)
    if (installPromtail) {
      try {
        const promtailResult = await installPromtail(serverIp, {
          sshUser,
          sshKey,
          sshPassword,
          lokiUrl: lokiUrl || null
        });
        
        if (promtailResult.success) {
          result.promtailInstalled = true;
          result.message += ` Promtail도 함께 설치되었습니다.`;
          console.log(`[Node Exporter] Promtail 설치 완료: ${serverIp}`);
        } else {
          console.warn(`[Node Exporter] Promtail 설치 실패 (${serverIp}):`, promtailResult.error);
          result.message += ` (Promtail 설치 실패: ${promtailResult.error})`;
        }
      } catch (promtailError) {
        console.warn(`[Node Exporter] Promtail 설치 중 예외 발생 (${serverIp}):`, promtailError.message);
        result.message += ` (Promtail 설치 실패: ${promtailError.message})`;
      }
    }

    // Prometheus 자동 등록 옵션이 활성화된 경우
    if (autoRegisterPrometheus) {
      try {
        // Job 이름 자동 생성 또는 사용자 지정
        let finalJobName = prometheusJobName;
        if (!finalJobName) {
          // 자동 생성 규칙: serverIp의 마지막 옥텟을 사용하여 job 이름 생성
          // 예: 10.255.48.230 -> node-exporter-230 또는 사용자 지정 규칙
          const ipParts = serverIp.split('.');
          const lastOctet = ipParts[ipParts.length - 1];
          finalJobName = `node-exporter-${lastOctet}`;
        }

        // Prometheus Job 등록
        const prometheusResult = await addPrometheusJob({
          jobName: finalJobName,
          targets: [`${serverIp}:9100`],
          labels: {
            instance: serverIp,
            service: prometheusLabels.service || 'node-exporter',
            environment: prometheusLabels.environment || 'production',
            ...prometheusLabels
          }
        });

        result.prometheusRegistered = true;
        result.prometheusJobName = finalJobName;
        result.message += ` Prometheus Job '${finalJobName}'에 자동 등록되었습니다.`;
        console.log(`[Node Exporter] Prometheus 자동 등록 완료: ${serverIp} -> ${finalJobName}`);
      } catch (prometheusError) {
        // Prometheus 등록 실패해도 Node Exporter 설치 성공으로 처리
        console.warn(`[Node Exporter] Prometheus 자동 등록 실패 (${serverIp}):`, prometheusError.message);
        result.prometheusError = prometheusError.message;
        result.message += ` (Prometheus 자동 등록 실패: ${prometheusError.message})`;
      }
    }

    return result;
  } catch (error) {
    console.error(`[Node Exporter] 설치 실패 (${serverIp}):`, error);
    return {
      success: false,
      serverIp: serverIp,
      error: error.message,
      details: error.stderr || error.stdout
    };
  }
}

/**
 * Node Exporter 상태 확인
 * @param {string} serverIp - 서버 IP 주소
 * @param {object} options - SSH 옵션
 * @returns {Promise<object>} 상태 정보
 */
async function checkNodeExporterStatus(serverIp, options = {}) {
  const {
    sshUser = 'ubuntu',
    sshKey = null,
    sshPassword = null
  } = options;

  try {
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    // 상태 확인 스크립트 (Node Exporter + Promtail)
    const checkScript = `#!/bin/bash
# Node Exporter 상태
systemctl is-active node_exporter 2>/dev/null || echo "inactive"
systemctl is-enabled node_exporter 2>/dev/null || echo "disabled"
# Node Exporter 바이너리 파일 존재 확인
test -f /usr/local/bin/node_exporter && echo "binary_exists" || echo "binary_not_found"
curl -s http://localhost:9100/metrics | head -1 2>/dev/null || echo "not_responding"

# Promtail 상태
systemctl is-active promtail 2>/dev/null || echo "inactive"
systemctl is-enabled promtail 2>/dev/null || echo "disabled"
# Promtail 바이너리 파일 존재 확인
test -f /usr/local/bin/promtail && echo "binary_exists" || echo "binary_not_found"
# Promtail 설정 파일 존재 확인
test -f /etc/promtail/config.yml && echo "config_exists" || echo "config_not_found"
# Promtail HTTP 엔드포인트 확인
curl -s http://localhost:9080/ready 2>&1 | head -1 || echo "not_responding"
# Promtail 서비스 상태 상세 확인 (에러 메시지 포함)
systemctl status promtail --no-pager -l 2>&1 | head -20 || echo "status_check_failed"
# Promtail 설정 파일에서 Loki URL 확인
grep -E "^\\s*url:" /etc/promtail/config.yml 2>/dev/null | head -1 || echo "loki_url_not_found"
`;

    // 스크립트를 base64로 인코딩하여 전송
    const scriptBase64 = Buffer.from(checkScript).toString('base64');
    const command = `${sshCommand} "echo '${scriptBase64}' | base64 -d | bash"`;
    const { stdout } = await execPromise(command, { timeout: 10000 });

    const lines = stdout.trim().split('\n');
    
    // Node Exporter 상태
    const nodeExporterActive = lines[0] === 'active';
    const nodeExporterEnabled = lines[1] === 'enabled';
    const nodeExporterBinaryExists = lines[2] === 'binary_exists';
    const nodeExporterResponding = lines[3] && !lines[3].includes('not_responding');
    // 설치됨 판단: 바이너리가 존재해야 함 (가장 엄격한 기준)
    // 또는 서비스가 실제로 active 상태이거나 enabled 상태이거나 실제로 응답하는 경우
    // 단, 바이너리가 없으면 미설치로 판단 (불완전한 설치 방지)
    const nodeExporterInstalled = (nodeExporterBinaryExists && (nodeExporterActive || nodeExporterEnabled || nodeExporterResponding)) ||
                                   (nodeExporterActive && nodeExporterBinaryExists) ||
                                   (nodeExporterEnabled && nodeExporterBinaryExists) ||
                                   (nodeExporterResponding && nodeExporterBinaryExists);
    
    // Promtail 상태
    const promtailActive = lines[4] === 'active';
    const promtailEnabled = lines[5] === 'enabled';
    const promtailBinaryExists = lines[6] === 'binary_exists';
    const promtailConfigExists = lines[7] === 'config_exists';
    // curl 응답 확인: 실제로 응답이 있고 'not_responding'이 아닌 경우만 true
    const promtailResponse = lines[8] ? lines[8].trim() : '';
    const promtailResponding = promtailResponse !== '' && 
                               promtailResponse !== 'not_responding' && 
                               promtailResponse !== 'disabled' &&
                               promtailResponse !== 'inactive' &&
                               promtailResponse !== 'binary_not_found' &&
                               promtailResponse !== 'config_not_found' &&
                               !promtailResponse.includes('Connection refused') &&
                               !promtailResponse.includes('curl:') &&
                               !promtailResponse.includes('could not resolve') &&
                               !promtailResponse.includes('Failed to connect');
    
    // 설치됨 판단: 바이너리와 설정 파일이 모두 존재해야 함 (가장 엄격한 기준)
    // 또는 서비스가 실제로 active 상태이거나 enabled 상태이거나 실제로 응답하는 경우
    // 단, 바이너리나 설정 파일이 없으면 미설치로 판단 (불완전한 설치 방지)
    const promtailInstalled = (promtailBinaryExists && promtailConfigExists) || 
                              (promtailActive && promtailBinaryExists) || 
                              (promtailEnabled && promtailBinaryExists) ||
                              (promtailResponding && promtailBinaryExists);
    
    // Promtail 서비스 상태 상세 정보 (디버깅용)
    // lines[9]부터 systemctl status 출력이 시작됨 (최대 20줄)
    const promtailStatusDetail = lines.length > 9 ? lines.slice(9, 29).join('\n') : '';
    // Loki URL은 마지막 줄에 있음 (lines[29] 또는 그 이후)
    const promtailLokiUrl = lines.length > 29 && !lines[29].includes('loki_url_not_found') 
      ? lines[29].trim() 
      : (lines.length > 9 && lines[lines.length - 1] && !lines[lines.length - 1].includes('loki_url_not_found')
        ? lines[lines.length - 1].trim() 
        : null);

    return {
      success: true,
      serverIp: serverIp,
      nodeExporter: {
        installed: nodeExporterInstalled,
        isActive: nodeExporterActive,
        isEnabled: nodeExporterEnabled,
        isResponding: nodeExporterResponding,
        binaryExists: nodeExporterBinaryExists,
        status: nodeExporterActive ? 'running' : (nodeExporterEnabled ? 'installed' : 'not_installed')
      },
      promtail: {
        installed: promtailInstalled,
        isActive: promtailActive,
        isEnabled: promtailEnabled,
        isResponding: promtailResponding,
        lokiUrl: promtailLokiUrl,
        statusDetail: promtailStatusDetail,
        status: promtailActive ? 'running' : (promtailEnabled ? 'installed' : 'not_installed')
      },
      // 하위 호환성을 위한 필드
      installed: nodeExporterInstalled,
      isActive: nodeExporterActive,
      isEnabled: nodeExporterEnabled,
      isResponding: nodeExporterResponding,
      status: nodeExporterActive ? 'running' : (nodeExporterEnabled ? 'installed' : 'not_installed')
    };
  } catch (error) {
    console.error(`[Node Exporter] 상태 확인 실패 (${serverIp}):`, error);
    return {
      success: false,
      serverIp: serverIp,
      nodeExporter: { installed: false },
      promtail: { installed: false },
      installed: false,
      error: error.message
    };
  }
}

/**
 * 여러 서버에 Node Exporter 설치
 * @param {Array<string>} serverIps - 서버 IP 목록
 * @param {object} options - 설치 옵션
 * @returns {Promise<Array<object>>} 설치 결과 목록
 */
async function installNodeExporterOnMultipleServers(serverIps, options = {}) {
  const {
    autoRegisterPrometheus = false,
    prometheusJobName = null,
    prometheusLabels = {},
    groupByJob = true, // 여러 서버를 하나의 Job으로 그룹화할지 여부
    installPromtail = true, // Promtail도 함께 설치 (기본값: true)
    lokiUrl = null // Loki 서버 URL
  } = options;

  const results = await Promise.all(
    serverIps.map(serverIp => installNodeExporter(serverIp, {
      ...options,
      autoRegisterPrometheus: false, // 개별 등록은 나중에 처리
      installPromtail: installPromtail, // Promtail 설치 옵션 전달
      lokiUrl: lokiUrl // Loki URL 전달
    }))
  );

  // Prometheus 자동 등록이 활성화된 경우
  if (autoRegisterPrometheus && results.some(r => r.success)) {
    try {
      const successfulServers = results
        .filter(r => r.success)
        .map(r => r.serverIp);

      if (groupByJob && successfulServers.length > 0) {
        // 여러 서버를 하나의 Job으로 그룹화
        let finalJobName = prometheusJobName;
        if (!finalJobName) {
          // 자동 생성: 첫 번째 서버의 IP 기반 또는 사용자 지정 규칙
          const firstIp = successfulServers[0];
          const ipParts = firstIp.split('.');
          const subnet = ipParts.slice(0, 3).join('.');
          finalJobName = `node-exporter-${subnet}`;
        }

        const targets = successfulServers.map(ip => `${ip}:9100`);
        
        await addPrometheusJob({
          jobName: finalJobName,
          targets: targets,
          labels: {
            service: prometheusLabels.service || 'node-exporter',
            environment: prometheusLabels.environment || 'production',
            ...prometheusLabels
          }
        });

        // 결과에 Prometheus 등록 정보 추가
        results.forEach((result, index) => {
          if (result.success) {
            result.prometheusRegistered = true;
            result.prometheusJobName = finalJobName;
            result.message += ` Prometheus Job '${finalJobName}'에 자동 등록되었습니다.`;
          }
        });

        console.log(`[Node Exporter] Prometheus 그룹 등록 완료: ${successfulServers.length}개 서버 -> ${finalJobName}`);
      } else {
        // 각 서버를 개별 Job으로 등록
        for (const result of results) {
          if (result.success && !result.prometheusRegistered) {
            const finalJobName = prometheusJobName || `node-exporter-${result.serverIp.split('.').pop()}`;
            try {
              await addPrometheusJob({
                jobName: finalJobName,
                targets: [`${result.serverIp}:9100`],
                labels: {
                  instance: result.serverIp,
                  service: prometheusLabels.service || 'node-exporter',
                  environment: prometheusLabels.environment || 'production',
                  ...prometheusLabels
                }
              });
              result.prometheusRegistered = true;
              result.prometheusJobName = finalJobName;
              result.message += ` Prometheus Job '${finalJobName}'에 자동 등록되었습니다.`;
            } catch (err) {
              console.warn(`[Node Exporter] Prometheus 개별 등록 실패 (${result.serverIp}):`, err.message);
            }
          }
        }
      }
    } catch (prometheusError) {
      console.warn(`[Node Exporter] Prometheus 그룹 등록 실패:`, prometheusError.message);
    }
  }

  return {
    success: results.every(r => r.success),
    results: results,
    summary: {
      total: serverIps.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      prometheusRegistered: results.filter(r => r.prometheusRegistered).length,
      promtailInstalled: results.filter(r => r.promtailInstalled).length
    }
  };
}

/**
 * Promtail 설치 (Loki 로그 수집)
 * @param {string} serverIp - 서버 IP 주소
 * @param {object} options - 설치 옵션
 * @returns {Promise<object>} 설치 결과
 */
async function installPromtail(serverIp, options = {}) {
  const {
    sshUser = 'ubuntu',
    sshKey = null,
    sshPassword = null,
    promtailVersion = '2.9.3',
    lokiUrl = null // Loki 서버 URL (예: http://10.255.1.254:3100/loki/api/v1/push)
  } = options;

  // Loki URL이 없으면 환경 변수에서 가져오기
  const finalLokiUrl = lokiUrl || process.env.LOKI_URL || 'http://10.255.1.254:3100/loki/api/v1/push';

  try {
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    // Promtail 설치 스크립트
    const installScript = `#!/bin/bash
set -eo pipefail

# 기존 Promtail 서비스 중지
sudo systemctl stop promtail 2>/dev/null || true
sudo systemctl disable promtail 2>/dev/null || true
sudo pkill -f promtail 2>/dev/null || true
sleep 2

# Promtail 다운로드 (tar.gz 형식 사용 - unzip 불필요)
cd /tmp
# unzip이 없을 수 있으므로 tar.gz 형식 사용
wget -q https://github.com/grafana/loki/releases/download/v${promtailVersion}/promtail-linux-amd64.zip -O promtail-linux-amd64.zip

# unzip 설치 시도 (없으면 설치)
if ! command -v unzip &> /dev/null; then
  sudo apt-get update -qq > /dev/null 2>&1
  sudo apt-get install -y unzip > /dev/null 2>&1 || {
    # unzip 설치 실패 시 Python으로 압축 해제 시도
    python3 -c "import zipfile; zipfile.ZipFile('promtail-linux-amd64.zip').extractall('.')" 2>/dev/null || {
      # Python도 없으면 에러
      echo "ERROR: unzip 또는 python3가 필요합니다."
      exit 1
    }
  }
fi

unzip -q promtail-linux-amd64.zip 2>/dev/null || {
  # unzip 실패 시 Python으로 재시도
  python3 -c "import zipfile; zipfile.ZipFile('promtail-linux-amd64.zip').extractall('.')" 2>/dev/null || exit 1
}

# 실행 파일 복사
sudo rm -f /usr/local/bin/promtail
sudo cp promtail-linux-amd64 /usr/local/bin/promtail
sudo chmod +x /usr/local/bin/promtail

# Promtail 설정 파일 생성
sudo mkdir -p /etc/promtail
# 호스트명을 변수로 가져오기
HOSTNAME=\$(hostname)
sudo tee /etc/promtail/config.yml > /dev/null <<CONFIGEOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: ${finalLokiUrl}

scrape_configs:
  # 1. 계정 및 인증 관련 로그 (최우선 점검)
  - job_name: auth
    static_configs:
      # Debian/Ubuntu 계열
      - targets:
          - localhost
        labels:
          job: auth
          log_type: authentication
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/auth.log
      # RHEL/CentOS/Rocky 계열
      - targets:
          - localhost
        labels:
          job: secure
          log_type: authentication
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/secure

  # 2. 전체 시스템 로그
  - job_name: system
    static_configs:
      # Debian/Ubuntu 계열
      - targets:
          - localhost
        labels:
          job: syslog
          log_type: system
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/syslog
      # RHEL/CentOS/Rocky 계열
      - targets:
          - localhost
        labels:
          job: messages
          log_type: system
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/messages

  # 3. 접속 기록 (바이너리 파일은 텍스트 변환 필요 - last, lastb 명령어 출력)
  # 주의: 바이너리 파일은 직접 수집 불가, cron으로 텍스트 변환 후 수집 권장
  - job_name: login_history
    static_configs:
      - targets:
          - localhost
        labels:
          job: login_history
          log_type: access
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/login_history.log

  # 4. 주요 서비스 및 작업 스케줄 로그
  - job_name: cron
    static_configs:
      - targets:
          - localhost
        labels:
          job: cron
          log_type: scheduled_task
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/cron

  # 5. 웹 서버 로그
  - job_name: web_server
    static_configs:
      # Apache (RHEL/CentOS)
      - targets:
          - localhost
        labels:
          job: apache_access
          log_type: web_access
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/httpd/access_log
      - targets:
          - localhost
        labels:
          job: apache_error
          log_type: web_error
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/httpd/error_log
      # Apache (Debian/Ubuntu)
      - targets:
          - localhost
        labels:
          job: apache2_access
          log_type: web_access
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/apache2/access.log
      - targets:
          - localhost
        labels:
          job: apache2_error
          log_type: web_error
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/apache2/error.log
      # Nginx
      - targets:
          - localhost
        labels:
          job: nginx_access
          log_type: web_access
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/nginx/access.log
      - targets:
          - localhost
        labels:
          job: nginx_error
          log_type: web_error
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/nginx/error.log

  # 6. 사용자 명령어 기록 (Shell History)
  - job_name: shell_history
    static_configs:
      - targets:
          - localhost
        labels:
          job: bash_history
          log_type: command_history
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /home/*/.bash_history
      - targets:
          - localhost
        labels:
          job: root_history
          log_type: command_history
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /root/.bash_history
      - targets:
          - localhost
        labels:
          job: zsh_history
          log_type: command_history
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /home/*/.zsh_history

  # 7. 기타 시스템 로그
  - job_name: system_logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: kern
          log_type: kernel
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/kern.log
      - targets:
          - localhost
        labels:
          job: daemon
          log_type: daemon
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/daemon.log
      - targets:
          - localhost
        labels:
          job: mail
          log_type: mail
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/mail.log
      - targets:
          - localhost
        labels:
          job: user
          log_type: user
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/user.log
      - targets:
          - localhost
        labels:
          job: dpkg
          log_type: package
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/dpkg.log
      - targets:
          - localhost
        labels:
          job: apt
          log_type: package
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/apt/*.log
      - targets:
          - localhost
        labels:
          job: journal
          log_type: systemd
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/journal/**/*.log
      - targets:
          - localhost
        labels:
          job: varlogs
          log_type: general
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/*.log
CONFIGEOF

# 접속 기록 바이너리 파일을 텍스트로 변환하는 스크립트 생성 (선택사항)
# wtmp, btmp, lastlog는 바이너리 파일이므로 cron으로 주기적으로 텍스트 변환
# heredoc 없이 echo로 직접 스크립트 작성
sudo bash -c 'echo "#!/bin/bash" > /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "LOG_FILE=\"/var/log/login_history.log\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "DATE=\$(date \"+%Y-%m-%d %H:%M:%S\" 2>/dev/null || echo \"unknown\")" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "{" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  echo \"=== Login History Export at \$DATE ===\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  echo \"--- Successful Logins (wtmp) ---\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  last -F -w 2>/dev/null || echo \"wtmp not available\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  echo \"\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  echo \"--- Failed Login Attempts (btmp) ---\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  lastb -F -w 2>/dev/null || echo \"btmp not available\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  echo \"\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  echo \"--- Last Login per User (lastlog) ---\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  lastlog 2>/dev/null || echo \"lastlog not available\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  echo \"\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  echo \"=== End of Export ===\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  echo \"\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "} >> \\\"\$LOG_FILE\\\" 2>&1" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "if [ -f \"\$LOG_FILE\" ]; then" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  FILE_SIZE=\$(stat -f%z \"\$LOG_FILE\" 2>/dev/null || stat -c%s \"\$LOG_FILE\" 2>/dev/null || echo \"0\")" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  MAX_SIZE=10485760" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  if [ \"\$FILE_SIZE\" -gt \"\$MAX_SIZE\" ]; then" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "    tail -n 1000 \"\$LOG_FILE\" > \"\${LOG_FILE}.tmp\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "    mv \"\${LOG_FILE}.tmp\" \"\$LOG_FILE\"" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "  fi" >> /usr/local/bin/export-login-history.sh'
sudo bash -c 'echo "fi" >> /usr/local/bin/export-login-history.sh'
sudo chmod +x /usr/local/bin/export-login-history.sh

# 매 5분마다 접속 기록을 텍스트로 변환하는 cron 작업 추가 (기존 cron 작업 유지)
(crontab -l 2>/dev/null | grep -v "export-login-history"; echo "*/5 * * * * /usr/local/bin/export-login-history.sh > /dev/null 2>&1") | crontab -

# systemd 서비스 파일 생성
sudo tee /etc/systemd/system/promtail.service > /dev/null <<'SERVICEEOF'
[Unit]
Description=Promtail
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/promtail -config.file=/etc/promtail/config.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

# systemd 리로드 및 서비스 시작
sudo systemctl daemon-reload
sudo systemctl start promtail
sudo systemctl enable promtail

# 설치 확인
sleep 2
systemctl is-active promtail || echo "Promtail 설치 완료 (서비스 확인 실패)"
`;

    const scriptBase64 = Buffer.from(installScript).toString('base64');
    const command = `${sshCommand} "echo '${scriptBase64}' | base64 -d | bash"`;
    
    const { stdout, stderr } = await execPromise(command, {
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024
    });

    return {
      success: true,
      serverIp: serverIp,
      message: `Promtail이 성공적으로 설치되었습니다.`,
      lokiUrl: finalLokiUrl,
      output: stdout,
      error: stderr || null
    };
  } catch (error) {
    console.error(`[Promtail] 설치 실패 (${serverIp}):`, error);
    return {
      success: false,
      serverIp: serverIp,
      error: error.message,
      details: error.stderr || error.stdout
    };
  }
}

/**
 * 여러 서버에 Promtail 설치
 * @param {Array<string>} serverIps - 서버 IP 목록
 * @param {object} options - 설치 옵션
 * @returns {Promise<object>} 설치 결과
 */
async function installPromtailOnMultipleServers(serverIps, options = {}) {
  const results = await Promise.all(
    serverIps.map(serverIp => installPromtail(serverIp, options))
  );

  return {
    success: results.every(r => r.success),
    results: results,
    summary: {
      total: serverIps.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  };
}

/**
 * Promtail 설정 파일 업데이트 (기존 설치된 서버용)
 * @param {string} serverIp - 서버 IP 주소
 * @param {object} options - SSH 옵션
 * @returns {Promise<object>} 업데이트 결과
 */
async function updatePromtailConfig(serverIp, options = {}) {
  const {
    sshUser = 'ubuntu',
    sshKey = null,
    sshPassword = null,
    lokiUrl = null
  } = options;

  const finalLokiUrl = lokiUrl || process.env.LOKI_URL || 'http://10.255.1.254:3100/loki/api/v1/push';

  try {
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    // Promtail 설정 파일 업데이트 스크립트
    const updateScript = `#!/bin/bash
set -e

# 호스트명 가져오기
HOSTNAME=\$(hostname)

# Promtail 설정 파일 업데이트
sudo mkdir -p /etc/promtail
sudo tee /etc/promtail/config.yml > /dev/null <<CONFIGEOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: ${finalLokiUrl}

scrape_configs:
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: varlogs
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/*log
      - targets:
          - localhost
        labels:
          job: syslog
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/syslog
      - targets:
          - localhost
        labels:
          job: auth
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/auth.log
      - targets:
          - localhost
        labels:
          job: messages
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/messages
      - targets:
          - localhost
        labels:
          job: kern
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/kern.log
      - targets:
          - localhost
        labels:
          job: daemon
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/daemon.log
      - targets:
          - localhost
        labels:
          job: mail
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/mail.log
      - targets:
          - localhost
        labels:
          job: user
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/user.log
      - targets:
          - localhost
        labels:
          job: dpkg
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/dpkg.log
      - targets:
          - localhost
        labels:
          job: apt
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/apt/*.log
      - targets:
          - localhost
        labels:
          job: journal
          hostname: \${HOSTNAME}
          instance: \${HOSTNAME}
          __path__: /var/log/journal/**/*.log
CONFIGEOF

# Promtail 서비스 재시작
sudo systemctl restart promtail 2>/dev/null || echo "Promtail 서비스가 없습니다. 재설치가 필요합니다."
`;

    const scriptBase64 = Buffer.from(updateScript).toString('base64');
    const command = `${sshCommand} "echo '${scriptBase64}' | base64 -d | bash"`;
    
    const { stdout, stderr } = await execPromise(command, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024
    });

    return {
      success: true,
      serverIp: serverIp,
      message: `Promtail 설정 파일이 업데이트되었습니다.`,
      output: stdout,
      error: stderr || null
    };
  } catch (error) {
    console.error(`[Promtail] 설정 업데이트 실패 (${serverIp}):`, error);
    return {
      success: false,
      serverIp: serverIp,
      error: error.message,
      details: error.stderr || error.stdout
    };
  }
}

/**
 * 여러 서버의 Promtail 설정 파일 업데이트
 * @param {Array<string>} serverIps - 서버 IP 목록
 * @param {object} options - SSH 옵션
 * @returns {Promise<object>} 업데이트 결과
 */
async function updatePromtailConfigOnMultipleServers(serverIps, options = {}) {
  const results = await Promise.all(
    serverIps.map(serverIp => updatePromtailConfig(serverIp, options))
  );

  return {
    success: results.every(r => r.success),
    results: results,
    summary: {
      total: serverIps.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  };
}

/**
 * Node Exporter 삭제
 * @param {string} serverIp - 서버 IP 주소
 * @param {object} options - SSH 옵션
 * @returns {Promise<object>} 삭제 결과
 */
async function uninstallNodeExporter(serverIp, options = {}) {
  const {
    sshUser = 'ubuntu',
    sshKey = null,
    sshPassword = null
  } = options;

  try {
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    const uninstallScript = `#!/bin/bash
set -e

# Node Exporter 서비스 중지 및 비활성화
sudo systemctl stop node_exporter 2>/dev/null || true
sudo systemctl disable node_exporter 2>/dev/null || true
sudo pkill -f node_exporter 2>/dev/null || true
sleep 2

# 실행 파일 삭제
sudo rm -f /usr/local/bin/node_exporter

# systemd 서비스 파일 삭제
sudo rm -f /etc/systemd/system/node_exporter.service

# systemd 리로드
sudo systemctl daemon-reload

echo "Node Exporter 삭제 완료"
`;

    const scriptBase64 = Buffer.from(uninstallScript).toString('base64');
    const command = `${sshCommand} "echo '${scriptBase64}' | base64 -d | bash"`;
    
    const { stdout, stderr } = await execPromise(command, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024
    });

    return {
      success: true,
      serverIp: serverIp,
      message: 'Node Exporter가 성공적으로 삭제되었습니다.',
      output: stdout,
      error: stderr || null
    };
  } catch (error) {
    console.error(`[Node Exporter] 삭제 실패 (${serverIp}):`, error);
    return {
      success: false,
      serverIp: serverIp,
      error: error.message,
      details: error.stderr || error.stdout
    };
  }
}

/**
 * 여러 서버에서 Node Exporter 삭제
 * @param {Array<string>} serverIps - 서버 IP 목록
 * @param {object} options - SSH 옵션
 * @returns {Promise<object>} 삭제 결과
 */
async function uninstallNodeExporterOnMultipleServers(serverIps, options = {}) {
  const results = await Promise.all(
    serverIps.map(serverIp => uninstallNodeExporter(serverIp, options))
  );

  return {
    success: results.every(r => r.success),
    results: results,
    summary: {
      total: serverIps.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  };
}

/**
 * Promtail 삭제
 * @param {string} serverIp - 서버 IP 주소
 * @param {object} options - SSH 옵션
 * @returns {Promise<object>} 삭제 결과
 */
async function uninstallPromtail(serverIp, options = {}) {
  const {
    sshUser = 'ubuntu',
    sshKey = null,
    sshPassword = null
  } = options;

  try {
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    const uninstallScript = `#!/bin/bash
set -e

# Promtail 서비스 중지 및 비활성화
sudo systemctl stop promtail 2>/dev/null || true
sudo systemctl disable promtail 2>/dev/null || true
sudo pkill -f promtail 2>/dev/null || true
sleep 2

# 실행 파일 삭제
sudo rm -f /usr/local/bin/promtail

# 설정 디렉토리 삭제
sudo rm -rf /etc/promtail

# systemd 서비스 파일 삭제
sudo rm -f /etc/systemd/system/promtail.service

# 접속 기록 변환 스크립트 삭제
sudo rm -f /usr/local/bin/export-login-history.sh

# 접속 기록 로그 파일 삭제
sudo rm -f /var/log/login_history.log

# cron 작업에서 export-login-history.sh 제거
(crontab -l 2>/dev/null | grep -v "export-login-history" || true) | crontab -

# systemd 리로드
sudo systemctl daemon-reload

echo "Promtail 삭제 완료"
`;

    const scriptBase64 = Buffer.from(uninstallScript).toString('base64');
    const command = `${sshCommand} "echo '${scriptBase64}' | base64 -d | bash"`;
    
    const { stdout, stderr } = await execPromise(command, {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024
    });

    return {
      success: true,
      serverIp: serverIp,
      message: 'Promtail이 성공적으로 삭제되었습니다.',
      output: stdout,
      error: stderr || null
    };
  } catch (error) {
    console.error(`[Promtail] 삭제 실패 (${serverIp}):`, error);
    return {
      success: false,
      serverIp: serverIp,
      error: error.message,
      details: error.stderr || error.stdout
    };
  }
}

/**
 * 여러 서버에서 Promtail 삭제
 * @param {Array<string>} serverIps - 서버 IP 목록
 * @param {object} options - SSH 옵션
 * @returns {Promise<object>} 삭제 결과
 */
async function uninstallPromtailOnMultipleServers(serverIps, options = {}) {
  const results = await Promise.all(
    serverIps.map(serverIp => uninstallPromtail(serverIp, options))
  );

  return {
    success: results.every(r => r.success),
    results: results,
    summary: {
      total: serverIps.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  };
}

module.exports = {
  installNodeExporter,
  checkNodeExporterStatus,
  installNodeExporterOnMultipleServers,
  installPromtail,
  installPromtailOnMultipleServers,
  updatePromtailConfig,
  updatePromtailConfigOnMultipleServers,
  uninstallNodeExporter,
  uninstallNodeExporterOnMultipleServers,
  uninstallPromtail,
  uninstallPromtailOnMultipleServers
};


