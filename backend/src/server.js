const http = require('http');
const url = require('url');
const { installNodeExporter, checkNodeExporterStatus, installNodeExporterOnMultipleServers } = require('./services/nodeExporterService');
const { addPrometheusJob, getPrometheusJobs, getPrometheusTargets } = require('./services/prometheusMonitoringService');
const { getTemplates, getTemplateById, convertVmToTemplate, deleteTemplate, getVmList } = require('./services/templateService');

const PORT = process.env.PORT || 4000;

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

  // Node Exporter 설치 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/node-exporter/install') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { serverIp, serverIps, sshUser, sshKey, sshPassword } = payload;

        if (serverIps && Array.isArray(serverIps)) {
          // 여러 서버에 설치
          const result = await installNodeExporterOnMultipleServers(serverIps, {
            sshUser,
            sshKey,
            sshPassword
          });
          sendJSONResponse(res, 200, result);
        } else if (serverIp) {
          // 단일 서버에 설치
          const result = await installNodeExporter(serverIp, {
            sshUser,
            sshKey,
            sshPassword
          });
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

  // Prometheus Job 추가 API
  if (req.method === 'POST' && parsedUrl.pathname === '/api/prometheus/jobs') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { jobName, targets, labels } = payload;

        if (!jobName || !targets || !Array.isArray(targets)) {
          return sendJSONResponse(res, 400, { 
            error: 'jobName과 targets (배열)가 필요합니다.' 
          });
        }

        const result = await addPrometheusJob({
          jobName,
          targets,
          labels
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
    (async () => {
      try {
        const result = await deleteTemplate(templateId);
        sendJSONResponse(res, 200, result);
      } catch (error) {
        sendJSONResponse(res, 500, { error: error.message });
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
        sendJSONResponse(res, 500, { error: error.message });
      }
    })();
    return;
  }

  // 404 Not Found
  sendJSONResponse(res, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`[VM Autoscaling Backend] Server running on port ${PORT}`);
  console.log(`[VM Autoscaling Backend] Health check: http://localhost:${PORT}/health`);
});

