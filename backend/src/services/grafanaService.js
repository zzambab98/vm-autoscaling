const axios = require('axios');

const GRAFANA_URL = process.env.GRAFANA_URL || 'http://10.255.1.254:3000';
const GRAFANA_USER = process.env.GRAFANA_USER || 'admin';
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD || 'admin123';
const GRAFANA_PROMETHEUS_DATASOURCE = process.env.GRAFANA_PROMETHEUS_DATASOURCE || 'Prometheus';

/**
 * Grafana API 인증 헤더 생성
 * @returns {string} Basic Auth 헤더
 */
function getAuthHeader() {
  const auth = Buffer.from(`${GRAFANA_USER}:${GRAFANA_PASSWORD}`).toString('base64');
  return `Basic ${auth}`;
}

/**
 * Grafana 대시보드 JSON 템플릿 생성
 * @param {string} jobName - Prometheus Job 이름
 * @param {object} labels - Prometheus Labels (instance, service, environment)
 * @returns {object} Grafana 대시보드 JSON
 */
function createDashboardTemplate(jobName, labels = {}) {
  const instanceLabel = labels.instance || jobName;
  const serviceLabel = labels.service || jobName;
  const environmentLabel = labels.environment || 'test';
  const vmName = labels.vmName || jobName;
  
  // 대시보드 제목: VM 이름 우선 사용 (VM 이름이 jobName과 다를 경우)
  const dashboardTitle = vmName !== jobName ? `${vmName} 모니터링` : `${jobName} 모니터링`;
  // UID는 jobName 기반으로 생성 (고유성 보장)
  const dashboardUid = `dashboard-${jobName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  return {
    dashboard: {
      title: dashboardTitle,
      uid: dashboardUid,
      tags: ['prometheus', 'node-exporter', serviceLabel, environmentLabel],
      timezone: 'browser',
      schemaVersion: 16,
      version: 0,
      refresh: '30s',
      panels: [
        // CPU 사용률
        {
          id: 1,
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          type: 'timeseries',
          title: 'CPU 사용률 (%)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle", job="${jobName}"}[5m])) * 100)`,
              legendFormat: '{{instance}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              color: { mode: 'palette-classic' }
            }
          }
        },
        // Memory 사용률
        {
          id: 2,
          gridPos: { x: 12, y: 0, w: 12, h: 8 },
          type: 'timeseries',
          title: 'Memory 사용률 (%)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `(1 - (avg by (instance) (node_memory_MemAvailable_bytes{job="${jobName}"}) / avg by (instance) (node_memory_MemTotal_bytes{job="${jobName}"}))) * 100`,
              legendFormat: '{{instance}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              color: { mode: 'palette-classic' }
            }
          }
        },
        // CPU 상세 (사용자, 시스템, I/O 대기)
        {
          id: 3,
          gridPos: { x: 0, y: 8, w: 12, h: 8 },
          type: 'timeseries',
          title: 'CPU 상세 (사용자/시스템/I/O 대기)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `avg by (instance, mode) (rate(node_cpu_seconds_total{job="${jobName}", mode!="idle"}[5m])) * 100`,
              legendFormat: '{{instance}} - {{mode}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // Memory 상세 (사용/캐시/버퍼)
        {
          id: 4,
          gridPos: { x: 12, y: 8, w: 12, h: 8 },
          type: 'timeseries',
          title: 'Memory 상세 (사용/캐시/버퍼)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `node_memory_MemTotal_bytes{job="${jobName}"} - node_memory_MemAvailable_bytes{job="${jobName}"}`,
              legendFormat: '{{instance}} - 사용',
              refId: 'A'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `node_memory_Cached_bytes{job="${jobName}"}`,
              legendFormat: '{{instance}} - 캐시',
              refId: 'B'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `node_memory_Buffers_bytes{job="${jobName}"}`,
              legendFormat: '{{instance}} - 버퍼',
              refId: 'C'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'bytes',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // Network 입출력
        {
          id: 5,
          gridPos: { x: 0, y: 16, w: 12, h: 8 },
          type: 'timeseries',
          title: 'Network 수신 (bytes/s)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `rate(node_network_receive_bytes_total{job="${jobName}", device!="lo"}[5m])`,
              legendFormat: '{{instance}} - {{device}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'Bps',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // Network 송신
        {
          id: 6,
          gridPos: { x: 12, y: 16, w: 12, h: 8 },
          type: 'timeseries',
          title: 'Network 송신 (bytes/s)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `rate(node_network_transmit_bytes_total{job="${jobName}", device!="lo"}[5m])`,
              legendFormat: '{{instance}} - {{device}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'Bps',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // Disk I/O 읽기
        {
          id: 7,
          gridPos: { x: 0, y: 24, w: 12, h: 8 },
          type: 'timeseries',
          title: 'Disk 읽기 (bytes/s)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `rate(node_disk_read_bytes_total{job="${jobName}", device!~"dm-.*|loop.*"}[5m])`,
              legendFormat: '{{instance}} - {{device}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'Bps',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // Disk I/O 쓰기
        {
          id: 8,
          gridPos: { x: 12, y: 24, w: 12, h: 8 },
          type: 'timeseries',
          title: 'Disk 쓰기 (bytes/s)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `rate(node_disk_written_bytes_total{job="${jobName}", device!~"dm-.*|loop.*"}[5m])`,
              legendFormat: '{{instance}} - {{device}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'Bps',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // Disk 사용률
        {
          id: 9,
          gridPos: { x: 0, y: 32, w: 12, h: 8 },
          type: 'timeseries',
          title: 'Disk 사용률 (%)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `(1 - (node_filesystem_avail_bytes{job="${jobName}", mountpoint="/", fstype!="rootfs"} / node_filesystem_size_bytes{job="${jobName}", mountpoint="/", fstype!="rootfs"})) * 100`,
              legendFormat: '{{instance}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              color: { mode: 'palette-classic' }
            }
          }
        },
        // Load Average
        {
          id: 10,
          gridPos: { x: 12, y: 32, w: 12, h: 8 },
          type: 'timeseries',
          title: 'Load Average',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `node_load1{job="${jobName}"}`,
              legendFormat: '{{instance}} - 1분',
              refId: 'A'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `node_load5{job="${jobName}"}`,
              legendFormat: '{{instance}} - 5분',
              refId: 'B'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `node_load15{job="${jobName}"}`,
              legendFormat: '{{instance}} - 15분',
              refId: 'C'
            }
          ],
          fieldConfig: {
            defaults: {
              color: { mode: 'palette-classic' }
            }
          }
        }
      ],
      templating: {
        list: [
          {
            name: 'job',
            type: 'query',
            datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
            query: `label_values(node_cpu_seconds_total, job)`,
            current: { value: jobName, text: jobName },
            options: []
          },
          {
            name: 'instance',
            type: 'query',
            datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
            query: `label_values(node_cpu_seconds_total{job="$job"}, instance)`,
            current: { value: instanceLabel, text: instanceLabel },
            options: []
          }
        ]
      },
      annotations: {
        list: []
      }
    },
    overwrite: false
  };
}

/**
 * Grafana 대시보드 생성
 * @param {string} jobName - Prometheus Job 이름
 * @param {object} labels - Prometheus Labels
 * @returns {Promise<object>} 생성 결과
 */
async function createGrafanaDashboard(jobName, labels = {}) {
  try {
    // 기존 대시보드 확인 (충돌 방지)
    const dashboardUid = `dashboard-${jobName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    
    // 기존 대시보드가 있는지 확인
    try {
      const existingDashboard = await getGrafanaDashboard(dashboardUid);
      if (existingDashboard && existingDashboard.success && existingDashboard.dashboard) {
        console.log(`[Grafana] 대시보드가 이미 존재합니다: ${jobName} (UID: ${dashboardUid})`);
        const dashboardUrl = `${GRAFANA_URL}/d/${dashboardUid}`;
        return {
          success: true,
          jobName: jobName,
          dashboardUrl: dashboardUrl,
          dashboardUid: dashboardUid,
          message: 'Grafana 대시보드가 이미 존재합니다. 기존 대시보드를 유지합니다.',
          exists: true
        };
      } else {
        console.log(`[Grafana] 기존 대시보드 없음, 새로 생성: ${jobName} (UID: ${dashboardUid})`);
      }
    } catch (checkError) {
      // 대시보드 확인 중 오류 발생 시 로그만 남기고 계속 진행
      console.warn(`[Grafana] 기존 대시보드 확인 중 오류 (무시하고 계속):`, checkError.message);
    }
    
    const dashboardJson = createDashboardTemplate(jobName, labels);
    
    // overwrite: false로 명시하여 기존 대시보드를 덮어쓰지 않도록 설정
    const requestBody = {
      ...dashboardJson,
      overwrite: false // 기존 대시보드를 덮어쓰지 않음
    };
    
    const response = await axios.post(
      `${GRAFANA_URL}/api/dashboards/db`,
      requestBody,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.url) {
      const dashboardUrl = `${GRAFANA_URL}${response.data.url}`;
      console.log(`[Grafana] 대시보드 생성 완료: ${dashboardUrl}`);
      return {
        success: true,
        jobName: jobName,
        dashboardUrl: dashboardUrl,
        dashboardUid: dashboardJson.dashboard.uid,
        message: 'Grafana 대시보드가 생성되었습니다.'
      };
    } else {
      throw new Error('Grafana API 응답 형식이 올바르지 않습니다.');
    }
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 412) {
        // 대시보드가 이미 존재하는 경우 (동시 생성 시도 등)
        console.log(`[Grafana] 대시보드가 이미 존재합니다 (412): ${jobName}`);
        const dashboardUid = `dashboard-${jobName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const dashboardUrl = `${GRAFANA_URL}/d/${dashboardUid}`;
        return {
          success: true,
          jobName: jobName,
          dashboardUrl: dashboardUrl,
          dashboardUid: dashboardUid,
          message: 'Grafana 대시보드가 이미 존재합니다.',
          exists: true
        };
      }
      
      throw new Error(`Grafana 대시보드 생성 실패 (${status}): ${data.message || JSON.stringify(data)}`);
    }
    
    console.error(`[Grafana] 대시보드 생성 실패:`, error);
    throw new Error(`Grafana 대시보드 생성 실패: ${error.message}`);
  }
}

/**
 * Grafana 대시보드 삭제
 * @param {string} dashboardUid - 대시보드 UID
 * @returns {Promise<object>} 삭제 결과
 */
async function deleteGrafanaDashboard(dashboardUid) {
  try {
    const response = await axios.delete(
      `${GRAFANA_URL}/api/dashboards/uid/${dashboardUid}`,
      {
        headers: {
          'Authorization': getAuthHeader()
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      dashboardUid: dashboardUid,
      message: 'Grafana 대시보드가 삭제되었습니다.'
    };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // 대시보드가 존재하지 않는 경우
      return {
        success: true,
        dashboardUid: dashboardUid,
        message: 'Grafana 대시보드가 존재하지 않습니다.',
        notFound: true
      };
    }
    
    console.error(`[Grafana] 대시보드 삭제 실패:`, error);
    throw new Error(`Grafana 대시보드 삭제 실패: ${error.message}`);
  }
}

/**
 * Grafana 대시보드 조회
 * @param {string} dashboardUid - 대시보드 UID
 * @returns {Promise<object>} 대시보드 정보
 */
async function getGrafanaDashboard(dashboardUid) {
  try {
    const response = await axios.get(
      `${GRAFANA_URL}/api/dashboards/uid/${dashboardUid}`,
      {
        headers: {
          'Authorization': getAuthHeader()
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.dashboard) {
      return {
        success: true,
        dashboard: response.data.dashboard,
        meta: response.data.meta,
        message: '대시보드를 찾았습니다.'
      };
    } else {
      return {
        success: false,
        message: '대시보드를 찾을 수 없습니다.',
        notFound: true
      };
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return {
        success: false,
        message: '대시보드를 찾을 수 없습니다.',
        notFound: true
      };
    }
    
    console.error(`[Grafana] 대시보드 조회 실패:`, error);
    throw new Error(`Grafana 대시보드 조회 실패: ${error.message}`);
  }
}

/**
 * Java 애플리케이션 모니터링용 Grafana 대시보드 JSON 템플릿 생성
 * @param {string} jobName - Prometheus Job 이름 (예: auto-vm-test-01-jmx)
 * @param {object} labels - Prometheus Labels (instance, service, environment, vmName)
 * @returns {object} Grafana 대시보드 JSON
 */
function createJavaDashboardTemplate(jobName, labels = {}) {
  const instanceLabel = labels.instance || jobName;
  const serviceLabel = labels.service || jobName;
  const environmentLabel = labels.environment || 'test';
  const vmName = labels.vmName || jobName.replace(/-jmx$/, '');
  
  // 대시보드 제목: VM 이름 + JMX 모니터링
  const dashboardTitle = `${vmName} JMX 모니터링`;
  // UID는 jobName 기반으로 생성 (고유성 보장)
  const dashboardUid = `dashboard-${jobName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  return {
    dashboard: {
      title: dashboardTitle,
      uid: dashboardUid,
      tags: ['prometheus', 'jmx-exporter', 'java', serviceLabel, environmentLabel],
      timezone: 'browser',
      schemaVersion: 16,
      version: 0,
      refresh: '30s',
      panels: [
        // JVM 힙 메모리 사용률
        {
          id: 1,
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          type: 'timeseries',
          title: 'JVM 힙 메모리 사용률 (%)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `(jvm_memory_used_bytes{job="${jobName}", area="heap"} / jvm_memory_max_bytes{job="${jobName}", area="heap"}) * 100`,
              legendFormat: '{{instance}} - 힙 사용률',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'percent',
              min: 0,
              max: 100,
              color: { mode: 'palette-classic' }
            }
          }
        },
        // JVM 힙 메모리 상세 (Used, Committed, Max)
        {
          id: 2,
          gridPos: { x: 12, y: 0, w: 12, h: 8 },
          type: 'timeseries',
          title: 'JVM 힙 메모리 상세 (bytes)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_memory_used_bytes{job="${jobName}", area="heap"}`,
              legendFormat: '{{instance}} - Used',
              refId: 'A'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_memory_committed_bytes{job="${jobName}", area="heap"}`,
              legendFormat: '{{instance}} - Committed',
              refId: 'B'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_memory_max_bytes{job="${jobName}", area="heap"}`,
              legendFormat: '{{instance}} - Max',
              refId: 'C'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'bytes',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // JVM 비힙 메모리 (Non-Heap)
        {
          id: 3,
          gridPos: { x: 0, y: 8, w: 12, h: 8 },
          type: 'timeseries',
          title: 'JVM 비힙 메모리 (Non-Heap)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_memory_used_bytes{job="${jobName}", area="nonheap"}`,
              legendFormat: '{{instance}} - Used',
              refId: 'A'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_memory_committed_bytes{job="${jobName}", area="nonheap"}`,
              legendFormat: '{{instance}} - Committed',
              refId: 'B'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_memory_max_bytes{job="${jobName}", area="nonheap"}`,
              legendFormat: '{{instance}} - Max',
              refId: 'C'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'bytes',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // GC 시간 (Garbage Collection)
        {
          id: 4,
          gridPos: { x: 12, y: 8, w: 12, h: 8 },
          type: 'timeseries',
          title: 'GC 시간 (초)',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `rate(jvm_gc_pause_seconds_sum{job="${jobName}"}[5m])`,
              legendFormat: '{{instance}} - {{gc}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 's',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // GC 횟수
        {
          id: 5,
          gridPos: { x: 0, y: 16, w: 12, h: 8 },
          type: 'timeseries',
          title: 'GC 횟수',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `rate(jvm_gc_pause_seconds_count{job="${jobName}"}[5m])`,
              legendFormat: '{{instance}} - {{gc}}',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'ops',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // JVM 스레드 수
        {
          id: 6,
          gridPos: { x: 12, y: 16, w: 12, h: 8 },
          type: 'timeseries',
          title: 'JVM 스레드 수',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_threads_live_threads{job="${jobName}"}`,
              legendFormat: '{{instance}} - Live',
              refId: 'A'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_threads_peak_threads{job="${jobName}"}`,
              legendFormat: '{{instance}} - Peak',
              refId: 'B'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_threads_daemon_threads{job="${jobName}"}`,
              legendFormat: '{{instance}} - Daemon',
              refId: 'C'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'short',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // JVM 클래스 로딩
        {
          id: 7,
          gridPos: { x: 0, y: 24, w: 12, h: 8 },
          type: 'timeseries',
          title: 'JVM 클래스 로딩',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_classes_loaded_classes{job="${jobName}"}`,
              legendFormat: '{{instance}} - Loaded',
              refId: 'A'
            },
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_classes_unloaded_classes_total{job="${jobName}"}`,
              legendFormat: '{{instance}} - Unloaded',
              refId: 'B'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'short',
              color: { mode: 'palette-classic' }
            }
          }
        },
        // JVM 가상 메모리 (Virtual Memory)
        {
          id: 8,
          gridPos: { x: 12, y: 24, w: 12, h: 8 },
          type: 'timeseries',
          title: 'JVM 가상 메모리',
          targets: [
            {
              datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
              expr: `jvm_memory_bytes{job="${jobName}", type="virtual"}`,
              legendFormat: '{{instance}} - Virtual',
              refId: 'A'
            }
          ],
          fieldConfig: {
            defaults: {
              unit: 'bytes',
              color: { mode: 'palette-classic' }
            }
          }
        }
      ],
      templating: {
        list: [
          {
            name: 'job',
            type: 'query',
            datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
            query: `label_values(jvm_memory_used_bytes, job)`,
            current: { value: jobName, text: jobName },
            options: []
          },
          {
            name: 'instance',
            type: 'query',
            datasource: { type: 'prometheus', uid: GRAFANA_PROMETHEUS_DATASOURCE },
            query: `label_values(jvm_memory_used_bytes{job="$job"}, instance)`,
            current: { value: instanceLabel, text: instanceLabel },
            options: []
          }
        ]
      },
      annotations: {
        list: []
      }
    },
    overwrite: false
  };
}

/**
 * Java 애플리케이션 모니터링용 Grafana 대시보드 생성
 * @param {string} jobName - Prometheus Job 이름 (예: auto-vm-test-01-jmx)
 * @param {object} labels - Prometheus Labels
 * @returns {Promise<object>} 생성 결과
 */
async function createJavaGrafanaDashboard(jobName, labels = {}) {
  try {
    const dashboardUid = `dashboard-${jobName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    
    // 기존 대시보드 확인
    try {
      const existingDashboard = await getGrafanaDashboard(dashboardUid);
      if (existingDashboard && existingDashboard.success && existingDashboard.dashboard) {
        console.log(`[Grafana] Java 대시보드가 이미 존재합니다: ${jobName} (UID: ${dashboardUid})`);
        const dashboardUrl = `${GRAFANA_URL}/d/${dashboardUid}`;
        return {
          success: true,
          jobName: jobName,
          dashboardUrl: dashboardUrl,
          dashboardUid: dashboardUid,
          message: 'Java Grafana 대시보드가 이미 존재합니다. 기존 대시보드를 유지합니다.',
          exists: true
        };
      }
    } catch (checkError) {
      console.warn(`[Grafana] 기존 Java 대시보드 확인 중 오류 (무시하고 계속):`, checkError.message);
    }
    
    const dashboardJson = createJavaDashboardTemplate(jobName, labels);
    
    const requestBody = {
      ...dashboardJson,
      overwrite: false
    };
    
    const response = await axios.post(
      `${GRAFANA_URL}/api/dashboards/db`,
      requestBody,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.url) {
      const dashboardUrl = `${GRAFANA_URL}${response.data.url}`;
      console.log(`[Grafana] Java 대시보드 생성 완료: ${dashboardUrl}`);
      return {
        success: true,
        jobName: jobName,
        dashboardUrl: dashboardUrl,
        dashboardUid: dashboardJson.dashboard.uid,
        message: 'Java Grafana 대시보드가 생성되었습니다.'
      };
    } else {
      throw new Error('Grafana API 응답 형식이 올바르지 않습니다.');
    }
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 412) {
        const dashboardUid = `dashboard-${jobName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const dashboardUrl = `${GRAFANA_URL}/d/${dashboardUid}`;
        return {
          success: true,
          jobName: jobName,
          dashboardUrl: dashboardUrl,
          dashboardUid: dashboardUid,
          message: 'Java Grafana 대시보드가 이미 존재합니다.',
          exists: true
        };
      }
      
      throw new Error(`Grafana Java 대시보드 생성 실패 (${status}): ${data.message || JSON.stringify(data)}`);
    }
    
    console.error(`[Grafana] Java 대시보드 생성 실패:`, error);
    throw new Error(`Grafana Java 대시보드 생성 실패: ${error.message}`);
  }
}

module.exports = {
  createGrafanaDashboard,
  createJavaGrafanaDashboard,
  deleteGrafanaDashboard,
  getGrafanaDashboard
};

