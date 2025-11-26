const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const yaml = require('js-yaml');

const PLG_STACK_SERVER = process.env.PLG_STACK_SERVER || '10.255.1.254';
const PLG_STACK_USER = process.env.PLG_STACK_USER || 'ubuntu';
const PLG_STACK_SSH_KEY = process.env.PLG_STACK_SSH_KEY || '/Users/jhlee/Desktop/Work/Dana-Cloud-Oper/DanaIX-신규 VM 생성/00. SSH-PemKey-List/danainfra';
const ALERTMANAGER_CONFIG_PATH = '/mnt/plg-stack/alertmanager/config/alertmanager.yml';
const JENKINS_URL = process.env.JENKINS_URL || 'http://10.255.0.103:8080';
const JENKINS_WEBHOOK_USER = process.env.JENKINS_WEBHOOK_USER || 'danacloud';
const JENKINS_WEBHOOK_PASSWORD = process.env.JENKINS_WEBHOOK_PASSWORD || '!danacloud12';

/**
 * Alertmanager 라우팅 규칙 추가
 * @param {object} config - 오토스케일링 설정
 * @returns {Promise<object>} 추가 결과
 */
async function addRoutingRule(config) {
  const {
    serviceName,
    id: configId,
    receiver, // 직접 지정된 receiver 이름 (선택)
    webhookUrl, // 직접 지정된 webhook URL (선택)
    webhookToken // 직접 지정된 webhook token (선택)
  } = config;

  if (!serviceName) {
    throw new Error('serviceName은 필수입니다.');
  }

  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 설정 파일 읽기
    const readCommand = `${sshCommand} "cat ${ALERTMANAGER_CONFIG_PATH}"`;
    const { stdout: currentConfig } = await execPromise(readCommand);

    // 2. YAML 파싱
    const alertmanagerConfig = yaml.load(currentConfig);

    // 3. 라우팅 규칙 추가
    if (!alertmanagerConfig.route) {
      alertmanagerConfig.route = {
        group_by: ['alertname', 'cluster', 'service'],
        group_wait: '10s',
        group_interval: '10s',
        repeat_interval: '12h',
        receiver: 'default-webhook',
        routes: []
      };
    }

    if (!alertmanagerConfig.route.routes) {
      alertmanagerConfig.route.routes = [];
    }

    // 기존 라우팅 규칙 제거 (같은 서비스)
    alertmanagerConfig.route.routes = alertmanagerConfig.route.routes.filter(
      route => !(route.match && route.match.service === serviceName)
    );

    // Receiver 이름 결정
    const receiverName = receiver || `jenkins-webhook-${serviceName}`;

    // 새 라우팅 규칙 추가 (맨 앞에 추가하여 우선순위 부여)
    const newRoute = {
      match: {
        service: serviceName
      },
      receiver: receiverName,
      continue: false
    };

    alertmanagerConfig.route.routes.unshift(newRoute);

    // 4. Webhook 수신자 추가
    if (!alertmanagerConfig.receivers) {
      alertmanagerConfig.receivers = [];
    }

    // 기존 수신자 제거 (같은 이름)
    alertmanagerConfig.receivers = alertmanagerConfig.receivers.filter(
      receiver => receiver.name !== receiverName
    );

    // Jenkins Webhook URL 결정
    let finalWebhookUrl = webhookUrl;
    if (!finalWebhookUrl) {
      // config.jenkins에서 가져오기 (오토스케일링 설정에서 호출된 경우)
      if (config.jenkins?.webhookUrl) {
        finalWebhookUrl = config.jenkins.webhookUrl;
      } else {
        // 기본값: Jenkins URL + token
        const normalizedServiceName = serviceName.toLowerCase().replace(/\s+/g, '-');
        const token = webhookToken || config.jenkins?.webhookToken || `autoscale-${normalizedServiceName}-token`;
        finalWebhookUrl = `${JENKINS_URL}/generic-webhook-trigger/invoke?token=${token}`;
      }
    }

    // 필요 시 백엔드 중계 엔드포인트 사용 (추가 메타데이터 전달용)
    if (config.jenkins?.useBackendWebhookProxy) {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4410';
      finalWebhookUrl = `${backendUrl}/api/webhook/autoscale/${serviceName}`;
    }

    // 새 수신자 추가
    const newReceiver = {
      name: receiverName,
      webhook_configs: [
        {
          url: finalWebhookUrl,
          send_resolved: true,
          http_config: {
            basic_auth: {
              username: JENKINS_WEBHOOK_USER,
              password: JENKINS_WEBHOOK_PASSWORD
            }
          }
        }
      ]
    };

    alertmanagerConfig.receivers.push(newReceiver);

    // 5. YAML로 변환
    const newConfigYaml = yaml.dump(alertmanagerConfig, {
      lineWidth: -1,
      noRefs: true
    });

    // 6. 설정 파일 백업
    const backupCommand = `${sshCommand} "sudo cp ${ALERTMANAGER_CONFIG_PATH} ${ALERTMANAGER_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"`;
    await execPromise(backupCommand).catch(() => { });

    // 7. 새 설정 파일 작성
    const tempFile = `/tmp/alertmanager_${Date.now()}.yml`;
    await fs.writeFile(tempFile, newConfigYaml);

    // 8. 원격 서버로 파일 복사
    const scpCommand = `scp -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${tempFile} ${PLG_STACK_USER}@${PLG_STACK_SERVER}:/tmp/alertmanager_new.yml`;
    await execPromise(scpCommand);

    // 9. 원격 서버에서 파일 이동
    const moveCommand = `${sshCommand} "sudo mv /tmp/alertmanager_new.yml ${ALERTMANAGER_CONFIG_PATH}"`;
    await execPromise(moveCommand);

    // 10. 임시 파일 삭제
    await fs.unlink(tempFile).catch(() => { });

    // 11. Alertmanager 컨테이너 재시작
    const restartCommand = `${sshCommand} "sudo docker restart alertmanager"`;
    await execPromise(restartCommand);

    return {
      success: true,
      serviceName: serviceName,
      receiver: receiverName,
      webhookUrl: finalWebhookUrl,
      message: 'Alertmanager 라우팅 규칙이 추가되었습니다.'
    };
  } catch (error) {
    console.error(`[Alertmanager] 라우팅 규칙 추가 실패:`, error);
    throw new Error(`라우팅 규칙 추가 실패: ${error.message}`);
  }
}

/**
 * 라우팅 규칙 삭제
 * @param {string} serviceName - 서비스 이름
 * @returns {Promise<object>} 삭제 결과
 */
async function deleteRoutingRule(serviceName) {
  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 설정 파일 읽기
    const readCommand = `${sshCommand} "cat ${ALERTMANAGER_CONFIG_PATH}"`;
    const { stdout: currentConfig } = await execPromise(readCommand);

    // 2. YAML 파싱
    const alertmanagerConfig = yaml.load(currentConfig);

    // 3. 라우팅 규칙 제거
    if (alertmanagerConfig.route && alertmanagerConfig.route.routes) {
      alertmanagerConfig.route.routes = alertmanagerConfig.route.routes.filter(
        route => !(route.match && route.match.service === serviceName)
      );
    }

    // 4. 수신자 제거
    if (alertmanagerConfig.receivers) {
      alertmanagerConfig.receivers = alertmanagerConfig.receivers.filter(
        receiver => receiver.name !== `jenkins-webhook-${serviceName}`
      );
    }

    // 5. YAML로 변환 및 파일 업데이트
    const newConfigYaml = yaml.dump(alertmanagerConfig, {
      lineWidth: -1,
      noRefs: true
    });

    const backupCommand = `${sshCommand} "sudo cp ${ALERTMANAGER_CONFIG_PATH} ${ALERTMANAGER_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"`;
    await execPromise(backupCommand).catch(() => { });

    const tempFile = `/tmp/alertmanager_${Date.now()}.yml`;
    await fs.writeFile(tempFile, newConfigYaml);

    const scpCommand = `scp -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${tempFile} ${PLG_STACK_USER}@${PLG_STACK_SERVER}:/tmp/alertmanager_new.yml`;
    await execPromise(scpCommand);

    const moveCommand = `${sshCommand} "sudo mv /tmp/alertmanager_new.yml ${ALERTMANAGER_CONFIG_PATH}"`;
    await execPromise(moveCommand);

    await fs.unlink(tempFile).catch(() => { });

    // 6. Alertmanager 컨테이너 재시작
    const restartCommand = `${sshCommand} "sudo docker restart alertmanager"`;
    await execPromise(restartCommand);

    return {
      success: true,
      message: `라우팅 규칙이 삭제되었습니다: ${serviceName}`
    };
  } catch (error) {
    console.error(`[Alertmanager] 라우팅 규칙 삭제 실패:`, error);
    throw new Error(`라우팅 규칙 삭제 실패: ${error.message}`);
  }
}

/**
 * 라우팅 규칙 목록 조회
 * @returns {Promise<Array>} 라우팅 규칙 목록
 */
async function getRoutingRules() {
  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;
    const readCommand = `${sshCommand} "cat ${ALERTMANAGER_CONFIG_PATH}"`;
    const { stdout: configContent } = await execPromise(readCommand);

    const alertmanagerConfig = yaml.load(configContent);
    const routes = [];

    if (alertmanagerConfig.route && alertmanagerConfig.route.routes) {
      alertmanagerConfig.route.routes.forEach(route => {
        if (route.match && route.match.service) {
          routes.push({
            service: route.match.service,
            receiver: route.receiver
          });
        }
      });
    }

    return {
      success: true,
      routes: routes
    };
  } catch (error) {
    console.error(`[Alertmanager] 라우팅 규칙 목록 조회 실패:`, error);
    throw new Error(`라우팅 규칙 목록 조회 실패: ${error.message}`);
  }
}

module.exports = {
  addRoutingRule,
  deleteRoutingRule,
  getRoutingRules
};


