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
    sshUser = process.env.DEFAULT_SSH_USER || 'ubuntu',
    sshKey = null,
    sshPassword = null,
    nodeExporterVersion = process.env.NODE_EXPORTER_VERSION || '1.7.0',
    autoRegisterPrometheus = false, // Prometheus 자동 등록 옵션
    prometheusJobName = null, // Job 이름 (자동 생성 또는 지정)
    prometheusLabels = {}, // 추가 labels (service, environment 등)
    installPromtail = false, // Promtail은 별도로 설치하므로 기본값 false로 변경
    lokiUrl = null // Loki 서버 URL
  } = options;

  try {
    // SSH 접속 테스트
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      // sshpass 사용 (설치 필요)
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    // SSH 연결 테스트
    try {
      const testCommand = `${sshCommand} "echo 'SSH connection test'"`;
      await execPromise(testCommand, { timeout: 10000 });
      console.log(`[Node Exporter] SSH 연결 확인 완료: ${serverIp}`);
    } catch (sshError) {
      console.error(`[Node Exporter] SSH 연결 실패 (${serverIp}):`, sshError.message);
      throw new Error(`SSH 연결 실패: ${sshError.message}. SSH 키 및 사용자 정보를 확인하세요.`);
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
    NODE_EXPORTER_PORT=\${NODE_EXPORTER_PORT:-9100}
    sudo ufw allow \${NODE_EXPORTER_PORT}/tcp 2>/dev/null || sudo iptables -A INPUT -p tcp --dport \${NODE_EXPORTER_PORT} -j ACCEPT 2>/dev/null || true

    # 설치 확인
    sleep 2
    curl -s http://localhost:\${NODE_EXPORTER_PORT}/metrics | head -5 || echo "Node Exporter 설치 완료 (메트릭 확인 실패)"
`;

    // 스크립트를 base64로 인코딩하여 전송
    const scriptBase64 = Buffer.from(installScript).toString('base64');
    
    // 원격에서 스크립트를 디코딩하고 실행
    const command = `${sshCommand} "echo '${scriptBase64}' | base64 -d | bash"`;
    
    console.log(`[Node Exporter] 설치 시작: ${serverIp} (버전: ${nodeExporterVersion})`);
    const { stdout, stderr } = await execPromise(command, {
      timeout: parseInt(process.env.NODE_EXPORTER_INSTALL_TIMEOUT) || 300000, // 기본 5분 타임아웃
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    if (stderr && stderr.trim() && !stderr.includes('WARNING')) {
      console.warn(`[Node Exporter] 설치 중 경고 (${serverIp}):`, stderr);
    }

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

    // Prometheus 자동 등록은 제거됨 (PLG Stack 모니터링 등록 메뉴에서 수행)

    return result;
  } catch (error) {
    console.error(`[Node Exporter] 설치 실패 (${serverIp}):`, error);
    console.error(`[Node Exporter] 에러 상세:`, {
      message: error.message,
      code: error.code,
      stderr: error.stderr,
      stdout: error.stdout
    });
    
    // 사용자 친화적인 에러 메시지 생성
    let userFriendlyError = error.message;
    if (error.message.includes('timeout')) {
      userFriendlyError = '설치 시간 초과: 네트워크 연결이 느리거나 서버 응답이 없습니다.';
    } else if (error.message.includes('Permission denied') || error.message.includes('Authentication failed')) {
      userFriendlyError = 'SSH 인증 실패: 올바른 SSH 키를 선택했는지 확인하세요.';
    } else if (error.message.includes('Connection refused') || error.message.includes('Could not resolve')) {
      userFriendlyError = '서버 연결 실패: 서버 IP 주소와 네트워크 연결을 확인하세요.';
    } else if (error.message.includes('SSH 연결 실패')) {
      userFriendlyError = error.message; // 이미 사용자 친화적인 메시지
    }
    
    return {
      success: false,
      serverIp: serverIp,
      error: userFriendlyError,
      details: error.stderr || error.stdout || error.message,
      originalError: error.message // 디버깅용
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
    sshUser = process.env.DEFAULT_SSH_USER || 'ubuntu',
    sshKey = null,
    sshPassword = null
  } = options;

  try {
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    // SSH 연결 테스트
    try {
      const testCommand = `${sshCommand} "echo 'SSH connection test'"`;
      await execPromise(testCommand, { timeout: 10000 });
    } catch (sshError) {
      console.error(`[Node Exporter] 상태 확인 - SSH 연결 실패 (${serverIp}):`, sshError.message);
      throw new Error(`SSH 연결 실패: ${sshError.message}`);
    }

    // 상태 확인 스크립트 (Node Exporter + Promtail)
    const nodeExporterPort = process.env.NODE_EXPORTER_PORT || '9100';
    const promtailPort = process.env.PROMTAIL_PORT || '9080';
    const checkScript = `#!/bin/bash
# 포트 설정
NODE_EXPORTER_PORT=${nodeExporterPort}
PROMTAIL_PORT=${promtailPort}

# Node Exporter 상태
systemctl is-active node_exporter 2>/dev/null || echo "inactive"
systemctl is-enabled node_exporter 2>/dev/null || echo "disabled"
# Node Exporter 바이너리 파일 존재 확인
test -f /usr/local/bin/node_exporter && echo "binary_exists" || echo "binary_not_found"
curl -s http://localhost:\${NODE_EXPORTER_PORT}/metrics | head -1 2>/dev/null || echo "not_responding"

# Promtail 상태
systemctl is-active promtail 2>/dev/null || echo "inactive"
systemctl is-enabled promtail 2>/dev/null || echo "disabled"
# Promtail 바이너리 파일 존재 확인
test -f /usr/local/bin/promtail && echo "binary_exists" || echo "binary_not_found"
# Promtail 설정 파일 존재 확인
test -f /etc/promtail/config.yml && echo "config_exists" || echo "config_not_found"
# Promtail HTTP 엔드포인트 확인
curl -s http://localhost:\${PROMTAIL_PORT}/ready 2>&1 | head -1 || echo "not_responding"
# Promtail 서비스 상태 상세 확인 (에러 메시지 포함)
systemctl status promtail --no-pager -l 2>&1 | head -20 || echo "status_check_failed"
# Promtail 설정 파일에서 Loki URL 확인
grep -E "^\\s*url:" /etc/promtail/config.yml 2>/dev/null | head -1 || echo "loki_url_not_found"
`;

    // 스크립트를 base64로 인코딩하여 전송
    const scriptBase64 = Buffer.from(checkScript).toString('base64');
    const command = `${sshCommand} "echo '${scriptBase64}' | base64 -d | bash"`;
    console.log(`[Node Exporter] 상태 확인 시작: ${serverIp}`);
    const { stdout, stderr } = await execPromise(command, { 
      timeout: parseInt(process.env.NODE_EXPORTER_STATUS_CHECK_TIMEOUT) || 15000 // 기본 15초
    });
    
    if (stderr && stderr.trim()) {
      console.warn(`[Node Exporter] 상태 확인 중 경고 (${serverIp}):`, stderr);
    }

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
    console.error(`[Node Exporter] 상태 확인 에러 상세:`, {
      message: error.message,
      code: error.code,
      stderr: error.stderr,
      stdout: error.stdout
    });
    
    // 사용자 친화적인 에러 메시지 생성
    let userFriendlyError = error.message;
    if (error.message.includes('timeout')) {
      userFriendlyError = '상태 확인 시간 초과: 서버 응답이 없습니다.';
    } else if (error.message.includes('Permission denied') || error.message.includes('Authentication failed')) {
      userFriendlyError = 'SSH 인증 실패: 올바른 SSH 키를 선택했는지 확인하세요.';
    } else if (error.message.includes('Connection refused') || error.message.includes('Could not resolve')) {
      userFriendlyError = '서버 연결 실패: 서버 IP 주소와 네트워크 연결을 확인하세요.';
    } else if (error.message.includes('SSH 연결 실패')) {
      userFriendlyError = error.message; // 이미 사용자 친화적인 메시지
    }
    
    return {
      success: false,
      serverIp: serverIp,
      nodeExporter: { installed: false },
      promtail: { installed: false },
      installed: false,
      error: userFriendlyError,
      originalError: error.message // 디버깅용
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

  // Prometheus 자동 등록은 제거됨 (PLG Stack 모니터링 등록 메뉴에서 수행)

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
    sshUser = process.env.DEFAULT_SSH_USER || 'ubuntu',
    sshKey = null,
    sshPassword = null,
    promtailVersion = process.env.PROMTAIL_VERSION || '2.9.3',
    lokiUrl = null // Loki 서버 URL (예: http://10.255.1.254:3100/loki/api/v1/push)
  } = options;

  // Loki URL이 없으면 환경 변수에서 가져오기
  const finalLokiUrl = lokiUrl || process.env.LOKI_URL || 'http://10.255.1.254:3100/loki/api/v1/push';
  const promtailPort = process.env.PROMTAIL_PORT || '9080';

  // Promtail 설정 파일 내용 생성
  const promtailConfig = `server:
  http_listen_port: ${promtailPort}
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: ${finalLokiUrl}

scrape_configs:
  - job_name: auth
    static_configs:
      - targets:
          - localhost
        labels:
          job: auth
          log_type: authentication
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/auth.log
      - targets:
          - localhost
        labels:
          job: secure
          log_type: authentication
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/secure

  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: syslog
          log_type: system
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/syslog
      - targets:
          - localhost
        labels:
          job: messages
          log_type: system
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/messages

  - job_name: login_history
    static_configs:
      - targets:
          - localhost
        labels:
          job: login_history
          log_type: access
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/login_history.log

  - job_name: cron
    static_configs:
      - targets:
          - localhost
        labels:
          job: cron
          log_type: scheduled_task
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/cron

  - job_name: web_server
    static_configs:
      - targets:
          - localhost
        labels:
          job: apache_access
          log_type: web_access
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/httpd/access_log
      - targets:
          - localhost
        labels:
          job: apache_error
          log_type: web_error
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/httpd/error_log
      - targets:
          - localhost
        labels:
          job: apache2_access
          log_type: web_access
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/apache2/access.log
      - targets:
          - localhost
        labels:
          job: apache2_error
          log_type: web_error
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/apache2/error.log
      - targets:
          - localhost
        labels:
          job: nginx_access
          log_type: web_access
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/nginx/access.log
      - targets:
          - localhost
        labels:
          job: nginx_error
          log_type: web_error
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/nginx/error.log

  - job_name: shell_history
    static_configs:
      - targets:
          - localhost
        labels:
          job: bash_history
          log_type: command_history
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /home/*/.bash_history
      - targets:
          - localhost
        labels:
          job: root_history
          log_type: command_history
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /root/.bash_history
      - targets:
          - localhost
        labels:
          job: zsh_history
          log_type: command_history
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /home/*/.zsh_history

  - job_name: system_logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: kern
          log_type: kernel
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/kern.log
      - targets:
          - localhost
        labels:
          job: daemon
          log_type: daemon
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/daemon.log
      - targets:
          - localhost
        labels:
          job: mail
          log_type: mail
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/mail.log
      - targets:
          - localhost
        labels:
          job: user
          log_type: user
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/user.log
      - targets:
          - localhost
        labels:
          job: dpkg
          log_type: package
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/dpkg.log
      - targets:
          - localhost
        labels:
          job: apt
          log_type: package
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/apt/*.log
      - targets:
          - localhost
        labels:
          job: journal
          log_type: systemd
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/journal/**/*.log
      - targets:
          - localhost
        labels:
          job: varlogs
          log_type: general
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/*.log`;

  // 설정 파일을 base64로 인코딩 (HOSTNAME은 스크립트에서 치환)
  // promtailConfig에 이미 __HOSTNAME__이 사용되므로 그대로 인코딩
  const configBase64 = Buffer.from(promtailConfig).toString('base64');

  // export-login-history.sh script content
  const exportScriptContent = `#!/bin/bash
set -e

LOG_FILE="/var/log/login_history.log"
DATE=\$(date "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")

/usr/bin/sudo /bin/mkdir -p "\$(dirname "\$LOG_FILE")" 2>/dev/null || true

{
  echo "=== Login History Export at \$DATE ==="
  echo "--- Successful Logins (wtmp) ---"
  last -F -w 2>/dev/null || echo "wtmp not available"
  echo ""
  echo "--- Failed Login Attempts (btmp) ---"
  lastb -F -w 2>/dev/null || echo "btmp not available"
  echo ""
  echo "--- Last Login per User (lastlog) ---"
  lastlog 2>/dev/null || echo "lastlog not available"
  echo ""
  echo "=== End of Export ==="
  echo ""
} | /usr/bin/sudo /usr/bin/tee -a "\$LOG_FILE" > /dev/null 2>&1

if /usr/bin/sudo /usr/bin/test -f "\$LOG_FILE"; then
  FILE_SIZE=\$(/usr/bin/sudo /usr/bin/stat -f%z "\$LOG_FILE" 2>/dev/null || /usr/bin/sudo /usr/bin/stat -c%s "\$LOG_FILE" 2>/dev/null || echo "0")
  MAX_SIZE=10485760
  if [ "\$FILE_SIZE" -gt "\$MAX_SIZE" ]; then
    /usr/bin/sudo /usr/bin/tail -n 1000 "\$LOG_FILE" > "\${LOG_FILE}.tmp"
    /usr/bin/sudo /bin/mv "\${LOG_FILE}.tmp" "\$LOG_FILE"
  fi
fi`;
  const exportScriptBase64 = Buffer.from(exportScriptContent).toString('base64');

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

echo "=== Starting Promtail installation ==="
echo "=== Stopping existing Promtail ==="
/usr/bin/sudo /bin/systemctl stop promtail 2>/dev/null || true
echo "Stopped promtail service"
/usr/bin/sudo /bin/systemctl disable promtail 2>/dev/null || true
echo "Disabled promtail service"
# Skip pkill as systemctl stop should handle process termination
sleep 1
echo "Waited for processes to terminate"

echo "=== Downloading Promtail ==="
cd /tmp || { echo "ERROR: Cannot cd to /tmp"; exit 1; }
echo "Changed to /tmp directory"
rm -f promtail-linux-amd64.zip promtail-linux-amd64 2>/dev/null || true
echo "Cleaned old files"
if wget https://github.com/grafana/loki/releases/download/v${promtailVersion}/promtail-linux-amd64.zip -O promtail-linux-amd64.zip 2>&1; then
  echo "Download completed successfully"
else
  echo "ERROR: Failed to download Promtail"
  exit 1
fi

echo "=== Extracting Promtail ==="
if ! command -v unzip &> /dev/null; then
  echo "unzip not found, installing..."
  /usr/bin/sudo /usr/bin/apt-get update -qq > /dev/null 2>&1
  /usr/bin/sudo /usr/bin/apt-get install -y unzip > /dev/null 2>&1 || {
    echo "apt-get failed, using python3..."
    python3 -c "import zipfile; zipfile.ZipFile('promtail-linux-amd64.zip').extractall('.')" 2>/dev/null || {
      echo "ERROR: unzip or python3 required"
      exit 1
    }
    echo "Extracted with python3"
  }
else
  echo "unzip found, extracting..."
  if unzip -q promtail-linux-amd64.zip 2>/dev/null; then
    echo "Extracted successfully"
  else
    echo "unzip failed, using python3..."
    python3 -c "import zipfile; zipfile.ZipFile('promtail-linux-amd64.zip').extractall('.')" 2>/dev/null || {
      echo "ERROR: Failed to extract Promtail"
      exit 1
    }
    echo "Extracted with python3"
  fi
fi

echo "=== Installing Promtail binary ==="
/usr/bin/sudo /bin/rm -f /usr/local/bin/promtail
/usr/bin/sudo /bin/cp promtail-linux-amd64 /usr/local/bin/promtail
/usr/bin/sudo /bin/chmod +x /usr/local/bin/promtail

echo "=== Creating Promtail config ==="
/usr/bin/sudo /bin/mkdir -p /etc/promtail
HOSTNAME_VALUE=\$(hostname)
echo "${configBase64}" | base64 -d | sed "s/__HOSTNAME__/\$HOSTNAME_VALUE/g" | /usr/bin/sudo /usr/bin/tee /etc/promtail/config.yml > /dev/null

echo "=== Installing export-login-history.sh ==="
/usr/bin/sudo /bin/mv /tmp/export-login-history.sh /usr/local/bin/export-login-history.sh
/usr/bin/sudo /bin/chmod +x /usr/local/bin/export-login-history.sh

echo "=== Adding cron job ==="
crontab -l 2>/dev/null | grep -v "export-login-history" > /tmp/crontab.tmp || true
echo "*/5 * * * * /usr/local/bin/export-login-history.sh > /dev/null 2>&1" >> /tmp/crontab.tmp
crontab /tmp/crontab.tmp
rm -f /tmp/crontab.tmp

echo "=== Creating systemd service ==="
/usr/bin/sudo /usr/bin/tee /etc/systemd/system/promtail.service > /dev/null <<'SERVICEEOF'
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

echo "=== Starting Promtail service ==="
/usr/bin/sudo /bin/systemctl daemon-reload
/usr/bin/sudo /bin/systemctl start promtail
/usr/bin/sudo /bin/systemctl enable promtail

sleep 3
# 서비스 상태 확인 (최대 3회 재시도)
RETRY_COUNT=0
MAX_RETRIES=3
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if systemctl is-active promtail > /dev/null 2>&1; then
    echo "=== Promtail installation completed successfully ==="
    echo "=== Promtail service is active ==="
    exit 0
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "WARNING: Promtail service is not active, retrying... ($RETRY_COUNT/$MAX_RETRIES)"
    /usr/bin/sudo /bin/systemctl restart promtail
    sleep 2
  fi
done
# 최종 확인 실패 시 에러 출력
echo "ERROR: Promtail service failed to start after $MAX_RETRIES attempts"
systemctl status promtail --no-pager || true
exit 1
`;

    // Write script to temp file and execute via scp + ssh
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const timestamp = Date.now();
    const tmpScriptPath = path.join(os.tmpdir(), `promtail-install-${timestamp}.sh`);
    const tmpExportScriptPath = path.join(os.tmpdir(), `export-login-history-${timestamp}.sh`);

    fs.writeFileSync(tmpScriptPath, installScript);
    fs.writeFileSync(tmpExportScriptPath, exportScriptContent);

    try {
      // Copy both scripts to remote server
      const scpCommand1 = sshKey
        ? `scp -i "${sshKey}" -o StrictHostKeyChecking=no "${tmpScriptPath}" ${sshUser}@${serverIp}:/tmp/promtail-install.sh`
        : `sshpass -p '${sshPassword}' scp -o StrictHostKeyChecking=no "${tmpScriptPath}" ${sshUser}@${serverIp}:/tmp/promtail-install.sh`;

      const scpCommand2 = sshKey
        ? `scp -i "${sshKey}" -o StrictHostKeyChecking=no "${tmpExportScriptPath}" ${sshUser}@${serverIp}:/tmp/export-login-history.sh`
        : `sshpass -p '${sshPassword}' scp -o StrictHostKeyChecking=no "${tmpExportScriptPath}" ${sshUser}@${serverIp}:/tmp/export-login-history.sh`;

      await execPromise(scpCommand1, { timeout: 60000 });
      await execPromise(scpCommand2, { timeout: 60000 });

      // Execute script on remote server with full error output
      const execCommand = `${sshCommand} "chmod +x /tmp/promtail-install.sh && timeout 300 bash -x /tmp/promtail-install.sh 2>&1; EXIT_CODE=\\$?; rm -f /tmp/promtail-install.sh /tmp/export-login-history.sh 2>/dev/null; exit \\$EXIT_CODE"`;
      const { stdout, stderr } = await execPromise(execCommand, {
        timeout: 360000, // 6 minutes
        maxBuffer: 10 * 1024 * 1024
      });

      // Clean up local temp files
      fs.unlinkSync(tmpScriptPath);
      fs.unlinkSync(tmpExportScriptPath);

      // 설치 스크립트의 종료 코드 확인 (0이면 성공, 1이면 실패)
      const exitCodeMatch = stdout.match(/exit (\d+)/) || stderr?.match(/exit (\d+)/);
      const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1]) : 0;
      
      // 서비스가 실제로 실행 중인지 확인
      const serviceCheckCommand = `${sshCommand} "systemctl is-active promtail 2>/dev/null || echo 'inactive'"`;
      let serviceActive = false;
      try {
        const { stdout: serviceStatus } = await execPromise(serviceCheckCommand, { timeout: 10000 });
        serviceActive = serviceStatus.trim() === 'active';
      } catch (checkError) {
        console.warn(`[Promtail] 서비스 상태 확인 실패 (${serverIp}):`, checkError.message);
      }

      if (exitCode === 0 && serviceActive) {
        return {
          success: true,
          serverIp: serverIp,
          message: `Promtail이 성공적으로 설치되었습니다.`,
          lokiUrl: finalLokiUrl,
          output: stdout,
          error: stderr || null
        };
      } else {
        // 설치 스크립트는 성공했지만 서비스가 실행되지 않은 경우
        const errorMsg = serviceActive 
          ? '설치 스크립트 실행 중 오류 발생'
          : 'Promtail 서비스가 시작되지 않았습니다';
        
        console.error(`[Promtail] 설치 실패 (${serverIp}): exitCode=${exitCode}, serviceActive=${serviceActive}`);
        return {
          success: false,
          serverIp: serverIp,
          error: errorMsg,
          details: stdout + (stderr ? '\n' + stderr : ''),
          exitCode: exitCode,
          serviceActive: serviceActive
        };
      }
    } catch (executeError) {
      // Clean up local temp files on error
      if (fs.existsSync(tmpScriptPath)) {
        fs.unlinkSync(tmpScriptPath);
      }
      if (fs.existsSync(tmpExportScriptPath)) {
        fs.unlinkSync(tmpExportScriptPath);
      }
      throw executeError;
    }
  } catch (error) {
    console.error(`[Promtail] 설치 실패 (${serverIp}):`, error);

    // Extract detailed error message
    let errorDetails = error.stderr || error.stdout || '';
    if (error.message) {
      errorDetails = error.message + (errorDetails ? '\n' + errorDetails : '');
    }

    return {
      success: false,
      serverIp: serverIp,
      error: errorDetails || 'Unknown error',
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
    sshUser = process.env.DEFAULT_SSH_USER || 'ubuntu',
    sshKey = null,
    sshPassword = null,
    lokiUrl = null
  } = options;
  
  const promtailPort = process.env.PROMTAIL_PORT || '9080';

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
  http_listen_port: ${promtailPort}
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
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/*log
      - targets:
          - localhost
        labels:
          job: syslog
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/syslog
      - targets:
          - localhost
        labels:
          job: auth
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/auth.log
      - targets:
          - localhost
        labels:
          job: messages
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/messages
      - targets:
          - localhost
        labels:
          job: kern
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/kern.log
      - targets:
          - localhost
        labels:
          job: daemon
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/daemon.log
      - targets:
          - localhost
        labels:
          job: mail
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/mail.log
      - targets:
          - localhost
        labels:
          job: user
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/user.log
      - targets:
          - localhost
        labels:
          job: dpkg
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/dpkg.log
      - targets:
          - localhost
        labels:
          job: apt
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
          __path__: /var/log/apt/*.log
      - targets:
          - localhost
        labels:
          job: journal
          hostname: __HOSTNAME__
          instance: __HOSTNAME__
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
    sshUser = process.env.DEFAULT_SSH_USER || 'ubuntu',
    sshKey = null,
    sshPassword = null,
    vmName = null // VM 이름 (Prometheus Job 및 Grafana 대시보드 삭제용)
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

    // Prometheus Job 및 Grafana 대시보드 삭제
    let prometheusDeleted = false;
    let grafanaDeleted = false;
    
    if (vmName) {
      try {
        const { deletePrometheusJob } = require('./prometheusMonitoringService');
        // VM 이름을 jobName으로 사용하여 Prometheus Job 삭제
        await deletePrometheusJob(vmName);
        prometheusDeleted = true;
        grafanaDeleted = true; // deletePrometheusJob 내부에서 Grafana 대시보드도 삭제
        console.log(`[Node Exporter] Prometheus Job 및 Grafana 대시보드 삭제 완료: ${vmName}`);
      } catch (promError) {
        console.warn(`[Node Exporter] Prometheus Job 삭제 실패 (${vmName}):`, promError.message);
        // Prometheus Job 삭제 실패해도 Node Exporter 삭제는 성공으로 처리
      }
    } else {
      // VM 이름이 없으면 Prometheus Job 목록에서 해당 IP를 가진 Job 찾기
      try {
        const { getPrometheusJobs, deletePrometheusJob } = require('./prometheusMonitoringService');
        const jobsResult = await getPrometheusJobs();
        const nodeExporterPort = process.env.NODE_EXPORTER_PORT || '9100';
        const targetToFind = `${serverIp}:${nodeExporterPort}`;
        
        // 해당 IP를 가진 Job 찾기
        const matchingJob = jobsResult.jobs?.find(job => 
          job.targets && job.targets.includes(targetToFind)
        );
        
        if (matchingJob) {
          await deletePrometheusJob(matchingJob.jobName);
          prometheusDeleted = true;
          grafanaDeleted = true;
          console.log(`[Node Exporter] Prometheus Job 및 Grafana 대시보드 삭제 완료: ${matchingJob.jobName}`);
        } else {
          console.warn(`[Node Exporter] Prometheus Job을 찾을 수 없음 (${serverIp})`);
        }
      } catch (promError) {
        console.warn(`[Node Exporter] Prometheus Job 조회/삭제 실패 (${serverIp}):`, promError.message);
      }
    }

    const messages = ['Node Exporter가 성공적으로 삭제되었습니다.'];
    if (prometheusDeleted) {
      messages.push('Prometheus Job 및 Grafana 대시보드도 삭제되었습니다.');
    }

    return {
      success: true,
      serverIp: serverIp,
      message: messages.join(' '),
      output: stdout,
      error: stderr || null,
      prometheusDeleted: prometheusDeleted,
      grafanaDeleted: grafanaDeleted
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

/**
 * JMX Exporter 설치
 * @param {string} serverIp - 서버 IP 주소
 * @param {object} options - 설치 옵션
 * @returns {Promise<object>} 설치 결과
 */
async function installJmxExporter(serverIp, options = {}) {
  const {
    sshUser = process.env.DEFAULT_SSH_USER || 'ubuntu',
    sshKey = null,
    sshPassword = null,
    jmxExporterVersion = process.env.JMX_EXPORTER_VERSION || '0.20.2',
    jmxExporterPort = process.env.JMX_EXPORTER_PORT || '9404',
    javaAppPort = process.env.JAVA_APP_JMX_PORT || '9999' // Java 애플리케이션 JMX 포트
  } = options;

  try {
    // SSH 접속 테스트
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    // SSH 연결 테스트
    try {
      const testCommand = `${sshCommand} "echo 'SSH connection test'"`;
      await execPromise(testCommand, { timeout: 10000 });
      console.log(`[JMX Exporter] SSH 연결 확인 완료: ${serverIp}`);
    } catch (sshError) {
      console.error(`[JMX Exporter] SSH 연결 실패 (${serverIp}):`, sshError.message);
      throw new Error(`SSH 연결 실패: ${sshError.message}. SSH 키 및 사용자 정보를 확인하세요.`);
    }

    // JMX Exporter 설치 스크립트
    const installScript = `#!/bin/bash
set -e

# 기존 JMX Exporter 서비스 중지 (이미 설치된 경우)
sudo systemctl stop jmx_exporter 2>/dev/null || true
sudo systemctl disable jmx_exporter 2>/dev/null || true

# 실행 중인 프로세스 종료
sudo pkill -f jmx_prometheus_httpserver 2>/dev/null || true
sleep 2

# JMX Exporter 다운로드
cd /tmp
wget -q https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_httpserver/${jmxExporterVersion}/jmx_prometheus_httpserver-${jmxExporterVersion}-jar-with-dependencies.jar -O jmx_prometheus_httpserver.jar

# JMX Exporter 디렉토리 생성
sudo mkdir -p /opt/jmx_exporter
sudo cp jmx_prometheus_httpserver.jar /opt/jmx_exporter/
sudo chmod +x /opt/jmx_exporter/jmx_prometheus_httpserver.jar

# JMX Exporter 설정 파일 생성
sudo tee /opt/jmx_exporter/config.yml > /dev/null <<'CONFIGEOF'
---
rules:
  - pattern: ".*"
CONFIGEOF

# systemd 서비스 파일 생성
sudo tee /etc/systemd/system/jmx_exporter.service > /dev/null <<'SERVICEEOF'
[Unit]
Description=JMX Exporter
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/java -jar /opt/jmx_exporter/jmx_prometheus_httpserver.jar ${javaAppPort} /opt/jmx_exporter/config.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

# systemd 리로드 및 서비스 시작
sudo systemctl daemon-reload
sudo systemctl start jmx_exporter
sudo systemctl enable jmx_exporter

# 방화벽 설정 (UFW 또는 iptables)
JMX_EXPORTER_PORT=\${JMX_EXPORTER_PORT:-${jmxExporterPort}}
sudo ufw allow \${JMX_EXPORTER_PORT}/tcp 2>/dev/null || sudo iptables -A INPUT -p tcp --dport \${JMX_EXPORTER_PORT} -j ACCEPT 2>/dev/null || true

# 설치 확인
sleep 3
for i in {1..3}; do
  if curl -s http://localhost:\${JMX_EXPORTER_PORT}/metrics | head -5 > /dev/null 2>&1; then
    echo "JMX Exporter 설치 완료"
    exit 0
  fi
  echo "JMX Exporter 시작 대기 중... (\${i}/3)"
  sleep 2
done
echo "JMX Exporter 설치 완료 (메트릭 확인 실패 - Java 애플리케이션이 실행 중이지 않을 수 있습니다)"
`;

    console.log(`[JMX Exporter] 설치 시작: ${serverIp} (버전: ${jmxExporterVersion}, 포트: ${jmxExporterPort})`);

    // 스크립트를 임시 파일로 전송하여 실행
    const tempScriptFile = `/tmp/jmx_exporter_install_${Date.now()}.sh`;
    await fs.writeFile(tempScriptFile, installScript);
    await execPromise(`chmod +x ${tempScriptFile}`);

    // 스크립트를 원격 서버로 복사
    const scpCommand = sshKey
      ? `scp -i "${sshKey}" -o StrictHostKeyChecking=no ${tempScriptFile} ${sshUser}@${serverIp}:/tmp/jmx_exporter_install.sh`
      : `sshpass -p '${sshPassword}' scp -o StrictHostKeyChecking=no ${tempScriptFile} ${sshUser}@${serverIp}:/tmp/jmx_exporter_install.sh`;
    
    await execPromise(scpCommand);

    // 원격 서버에서 스크립트 실행
    const installTimeout = parseInt(process.env.JMX_EXPORTER_INSTALL_TIMEOUT || process.env.NODE_EXPORTER_INSTALL_TIMEOUT || '300000');
    const { stdout, stderr } = await execPromise(
      `${sshCommand} "bash /tmp/jmx_exporter_install.sh"`,
      { timeout: installTimeout }
    );

    // 임시 파일 삭제
    await fs.unlink(tempScriptFile).catch(() => {});

    if (stderr) {
      console.warn(`[JMX Exporter] 설치 중 경고 (${serverIp}):`, stderr);
    }

    return {
      success: true,
      serverIp: serverIp,
      version: jmxExporterVersion,
      port: jmxExporterPort,
      message: `JMX Exporter가 성공적으로 설치되었습니다. (포트: ${jmxExporterPort})`
    };
  } catch (error) {
    console.error(`[JMX Exporter] 설치 실패 (${serverIp}):`, error);
    
    let userFriendlyError = error.message;
    if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
      userFriendlyError = '설치 시간 초과: 네트워크 연결이 느리거나 서버 응답이 없습니다.';
    } else if (error.message.includes('SSH 연결 실패')) {
      userFriendlyError = error.message;
    } else if (error.message.includes('Permission denied')) {
      userFriendlyError = '권한 오류: SSH 키 또는 사용자 권한을 확인하세요.';
    }

    throw new Error(`JMX Exporter 설치 실패: ${userFriendlyError}`);
  }
}

/**
 * JMX Exporter 설치 상태 확인
 * @param {string} serverIp - 서버 IP 주소
 * @param {object} options - 확인 옵션
 * @returns {Promise<object>} 상태 정보
 */
async function checkJmxExporterStatus(serverIp, options = {}) {
  const {
    sshUser = process.env.DEFAULT_SSH_USER || 'ubuntu',
    sshKey = null,
    sshPassword = null,
    jmxExporterPort = process.env.JMX_EXPORTER_PORT || '9404'
  } = options;

  try {
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    // SSH 연결 테스트
    try {
      const testCommand = `${sshCommand} "echo 'SSH connection test'"`;
      await execPromise(testCommand, { timeout: 10000 });
    } catch (sshError) {
      return {
        installed: false,
        running: false,
        error: `SSH 연결 실패: ${sshError.message}`
      };
    }

    // 바이너리 파일 존재 확인
    const checkBinaryCommand = `${sshCommand} "test -f /opt/jmx_exporter/jmx_prometheus_httpserver.jar && echo 'exists' || echo 'not_exists'"`;
    const { stdout: binaryCheck } = await execPromise(checkBinaryCommand);
    const binaryExists = binaryCheck.trim() === 'exists';

    // 서비스 상태 확인
    const checkServiceCommand = `${sshCommand} "systemctl is-active jmx_exporter 2>/dev/null || echo 'inactive'"`;
    const { stdout: serviceStatus } = await execPromise(checkServiceCommand);
    const serviceActive = serviceStatus.trim() === 'active';

    // 메트릭 엔드포인트 확인
    let metricsAvailable = false;
    if (serviceActive) {
      try {
        const metricsCheckTimeout = parseInt(process.env.JMX_EXPORTER_STATUS_CHECK_TIMEOUT || process.env.NODE_EXPORTER_STATUS_CHECK_TIMEOUT || '15000');
        const metricsCheckCommand = `${sshCommand} "timeout ${metricsCheckTimeout / 1000} curl -s http://localhost:${jmxExporterPort}/metrics | head -1 || echo 'unavailable'"`;
        const { stdout: metricsCheck } = await execPromise(metricsCheckCommand);
        metricsAvailable = metricsCheck.trim() !== 'unavailable' && metricsCheck.trim().length > 0;
      } catch (metricsError) {
        metricsAvailable = false;
      }
    }

    // 설치됨 판단: 바이너리와 설정 파일이 모두 존재해야 함
    const installed = binaryExists;

    return {
      installed: installed,
      running: serviceActive && metricsAvailable,
      binaryExists: binaryExists,
      serviceActive: serviceActive,
      metricsAvailable: metricsAvailable,
      port: jmxExporterPort
    };
  } catch (error) {
    console.error(`[JMX Exporter] 상태 확인 실패 (${serverIp}):`, error);
    return {
      installed: false,
      running: false,
      error: error.message
    };
  }
}

/**
 * 여러 서버에 JMX Exporter 설치
 * @param {Array<string>} serverIps - 서버 IP 주소 목록
 * @param {object} options - 설치 옵션
 * @returns {Promise<object>} 설치 결과
 */
async function installJmxExporterOnMultipleServers(serverIps, options = {}) {
  const results = await Promise.allSettled(
    serverIps.map(serverIp => installJmxExporter(serverIp, options))
  );

  const successResults = [];
  const failedResults = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successResults.push(result.value);
    } else {
      failedResults.push({
        serverIp: serverIps[index],
        error: result.reason.message
      });
    }
  });

  return {
    success: failedResults.length === 0,
    total: serverIps.length,
    successCount: successResults.length,
    failedCount: failedResults.length,
    results: successResults,
    failures: failedResults
  };
}

/**
 * JMX Exporter 삭제
 * @param {string} serverIp - 서버 IP 주소
 * @param {object} options - 삭제 옵션
 * @returns {Promise<object>} 삭제 결과
 */
async function uninstallJmxExporter(serverIp, options = {}) {
  const {
    sshUser = process.env.DEFAULT_SSH_USER || 'ubuntu',
    sshKey = null,
    sshPassword = null
  } = options;

  try {
    let sshCommand = '';
    if (sshKey) {
      sshCommand = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else if (sshPassword) {
      sshCommand = `sshpass -p '${sshPassword}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUser}@${serverIp}`;
    } else {
      throw new Error('SSH Key 또는 Password가 필요합니다.');
    }

    // JMX Exporter 삭제 스크립트
    const uninstallScript = `#!/bin/bash
set -e

# 서비스 중지 및 비활성화
sudo systemctl stop jmx_exporter 2>/dev/null || true
sudo systemctl disable jmx_exporter 2>/dev/null || true

# 실행 중인 프로세스 종료
sudo pkill -f jmx_prometheus_httpserver 2>/dev/null || true
sleep 2

# 서비스 파일 삭제
sudo rm -f /etc/systemd/system/jmx_exporter.service
sudo systemctl daemon-reload

# 설치 디렉토리 삭제
sudo rm -rf /opt/jmx_exporter

echo "JMX Exporter 삭제 완료"
`;

    const tempScriptFile = `/tmp/jmx_exporter_uninstall_${Date.now()}.sh`;
    await fs.writeFile(tempScriptFile, uninstallScript);
    await execPromise(`chmod +x ${tempScriptFile}`);

    const scpCommand = sshKey
      ? `scp -i "${sshKey}" -o StrictHostKeyChecking=no ${tempScriptFile} ${sshUser}@${serverIp}:/tmp/jmx_exporter_uninstall.sh`
      : `sshpass -p '${sshPassword}' scp -o StrictHostKeyChecking=no ${tempScriptFile} ${sshUser}@${serverIp}:/tmp/jmx_exporter_uninstall.sh`;
    
    await execPromise(scpCommand);
    await execPromise(`${sshCommand} "bash /tmp/jmx_exporter_uninstall.sh"`);
    await fs.unlink(tempScriptFile).catch(() => {});

    return {
      success: true,
      serverIp: serverIp,
      message: 'JMX Exporter가 삭제되었습니다.'
    };
  } catch (error) {
    console.error(`[JMX Exporter] 삭제 실패 (${serverIp}):`, error);
    throw new Error(`JMX Exporter 삭제 실패: ${error.message}`);
  }
}

/**
 * 여러 서버에서 JMX Exporter 삭제
 * @param {Array<string>} serverIps - 서버 IP 주소 목록
 * @param {object} options - 삭제 옵션
 * @returns {Promise<object>} 삭제 결과
 */
async function uninstallJmxExporterOnMultipleServers(serverIps, options = {}) {
  const results = await Promise.allSettled(
    serverIps.map(serverIp => uninstallJmxExporter(serverIp, options))
  );

  const successResults = [];
  const failedResults = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successResults.push(result.value);
    } else {
      failedResults.push({
        serverIp: serverIps[index],
        error: result.reason.message
      });
    }
  });

  return {
    success: failedResults.length === 0,
    total: serverIps.length,
    successCount: successResults.length,
    failedCount: failedResults.length,
    results: successResults,
    failures: failedResults
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
  uninstallPromtailOnMultipleServers,
  installJmxExporter,
  checkJmxExporterStatus,
  installJmxExporterOnMultipleServers,
  uninstallJmxExporter,
  uninstallJmxExporterOnMultipleServers
};


