const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const yaml = require('js-yaml');

const PLG_STACK_SERVER = process.env.PLG_STACK_SERVER || '10.255.1.254';
const PLG_STACK_USER = process.env.PLG_STACK_USER || 'ubuntu';
const PLG_STACK_SSH_KEY = process.env.PLG_STACK_SSH_KEY || '/home/ubuntu/workspace/vm-autoscaling/pemkey/danainfra';
const ALERT_RULES_PATH = '/mnt/plg-stack/prometheus/rules/alert_rules.yml';

/**
 * Alert Rule 생성
 * @param {object} config - 오토스케일링 설정
 * @returns {Promise<object>} 생성 결과
 */
async function createAlertRule(config) {
  const {
    serviceName,
    id: configId,
    monitoring: {
      cpuThreshold,
      memoryThreshold,
      duration,
      prometheusJobName
    }
  } = config;

  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 Alert Rules 파일 읽기
    const readCommand = `${sshCommand} "cat ${ALERT_RULES_PATH}"`;
    const { stdout: currentRulesContent } = await execPromise(readCommand);

    // 2. YAML 파싱
    let alertRules = { groups: [] };
    try {
      alertRules = yaml.load(currentRulesContent) || { groups: [] };
    } catch (parseError) {
      console.warn('[Prometheus Alert] YAML 파싱 실패, 새 파일 생성:', parseError.message);
      alertRules = { groups: [] };
    }

    // 3. 기존 그룹 찾기 또는 생성
    let group = alertRules.groups.find(g => g.name === `${serviceName}-autoscale`);
    if (!group) {
      group = {
        name: `${serviceName}-autoscale`,
        interval: '15s',
        rules: []
      };
      alertRules.groups.push(group);
    }

    // 4. 기존 Alert Rule 제거 (같은 이름이 있으면)
    group.rules = group.rules.filter(rule => rule.alert !== `${serviceName}_HighResourceUsage`);

    // 5. 새 Alert Rule 생성
    // CPU 사용률: 각 instance별로 계산하고, 그 중 최대값이 임계값을 초과하면 Alert 발생
    // - 2대 서버 중 한 대라도 CPU가 80%를 넘으면 스케일아웃
    // - max(100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle",job="${prometheusJobName}"}[5m])) * 100))
    // Memory 사용률: 각 instance별로 계산하고, 그 중 최대값이 임계값을 초과하면 Alert 발생
    // - max((1 - (avg by (instance) (node_memory_MemAvailable_bytes{job="${prometheusJobName}"}) / avg by (instance) (node_memory_MemTotal_bytes{job="${prometheusJobName}"}))) * 100)
    // 
    // 주의: max() 집계를 사용하므로 특정 instance를 지정할 수 없음
    // Jenkins 파이프라인에서 instance 정보가 필요하므로, annotations에 모든 instance 목록을 포함
    const alertRule = {
      alert: `${serviceName}_HighResourceUsage`,
      expr: `(
        max(100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle",job="${prometheusJobName}"}[5m])) * 100)) > ${cpuThreshold}
        OR
        max((1 - (avg by (instance) (node_memory_MemAvailable_bytes{job="${prometheusJobName}"}) / avg by (instance) (node_memory_MemTotal_bytes{job="${prometheusJobName}"}))) * 100) > ${memoryThreshold}
      )`,
      for: `${duration}m`,
      labels: {
        severity: 'warning',
        service: serviceName,
        autoscaleConfigId: configId,
        instance: 'all' // max() 집계를 사용하므로 모든 instance를 의미
      },
      annotations: {
        summary: `${serviceName} 리소스 사용률이 높습니다`,
        description: `CPU 또는 Memory 사용률이 임계값(${cpuThreshold}% CPU, ${memoryThreshold}% Memory)을 초과하여 ${duration}분 이상 지속되었습니다. 자동 스케일아웃이 필요합니다.`,
        instances: `{{ \$labels.job }}/{{ \$labels.instance }}` // 모든 instance 정보 포함
      }
    };

    group.rules.push(alertRule);

    // 6. YAML로 변환
    const newRulesYaml = yaml.dump(alertRules, {
      lineWidth: -1,
      noRefs: true
    });

    // 7. 설정 파일 백업
    const backupCommand = `${sshCommand} "sudo cp ${ALERT_RULES_PATH} ${ALERT_RULES_PATH}.backup.$(date +%Y%m%d_%H%M%S)"`;
    await execPromise(backupCommand).catch(() => {});

    // 8. 새 설정 파일 작성
    const tempFile = `/tmp/alert_rules_${Date.now()}.yml`;
    await fs.writeFile(tempFile, newRulesYaml);

    // 9. 원격 서버로 파일 복사
    const scpCommand = `scp -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${tempFile} ${PLG_STACK_USER}@${PLG_STACK_SERVER}:/tmp/alert_rules_new.yml`;
    await execPromise(scpCommand);

    // 10. 원격 서버에서 파일 이동
    const moveCommand = `${sshCommand} "sudo mv /tmp/alert_rules_new.yml ${ALERT_RULES_PATH}"`;
    await execPromise(moveCommand);

    // 11. 임시 파일 삭제
    await fs.unlink(tempFile).catch(() => {});

    // 12. Prometheus 컨테이너 재시작
    const restartCommand = `${sshCommand} "sudo docker restart prometheus"`;
    await execPromise(restartCommand);

    return {
      success: true,
      alertRule: alertRule,
      message: 'Alert Rule이 생성되었습니다.'
    };
  } catch (error) {
    console.error(`[Prometheus Alert] Alert Rule 생성 실패:`, error);
    throw new Error(`Alert Rule 생성 실패: ${error.message}`);
  }
}

/**
 * Alert Rule 삭제
 * @param {string} serviceName - 서비스 이름
 * @returns {Promise<object>} 삭제 결과
 */
async function deleteAlertRule(serviceName) {
  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 Alert Rules 파일 읽기
    const readCommand = `${sshCommand} "cat ${ALERT_RULES_PATH}"`;
    const { stdout: currentRulesContent } = await execPromise(readCommand);

    // 2. YAML 파싱
    const alertRules = yaml.load(currentRulesContent) || { groups: [] };

    // 3. 해당 서비스 그룹 제거
    alertRules.groups = alertRules.groups.filter(g => g.name !== `${serviceName}-autoscale`);

    // 4. YAML로 변환
    const newRulesYaml = yaml.dump(alertRules, {
      lineWidth: -1,
      noRefs: true
    });

    // 5. 백업 및 파일 업데이트
    const backupCommand = `${sshCommand} "sudo cp ${ALERT_RULES_PATH} ${ALERT_RULES_PATH}.backup.$(date +%Y%m%d_%H%M%S)"`;
    await execPromise(backupCommand).catch(() => {});

    const tempFile = `/tmp/alert_rules_${Date.now()}.yml`;
    await fs.writeFile(tempFile, newRulesYaml);

    const scpCommand = `scp -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${tempFile} ${PLG_STACK_USER}@${PLG_STACK_SERVER}:/tmp/alert_rules_new.yml`;
    await execPromise(scpCommand);

    const moveCommand = `${sshCommand} "sudo mv /tmp/alert_rules_new.yml ${ALERT_RULES_PATH}"`;
    await execPromise(moveCommand);

    await fs.unlink(tempFile).catch(() => {});

    // 6. Prometheus 컨테이너 재시작
    const restartCommand = `${sshCommand} "sudo docker restart prometheus"`;
    await execPromise(restartCommand);

    return {
      success: true,
      message: `Alert Rule이 삭제되었습니다: ${serviceName}`
    };
  } catch (error) {
    console.error(`[Prometheus Alert] Alert Rule 삭제 실패:`, error);
    throw new Error(`Alert Rule 삭제 실패: ${error.message}`);
  }
}

/**
 * Alert Rule 목록 조회
 * @returns {Promise<Array>} Alert Rule 목록
 */
async function getAlertRules() {
  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;
    const readCommand = `${sshCommand} "cat ${ALERT_RULES_PATH}"`;
    const { stdout: rulesContent } = await execPromise(readCommand);

    const alertRules = yaml.load(rulesContent) || { groups: [] };
    const rules = [];

    alertRules.groups.forEach(group => {
      if (group.name.endsWith('-autoscale')) {
        group.rules.forEach(rule => {
          rules.push({
            group: group.name,
            alert: rule.alert,
            service: rule.labels?.service,
            configId: rule.labels?.autoscaleConfigId
          });
        });
      }
    });

    return {
      success: true,
      rules: rules
    };
  } catch (error) {
    console.error(`[Prometheus Alert] Alert Rule 목록 조회 실패:`, error);
    throw new Error(`Alert Rule 목록 조회 실패: ${error.message}`);
  }
}

module.exports = {
  createAlertRule,
  deleteAlertRule,
  getAlertRules
};


