const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const yaml = require('js-yaml');

const PLG_STACK_SERVER = process.env.PLG_STACK_SERVER || '10.255.1.254';
const PLG_STACK_USER = process.env.PLG_STACK_USER || 'ubuntu';
const PLG_STACK_SSH_KEY = process.env.PLG_STACK_SSH_KEY || '/home/ubuntu/workspace/vm-autoscaling/pemkey/danainfra';
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
    // 각 target별로 고유한 instance label을 사용하도록 설정
    // target의 IP 주소만 instance로 사용하여 각 서버를 구분 (Grafana에서 IP로 표시)
    const staticConfigs = targets.map(target => {
      // target 형식: "10.255.48.230:9100"
      const [ip, port] = target.split(':');
      const instanceLabel = ip; // IP 주소만 사용 (각 target별 고유)
      
      // labels에서 instance를 제외한 나머지만 사용 (instance는 IP 주소로 강제 설정)
      const { instance, ...otherLabels } = labels || {};
      
      return {
        targets: [target],
        labels: {
          instance: instanceLabel, // 각 target별 고유한 instance (IP 주소만) - 항상 IP 주소로 설정
          service: otherLabels.service || jobName,
          environment: otherLabels.environment || 'test',
          ...otherLabels,
          // 사용자가 입력한 instance는 originalInstance로 저장 (참고용)
          originalInstance: instance || jobName
        }
      };
    });

    const newJob = {
      job_name: jobName,
      static_configs: staticConfigs
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
      // 기존 Job이 있으면 target을 병합 (기존 target 유지 + 새 target 추가)
      const existingJob = prometheusConfig.scrape_configs[existingJobIndex];
      const existingTargetsMap = new Map(); // target -> staticConfig 매핑
      
      // 기존 static_configs의 모든 target을 Map에 추가
      if (existingJob.static_configs && Array.isArray(existingJob.static_configs)) {
        existingJob.static_configs.forEach(staticConfig => {
          if (staticConfig.targets && Array.isArray(staticConfig.targets)) {
            staticConfig.targets.forEach(target => {
              // 각 target별로 고유한 instance label을 가진 staticConfig 저장
              existingTargetsMap.set(target, {
                targets: [target],
                labels: staticConfig.labels || {}
              });
            });
          }
        });
      }
      
      // 새 target들을 Map에 추가 (기존 것과 병합)
      newJob.static_configs.forEach(staticConfig => {
        if (staticConfig.targets && Array.isArray(staticConfig.targets)) {
          staticConfig.targets.forEach(target => {
            const [ip, port] = target.split(':');
            const instanceLabel = ip; // IP 주소만 사용
            
            // 새 target이면 추가, 기존 target이면 instance label만 업데이트
            existingTargetsMap.set(target, {
              targets: [target],
              labels: {
                instance: instanceLabel, // 각 target의 IP 주소를 instance로 사용
                service: labels.service || jobName,
                environment: labels.environment || 'test',
                ...labels,
                originalInstance: labels.instance || jobName
              }
            });
          });
        }
      });
      
      // 모든 target을 포함하는 새로운 static_configs 생성
      const mergedStaticConfigs = Array.from(existingTargetsMap.values());
      
      // 각 staticConfig의 instance label이 올바른지 확인 및 수정
      // labels에서 instance를 제외한 나머지만 사용
      const { instance, ...otherLabels } = labels || {};
      
      mergedStaticConfigs.forEach(staticConfig => {
        if (staticConfig.targets && staticConfig.targets.length > 0) {
          const target = staticConfig.targets[0];
          const [ip, port] = target.split(':');
          // instance label을 항상 target의 IP 주소로 강제 설정
          if (staticConfig.labels) {
            staticConfig.labels.instance = ip; // IP 주소로 강제 수정
            // 다른 labels는 유지하되, service와 environment는 업데이트
            staticConfig.labels.service = otherLabels.service || jobName;
            staticConfig.labels.environment = otherLabels.environment || 'test';
            // 사용자가 입력한 instance는 originalInstance로 저장
            if (instance) {
              staticConfig.labels.originalInstance = instance;
            }
          }
        }
      });
      
      // 기존 Job 업데이트 (target 병합)
      prometheusConfig.scrape_configs[existingJobIndex] = {
        job_name: jobName,
        static_configs: mergedStaticConfigs
      };
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

    // 12. Grafana 대시보드 자동 생성
    let grafanaResult = null;
    try {
      const { createGrafanaDashboard } = require('./grafanaService');
      grafanaResult = await createGrafanaDashboard(jobName, labels);
      console.log(`[Grafana] 대시보드 생성 완료: ${grafanaResult.dashboardUrl}`);
    } catch (grafanaError) {
      // Grafana 대시보드 생성 실패해도 Prometheus Job 등록은 성공으로 처리
      console.warn(`[Grafana] 대시보드 생성 실패 (경고): ${grafanaError.message}`);
    }

    return {
      success: true,
      jobName: jobName,
      targets: targets,
      message: 'Prometheus Job이 추가되었습니다.',
      grafana: grafanaResult
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
      jobs: jobs.map(job => {
        // 모든 static_configs의 targets를 합쳐서 반환
        const allTargets = [];
        const allLabels = {};
        
        if (job.static_configs && Array.isArray(job.static_configs)) {
          job.static_configs.forEach(staticConfig => {
            if (staticConfig.targets && Array.isArray(staticConfig.targets)) {
              allTargets.push(...staticConfig.targets);
            }
            // labels는 첫 번째 static_config의 것을 사용 (공통 labels)
            if (staticConfig.labels && Object.keys(allLabels).length === 0) {
              Object.assign(allLabels, staticConfig.labels);
            }
          });
        }
        
        return {
          jobName: job.job_name,
          targets: allTargets,
          labels: allLabels
        };
      })
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
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 설정 파일 읽기
    const readCommand = `${sshCommand} "cat ${PROMETHEUS_CONFIG_PATH}"`;
    const { stdout: currentConfig } = await execPromise(readCommand);

    // 2. YAML 파싱
    const prometheusConfig = yaml.load(currentConfig);

    // 3. Job 제거
    if (!prometheusConfig.scrape_configs) {
      prometheusConfig.scrape_configs = [];
    }

    const beforeCount = prometheusConfig.scrape_configs.length;
    prometheusConfig.scrape_configs = prometheusConfig.scrape_configs.filter(
      job => job.job_name !== jobName
    );

    if (prometheusConfig.scrape_configs.length === beforeCount) {
      throw new Error(`Job을 찾을 수 없습니다: ${jobName}`);
    }

    // 4. YAML로 변환
    const newConfigYaml = yaml.dump(prometheusConfig, {
      lineWidth: -1,
      noRefs: true
    });

    // 5. 설정 파일 백업
    const backupCommand = `${sshCommand} "sudo cp ${PROMETHEUS_CONFIG_PATH} ${PROMETHEUS_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"`;
    await execPromise(backupCommand).catch(() => {});

    // 6. 새 설정 파일 작성
    const tempFile = `/tmp/prometheus_${Date.now()}.yml`;
    await fs.writeFile(tempFile, newConfigYaml);

    // 7. 원격 서버로 파일 복사
    const scpCommand = `scp -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${tempFile} ${PLG_STACK_USER}@${PLG_STACK_SERVER}:/tmp/prometheus_new.yml`;
    await execPromise(scpCommand);

    // 8. 원격 서버에서 파일 이동
    const moveCommand = `${sshCommand} "sudo mv /tmp/prometheus_new.yml ${PROMETHEUS_CONFIG_PATH}"`;
    await execPromise(moveCommand);

    // 9. 임시 파일 삭제
    await fs.unlink(tempFile).catch(() => {});

    // 10. Prometheus 컨테이너 재시작
    const restartCommand = `${sshCommand} "sudo docker restart prometheus"`;
    await execPromise(restartCommand);

    // 11. Grafana 대시보드 삭제 (선택사항)
    try {
      const { deleteGrafanaDashboard } = require('./grafanaService');
      const dashboardUid = `dashboard-${jobName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      await deleteGrafanaDashboard(dashboardUid);
      console.log(`[Grafana] 대시보드 삭제 완료: ${dashboardUid}`);
    } catch (grafanaError) {
      console.warn(`[Grafana] 대시보드 삭제 실패 (경고): ${grafanaError.message}`);
    }

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


