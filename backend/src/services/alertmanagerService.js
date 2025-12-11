const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const yaml = require('js-yaml');

const PLG_STACK_SERVER = process.env.PLG_STACK_SERVER || '10.255.1.254';
const PLG_STACK_USER = process.env.PLG_STACK_USER || 'ubuntu';
const PLG_STACK_SSH_KEY = process.env.PLG_STACK_SSH_KEY || '/home/ubuntu/workspace/vm-autoscaling/pemkey/danainfra';
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
    jenkins
  } = config;

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
        repeat_interval: '5m', // 12h → 5m로 단축 (스케일아웃 반응성 향상)
        receiver: 'default-webhook',
        routes: []
      };
    } else if (!alertmanagerConfig.route.repeat_interval || alertmanagerConfig.route.repeat_interval === '12h') {
      // 기존 설정이 12h이면 5m로 업데이트
      alertmanagerConfig.route.repeat_interval = '5m';
    }

    if (!alertmanagerConfig.route.routes) {
      alertmanagerConfig.route.routes = [];
    }

    // 기존 라우팅 규칙 제거 (같은 서비스의 스케일아웃/스케일인)
    alertmanagerConfig.route.routes = alertmanagerConfig.route.routes.filter(
      route => !(
        route.match && 
        route.match.service === serviceName && 
        (route.match.alertname === `${serviceName}_HighResourceUsage` || 
         route.match.alertname === `${serviceName}_LowResourceUsage`)
      )
    );

    // 스케일아웃 라우팅 규칙 추가 (맨 앞에 추가하여 우선순위 부여)
    const scaleOutRoute = {
      match: {
        service: serviceName,
        alertname: `${serviceName}_HighResourceUsage`
      },
      receiver: `jenkins-webhook-${serviceName}-out`,
      continue: false
    };

    // 스케일인 라우팅 규칙 추가
    const scaleInRoute = {
      match: {
        service: serviceName,
        alertname: `${serviceName}_LowResourceUsage`
      },
      receiver: `jenkins-webhook-${serviceName}-in`,
      continue: false
    };

    alertmanagerConfig.route.routes.unshift(scaleInRoute); // 스케일인이 먼저 (더 구체적)
    alertmanagerConfig.route.routes.unshift(scaleOutRoute);

    // 4. Webhook 수신자 추가
    if (!alertmanagerConfig.receivers) {
      alertmanagerConfig.receivers = [];
    }

    // 기존 수신자 제거 (같은 서비스의 스케일아웃/스케일인)
    alertmanagerConfig.receivers = alertmanagerConfig.receivers.filter(
      receiver => !(
        receiver.name === `jenkins-webhook-${serviceName}-out` ||
        receiver.name === `jenkins-webhook-${serviceName}-in`
      )
    );

    // 백엔드 웹훅 URL 생성 (백엔드에서 최소/최대 VM 개수 체크 및 쿨다운 체크 후 Jenkins 호출)
    const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://10.255.48.253:6010';
    const webhookUrlOut = `${BACKEND_API_URL}/api/webhook/autoscale/${encodeURIComponent(serviceName)}`;
    const webhookUrlIn = `${BACKEND_API_URL}/api/webhook/autoscale/${encodeURIComponent(serviceName)}`;

    // 스케일아웃 수신자 추가 (백엔드 웹훅 호출)
    const scaleOutReceiver = {
      name: `jenkins-webhook-${serviceName}-out`,
      webhook_configs: [
        {
          url: webhookUrlOut,
          send_resolved: false, // Alert 해결 시 webhook 전송 안 함
          http_config: {
            // 백엔드 웹훅은 인증 불필요 (내부 서비스)
          }
        }
      ]
    };

    // 스케일인 수신자 추가 (백엔드 웹훅 호출)
    const scaleInReceiver = {
      name: `jenkins-webhook-${serviceName}-in`,
      webhook_configs: [
        {
          url: webhookUrlIn,
          send_resolved: false, // Alert 해결 시 webhook 전송 안 함
          http_config: {
            // 백엔드 웹훅은 인증 불필요 (내부 서비스)
          }
        }
      ]
    };

    alertmanagerConfig.receivers.push(scaleOutReceiver);
    alertmanagerConfig.receivers.push(scaleInReceiver);

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
      scaleOut: {
        webhookUrl: webhookUrlOut,
        webhookToken: JENKINS_DEFAULT_WEBHOOK_TOKEN_OUT,
        jobName: 'plg-autoscale-out'
      },
      scaleIn: {
        webhookUrl: webhookUrlIn,
        webhookToken: JENKINS_DEFAULT_WEBHOOK_TOKEN_IN,
        jobName: 'plg-autoscale-in'
      },
      message: 'Alertmanager 라우팅 규칙이 추가되었습니다. (스케일아웃 + 스케일인)'
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

    // 3. 라우팅 규칙 제거 (서비스 이름으로 매칭)
    // 서비스 이름과 일치하는 모든 라우팅 규칙 제거 (alertname 조건 없이)
    if (alertmanagerConfig.route && alertmanagerConfig.route.routes) {
      const beforeCount = alertmanagerConfig.route.routes.length;
      alertmanagerConfig.route.routes = alertmanagerConfig.route.routes.filter(
        route => {
          // service 매칭이 없거나 다른 경우 유지
          if (!route.match || route.match.service !== serviceName) {
            return true;
          }
          // service가 일치하면 제거 (alertname 조건 무시)
          console.log(`[Alertmanager] 라우팅 규칙 제거: service=${serviceName}, alertname=${route.match.alertname || 'N/A'}`);
          return false;
        }
      );
      const afterCount = alertmanagerConfig.route.routes.length;
      console.log(`[Alertmanager] 라우팅 규칙 제거: ${beforeCount}개 → ${afterCount}개`);
    }

    // 4. 수신자 제거 (서비스 이름이 포함된 모든 수신자 제거)
    if (alertmanagerConfig.receivers) {
      const beforeCount = alertmanagerConfig.receivers.length;
      alertmanagerConfig.receivers = alertmanagerConfig.receivers.filter(
        receiver => {
          // 수신자 이름에 서비스 이름이 포함되어 있으면 제거
          if (receiver.name && receiver.name.includes(serviceName)) {
            console.log(`[Alertmanager] 수신자 제거: ${receiver.name}`);
            return false;
          }
          return true;
        }
      );
      const afterCount = alertmanagerConfig.receivers.length;
      console.log(`[Alertmanager] 수신자 제거: ${beforeCount}개 → ${afterCount}개`);
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

/**
 * Alertmanager Silence 생성 (최소 VM 수 도달 시 스케일인 alert 차단)
 * @param {string} serviceName - 서비스 이름
 * @param {number} durationMinutes - Silence 지속 시간 (분), 기본 30분
 * @returns {Promise<object>} Silence 생성 결과
 */
async function createScaleInSilence(serviceName, durationMinutes = 30) {
  try {
    const axios = require('axios');
    const ALERTMANAGER_URL = process.env.ALERTMANAGER_URL || 'http://10.255.1.254:9093';
    
    // Silence 시작 시간 (현재)
    const startsAt = new Date().toISOString();
    // Silence 종료 시간
    const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    
    // Silence 생성 요청
    const silencePayload = {
      matchers: [
        {
          name: 'service',
          value: serviceName,
          isRegex: false
        },
        {
          name: 'alertname',
          value: `${serviceName}_LowResourceUsage`,
          isRegex: false
        }
      ],
      startsAt: startsAt,
      endsAt: endsAt,
      createdBy: 'vm-autoscaling-backend',
      comment: `최소 VM 수 도달로 인한 스케일인 alert 차단 (${durationMinutes}분)`
    };
    
    const response = await axios.post(
      `${ALERTMANAGER_URL}/api/v2/silences`,
      silencePayload,
      { timeout: 10000 }
    );
    
    console.log(`[Alertmanager] Silence 생성 성공: ${serviceName} - ${response.data.silenceID}`);
    
    return {
      success: true,
      silenceID: response.data.silenceID,
      serviceName: serviceName,
      durationMinutes: durationMinutes,
      endsAt: endsAt
    };
  } catch (error) {
    console.error(`[Alertmanager] Silence 생성 실패:`, error.message);
    throw new Error(`Silence 생성 실패: ${error.message}`);
  }
}

/**
 * Alertmanager Silence 삭제 (스케일인 가능 상태로 복구)
 * @param {string} serviceName - 서비스 이름
 * @returns {Promise<object>} Silence 삭제 결과
 */
async function deleteScaleInSilence(serviceName) {
  try {
    const axios = require('axios');
    const ALERTMANAGER_URL = process.env.ALERTMANAGER_URL || 'http://10.255.1.254:9093';
    
    // 현재 활성화된 silence 목록 조회
    const silencesResponse = await axios.get(
      `${ALERTMANAGER_URL}/api/v2/silences`,
      { params: { active: true }, timeout: 10000 }
    );
    
    // 해당 서비스의 스케일인 silence 찾기
    const targetSilence = silencesResponse.data.find(silence => {
      const matchers = silence.matchers || [];
      const hasService = matchers.some(m => m.name === 'service' && m.value === serviceName);
      const hasAlertname = matchers.some(m => m.name === 'alertname' && m.value === `${serviceName}_LowResourceUsage`);
      return hasService && hasAlertname && silence.status?.state === 'active';
    });
    
    if (!targetSilence) {
      return {
        success: true,
        message: '활성화된 silence가 없습니다.',
        silenceID: null
      };
    }
    
    // Silence 삭제
    await axios.delete(
      `${ALERTMANAGER_URL}/api/v2/silence/${targetSilence.id}`,
      { timeout: 10000 }
    );
    
    console.log(`[Alertmanager] Silence 삭제 성공: ${serviceName} - ${targetSilence.id}`);
    
    return {
      success: true,
      silenceID: targetSilence.id,
      serviceName: serviceName
    };
  } catch (error) {
    console.error(`[Alertmanager] Silence 삭제 실패:`, error.message);
    // 삭제 실패해도 에러를 던지지 않음 (이미 만료되었을 수 있음)
    return {
      success: false,
      message: `Silence 삭제 실패: ${error.message}`
    };
  }
}

module.exports = {
  addRoutingRule,
  deleteRoutingRule,
  getRoutingRules,
  createScaleInSilence,
  deleteScaleInSilence
};


