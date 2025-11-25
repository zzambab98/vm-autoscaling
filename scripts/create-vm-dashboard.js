#!/usr/bin/env node

/**
 * VM 최적화 Grafana 대시보드 생성 스크립트
 * 사용법: node scripts/create-vm-dashboard.js <jobName> <dashboardTitle> [hostIP]
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

// VM 최적화 대시보드 생성
async function createVMDashboard(jobName, dashboardTitle, hostIP, auth) {
  // Job을 호스트 단위로 생성하므로 job 라벨을 기준으로 필터링한다.
  const labelFilter = `job="${jobName}"`;
  
  const dashboard = {
    dashboard: {
      title: dashboardTitle,
      tags: ['monitoring', 'vm', 'node-exporter', jobName],
      timezone: 'browser',
      schemaVersion: 38,
      version: 0,
      refresh: '10s',
      panels: [
        // === 상단 요약 패널 (Stat) ===
        {
          id: 1,
          gridPos: { x: 0, y: 0, w: 6, h: 4 },
          title: 'CPU 사용률',
          type: 'stat',
          targets: [{
            expr: `100 - (avg(rate(node_cpu_seconds_total{mode="idle",${labelFilter}}[5m])) * 100)`,
            refId: 'A'
          }],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              thresholds: {
                mode: 'absolute',
                steps: [
                  { value: 0, color: 'green' },
                  { value: 70, color: 'yellow' },
                  { value: 85, color: 'red' }
                ]
              }
            }
          },
          options: {
            graphMode: 'area',
            textMode: 'value_and_name',
            colorMode: 'value'
          }
        },
        {
          id: 2,
          gridPos: { x: 6, y: 0, w: 6, h: 4 },
          title: 'Memory 사용률',
          type: 'stat',
          targets: [{
            expr: `(1 - (avg(node_memory_MemAvailable_bytes{${labelFilter}}) / avg(node_memory_MemTotal_bytes{${labelFilter}}))) * 100`,
            refId: 'A'
          }],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              thresholds: {
                mode: 'absolute',
                steps: [
                  { value: 0, color: 'green' },
                  { value: 70, color: 'yellow' },
                  { value: 85, color: 'red' }
                ]
              }
            }
          },
          options: {
            graphMode: 'area',
            textMode: 'value_and_name',
            colorMode: 'value'
          }
        },
        {
          id: 3,
          gridPos: { x: 12, y: 0, w: 6, h: 4 },
          title: 'Disk 사용률',
          type: 'stat',
          targets: [{
            expr: `100 - ((avg(node_filesystem_avail_bytes{${labelFilter},fstype!="rootfs",mountpoint!="/boot"}) / avg(node_filesystem_size_bytes{${labelFilter},fstype!="rootfs",mountpoint!="/boot"})) * 100)`,
            refId: 'A'
          }],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              thresholds: {
                mode: 'absolute',
                steps: [
                  { value: 0, color: 'green' },
                  { value: 70, color: 'yellow' },
                  { value: 85, color: 'red' }
                ]
              }
            }
          },
          options: {
            graphMode: 'area',
            textMode: 'value_and_name',
            colorMode: 'value'
          }
        },
        {
          id: 4,
          gridPos: { x: 18, y: 0, w: 6, h: 4 },
          title: 'Load Average',
          type: 'stat',
          targets: [{
            expr: `avg(node_load1{${labelFilter}})`,
            refId: 'A'
          }],
          fieldConfig: {
            defaults: {
              unit: 'short',
              decimals: 2
            }
          },
          options: {
            graphMode: 'area',
            textMode: 'value_and_name'
          }
        },
        
        // === CPU 메트릭 ===
        {
          id: 5,
          gridPos: { x: 0, y: 4, w: 12, h: 8 },
          title: 'CPU 사용률 (%)',
          type: 'timeseries',
          targets: [{
            expr: `100 - (avg by (mode) (rate(node_cpu_seconds_total{${labelFilter}}[5m])) * 100)`,
            legendFormat: '{{mode}}',
            refId: 'A'
          }],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5,
                showPoints: 'never'
              },
              thresholds: {
                mode: 'absolute',
                steps: [
                  { value: 0, color: 'green' },
                  { value: 70, color: 'yellow' },
                  { value: 85, color: 'red' }
                ]
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom',
              showLegend: true
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        {
          id: 6,
          gridPos: { x: 12, y: 4, w: 12, h: 8 },
          title: 'CPU 코어별 사용률',
          type: 'timeseries',
          targets: [{
            expr: `100 - (avg by (cpu) (rate(node_cpu_seconds_total{mode="idle",${labelFilter}}[5m])) * 100)`,
            legendFormat: 'CPU {{cpu}}',
            refId: 'A'
          }],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        
        // === Memory 메트릭 ===
        {
          id: 7,
          gridPos: { x: 0, y: 12, w: 12, h: 8 },
          title: 'Memory 사용량 (Bytes)',
          type: 'timeseries',
          targets: [
            {
              expr: `avg(node_memory_MemTotal_bytes{${labelFilter}})`,
              legendFormat: 'Total',
              refId: 'A'
            },
            {
              expr: `avg(node_memory_MemFree_bytes{${labelFilter}})`,
              legendFormat: 'Free',
              refId: 'B'
            },
            {
              expr: `avg(node_memory_MemAvailable_bytes{${labelFilter}})`,
              legendFormat: 'Available',
              refId: 'C'
            },
            {
              expr: `avg(node_memory_Buffers_bytes{${labelFilter}})`,
              legendFormat: 'Buffers',
              refId: 'D'
            },
            {
              expr: `avg(node_memory_Cached_bytes{${labelFilter}})`,
              legendFormat: 'Cached',
              refId: 'E'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'bytes',
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        {
          id: 8,
          gridPos: { x: 12, y: 12, w: 12, h: 8 },
          title: 'Memory 사용률 (%)',
          type: 'timeseries',
          targets: [{
            expr: `(1 - (avg(node_memory_MemAvailable_bytes{${labelFilter}}) / avg(node_memory_MemTotal_bytes{${labelFilter}}))) * 100`,
            legendFormat: 'Memory 사용률',
            refId: 'A'
          }],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              },
              thresholds: {
                mode: 'absolute',
                steps: [
                  { value: 0, color: 'green' },
                  { value: 70, color: 'yellow' },
                  { value: 85, color: 'red' }
                ]
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        
        // === Virtual Memory (Swap) ===
        {
          id: 9,
          gridPos: { x: 0, y: 20, w: 12, h: 8 },
          title: 'Swap 사용량 (Bytes)',
          type: 'timeseries',
          targets: [
            {
              expr: `avg(node_memory_SwapTotal_bytes{${labelFilter}})`,
              legendFormat: 'Swap Total',
              refId: 'A'
            },
            {
              expr: `avg(node_memory_SwapFree_bytes{${labelFilter}})`,
              legendFormat: 'Swap Free',
              refId: 'B'
            },
            {
              expr: `avg(node_memory_SwapCached_bytes{${labelFilter}})`,
              legendFormat: 'Swap Cached',
              refId: 'C'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'bytes',
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        {
          id: 10,
          gridPos: { x: 12, y: 20, w: 12, h: 8 },
          title: 'Swap 사용률 (%)',
          type: 'timeseries',
          targets: [{
            expr: `(1 - (avg(node_memory_SwapFree_bytes{${labelFilter}}) / avg(node_memory_SwapTotal_bytes{${labelFilter}}))) * 100`,
            legendFormat: 'Swap 사용률',
            refId: 'A'
          }],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        
        // === Disk 메트릭 ===
        {
          id: 11,
          gridPos: { x: 0, y: 28, w: 12, h: 8 },
          title: 'Disk 사용률 (파일시스템별)',
          type: 'timeseries',
          targets: [{
            expr: `100 - ((avg by (mountpoint) (node_filesystem_avail_bytes{${labelFilter},fstype!="rootfs",mountpoint!="/boot"})) / avg by (mountpoint) (node_filesystem_size_bytes{${labelFilter},fstype!="rootfs",mountpoint!="/boot"})) * 100)`,
            legendFormat: '{{mountpoint}}',
            refId: 'A'
          }],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              },
              thresholds: {
                mode: 'absolute',
                steps: [
                  { value: 0, color: 'green' },
                  { value: 70, color: 'yellow' },
                  { value: 85, color: 'red' }
                ]
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        {
          id: 12,
          gridPos: { x: 12, y: 28, w: 12, h: 8 },
          title: 'Disk I/O (Bytes/sec)',
          type: 'timeseries',
          targets: [
            {
              expr: `rate(node_disk_read_bytes_total{${labelFilter}}[5m])`,
              legendFormat: '{{device}} - Read',
              refId: 'A'
            },
            {
              expr: `rate(node_disk_written_bytes_total{${labelFilter}}[5m])`,
              legendFormat: '{{device}} - Write',
              refId: 'B'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'Bps',
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        
        // === Network 메트릭 ===
        {
          id: 13,
          gridPos: { x: 0, y: 36, w: 12, h: 8 },
          title: 'Network 트래픽 (Bytes/sec)',
          type: 'timeseries',
          targets: [
            {
              expr: `rate(node_network_receive_bytes_total{${labelFilter},device!="lo"}[5m])`,
              legendFormat: '{{device}} - Receive',
              refId: 'A'
            },
            {
              expr: `rate(node_network_transmit_bytes_total{${labelFilter},device!="lo"}[5m])`,
              legendFormat: '{{device}} - Transmit',
              refId: 'B'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'Bps',
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        {
          id: 14,
          gridPos: { x: 12, y: 36, w: 12, h: 8 },
          title: 'Network 패킷 (Packets/sec)',
          type: 'timeseries',
          targets: [
            {
              expr: `rate(node_network_receive_packets_total{${labelFilter},device!="lo"}[5m])`,
              legendFormat: '{{device}} - Receive',
              refId: 'A'
            },
            {
              expr: `rate(node_network_transmit_packets_total{${labelFilter},device!="lo"}[5m])`,
              legendFormat: '{{device}} - Transmit',
              refId: 'B'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'pps',
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        
        // === 추가 시스템 메트릭 ===
        {
          id: 15,
          gridPos: { x: 0, y: 44, w: 8, h: 6 },
          title: 'Load Average',
          type: 'timeseries',
          targets: [
            {
              expr: `avg(node_load1{${labelFilter}})`,
              legendFormat: '1m',
              refId: 'A'
            },
            {
              expr: `avg(node_load5{${labelFilter}})`,
              legendFormat: '5m',
              refId: 'B'
            },
            {
              expr: `avg(node_load15{${labelFilter}})`,
              legendFormat: '15m',
              refId: 'C'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'short',
              decimals: 2,
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        {
          id: 16,
          gridPos: { x: 8, y: 44, w: 8, h: 6 },
          title: '프로세스 수',
          type: 'timeseries',
          targets: [{
            expr: `avg(node_procs_running{${labelFilter}})`,
            legendFormat: 'Running',
            refId: 'A'
          }, {
            expr: `avg(node_procs_blocked{${labelFilter}})`,
            legendFormat: 'Blocked',
            refId: 'B'
          }],
          fieldConfig: {
            defaults: {
              unit: 'short',
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
        },
        {
          id: 17,
          gridPos: { x: 16, y: 44, w: 8, h: 6 },
          title: '파일 디스크립터',
          type: 'timeseries',
          targets: [{
            expr: `avg(node_filefd_allocated{${labelFilter}})`,
            legendFormat: 'Allocated',
            refId: 'A'
          }, {
            expr: `avg(node_filefd_maximum{${labelFilter}})`,
            legendFormat: 'Maximum',
            refId: 'B'
          }],
          fieldConfig: {
            defaults: {
              unit: 'short',
              custom: {
                drawStyle: 'line',
                lineInterpolation: 'smooth',
                fillOpacity: 10,
                pointSize: 5
              }
            }
          },
          options: {
            legend: {
              displayMode: 'table',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'multi'
            }
          }
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
  console.error('사용법: node scripts/create-vm-dashboard.js <jobName> <dashboardTitle> [hostIP]');
  console.error('예시: node scripts/create-vm-dashboard.js vm-host-10.255.48.230 "VM Host 10.255.48.230" 10.255.48.230');
  process.exit(1);
}

const jobName = args[0];
const dashboardTitle = args[1];
const hostIP = args[2] || null;

// Basic Auth 생성
const auth = Buffer.from(`${GRAFANA_USER}:${GRAFANA_PASSWORD}`).toString('base64');

console.log(`VM 최적화 Grafana 대시보드 생성 중...`);
console.log(`Job 이름: ${jobName}`);
console.log(`대시보드 제목: ${dashboardTitle}`);
if (hostIP) {
  console.log(`호스트 IP: ${hostIP}`);
}
console.log(`Grafana URL: ${GRAFANA_URL}`);
console.log('');

createVMDashboard(jobName, dashboardTitle, hostIP, auth)
  .then(result => {
    console.log('✅ 성공: 대시보드가 생성되었습니다.');
    console.log(`대시보드 URL: ${result.url}`);
    console.log('');
    console.log('대시보드에 포함된 메트릭:');
    console.log('- CPU 사용률 (전체, 코어별)');
    console.log('- Memory 사용량 및 사용률');
    console.log('- Virtual Memory (Swap)');
    console.log('- Disk 사용률 (파일시스템별)');
    console.log('- Disk I/O');
    console.log('- Network 트래픽 (Bytes, Packets)');
    console.log('- Load Average');
    console.log('- 프로세스 수');
    console.log('- 파일 디스크립터');
  })
  .catch(error => {
    console.error('❌ 실패:', error.message);
    process.exit(1);
  });

