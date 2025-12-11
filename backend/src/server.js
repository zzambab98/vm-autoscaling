const http = require('http');
const url = require('url');
const { 
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
} = require('./services/nodeExporterService');
const { 
  addPrometheusJob,
  addTargetToJob,
  removeTargetFromJob,
  getPrometheusJobs, 
  getPrometheusTargets, 
  deletePrometheusJob,
  getVmRegistrationStatus,
  addMonitoringFeatures,
  removeMonitoringFeatures
} = require('./services/prometheusMonitoringService');
const { getTemplates, getTemplateById, convertVmToTemplate, deleteTemplate, getVmList, startVCenterConnectionMonitor, getVCenterConnectionState } = require('./services/templateService');
const { saveConfig, getConfigs, getConfigById, updateConfig, deleteConfig, setConfigEnabled } = require('./services/autoscalingService');
const { createAlertRule, deleteAlertRule, getAlertRules } = require('./services/prometheusAlertService');
const { addRoutingRule, deleteRoutingRule, getRoutingRules } = require('./services/alertmanagerService');
const { createJenkinsJob, deleteJenkinsJob, getJenkinsJobStatus, getJenkinsJobs, triggerJenkinsJob } = require('./services/jenkinsService');
const { getF5Pools, getF5VirtualServers, removeF5PoolMember } = require('./services/f5Service');

const PORT = process.env.VM_AUTOSCALING_BACKEND_PORT || process.env.PORT || 6010;

function sendJSONResponse(res, status, data, headers = {}) {
  const payload = JSON.stringify(data);
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
  res.writeHead(status, { ...defaultHeaders, ...headers });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // CORS Preflight 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    return res.end();
  }

  // Health Check
  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    return sendJSONResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
  }

  // vCenter 연결 상태 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/vcenter/connection-status') {
    const state = getVCenterConnectionState();
    return sendJSONResponse(res, 200, {
      success: true,
      connectionState: state
    });
  }

  // Node Exporter 설치 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/node-exporter/install') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { 
          serverIp, 
          serverIps, 
          sshUser, 
          sshKey, 
          sshPassword,
          autoRegisterPrometheus,
          prometheusJobName,
          prometheusLabels,
          groupByJob,
          serverInfoMap
        } = payload;

        const installOptions = {
          sshUser,
          sshKey,
          sshPassword,
          autoRegisterPrometheus: autoRegisterPrometheus || false,
          prometheusJobName: prometheusJobName || null,
          prometheusLabels: prometheusLabels || {},
          groupByJob: groupByJob !== false, // 기본값 true
          serverInfoMap: serverInfoMap || {} // VM 이름 매핑
        };

        if (serverIps && Array.isArray(serverIps)) {
          // 여러 서버에 설치
          const result = await installNodeExporterOnMultipleServers(serverIps, installOptions);
          sendJSONResponse(res, 200, result);
        } else if (serverIp) {
          // 단일 서버에 설치
          const result = await installNodeExporter(serverIp, installOptions);
          sendJSONResponse(res, result.success ? 200 : 500, result);
        } else {
          sendJSONResponse(res, 400, { error: 'serverIp 또는 serverIps가 필요합니다.' });
        }
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Promtail 설치 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/promtail/install') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { serverIp, serverIps, sshUser, sshKey, sshPassword, lokiUrl } = payload;

        const installOptions = {
          sshUser,
          sshKey,
          sshPassword,
          lokiUrl: lokiUrl || null
        };

        if (serverIps && Array.isArray(serverIps)) {
          // 여러 서버에 설치
          const result = await installPromtailOnMultipleServers(serverIps, installOptions);
          sendJSONResponse(res, 200, result);
        } else if (serverIp) {
          // 단일 서버에 설치
          const result = await installPromtail(serverIp, installOptions);
          sendJSONResponse(res, result.success ? 200 : 500, result);
        } else {
          sendJSONResponse(res, 400, { error: 'serverIp 또는 serverIps가 필요합니다.' });
        }
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Promtail 삭제 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/promtail/uninstall') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { 
          serverIp, 
          serverIps, 
          sshUser, 
          sshKey, 
          sshPassword
        } = payload;

        const uninstallOptions = {
          sshUser,
          sshKey,
          sshPassword
        };

        if (serverIps && Array.isArray(serverIps)) {
          // 여러 서버에서 삭제
          const result = await uninstallPromtailOnMultipleServers(serverIps, uninstallOptions);
          sendJSONResponse(res, 200, result);
        } else if (serverIp) {
          // 단일 서버에서 삭제
          const result = await uninstallPromtail(serverIp, uninstallOptions);
          sendJSONResponse(res, result.success ? 200 : 500, result);
        } else {
          sendJSONResponse(res, 400, { error: 'serverIp 또는 serverIps가 필요합니다.' });
        }
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Promtail 설정 업데이트 API (기존 설치된 서버용)
  if (req.method === 'POST' && parsedUrl.pathname === '/api/promtail/update-config') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { serverIp, serverIps, sshUser, sshKey, sshPassword, lokiUrl } = payload;

        const updateOptions = {
          sshUser,
          sshKey,
          sshPassword,
          lokiUrl: lokiUrl || null
        };

        if (serverIps && Array.isArray(serverIps)) {
          // 여러 서버 설정 업데이트
          const result = await updatePromtailConfigOnMultipleServers(serverIps, updateOptions);
          sendJSONResponse(res, 200, result);
        } else if (serverIp) {
          // 단일 서버 설정 업데이트
          const result = await updatePromtailConfig(serverIp, updateOptions);
          sendJSONResponse(res, result.success ? 200 : 500, result);
        } else {
          sendJSONResponse(res, 400, { error: 'serverIp 또는 serverIps가 필요합니다.' });
        }
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Node Exporter 삭제 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/node-exporter/uninstall') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { 
          serverIp, 
          serverIps, 
          sshUser, 
          sshKey, 
          sshPassword,
          vmName
        } = payload;

        const uninstallOptions = {
          sshUser,
          sshKey,
          sshPassword,
          vmName: vmName || null // VM 이름 (Prometheus Job 및 Grafana 대시보드 삭제용)
        };

        if (serverIps && Array.isArray(serverIps)) {
          // 여러 서버에서 삭제
          const result = await uninstallNodeExporterOnMultipleServers(serverIps, uninstallOptions);
          sendJSONResponse(res, 200, result);
        } else if (serverIp) {
          // 단일 서버에서 삭제
          const result = await uninstallNodeExporter(serverIp, uninstallOptions);
          sendJSONResponse(res, result.success ? 200 : 500, result);
        } else {
          sendJSONResponse(res, 400, { error: 'serverIp 또는 serverIps가 필요합니다.' });
        }
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Node Exporter 상태 확인 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/node-exporter/status') {
    const { serverIp } = parsedUrl.query;
    const { sshUser, sshKey, sshPassword } = parsedUrl.query;

    if (!serverIp) {
      return sendJSONResponse(res, 400, { error: 'serverIp가 필요합니다.' });
    }

    (async () => {
      try {
        const result = await checkNodeExporterStatus(serverIp, {
          sshUser,
          sshKey,
          sshPassword
        });
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // JMX Exporter 설치 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/jmx-exporter/install') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { serverIp, serverIps, sshUser, sshKey, sshPassword, jmxExporterVersion, jmxExporterPort, javaAppPort } = payload;

        const installOptions = {
          sshUser: sshUser || process.env.DEFAULT_SSH_USER || 'ubuntu',
          sshKey: sshKey || process.env.DEFAULT_SSH_KEY || null,
          sshPassword: sshPassword || null,
          jmxExporterVersion: jmxExporterVersion || process.env.JMX_EXPORTER_VERSION || '0.20.2',
          jmxExporterPort: jmxExporterPort || process.env.JMX_EXPORTER_PORT || '9404',
          javaAppPort: javaAppPort || process.env.JAVA_APP_JMX_PORT || '9999'
        };

        if (serverIps && Array.isArray(serverIps)) {
          const result = await installJmxExporterOnMultipleServers(serverIps, installOptions);
          sendJSONResponse(res, 200, result);
        } else if (serverIp) {
          const result = await installJmxExporter(serverIp, installOptions);
          sendJSONResponse(res, 200, result);
        } else {
          sendJSONResponse(res, 400, { error: 'serverIp 또는 serverIps가 필요합니다.' });
        }
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // JMX Exporter 삭제 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/jmx-exporter/uninstall') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { serverIp, serverIps, sshUser, sshKey, sshPassword } = payload;

        const uninstallOptions = {
          sshUser: sshUser || process.env.DEFAULT_SSH_USER || 'ubuntu',
          sshKey: sshKey || process.env.DEFAULT_SSH_KEY || null,
          sshPassword: sshPassword || null
        };

        if (serverIps && Array.isArray(serverIps)) {
          const result = await uninstallJmxExporterOnMultipleServers(serverIps, uninstallOptions);
          sendJSONResponse(res, 200, result);
        } else if (serverIp) {
          const result = await uninstallJmxExporter(serverIp, uninstallOptions);
          sendJSONResponse(res, 200, result);
        } else {
          sendJSONResponse(res, 400, { error: 'serverIp 또는 serverIps가 필요합니다.' });
        }
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // JMX Exporter 상태 확인 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/jmx-exporter/status') {
    const { serverIp } = parsedUrl.query;
    const { sshUser, sshKey, sshPassword } = parsedUrl.query;

    if (!serverIp) {
      return sendJSONResponse(res, 400, { error: 'serverIp가 필요합니다.' });
    }

    (async () => {
      try {
        const result = await checkJmxExporterStatus(serverIp, {
          sshUser,
          sshKey,
          sshPassword
        });
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Prometheus Job 추가 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/prometheus/jobs') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { jobName, targets, labels, sshUser, sshKey, createInfraDashboard, createJvmDashboard, enableLoki } = payload;

        if (!jobName || !targets || !Array.isArray(targets)) {
          return sendJSONResponse(res, 400, {
            error: 'jobName과 targets (배열)가 필요합니다.'
          });
        }

        // SSH 옵션이 제공된 경우 labels에 포함하여 전달
        const finalLabels = {
          ...labels,
          _sshUser: sshUser || process.env.DEFAULT_SSH_USER || 'ubuntu',
          _sshKey: sshKey || process.env.DEFAULT_SSH_KEY || null
        };

        const result = await addPrometheusJob({
          jobName,
          targets,
          labels: finalLabels,
          createInfraDashboard: createInfraDashboard !== undefined ? createInfraDashboard : null,
          createJvmDashboard: createJvmDashboard !== undefined ? createJvmDashboard : null,
          enableLoki: enableLoki !== undefined ? enableLoki : null
        });
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Prometheus Job 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/prometheus/jobs') {
    (async () => {
      try {
        const result = await getPrometheusJobs();
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Prometheus Target 상태 확인 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/prometheus/targets') {
    const { jobName } = parsedUrl.query;

    if (!jobName) {
      return sendJSONResponse(res, 400, { error: 'jobName이 필요합니다.' });
    }

    (async () => {
      try {
        const result = await getPrometheusTargets(jobName);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // VM별 등록 상태 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/prometheus/vm-status') {
    const { vmName } = parsedUrl.query;

    if (!vmName) {
      return sendJSONResponse(res, 400, { error: 'vmName이 필요합니다.' });
    }

    (async () => {
      try {
        const result = await getVmRegistrationStatus(vmName);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 기능별 추가 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/prometheus/add-features') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { vmName, ip, port, features, labels, sshUser, sshKey } = payload;

        if (!vmName || !ip) {
          return sendJSONResponse(res, 400, {
            error: 'vmName과 ip가 필요합니다.'
          });
        }

        // SSH 옵션이 제공된 경우 labels에 포함하여 전달
        const finalLabels = {
          ...labels,
          _sshUser: sshUser || process.env.DEFAULT_SSH_USER || 'ubuntu',
          _sshKey: sshKey || process.env.DEFAULT_SSH_KEY || null
        };

        const result = await addMonitoringFeatures({
          vmName,
          ip,
          port,
          features: features || {},
          labels: finalLabels
        });
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // 기능별 삭제 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/prometheus/remove-features') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { vmName, features } = payload;

        if (!vmName) {
          return sendJSONResponse(res, 400, {
            error: 'vmName이 필요합니다.'
          });
        }

        const result = await removeMonitoringFeatures({
          vmName,
          features: features || {}
        });
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Prometheus Job 삭제 API
  if (req.method === 'DELETE' && parsedUrl.pathname.startsWith('/api/prometheus/jobs/')) {
    const jobName = decodeURIComponent(parsedUrl.pathname.split('/').pop());
    
    (async () => {
      try {
        const { deletePrometheusJob } = require('./services/prometheusMonitoringService');
        const result = await deletePrometheusJob(jobName);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 템플릿 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/templates') {
    (async () => {
      try {
        const templates = await getTemplates();
        sendJSONResponse(res, 200, { success: true, templates });
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // VM 목록 조회 API (템플릿 상세 조회보다 먼저 체크)
  if (req.method === 'GET' && parsedUrl.pathname === '/api/templates/vms') {
    (async () => {
      try {
        const vms = await getVmList();
        sendJSONResponse(res, 200, { success: true, vms });
      } catch (error) {
        console.error('[Server] VM 목록 조회 API 에러:', error);
        sendJSONResponse(res, 500, { success: false, error: error.message, vms: [] });
      }
    })();
    return;
  }

  // 네트워크/VLAN 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/networks') {
    (async () => {
      try {
        const { getNetworks } = require('./services/templateService');
        const networks = await getNetworks();
        sendJSONResponse(res, 200, { success: true, networks });
      } catch (error) {
        console.error('[Server] 네트워크 목록 조회 API 에러:', error);
        sendJSONResponse(res, 500, { success: false, error: error.message, networks: [] });
      }
    })();
    return;
  }

  // 템플릿 상세 조회 API
  if (req.method === 'GET' && parsedUrl.pathname.startsWith('/api/templates/')) {
    const templateId = parsedUrl.pathname.split('/').pop();
    (async () => {
      try {
        const template = await getTemplateById(templateId);
        if (template) {
          sendJSONResponse(res, 200, { success: true, template });
        } else {
          sendJSONResponse(res, 404, { error: '템플릿을 찾을 수 없습니다.' });
        }
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 템플릿 생성 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/templates') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { vmName, templateName, description } = payload;

        if (!vmName || !templateName) {
          return sendJSONResponse(res, 400, { error: 'vmName과 templateName이 필요합니다.' });
        }

        const result = await convertVmToTemplate(vmName, templateName, { description });
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // 템플릿 삭제 API
  if (req.method === 'DELETE' && parsedUrl.pathname.startsWith('/api/templates/')) {
    const templateId = parsedUrl.pathname.split('/').pop();
    console.log(`[Server] 템플릿 삭제 요청: ${templateId}`);
    (async () => {
      try {
        const result = await deleteTemplate(templateId);
        console.log(`[Server] 템플릿 삭제 성공: ${templateId}`, result);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        console.error(`[Server] 템플릿 삭제 실패: ${templateId}`, error);
        sendJSONResponse(res, 500, { 
          error: error.message || '템플릿 삭제 중 오류가 발생했습니다.',
          success: false
        });
      }
    })();
    return;
  }

  // VM 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/vms') {
    (async () => {
      try {
        const vms = await getVmList();
        sendJSONResponse(res, 200, { success: true, vms });
      } catch (error) {
        console.error('[Server] VM 목록 조회 API 에러:', error);
        sendJSONResponse(res, 500, { success: false, error: error.message, vms: [] });
      }
    })();
    return;
  }

  // 오토스케일링 설정 생성 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/autoscaling/configs') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const config = await saveConfig(payload);
        
        // 설정이 enabled=true로 생성된 경우 자동으로 Jenkins Job 생성
        if (config.enabled) {
          try {
            const { createAlertRule } = require('./services/prometheusAlertService');
            const { addRoutingRule } = require('./services/alertmanagerService');
            const { createJenkinsJob } = require('./services/jenkinsService');
            
            // Alert Rule 생성
            await createAlertRule(config);
            
            // Alertmanager 라우팅 규칙 추가
            await addRoutingRule(config);
            
            // Jenkins Job 생성
            await createJenkinsJob(config);
            
            console.log(`[Server] 오토스케일링 설정 생성 및 Jenkins Job 생성 완료: ${config.serviceName}`);
          } catch (error) {
            console.error(`[Server] Jenkins Job 생성 실패 (설정은 저장됨):`, error);
            // Jenkins Job 생성 실패해도 설정은 저장됨 (경고만)
          }
        }
        
        sendJSONResponse(res, 200, { success: true, config });
      } catch (error) {
        sendJSONResponse(res, 400, { error: error.message });
      }
    });
    return;
  }

  // 오토스케일링 설정 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/autoscaling/configs') {
    const { enabled, serviceName } = parsedUrl.query;
    (async () => {
      try {
        const filters = {};
        if (enabled !== undefined) filters.enabled = enabled === 'true';
        if (serviceName) filters.serviceName = serviceName;
        const configs = await getConfigs(filters);
        sendJSONResponse(res, 200, { success: true, configs });
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 오토스케일링 설정 상세 조회 API
  if (req.method === 'GET' && parsedUrl.pathname.startsWith('/api/autoscaling/configs/')) {
    const configId = parsedUrl.pathname.split('/').pop();
    (async () => {
      try {
        const config = await getConfigById(configId);
        if (config) {
          sendJSONResponse(res, 200, { success: true, config });
        } else {
          sendJSONResponse(res, 404, { error: '설정을 찾을 수 없습니다.' });
        }
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 오토스케일링 설정 수정 API
  if (req.method === 'PUT' && parsedUrl.pathname.startsWith('/api/autoscaling/configs/')) {
    const configId = parsedUrl.pathname.split('/').pop();
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const config = await updateConfig(configId, payload);
        sendJSONResponse(res, 200, { success: true, config });
      } catch (error) {
        sendJSONResponse(res, 400, { error: error.message });
      }
    });
    return;
  }

  // 오토스케일링 설정 삭제 API
  if (req.method === 'DELETE' && parsedUrl.pathname.startsWith('/api/autoscaling/configs/')) {
    const configId = parsedUrl.pathname.split('/').pop();
    (async () => {
      try {
        const result = await deleteConfig(configId);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 오토스케일링 설정 활성화/비활성화 API
  if (req.method === 'POST' && parsedUrl.pathname.includes('/api/autoscaling/configs/') &&
    (parsedUrl.pathname.endsWith('/enable') || parsedUrl.pathname.endsWith('/disable'))) {
    const pathParts = parsedUrl.pathname.split('/');
    const configId = pathParts[pathParts.length - 2];
    const action = pathParts[pathParts.length - 1];
    (async () => {
      try {
        const enabled = action === 'enable';
        const config = await setConfigEnabled(configId, enabled);
        sendJSONResponse(res, 200, { success: true, config, message: `설정이 ${enabled ? '활성화' : '비활성화'}되었습니다.` });
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Prometheus Alert Rule 생성 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/prometheus/alert-rules') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const result = await createAlertRule(payload);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Prometheus Alert Rule 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/prometheus/alert-rules') {
    (async () => {
      try {
        const result = await getAlertRules();
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Prometheus Alert Rule 삭제 API
  if (req.method === 'DELETE' && parsedUrl.pathname.startsWith('/api/prometheus/alert-rules/')) {
    const serviceName = decodeURIComponent(parsedUrl.pathname.split('/').pop());
    (async () => {
      try {
        const result = await deleteAlertRule(serviceName);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Alertmanager 라우팅 규칙 추가 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/alertmanager/routing-rules') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const result = await addRoutingRule(payload);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Alertmanager 라우팅 규칙 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/alertmanager/routing-rules') {
    (async () => {
      try {
        const result = await getRoutingRules();
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Alertmanager 라우팅 규칙 삭제 API
  if (req.method === 'DELETE' && parsedUrl.pathname.startsWith('/api/alertmanager/routing-rules/')) {
    const serviceName = decodeURIComponent(parsedUrl.pathname.split('/').pop());
    (async () => {
      try {
        const result = await deleteRoutingRule(serviceName);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Jenkins Job 생성 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/jenkins/jobs') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const result = await createJenkinsJob(payload);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Jenkins Job 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/jenkins/jobs') {
    (async () => {
      try {
        const result = await getJenkinsJobs();
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Jenkins Job 빌드 이력 조회 API
  if (req.method === 'GET' && parsedUrl.pathname.match(/^\/api\/jenkins\/jobs\/[^/]+\/builds$/)) {
    const pathParts = parsedUrl.pathname.split('/');
    const jobName = decodeURIComponent(pathParts[pathParts.length - 2]);
    (async () => {
      try {
        const { getJenkinsJobBuilds } = require('./services/jenkinsService');
        const result = await getJenkinsJobBuilds(jobName);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Jenkins Job 상태 조회 API
  if (req.method === 'GET' && parsedUrl.pathname.startsWith('/api/jenkins/jobs/')) {
    const jobName = decodeURIComponent(parsedUrl.pathname.split('/').pop());
    (async () => {
      try {
        const result = await getJenkinsJobStatus(jobName);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Jenkins Job 삭제 API
  if (req.method === 'DELETE' && parsedUrl.pathname.startsWith('/api/jenkins/jobs/')) {
    const jobName = decodeURIComponent(parsedUrl.pathname.split('/').pop());
    (async () => {
      try {
        const result = await deleteJenkinsJob(jobName);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Jenkins Job 빌드 실행 API
  if (req.method === 'POST' && parsedUrl.pathname.startsWith('/api/jenkins/jobs/') && parsedUrl.pathname.endsWith('/build')) {
    const jobName = decodeURIComponent(parsedUrl.pathname.split('/').slice(-2, -1)[0]);
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const parameters = payload.parameters || {};
        const result = await triggerJenkinsJob(jobName, parameters);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // SSH 설정 조회 API (SSH 키 목록 + 기본 설정)
  if (req.method === 'GET' && parsedUrl.pathname === '/api/ssh-config') {
    (async () => {
      try {
        const fs = require('fs').promises;
        const path = require('path');
        // SSH 키 디렉토리를 환경 변수로 설정 가능하도록 변경
        const sshKeyDir = process.env.SSH_KEY_DIR || '/home/ubuntu/workspace/vm-autoscaling/pemkey';
        const defaultSshUser = process.env.DEFAULT_SSH_USER || 'ubuntu';

        try {
          const files = await fs.readdir(sshKeyDir);
          const sshKeys = [];

          for (const file of files) {
            const filePath = path.join(sshKeyDir, file);
            const stats = await fs.stat(filePath);

            // 일반 파일만 (디렉토리 제외)
            if (stats.isFile()) {
              sshKeys.push({
                label: file,
                value: filePath
              });
            }
          }

          // 기본 SSH 키 선택 (환경 변수 또는 첫 번째 키)
          const defaultSshKey = process.env.DEFAULT_SSH_KEY 
            ? sshKeys.find(k => k.value === process.env.DEFAULT_SSH_KEY)?.value || sshKeys[0]?.value || ''
            : sshKeys[0]?.value || '';

          sendJSONResponse(res, 200, {
            success: true,
            sshKeys: sshKeys,
            defaultSshUser: defaultSshUser,
            defaultSshKey: defaultSshKey
          });
        } catch (error) {
          console.error('[API] SSH 키 디렉토리 읽기 실패:', error.message);
          sendJSONResponse(res, 200, {
            success: true,
            sshKeys: [],
            defaultSshUser: defaultSshUser,
            defaultSshKey: ''
          });
        }
      } catch (error) {
        console.error('[API] SSH 설정 조회 실패:', error.message);
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // SSH 키 목록 조회 API (하위 호환성 유지)
  if (req.method === 'GET' && parsedUrl.pathname === '/api/ssh-keys') {
    (async () => {
      try {
        const fs = require('fs').promises;
        const path = require('path');
        const sshKeyDir = process.env.SSH_KEY_DIR || '/home/ubuntu/workspace/vm-autoscaling/pemkey';

        try {
          const files = await fs.readdir(sshKeyDir);
          const sshKeys = [];

          for (const file of files) {
            const filePath = path.join(sshKeyDir, file);
            const stats = await fs.stat(filePath);

            // 일반 파일만 (디렉토리 제외)
            if (stats.isFile()) {
              sshKeys.push({
                name: file,
                path: filePath
              });
            }
          }

          sendJSONResponse(res, 200, {
            success: true,
            keys: sshKeys
          });
        } catch (error) {
          console.error('[API] SSH 키 디렉토리 읽기 실패:', error.message);
          sendJSONResponse(res, 200, {
            success: true,
            keys: []
          });
        }
      } catch (error) {
        console.error('[API] SSH 키 목록 조회 실패:', error.message);
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }



  // Webhook 엔드포인트: Alertmanager에서 받은 webhook을 설정 정보와 함께 Jenkins에 전달
  if (req.method === 'POST' && parsedUrl.pathname.startsWith('/api/webhook/autoscale/')) {
    const serviceName = decodeURIComponent(parsedUrl.pathname.split('/').pop());
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const alertmanagerPayload = JSON.parse(body || '{}');
        
        // 설정 정보 조회
        const { getConfigs } = require('./services/autoscalingService');
        const { getTemplateById } = require('./services/templateService');
        const { checkCooldown } = require('./services/cooldownService');
        const configs = await getConfigs();
        const config = configs.find(c => c.serviceName === serviceName && c.enabled);
        
        if (!config) {
          console.warn(`[Webhook] 설정을 찾을 수 없습니다: ${serviceName}`);
          sendJSONResponse(res, 404, { error: `설정을 찾을 수 없습니다: ${serviceName}` });
          return;
        }

        // Alert 타입 확인 (스케일아웃 vs 스케일인)
        const alerts = alertmanagerPayload.alerts || [];
        const alertName = alerts[0]?.labels?.alertname || '';
        const isScaleOut = alertName.includes('HighResourceUsage');
        const isScaleIn = alertName.includes('LowResourceUsage');
        const scaleAction = isScaleOut ? 'scale-out' : (isScaleIn ? 'scale-in' : null);

        // 쿨다운 체크
        if (scaleAction) {
          const cooldownStatus = await checkCooldown(serviceName, scaleAction);
          if (cooldownStatus.inCooldown) {
            console.log(`[Webhook] 쿨다운 중: ${serviceName} - ${scaleAction} (${cooldownStatus.remainingTime}초 남음)`);
            sendJSONResponse(res, 200, {
              success: false,
              message: `쿨다운 중입니다. ${cooldownStatus.remainingTime}초 후에 다시 시도하세요.`,
              cooldownStatus: cooldownStatus
            });
            return;
          }
        }

        // 스케일인인 경우 삭제할 VM 선택
        let vmToDelete = null;
        if (isScaleIn) {
          try {
            // 최소 VM 개수 확인
            const minVms = config.scaling?.minVms || 1;
            
            // Prometheus Job에서 현재 등록된 VM 목록 가져오기
            const prometheusJobName = config.monitoring?.prometheusJobName;
            if (prometheusJobName) {
              const { getPrometheusTargets } = require('./services/prometheusMonitoringService');
              const targetsResult = await getPrometheusTargets(prometheusJobName);
              
              if (targetsResult.success && targetsResult.targets && targetsResult.targets.length > minVms) {
                // VM 목록에서 vmPrefix로 시작하는 VM만 필터링
                const { getVmList } = require('./services/templateService');
                const vmListResult = await getVmList();
                
                if (vmListResult.success && vmListResult.vms) {
                  const vmPrefix = config.vmPrefix || '';
                  const serviceVms = vmListResult.vms.filter(vm => {
                    // vmPrefix로 시작하는 VM만 선택
                    if (vmPrefix && !vm.name.startsWith(vmPrefix)) {
                      return false;
                    }
                    // Prometheus Job에 등록된 VM만 선택 (IP로 매칭)
                    const vmIp = vm.ips && vm.ips.length > 0 ? vm.ips[0] : null;
                    return vmIp && targetsResult.targets.some(target => target.instance === vmIp);
                  });

                  if (serviceVms.length > minVms) {
                    // 가장 오래된 VM 선택 (FIFO - First In First Out)
                    // VM 이름에서 숫자 부분을 추출하여 정렬 (예: auto-vm-test-01, auto-vm-test-02)
                    const sortedVms = serviceVms.sort((a, b) => {
                      // 숫자 부분 추출 및 비교
                      const aMatch = a.name.match(/(\d+)$/);
                      const bMatch = b.name.match(/(\d+)$/);
                      if (aMatch && bMatch) {
                        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
                      }
                      // 숫자가 없으면 이름으로 정렬
                      return a.name.localeCompare(b.name);
                    });

                    // 가장 오래된 VM 선택 (첫 번째)
                    const selectedVm = sortedVms[0];
                    vmToDelete = {
                      name: selectedVm.name,
                      ip: selectedVm.ips && selectedVm.ips.length > 0 ? selectedVm.ips[0] : null
                    };

                    console.log(`[Webhook] 삭제할 VM 선택: ${vmToDelete.name} (${vmToDelete.ip})`);
                  } else {
                    console.warn(`[Webhook] 최소 VM 개수(${minVms})에 도달하여 스케일인 불가`);
                    sendJSONResponse(res, 200, {
                      success: false,
                      message: `최소 VM 개수(${minVms})에 도달하여 스케일인할 수 없습니다.`
                    });
                    return;
                  }
                }
              } else {
                console.warn(`[Webhook] 현재 VM 개수(${targetsResult.targets?.length || 0})가 최소 개수(${minVms}) 이하여서 스케일인 불가`);
                sendJSONResponse(res, 200, {
                  success: false,
                  message: `현재 VM 개수가 최소 개수(${minVms}) 이하여서 스케일인할 수 없습니다.`
                });
                return;
              }
            }
          } catch (error) {
            console.error(`[Webhook] 삭제할 VM 선택 실패:`, error.message);
            // VM 선택 실패해도 계속 진행 (Jenkins에서 선택하도록)
          }
        }
        
        // 템플릿 정보 조회
        let templateName = '';
        if (config.templateId) {
          try {
            const template = await getTemplateById(config.templateId);
            if (template) {
              templateName = template.name;
            }
          } catch (error) {
            console.warn(`[Webhook] 템플릿 조회 실패:`, error.message);
          }
        }
        
        // Jenkins에 전달할 payload 구성 (설정 정보 포함)
        const jenkinsPayload = {
          alerts: alertmanagerPayload.alerts || [],
          scaleAction: scaleAction, // 'scale-out' 또는 'scale-in'
          vmToDelete: vmToDelete, // 스케일인인 경우 삭제할 VM 정보
          config: {
            serviceName: serviceName,
            templateName: templateName,
            vmPrefix: config.vmPrefix || '',
            sshKeyPath: config.sshKeyPath || '',
            scaling: {
              minVms: config.scaling?.minVms || 1,
              maxVms: config.scaling?.maxVms || 10,
              scaleOutStep: config.scaling?.scaleOutStep || 1,
              scaleInStep: config.scaling?.scaleInStep || 1,
              cooldownPeriod: config.scaling?.cooldownPeriod || 300
            },
            monitoring: {
              prometheusJobName: config.monitoring?.prometheusJobName || ''
            },
            network: {
              ipPoolStart: config.network?.ipPoolStart || '',
              ipPoolEnd: config.network?.ipPoolEnd || '',
              subnet: config.network?.subnet || '255.255.255.0',
              gateway: config.network?.gateway || '',
              vlan: config.network?.vlan || ''
            },
            f5: {
              poolName: config.f5?.poolName || '',
              vip: config.f5?.vip || '',
              vipPort: config.f5?.vipPort || '80',
              healthCheckPath: config.f5?.healthCheckPath || '/'
            }
          }
        };
        
        // Jenkins webhook 호출
        const { triggerJenkinsJob } = require('./services/jenkinsService');
        const JENKINS_URL = process.env.JENKINS_URL || 'http://10.255.0.103:8080';
        
        // 스케일인/스케일아웃에 따라 다른 Job 호출
        let jobName, webhookToken, webhookUrl;
        if (isScaleIn) {
          // 스케일인: plg-autoscale-in Job 사용
          jobName = 'plg-autoscale-in';
          webhookToken = 'plg-autoscale-in-token';
          webhookUrl = `${JENKINS_URL}/generic-webhook-trigger/invoke?token=${webhookToken}`;
        } else {
          // 스케일아웃: 서비스별 Job 사용
          jobName = `autoscale-${serviceName.toLowerCase().replace(/\s+/g, '-')}`;
          webhookToken = `autoscale-${serviceName.toLowerCase().replace(/\s+/g, '-')}-token`;
          webhookUrl = `${JENKINS_URL}/generic-webhook-trigger/invoke?token=${webhookToken}`;
        }
        
        // Jenkins webhook에 POST 요청
        const axios = require('axios');
        const JENKINS_WEBHOOK_USER = process.env.JENKINS_WEBHOOK_USER || 'danacloud';
        const JENKINS_WEBHOOK_PASSWORD = process.env.JENKINS_WEBHOOK_PASSWORD || '!danacloud12';
        
        await axios.post(webhookUrl, jenkinsPayload, {
          auth: {
            username: JENKINS_WEBHOOK_USER,
            password: JENKINS_WEBHOOK_PASSWORD
          },
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`[Webhook] Jenkins Job 트리거 완료: ${jobName}`);
        sendJSONResponse(res, 200, { 
          success: true, 
          message: 'Webhook이 Jenkins에 전달되었습니다.',
          jobName: jobName
        });
      } catch (error) {
        console.error(`[Webhook] 처리 실패:`, error.message);
        sendJSONResponse(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Jenkins 웹훅 콜백: VM 삭제 완료 후 호출 (스케일인)
  if (req.method === 'POST' && parsedUrl.pathname === '/api/webhook/jenkins/vm-deleted') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { serviceName, vmName, vmIp, prometheusJobName, f5PoolName, f5VipPort } = payload;

        if (!serviceName || !vmName || !vmIp || !prometheusJobName) {
          sendJSONResponse(res, 400, { 
            success: false, 
            error: '필수 파라미터가 누락되었습니다. (serviceName, vmName, vmIp, prometheusJobName 필요)' 
          });
          return;
        }

        console.log(`[Webhook] VM 삭제 완료 수신: ${serviceName} - ${vmName} (${vmIp})`);

        // 1. Prometheus Job에서 target 제거
        const nodeExporterPort = process.env.NODE_EXPORTER_PORT || '9100';
        const target = `${vmIp}:${nodeExporterPort}`;
        
        try {
          await removeTargetFromJob(prometheusJobName, target);
          console.log(`[Webhook] Prometheus Job에서 target 제거 완료: ${prometheusJobName} - ${target}`);
        } catch (error) {
          console.error(`[Webhook] Prometheus Job에서 target 제거 실패:`, error.message);
          // Prometheus 제거 실패해도 계속 진행 (경고만)
        }

        // 2. 쿨다운 시작
        try {
          const { startCooldown } = require('./services/cooldownService');
          // 설정에서 쿨다운 기간 가져오기 (기본값: 5분)
          const { getConfigs } = require('./services/autoscalingService');
          const configs = await getConfigs();
          const config = configs.find(c => c.serviceName === serviceName);
          const cooldownPeriod = config?.scaling?.cooldownPeriod || 300;
          
          await startCooldown(serviceName, 'scale-in', cooldownPeriod);
          console.log(`[Webhook] 쿨다운 시작: ${serviceName} - scale-in`);
        } catch (error) {
          console.error(`[Webhook] 쿨다운 시작 실패 (경고):`, error.message);
          // 쿨다운 시작 실패해도 계속 진행
        }

        sendJSONResponse(res, 200, {
          success: true,
          message: `VM 삭제 완료 처리 완료: ${vmName}`,
          serviceName: serviceName,
          vmName: vmName,
          vmIp: vmIp,
          prometheusJobName: prometheusJobName
        });
      } catch (error) {
        console.error(`[Webhook] VM 삭제 완료 처리 실패:`, error);
        sendJSONResponse(res, 500, { 
          success: false,
          error: error.message 
        });
      }
    });
    return;
  }

  // Jenkins 웹훅 콜백: VM 생성 완료 후 호출 (스케일아웃)
  if (req.method === 'POST' && parsedUrl.pathname === '/api/webhook/jenkins/vm-created') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { serviceName, vmName, vmIp, prometheusJobName, f5PoolName, f5VipPort } = payload;

        if (!serviceName || !vmName || !vmIp || !prometheusJobName) {
          sendJSONResponse(res, 400, { 
            success: false, 
            error: '필수 파라미터가 누락되었습니다. (serviceName, vmName, vmIp, prometheusJobName 필요)' 
          });
          return;
        }

        console.log(`[Webhook] VM 생성 완료 수신: ${serviceName} - ${vmName} (${vmIp})`);

        // 1. Prometheus Job에 새 target 추가
        const nodeExporterPort = process.env.NODE_EXPORTER_PORT || '9100';
        const target = `${vmIp}:${nodeExporterPort}`;
        
        try {
          await addTargetToJob(prometheusJobName, target, {
            service: serviceName,
            vmName: vmName
          });
          console.log(`[Webhook] Prometheus Job에 target 추가 완료: ${prometheusJobName} - ${target}`);
        } catch (error) {
          console.error(`[Webhook] Prometheus Job에 target 추가 실패:`, error.message);
          // Prometheus 추가 실패해도 계속 진행 (경고만)
        }

        // 2. 쿨다운 시작
        try {
          const { startCooldown } = require('./services/cooldownService');
          // 설정에서 쿨다운 기간 가져오기 (기본값: 5분)
          const { getConfigs } = require('./services/autoscalingService');
          const configs = await getConfigs();
          const config = configs.find(c => c.serviceName === serviceName);
          const cooldownPeriod = config?.scaling?.cooldownPeriod || 300;
          
          await startCooldown(serviceName, 'scale-out', cooldownPeriod);
          console.log(`[Webhook] 쿨다운 시작: ${serviceName} - scale-out`);
        } catch (error) {
          console.error(`[Webhook] 쿨다운 시작 실패 (경고):`, error.message);
          // 쿨다운 시작 실패해도 계속 진행
        }

        sendJSONResponse(res, 200, {
          success: true,
          message: `VM 생성 완료 처리 완료: ${vmName}`,
          serviceName: serviceName,
          vmName: vmName,
          vmIp: vmIp,
          prometheusJobName: prometheusJobName
        });
      } catch (error) {
        console.error(`[Webhook] VM 생성 완료 처리 실패:`, error);
        sendJSONResponse(res, 500, { 
          success: false,
          error: error.message 
        });
      }
    });
    return;
  }

  // F5 Pool 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/f5/pools') {
    (async () => {
      try {
        const result = await getF5Pools();
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // F5 VIP 목록 조회 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/f5/vips') {
    (async () => {
      try {
        const result = await getF5VirtualServers();
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 디버깅: Prometheus Alert 상태 확인 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/debug/prometheus/alerts') {
    (async () => {
      try {
        const axios = require('axios');
        const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://10.255.1.254:9090';
        const response = await axios.get(`${PROMETHEUS_URL}/api/v1/alerts`);
        sendJSONResponse(res, 200, {
          success: true,
          alerts: response.data.data.alerts || []
        });
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // Alertmanager Alerts 조회 API (프록시)
  if (req.method === 'GET' && parsedUrl.pathname === '/api/alerts') {
    (async () => {
      try {
        const axios = require('axios');
        const ALERTMANAGER_URL = process.env.ALERTMANAGER_URL || 'http://10.255.1.254:9093';
        const response = await axios.get(`${ALERTMANAGER_URL}/api/v2/alerts`);
        sendJSONResponse(res, 200, response.data);
      } catch (error) {
        console.error('[API] Alertmanager 조회 실패:', error.message);
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 디버깅: Alertmanager 상태 확인 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/debug/alertmanager/status') {
    (async () => {
      try {
        const axios = require('axios');
        const ALERTMANAGER_URL = process.env.ALERTMANAGER_URL || 'http://10.255.1.254:9093';
        const [statusResponse, alertsResponse, silencesResponse] = await Promise.all([
          axios.get(`${ALERTMANAGER_URL}/api/v2/status`).catch(() => ({ data: null })),
          axios.get(`${ALERTMANAGER_URL}/api/v2/alerts`).catch(() => ({ data: [] })),
          axios.get(`${ALERTMANAGER_URL}/api/v2/silences`).catch(() => ({ data: [] }))
        ]);
        sendJSONResponse(res, 200, {
          success: true,
          status: statusResponse.data,
          alerts: alertsResponse.data || [],
          silences: silencesResponse.data || []
        });
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 디버깅: Alert Rules 확인 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/debug/alert-rules') {
    (async () => {
      try {
        const result = await getAlertRules();
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 디버깅: Alertmanager 라우팅 규칙 확인 API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/debug/alertmanager/routes') {
    (async () => {
      try {
        const result = await getRoutingRules();
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 404 Not Found
  sendJSONResponse(res, 404, { error: 'Not Found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[VM Autoscaling Backend] Server running on port ${PORT}`);
  console.log(`[VM Autoscaling Backend] Listening on all interfaces (0.0.0.0:${PORT})`);
  console.log(`[VM Autoscaling Backend] Health check: http://localhost:${PORT}/health`);
  console.log(`[VM Autoscaling Backend] Internal access: http://10.255.48.253:${PORT}/health`);
  console.log(`[VM Autoscaling Backend] External access: http://121.156.103.69:${PORT}/health`);
  
  // vCenter 연결 모니터링 시작
  startVCenterConnectionMonitor();
});

