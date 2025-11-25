const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const yaml = require('js-yaml');

const PLG_STACK_SERVER = process.env.PLG_STACK_SERVER || '10.255.1.254';
const PLG_STACK_USER = process.env.PLG_STACK_USER || 'ubuntu';
const PLG_STACK_SSH_KEY = process.env.PLG_STACK_SSH_KEY || '/Users/jhlee/Desktop/Work/Dana-Cloud-Oper/DanaIX-신규 VM 생성/00. SSH-PemKey-List/danainfra';
const PROMETHEUS_CONFIG_PATH = '/mnt/plg-stack/prometheus/prometheus.yml';

/**
 * Prometheus 설정에 새 Job 추가
 * @param {object} config - Job 설정
 * @returns {Promise<object>} 추가 결과
 */
async function addPrometheusJob(config) {
  const {
    jobName,
    targets, // Array of strings: ['10.255.48.230:9100', '10.255.48.231:9100']
    labels = {} // { instance: '...', service: '...', environment: '...' }
  } = config;

  try {
    // SSH 명령어
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 설정 파일 읽기
    const readCommand = `${sshCommand} "cat ${PROMETHEUS_CONFIG_PATH}"`;
    const { stdout: currentConfig } = await execPromise(readCommand);

    // 2. YAML 파싱
    const prometheusConfig = yaml.load(currentConfig);

    // 3. 새 Job 추가
    const newJob = {
      job_name: jobName,
      static_configs: [
        {
          targets: targets,
          labels: {
            instance: labels.instance || jobName,
            service: labels.service || jobName,
            environment: labels.environment || 'test',
            ...labels
          }
        }
      ]
    };

    // 4. scrape_configs에 추가 (중복 체크)
    if (!prometheusConfig.scrape_configs) {
      prometheusConfig.scrape_configs = [];
    }

    // 기존 Job이 있는지 확인
    const existingJobIndex = prometheusConfig.scrape_configs.findIndex(
      job => job.job_name === jobName
    );

    if (existingJobIndex >= 0) {
      // 기존 Job 업데이트
      prometheusConfig.scrape_configs[existingJobIndex] = newJob;
    } else {
      // 새 Job 추가
      prometheusConfig.scrape_configs.push(newJob);
    }

    // 5. YAML로 변환
    const newConfigYaml = yaml.dump(prometheusConfig, {
      lineWidth: -1,
      noRefs: true
    });

    // 6. 설정 파일 백업
    const backupCommand = `${sshCommand} "sudo cp ${PROMETHEUS_CONFIG_PATH} ${PROMETHEUS_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"`;
    await execPromise(backupCommand);

    // 7. 새 설정 파일 작성
    const tempFile = `/tmp/prometheus_${Date.now()}.yml`;
    await fs.writeFile(tempFile, newConfigYaml);

    // 8. 원격 서버로 파일 복사
    const scpCommand = `scp -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${tempFile} ${PLG_STACK_USER}@${PLG_STACK_SERVER}:/tmp/prometheus_new.yml`;
    await execPromise(scpCommand);

    // 9. 원격 서버에서 파일 이동
    const moveCommand = `${sshCommand} "sudo mv /tmp/prometheus_new.yml ${PROMETHEUS_CONFIG_PATH}"`;
    await execPromise(moveCommand);

    // 10. 임시 파일 삭제
    await fs.unlink(tempFile).catch(() => {});

    // 11. Prometheus 컨테이너 재시작
    const restartCommand = `${sshCommand} "sudo docker restart prometheus"`;
    await execPromise(restartCommand);

    return {
      success: true,
      jobName: jobName,
      targets: targets,
      message: 'Prometheus Job이 추가되었습니다.'
    };
  } catch (error) {
    console.error(`[Prometheus] Job 추가 실패:`, error);
    throw new Error(`Prometheus Job 추가 실패: ${error.message}`);
  }
}

/**
 * Prometheus Job 목록 조회
 * @returns {Promise<Array>} Job 목록
 */
async function getPrometheusJobs() {
  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;
    const readCommand = `${sshCommand} "cat ${PROMETHEUS_CONFIG_PATH}"`;
    const { stdout: configContent } = await execPromise(readCommand);

    const prometheusConfig = yaml.load(configContent);
    const jobs = prometheusConfig.scrape_configs || [];

    return {
      success: true,
      jobs: jobs.map(job => ({
        jobName: job.job_name,
        targets: job.static_configs?.[0]?.targets || [],
        labels: job.static_configs?.[0]?.labels || {}
      }))
    };
  } catch (error) {
    console.error(`[Prometheus] Job 목록 조회 실패:`, error);
    throw new Error(`Prometheus Job 목록 조회 실패: ${error.message}`);
  }
}

/**
 * Prometheus Target 상태 확인
 * @param {string} jobName - Job 이름
 * @returns {Promise<object>} Target 상태
 */
async function getPrometheusTargets(jobName) {
  try {
    const prometheusUrl = `http://${PLG_STACK_SERVER}:9090`;
    const axios = require('axios');
    
    const response = await axios.get(`${prometheusUrl}/api/v1/targets`);
    const targets = response.data.data.activeTargets.filter(
      target => target.labels.job === jobName
    );

    return {
      success: true,
      jobName: jobName,
      targets: targets.map(target => ({
        instance: target.labels.instance,
        job: target.labels.job,
        health: target.health,
        lastError: target.lastError,
        lastScrape: target.lastScrape
      }))
    };
  } catch (error) {
    console.error(`[Prometheus] Target 상태 확인 실패:`, error);
    throw new Error(`Prometheus Target 상태 확인 실패: ${error.message}`);
  }
}

/**
 * Prometheus Job 삭제
 * @param {string} jobName - Job 이름
 * @returns {Promise<object>} 삭제 결과
 */
async function deletePrometheusJob(jobName) {
  try {
    // SSH 명령어
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 설정 파일 읽기
    const readCommand = `${sshCommand} "cat ${PROMETHEUS_CONFIG_PATH}"`;
    const { stdout: currentConfig } = await execPromise(readCommand);

    // 2. YAML 파싱
    const prometheusConfig = yaml.load(currentConfig);

    // 3. Job 찾기
    if (!prometheusConfig.scrape_configs) {
      throw new Error(`Job '${jobName}'을 찾을 수 없습니다.`);
    }

    const jobIndex = prometheusConfig.scrape_configs.findIndex(
      job => job.job_name === jobName
    );

    if (jobIndex < 0) {
      throw new Error(`Job '${jobName}'을 찾을 수 없습니다.`);
    }

    // 4. Job 제거
    prometheusConfig.scrape_configs.splice(jobIndex, 1);

    // 5. YAML로 변환
    const newConfigYaml = yaml.dump(prometheusConfig, {
      lineWidth: -1,
      noRefs: true
    });

    // 6. 설정 파일 백업
    const backupCommand = `${sshCommand} "sudo cp ${PROMETHEUS_CONFIG_PATH} ${PROMETHEUS_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"`;
    await execPromise(backupCommand);

    // 7. 새 설정 파일 작성
    const tempFile = `/tmp/prometheus_${Date.now()}.yml`;
    await fs.writeFile(tempFile, newConfigYaml);

    // 8. 원격 서버로 파일 복사
    const scpCommand = `scp -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${tempFile} ${PLG_STACK_USER}@${PLG_STACK_SERVER}:/tmp/prometheus_new.yml`;
    await execPromise(scpCommand);

    // 9. 원격 서버에서 파일 이동
    const moveCommand = `${sshCommand} "sudo mv /tmp/prometheus_new.yml ${PROMETHEUS_CONFIG_PATH}"`;
    await execPromise(moveCommand);

    // 10. 임시 파일 삭제
    await fs.unlink(tempFile).catch(() => {});

    // 11. Prometheus 컨테이너 재시작
    const restartCommand = `${sshCommand} "sudo docker restart prometheus"`;
    await execPromise(restartCommand);

    return {
      success: true,
      jobName: jobName,
      message: `Prometheus Job '${jobName}'이 삭제되었습니다.`
    };
  } catch (error) {
    console.error(`[Prometheus] Job 삭제 실패:`, error);
    throw new Error(`Prometheus Job 삭제 실패: ${error.message}`);
  }
}

module.exports = {
  addPrometheusJob,
  getPrometheusJobs,
  getPrometheusTargets,
  deletePrometheusJob
};


