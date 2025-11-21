const http = require('http');
const url = require('url');
const { installNodeExporter, checkNodeExporterStatus, installNodeExporterOnMultipleServers } = require('./services/nodeExporterService');
const { addPrometheusJob, getPrometheusJobs, getPrometheusTargets } = require('./services/prometheusMonitoringService');

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

  // 404 Not Found
  sendJSONResponse(res, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`[VM Autoscaling Backend] Server running on port ${PORT}`);
  console.log(`[VM Autoscaling Backend] Health check: http://localhost:${PORT}/health`);
});

