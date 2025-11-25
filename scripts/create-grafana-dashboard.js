#!/usr/bin/env node

/**
 * Grafana 대시보드 생성 스크립트
 * 사용법: node scripts/create-grafana-dashboard.js <jobName> <dashboardTitle>
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const GRAFANA_URL = process.env.GRAFANA_URL || 'http://10.255.1.254:3000';
const GRAFANA_USER = process.env.GRAFANA_USER || 'admin';
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD || 'admin123';

// HTTP/HTTPS 요청 함수
function makeRequest(url, method, data, auth) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    };

    const req = client.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(result)}`));
          }
        } catch (error) {
          reject(new Error(`응답 파싱 실패: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`요청 실패: ${error.message}`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Grafana 대시보드 생성
async function createDashboard(jobName, dashboardTitle, auth) {
  
  const dashboard = {
    dashboard: {
      title: dashboardTitle,
      tags: ['monitoring', 'vm', jobName],
      timezone: 'browser',
      schemaVersion: 16,
      version: 0,
      refresh: '10s',
      panels: [
        // CPU 사용률 패널
        {
          id: 1,
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          title: 'CPU 사용률',
          type: 'graph',
          targets: [
            {
              expr: `100 - (avg(rate(node_cpu_seconds_total{mode="idle",job="${jobName}"}[5m])) * 100)`,
              legendFormat: 'CPU 사용률',
              refId: 'A'
            }
          ],
          yaxes: [
            { format: 'percent', min: 0, max: 100 },
            { format: 'short' }
          ]
        },
        // Memory 사용률 패널
        {
          id: 2,
          gridPos: { x: 12, y: 0, w: 12, h: 8 },
          title: 'Memory 사용률',
          type: 'graph',
          targets: [
            {
              expr: `(1 - (avg(node_memory_MemAvailable_bytes{job="${jobName}"}) / avg(node_memory_MemTotal_bytes{job="${jobName}"}))) * 100`,
              legendFormat: 'Memory 사용률',
              refId: 'A'
            }
          ],
          yaxes: [
            { format: 'percent', min: 0, max: 100 },
            { format: 'short' }
          ]
        },
        // CPU 사용률 (인스턴스별)
        {
          id: 3,
          gridPos: { x: 0, y: 8, w: 12, h: 8 },
          title: 'CPU 사용률 (인스턴스별)',
          type: 'graph',
          targets: [
            {
              expr: `100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle",job="${jobName}"}[5m])) * 100)`,
              legendFormat: '{{instance}}',
              refId: 'A'
            }
          ],
          yaxes: [
            { format: 'percent', min: 0, max: 100 },
            { format: 'short' }
          ]
        },
        // Memory 사용률 (인스턴스별)
        {
          id: 4,
          gridPos: { x: 12, y: 8, w: 12, h: 8 },
          title: 'Memory 사용률 (인스턴스별)',
          type: 'graph',
          targets: [
            {
              expr: `(1 - (avg by (instance) (node_memory_MemAvailable_bytes{job="${jobName}"}) / avg by (instance) (node_memory_MemTotal_bytes{job="${jobName}"}))) * 100`,
              legendFormat: '{{instance}}',
              refId: 'A'
            }
          ],
          yaxes: [
            { format: 'percent', min: 0, max: 100 },
            { format: 'short' }
          ]
        },
        // Disk 사용률
        {
          id: 5,
          gridPos: { x: 0, y: 16, w: 12, h: 8 },
          title: 'Disk 사용률',
          type: 'graph',
          targets: [
            {
              expr: `100 - ((avg(node_filesystem_avail_bytes{job="${jobName}",fstype!="rootfs"}) / avg(node_filesystem_size_bytes{job="${jobName}",fstype!="rootfs"})) * 100)`,
              legendFormat: 'Disk 사용률',
              refId: 'A'
            }
          ],
          yaxes: [
            { format: 'percent', min: 0, max: 100 },
            { format: 'short' }
          ]
        },
        // Network I/O
        {
          id: 6,
          gridPos: { x: 12, y: 16, w: 12, h: 8 },
          title: 'Network I/O',
          type: 'graph',
          targets: [
            {
              expr: `rate(node_network_receive_bytes_total{job="${jobName}"}[5m])`,
              legendFormat: '{{instance}} - Receive',
              refId: 'A'
            },
            {
              expr: `rate(node_network_transmit_bytes_total{job="${jobName}"}[5m])`,
              legendFormat: '{{instance}} - Transmit',
              refId: 'B'
            }
          ],
          yaxes: [
            { format: 'bytes' },
            { format: 'short' }
          ]
        }
      ],
      time: {
        from: 'now-6h',
        to: 'now'
      },
      timepicker: {
        refresh_intervals: ['10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d']
      }
    },
    overwrite: false
  };

  try {
    const response = await makeRequest(
      `${GRAFANA_URL}/api/dashboards/db`,
      'POST',
      dashboard,
      auth
    );

    return {
      success: true,
      dashboard: response,
      url: `${GRAFANA_URL}${response.url}`
    };
  } catch (error) {
    throw new Error(`대시보드 생성 실패: ${error.message}`);
  }
}

// 명령줄 인자 파싱
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('사용법: node scripts/create-grafana-dashboard.js <jobName> <dashboardTitle>');
  console.error('예시: node scripts/create-grafana-dashboard.js vm-service-01 "VM Service 01 모니터링"');
  process.exit(1);
}

const jobName = args[0];
const dashboardTitle = args[1];

// Basic Auth 생성
const auth = Buffer.from(`${GRAFANA_USER}:${GRAFANA_PASSWORD}`).toString('base64');

console.log(`Grafana 대시보드 생성 중...`);
console.log(`Job 이름: ${jobName}`);
console.log(`대시보드 제목: ${dashboardTitle}`);
console.log(`Grafana URL: ${GRAFANA_URL}`);
console.log('');

createDashboard(jobName, dashboardTitle, auth)
  .then(result => {
    console.log('✅ 성공: 대시보드가 생성되었습니다.');
    console.log(`대시보드 URL: ${result.url}`);
    console.log('');
    console.log('대시보드에서 다음 메트릭을 확인할 수 있습니다:');
    console.log('- CPU 사용률');
    console.log('- Memory 사용률');
    console.log('- Disk 사용률');
    console.log('- Network I/O');
  })
  .catch(error => {
    console.error('❌ 실패:', error.message);
    process.exit(1);
  });

