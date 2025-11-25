const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

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
    nodeExporterVersion = '1.7.0'
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

    return {
      success: true,
      serverIp: serverIp,
      message: `Node Exporter가 성공적으로 설치되었습니다.`,
      output: stdout,
      error: stderr || null
    };
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

    // 상태 확인 스크립트
    const checkScript = `#!/bin/bash
systemctl is-active node_exporter 2>/dev/null || echo "inactive"
systemctl is-enabled node_exporter 2>/dev/null || echo "disabled"
curl -s http://localhost:9100/metrics | head -1 2>/dev/null || echo "not_responding"
`;

    // 스크립트를 base64로 인코딩하여 전송
    const scriptBase64 = Buffer.from(checkScript).toString('base64');
    const command = `${sshCommand} "echo '${scriptBase64}' | base64 -d | bash"`;
    const { stdout } = await execPromise(command, { timeout: 10000 });

    const lines = stdout.trim().split('\n');
    const isActive = lines[0] === 'active';
    const isEnabled = lines[1] === 'enabled';
    const isResponding = lines[2] && !lines[2].includes('not_responding');

    return {
      success: true,
      serverIp: serverIp,
      installed: isActive || isEnabled || isResponding,
      isActive: isActive,
      isEnabled: isEnabled,
      isResponding: isResponding,
      status: isActive ? 'running' : (isEnabled ? 'installed' : 'not_installed')
    };
  } catch (error) {
    console.error(`[Node Exporter] 상태 확인 실패 (${serverIp}):`, error);
    return {
      success: false,
      serverIp: serverIp,
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
  const results = await Promise.all(
    serverIps.map(serverIp => installNodeExporter(serverIp, options))
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
  installNodeExporterOnMultipleServers
};


