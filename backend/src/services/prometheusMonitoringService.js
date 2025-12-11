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
    labels = {}, // { instance: '...', service: '...', environment: '...' }
    createInfraDashboard = null,
    createJvmDashboard = null,
    enableLoki = null
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
      // 기존 Job이 이미 존재하면 에러 반환 (병합하지 않음)
      throw new Error(`Job '${jobName}'이 이미 존재합니다. 중복 등록을 방지하기 위해 기존 Job을 먼저 삭제해주세요.`);
    }

    // 새 Job 추가
    prometheusConfig.scrape_configs.push(newJob);

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
    // 옵션이 명시적으로 설정되지 않은 경우 자동 감지
    const jmxExporterPort = process.env.JMX_EXPORTER_PORT || '9404';
    const nodeExporterPort = process.env.NODE_EXPORTER_PORT || '9100';
    
    let shouldCreateInfraDashboard = createInfraDashboard;
    let shouldCreateJvmDashboard = createJvmDashboard;
    
    // 자동 감지 로직 (옵션이 null인 경우)
    if (shouldCreateInfraDashboard === null && shouldCreateJvmDashboard === null) {
      const isJavaApplication = jobName.toLowerCase().includes('-jmx') || 
                               targets.some(target => {
                                 const [, port] = target.split(':');
                                 return port === jmxExporterPort;
                               });
      shouldCreateJvmDashboard = isJavaApplication;
      shouldCreateInfraDashboard = !isJavaApplication;
    } else if (shouldCreateInfraDashboard === null) {
      // JVM 대시보드만 명시된 경우
      shouldCreateInfraDashboard = false;
    } else if (shouldCreateJvmDashboard === null) {
      // 인프라 대시보드만 명시된 경우
      shouldCreateJvmDashboard = false;
    }
    
    // 대시보드 생성 결과 저장 (여러 개 생성 가능)
    const grafanaResults = [];
    
    try {
      // JVM 대시보드 생성
      if (shouldCreateJvmDashboard) {
        try {
          const { createJavaGrafanaDashboard } = require('./grafanaService');
          const jvmDashboardResult = await createJavaGrafanaDashboard(jobName, labels);
          grafanaResults.push({
            type: 'jvm',
            success: true,
            result: jvmDashboardResult
          });
          console.log(`[Grafana] Java 대시보드 생성 완료: ${jvmDashboardResult.dashboardUrl}`);
        } catch (jvmError) {
          grafanaResults.push({
            type: 'jvm',
            success: false,
            error: jvmError.message
          });
          console.warn(`[Grafana] Java 대시보드 생성 실패 (경고): ${jvmError.message}`);
        }
      }
      
      // 서버 인프라 대시보드 생성
      if (shouldCreateInfraDashboard) {
        try {
          const { createGrafanaDashboard } = require('./grafanaService');
          const infraDashboardResult = await createGrafanaDashboard(jobName, labels);
          grafanaResults.push({
            type: 'infra',
            success: true,
            result: infraDashboardResult
          });
          console.log(`[Grafana] 인프라 대시보드 생성 완료: ${infraDashboardResult.dashboardUrl}`);
        } catch (infraError) {
          grafanaResults.push({
            type: 'infra',
            success: false,
            error: infraError.message
          });
          console.warn(`[Grafana] 인프라 대시보드 생성 실패 (경고): ${infraError.message}`);
        }
      }
    } catch (grafanaError) {
      // Grafana 대시보드 생성 실패해도 Prometheus Job 등록은 성공으로 처리
      console.warn(`[Grafana] 대시보드 생성 실패 (경고): ${grafanaError.message}`);
    }
    
    // 기존 호환성을 위해 첫 번째 성공한 대시보드 결과를 grafanaResult에 저장
    const grafanaResult = grafanaResults.find(r => r.success)?.result || null;

    // 13. Promtail 연동 (각 target의 IP에 대해 Promtail 설정 확인 및 업데이트)
    // enableLoki가 false로 명시된 경우 스킵
    const shouldEnableLoki = enableLoki !== false; // null이면 기본값 true
    
    const promtailResults = [];
    if (shouldEnableLoki) {
      const { updatePromtailConfig } = require('./nodeExporterService');
      const lokiUrl = process.env.LOKI_URL || 'http://10.255.1.254:3100/loki/api/v1/push';
      
      // SSH 옵션은 labels에서 가져오거나 기본값 사용
      const sshUser = labels._sshUser || process.env.DEFAULT_SSH_USER || 'ubuntu';
      const sshKey = labels._sshKey || process.env.DEFAULT_SSH_KEY || null;
      
      // labels에서 내부 사용 필드 제거
      const { _sshUser, _sshKey, ...cleanLabels } = labels;

      for (const target of targets) {
        const [targetIp] = target.split(':');
        try {
          // Promtail 설정 업데이트 시도 (이미 설치된 경우에만 동작)
          const promtailResult = await updatePromtailConfig(targetIp, {
            sshUser: sshUser,
            sshKey: sshKey,
            lokiUrl: lokiUrl
          });
          
          if (promtailResult.success) {
            promtailResults.push({ ip: targetIp, success: true });
            console.log(`[Promtail] 연동 완료: ${targetIp}`);
          } else {
            // Promtail이 설치되어 있지 않거나 설정 업데이트 실패
            promtailResults.push({ ip: targetIp, success: false, error: promtailResult.error });
            console.warn(`[Promtail] 연동 실패 (${targetIp}): ${promtailResult.error}`);
          }
        } catch (promtailError) {
          // Promtail 연동 실패해도 Prometheus Job 등록은 성공으로 처리
          promtailResults.push({ ip: targetIp, success: false, error: promtailError.message });
          console.warn(`[Promtail] 연동 중 예외 발생 (${targetIp}): ${promtailError.message}`);
        }
      }
    }

    return {
      success: true,
      jobName: jobName,
      targets: targets,
      message: 'Prometheus Job이 추가되었습니다.',
      grafana: grafanaResult, // 기존 호환성을 위해 첫 번째 성공한 대시보드 결과
      grafanaResults: grafanaResults, // 모든 대시보드 생성 결과 (새로 추가)
      promtail: {
        results: promtailResults,
        successCount: promtailResults.filter(r => r.success).length,
        totalCount: promtailResults.length
      }
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

/**
 * VM별 등록 상태 조회
 * @param {string} vmName - VM 이름
 * @returns {Promise<object>} 등록 상태
 */
async function getVmRegistrationStatus(vmName) {
  try {
    const nodeExporterPort = process.env.NODE_EXPORTER_PORT || '9100';
    const jmxExporterPort = process.env.JMX_EXPORTER_PORT || '9404';
    
    // Job 이름 생성
    const infraJobName = `${vmName}-node-exporter`;
    const jvmJobName = `${vmName}-jmx`;
    
    // 모든 Job 조회
    const jobsResult = await getPrometheusJobs();
    const allJobs = jobsResult.jobs || [];
    
    // 인프라 대시보드 상태 확인
    const infraJob = allJobs.find(job => job.jobName === infraJobName);
    const infraDashboardStatus = {
      registered: !!infraJob,
      jobName: infraJobName,
      targets: infraJob?.targets || [],
      dashboardUrl: null
    };
    
    // JVM 대시보드 상태 확인
    const jvmJob = allJobs.find(job => job.jobName === jvmJobName);
    const jvmDashboardStatus = {
      registered: !!jvmJob,
      jobName: jvmJobName,
      targets: jvmJob?.targets || [],
      dashboardUrl: null
    };
    
    // Grafana 대시보드 URL 확인
    try {
      const { getGrafanaDashboard } = require('./grafanaService');
      
      if (infraDashboardStatus.registered) {
        const infraDashboardUid = `dashboard-${infraJobName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const infraDashboard = await getGrafanaDashboard(infraDashboardUid);
        if (infraDashboard.success && infraDashboard.dashboard) {
          const grafanaUrl = process.env.GRAFANA_URL || 'http://10.255.1.254:3000';
          infraDashboardStatus.dashboardUrl = `${grafanaUrl}/d/${infraDashboardUid}`;
        }
      }
      
      if (jvmDashboardStatus.registered) {
        const jvmDashboardUid = `dashboard-${jvmJobName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const jvmDashboard = await getGrafanaDashboard(jvmDashboardUid);
        if (jvmDashboard.success && jvmDashboard.dashboard) {
          const grafanaUrl = process.env.GRAFANA_URL || 'http://10.255.1.254:3000';
          jvmDashboardStatus.dashboardUrl = `${grafanaUrl}/d/${jvmDashboardUid}`;
        }
      }
    } catch (dashboardError) {
      console.warn(`[Prometheus] 대시보드 조회 실패:`, dashboardError.message);
    }
    
    // Promtail 연동 상태 확인 (Promtail이 설치되어 있는지만 확인)
    // 실제 Promtail 설정 파일 확인은 복잡하므로, Promtail 설치 여부만 확인
    const lokiStatus = {
      enabled: false,
      promtailInstalled: false
    };
    
    return {
      success: true,
      vmName: vmName,
      status: {
        infraDashboard: infraDashboardStatus,
        jvmDashboard: jvmDashboardStatus,
        loki: lokiStatus
      }
    };
  } catch (error) {
    console.error(`[Prometheus] VM 등록 상태 조회 실패:`, error);
    throw new Error(`VM 등록 상태 조회 실패: ${error.message}`);
  }
}

/**
 * 기능별 추가 (서버 인프라 대시보드, JVM 대시보드, 로키)
 * @param {object} config - 추가 설정
 * @returns {Promise<object>} 추가 결과
 */
async function addMonitoringFeatures(config) {
  const {
    vmName,
    ip,
    port,
    features = {
      infraDashboard: false,
      jvmDashboard: false,
      loki: false
    },
    labels = {}
  } = config;
  
  const results = {
    infraDashboard: null,
    jvmDashboard: null,
    loki: null
  };
  
  const nodeExporterPort = process.env.NODE_EXPORTER_PORT || '9100';
  const jmxExporterPort = process.env.JMX_EXPORTER_PORT || '9404';
  
  try {
    // 서버 인프라 대시보드 추가
    if (features.infraDashboard) {
      const jobName = `${vmName}-node-exporter`;
      const targetPort = port || nodeExporterPort;
      const finalLabels = {
        ...labels,
        vmName: vmName,
        instance: ip,
        service: labels.service || 'node-exporter',
        environment: labels.environment || 'production'
      };
      
      try {
        const result = await addPrometheusJob({
          jobName: jobName,
          targets: [`${ip}:${targetPort}`],
          labels: finalLabels,
          createInfraDashboard: true,
          createJvmDashboard: false,
          enableLoki: false
        });
        results.infraDashboard = {
          success: true,
          jobName: jobName,
          result: result
        };
      } catch (error) {
        results.infraDashboard = {
          success: false,
          error: error.message
        };
      }
    }
    
    // JVM 대시보드 추가
    if (features.jvmDashboard) {
      const jobName = `${vmName}-jmx`;
      const targetPort = port || jmxExporterPort;
      const finalLabels = {
        ...labels,
        vmName: vmName,
        instance: ip,
        service: labels.service || 'jmx-exporter',
        environment: labels.environment || 'production'
      };
      
      try {
        const result = await addPrometheusJob({
          jobName: jobName,
          targets: [`${ip}:${targetPort}`],
          labels: finalLabels,
          createInfraDashboard: false,
          createJvmDashboard: true,
          enableLoki: false
        });
        results.jvmDashboard = {
          success: true,
          jobName: jobName,
          result: result
        };
      } catch (error) {
        results.jvmDashboard = {
          success: false,
          error: error.message
        };
      }
    }
    
    // 로키 (Promtail 연동)
    if (features.loki) {
      const { updatePromtailConfig } = require('./nodeExporterService');
      const lokiUrl = process.env.LOKI_URL || 'http://10.255.1.254:3100/loki/api/v1/push';
      const sshUser = labels._sshUser || process.env.DEFAULT_SSH_USER || 'ubuntu';
      const sshKey = labels._sshKey || process.env.DEFAULT_SSH_KEY || null;
      
      try {
        const promtailResult = await updatePromtailConfig(ip, {
          sshUser: sshUser,
          sshKey: sshKey,
          lokiUrl: lokiUrl
        });
        
        results.loki = {
          success: promtailResult.success,
          result: promtailResult
        };
      } catch (error) {
        results.loki = {
          success: false,
          error: error.message
        };
      }
    }
    
    return {
      success: true,
      vmName: vmName,
      results: results
    };
  } catch (error) {
    console.error(`[Prometheus] 기능 추가 실패:`, error);
    throw new Error(`기능 추가 실패: ${error.message}`);
  }
}

/**
 * 기능별 삭제 (서버 인프라 대시보드, JVM 대시보드, 로키)
 * @param {object} config - 삭제 설정
 * @returns {Promise<object>} 삭제 결과
 */
async function removeMonitoringFeatures(config) {
  const {
    vmName,
    features = {
      infraDashboard: false,
      jvmDashboard: false,
      loki: false
    }
  } = config;
  
  const results = {
    infraDashboard: null,
    jvmDashboard: null,
    loki: null
  };
  
  try {
    // 서버 인프라 대시보드 삭제
    if (features.infraDashboard) {
      const jobName = `${vmName}-node-exporter`;
      try {
        await deletePrometheusJob(jobName);
        results.infraDashboard = {
          success: true,
          jobName: jobName
        };
      } catch (error) {
        results.infraDashboard = {
          success: false,
          error: error.message
        };
      }
    }
    
    // JVM 대시보드 삭제
    if (features.jvmDashboard) {
      const jobName = `${vmName}-jmx`;
      try {
        await deletePrometheusJob(jobName);
        results.jvmDashboard = {
          success: true,
          jobName: jobName
        };
      } catch (error) {
        results.jvmDashboard = {
          success: false,
          error: error.message
        };
      }
    }
    
    // 로키 (Promtail 연동 해제는 Promtail 설정 파일에서 해당 VM 제거)
    // 현재는 Promtail 설정 파일 구조상 특정 VM만 제거하기 어려우므로,
    // Promtail 설정 업데이트를 통해 로키 URL을 제거하거나 비활성화하는 방식으로 처리
    if (features.loki) {
      // 로키 연동 해제는 Promtail 설정 파일 수정이 필요하지만,
      // 현재 구조상 개별 VM 제거가 어려우므로 경고 메시지만 반환
      results.loki = {
        success: true,
        message: '로키 연동 해제는 Promtail 설정 파일을 수동으로 수정해야 합니다.'
      };
    }
    
    return {
      success: true,
      vmName: vmName,
      results: results
    };
  } catch (error) {
    console.error(`[Prometheus] 기능 삭제 실패:`, error);
    throw new Error(`기능 삭제 실패: ${error.message}`);
  }
}

/**
 * 기존 Job에 target 추가
 * @param {string} jobName - Job 이름
 * @param {string} target - 추가할 target (예: "10.255.48.250:9100")
 * @param {object} labels - 추가할 labels (선택사항)
 * @returns {Promise<object>} 추가 결과
 */
async function addTargetToJob(jobName, target, labels = {}) {
  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 설정 파일 읽기
    const readCommand = `${sshCommand} "cat ${PROMETHEUS_CONFIG_PATH}"`;
    const { stdout: currentConfig } = await execPromise(readCommand);

    // 2. YAML 파싱
    const prometheusConfig = yaml.load(currentConfig);

    // 3. 기존 Job 찾기
    if (!prometheusConfig.scrape_configs) {
      throw new Error(`Job '${jobName}'을 찾을 수 없습니다.`);
    }

    const existingJobIndex = prometheusConfig.scrape_configs.findIndex(
      job => job.job_name === jobName
    );

    if (existingJobIndex < 0) {
      throw new Error(`Job '${jobName}'을 찾을 수 없습니다.`);
    }

    const existingJob = prometheusConfig.scrape_configs[existingJobIndex];

    // 4. target 파싱
    const [ip, port] = target.split(':');
    const instanceLabel = ip; // IP 주소만 사용

    // 5. 중복 체크 (같은 IP:Port가 이미 있는지 확인)
    const targetExists = existingJob.static_configs?.some(config => 
      config.targets && config.targets.includes(target)
    );

    if (targetExists) {
      throw new Error(`Target '${target}'이 이미 Job '${jobName}'에 존재합니다.`);
    }

    // 6. 새 static_config 추가
    const { instance, ...otherLabels } = labels || {};
    const newStaticConfig = {
      targets: [target],
      labels: {
        instance: instanceLabel,
        service: otherLabels.service || existingJob.static_configs[0]?.labels?.service || jobName,
        environment: otherLabels.environment || existingJob.static_configs[0]?.labels?.environment || 'production',
        ...otherLabels
      }
    };

    if (!existingJob.static_configs) {
      existingJob.static_configs = [];
    }
    existingJob.static_configs.push(newStaticConfig);

    // 7. YAML로 변환
    const newConfigYaml = yaml.dump(prometheusConfig, {
      lineWidth: -1,
      noRefs: true
    });

    // 8. 설정 파일 백업
    const backupCommand = `${sshCommand} "sudo cp ${PROMETHEUS_CONFIG_PATH} ${PROMETHEUS_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"`;
    await execPromise(backupCommand);

    // 9. 새 설정 파일 작성
    const tempFile = `/tmp/prometheus_${Date.now()}.yml`;
    await fs.writeFile(tempFile, newConfigYaml);

    // 10. 원격 서버로 파일 복사
    const scpCommand = `scp -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${tempFile} ${PLG_STACK_USER}@${PLG_STACK_SERVER}:/tmp/prometheus_new.yml`;
    await execPromise(scpCommand);

    // 11. 원격 서버에서 파일 이동
    const moveCommand = `${sshCommand} "sudo mv /tmp/prometheus_new.yml ${PROMETHEUS_CONFIG_PATH}"`;
    await execPromise(moveCommand);

    // 12. 임시 파일 삭제
    await fs.unlink(tempFile).catch(() => {});

    // 13. Prometheus 컨테이너 재시작
    const restartCommand = `${sshCommand} "sudo docker restart prometheus"`;
    await execPromise(restartCommand);

    console.log(`[Prometheus] Job '${jobName}'에 target '${target}' 추가 완료`);

    return {
      success: true,
      jobName: jobName,
      target: target,
      message: `Job '${jobName}'에 target '${target}'이 추가되었습니다.`
    };
  } catch (error) {
    console.error(`[Prometheus] Target 추가 실패:`, error);
    throw new Error(`Target 추가 실패: ${error.message}`);
  }
}

/**
 * 기존 Job에서 target 제거
 * @param {string} jobName - Job 이름
 * @param {string} target - 제거할 target (예: "10.255.48.250:9100")
 * @returns {Promise<object>} 제거 결과
 */
async function removeTargetFromJob(jobName, target) {
  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 설정 파일 읽기
    const readCommand = `${sshCommand} "cat ${PROMETHEUS_CONFIG_PATH}"`;
    const { stdout: currentConfig } = await execPromise(readCommand);

    // 2. YAML 파싱
    const prometheusConfig = yaml.load(currentConfig);

    // 3. 기존 Job 찾기
    if (!prometheusConfig.scrape_configs) {
      throw new Error(`Job '${jobName}'을 찾을 수 없습니다.`);
    }

    const existingJobIndex = prometheusConfig.scrape_configs.findIndex(
      job => job.job_name === jobName
    );

    if (existingJobIndex < 0) {
      throw new Error(`Job '${jobName}'을 찾을 수 없습니다.`);
    }

    const existingJob = prometheusConfig.scrape_configs[existingJobIndex];

    // 4. target 제거
    if (!existingJob.static_configs || existingJob.static_configs.length === 0) {
      throw new Error(`Job '${jobName}'에 target이 없습니다.`);
    }

    const beforeCount = existingJob.static_configs.length;
    existingJob.static_configs = existingJob.static_configs.filter(config => {
      // target이 포함된 static_config 제거
      return !(config.targets && config.targets.includes(target));
    });

    const afterCount = existingJob.static_configs.length;

    if (beforeCount === afterCount) {
      throw new Error(`Target '${target}'이 Job '${jobName}'에 존재하지 않습니다.`);
    }

    // static_configs가 비어있으면 Job 자체를 제거할지 결정
    // 일단 Job은 유지하고 빈 배열로 둠 (나중에 필요하면 Job 삭제)

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

    console.log(`[Prometheus] Job '${jobName}'에서 target '${target}' 제거 완료`);

    return {
      success: true,
      jobName: jobName,
      target: target,
      message: `Job '${jobName}'에서 target '${target}'이 제거되었습니다.`
    };
  } catch (error) {
    console.error(`[Prometheus] Target 제거 실패:`, error);
    throw new Error(`Target 제거 실패: ${error.message}`);
  }
}

module.exports = {
  addPrometheusJob,
  addTargetToJob,
  removeTargetFromJob,
  getPrometheusJobs,
  getPrometheusTargets,
  deletePrometheusJob,
  getVmRegistrationStatus,
  addMonitoringFeatures,
  removeMonitoringFeatures
};


