import api from './api';

const PROMETHEUS_URL = 'http://10.255.1.254:9090';

/**
 * Prometheus Query API 호출
 * @param {string} query - PromQL 쿼리
 * @returns {Promise<object>} 쿼리 결과
 */
export async function queryPrometheus(query) {
  try {
    const response = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (data.status === 'success' && data.data && data.data.result) {
      return data.data.result;
    }
    return [];
  } catch (error) {
    console.error('[Monitoring API] Prometheus 쿼리 실패:', error);
    throw error;
  }
}

/**
 * Prometheus Query Range API 호출
 * @param {string} query - PromQL 쿼리
 * @param {number} start - 시작 시간 (Unix timestamp)
 * @param {number} end - 종료 시간 (Unix timestamp)
 * @param {number} step - 간격 (초)
 * @returns {Promise<Array>} 시계열 데이터
 */
export async function queryRangePrometheus(query, start, end, step = 15) {
  try {
    const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'success' && data.data && data.data.result) {
      return data.data.result;
    }
    return [];
  } catch (error) {
    console.error('[Monitoring API] Prometheus Query Range 실패:', error);
    throw error;
  }
}

/**
 * CPU 사용률 조회 (각 instance별)
 * @param {string} jobName - Prometheus Job 이름
 * @param {number} duration - 조회 기간 (분)
 * @returns {Promise<Array>} CPU 사용률 데이터 (각 instance별)
 */
export async function getCpuUsage(jobName, duration = 60) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - (duration * 60);
  
  // 각 instance별로 CPU 사용률 계산
  // 올바른 계산: (1 - idle_rate) * 100
  // rate()는 초당 증가율이므로, idle mode의 rate는 초당 idle 시간입니다
  // 여러 CPU 코어가 있으면 avg by (instance)로 평균을 내어 instance별 idle 비율을 구합니다
  // 주의: 같은 instance label을 가진 여러 target이 있으면 데이터가 합쳐집니다
  // 각 target별로 고유한 instance label이 필요합니다
  const query = `(1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle",job="${jobName}"}[5m]))) * 100`;
  
  try {
    console.log('[Monitoring API] CPU 사용률 조회 시작:', { jobName, duration, query, start, end });
    const results = await queryRangePrometheus(query, start, end, 15);
    console.log('[Monitoring API] CPU 사용률 조회 결과:', results);
    
    // 데이터 변환 (Recharts 형식)
    // 여러 instance의 데이터를 시간별로 그룹화
    const timeMap = new Map();
    
    if (!results || results.length === 0) {
      console.warn('[Monitoring API] CPU 사용률 조회 결과가 비어있습니다.');
      return [];
    }
    
    results.forEach(result => {
      const instance = result.metric?.instance || 'unknown';
      console.log('[Monitoring API] Instance 데이터 처리:', instance, result.values?.length || 0, '개 데이터 포인트');
      if (result.values && result.values.length > 0) {
        result.values.forEach(([timestamp, value]) => {
          const timeKey = new Date(timestamp * 1000).toLocaleTimeString();
          if (!timeMap.has(timeKey)) {
            timeMap.set(timeKey, { time: timeKey });
          }
          // 음수 값 방지 및 0-100 범위로 제한
          let cpuValue = parseFloat(value) || 0;
          if (isNaN(cpuValue) || !isFinite(cpuValue)) cpuValue = 0;
          if (cpuValue < 0) cpuValue = 0;
          if (cpuValue > 100) cpuValue = 100;
          timeMap.get(timeKey)[instance] = cpuValue;
        });
      } else {
        console.warn('[Monitoring API] Instance에 데이터 포인트가 없습니다:', instance);
      }
    });
    
    const finalData = Array.from(timeMap.values());
    console.log('[Monitoring API] 최종 CPU 데이터:', finalData.length, '개 시간 포인트');
    if (finalData.length > 0) {
      console.log('[Monitoring API] 첫 번째 데이터 포인트:', finalData[0]);
    }
    return finalData;
  } catch (error) {
    console.error('[Monitoring API] CPU 사용률 조회 실패:', error);
    console.error('[Monitoring API] 에러 상세:', error.message, error.stack);
    return [];
  }
}

/**
 * Memory 사용률 조회 (각 instance별)
 * @param {string} jobName - Prometheus Job 이름
 * @param {number} duration - 조회 기간 (분)
 * @returns {Promise<Array>} Memory 사용률 데이터 (각 instance별)
 */
export async function getMemoryUsage(jobName, duration = 60) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - (duration * 60);
  
  // 각 instance별로 Memory 사용률 계산
  const query = `(1 - (avg by (instance) (node_memory_MemAvailable_bytes{job="${jobName}"}) / avg by (instance) (node_memory_MemTotal_bytes{job="${jobName}"}))) * 100`;
  
  try {
    const results = await queryRangePrometheus(query, start, end, 15);
    
    // 데이터 변환 (Recharts 형식)
    // 여러 instance의 데이터를 시간별로 그룹화
    const timeMap = new Map();
    
    results.forEach(result => {
      const instance = result.metric?.instance || 'unknown';
      if (result.values) {
        result.values.forEach(([timestamp, value]) => {
          const timeKey = new Date(timestamp * 1000).toLocaleTimeString();
          if (!timeMap.has(timeKey)) {
            timeMap.set(timeKey, { time: timeKey });
          }
          timeMap.get(timeKey)[instance] = parseFloat(value) || 0;
        });
      }
    });
    
    return Array.from(timeMap.values());
  } catch (error) {
    console.error('[Monitoring API] Memory 사용률 조회 실패:', error);
    return [];
  }
}

/**
 * 현재 CPU 사용률 조회 (실시간, 각 instance별 최대값)
 * @param {string} jobName - Prometheus Job 이름
 * @returns {Promise<number>} CPU 사용률 (%) - 모든 instance 중 최대값
 */
export async function getCurrentCpuUsage(jobName) {
  // 각 instance별로 계산하고 최대값 반환
  // 올바른 계산: (1 - idle_rate) * 100
  const query = `max((1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle",job="${jobName}"}[5m]))) * 100)`;
  
  try {
    const results = await queryPrometheus(query);
    
    if (results.length > 0 && results[0].value) {
      let cpuValue = parseFloat(results[0].value[1]) || 0;
      // NaN, Infinity 체크 및 음수 값 방지, 0-100 범위로 제한
      if (isNaN(cpuValue) || !isFinite(cpuValue)) cpuValue = 0;
      if (cpuValue < 0) cpuValue = 0;
      if (cpuValue > 100) cpuValue = 100;
      return cpuValue;
    }
    return 0;
  } catch (error) {
    console.error('[Monitoring API] 현재 CPU 사용률 조회 실패:', error);
    return 0;
  }
}

/**
 * 현재 Memory 사용률 조회 (실시간, 각 instance별 최대값)
 * @param {string} jobName - Prometheus Job 이름
 * @returns {Promise<number>} Memory 사용률 (%) - 모든 instance 중 최대값
 */
export async function getCurrentMemoryUsage(jobName) {
  // 각 instance별로 계산하고 최대값 반환
  const query = `max((1 - (avg by (instance) (node_memory_MemAvailable_bytes{job="${jobName}"}) / avg by (instance) (node_memory_MemTotal_bytes{job="${jobName}"}))) * 100)`;
  
  try {
    const results = await queryPrometheus(query);
    
    if (results.length > 0 && results[0].value) {
      return parseFloat(results[0].value[1]) || 0;
    }
    return 0;
  } catch (error) {
    console.error('[Monitoring API] 현재 Memory 사용률 조회 실패:', error);
    return 0;
  }
}

/**
 * Alertmanager Alerts 조회 (최신 Alert 정보)
 * @returns {Promise<Array>} Alert 목록
 */
export async function getPrometheusAlerts() {
  try {
    // Alertmanager API 사용 (최신 Alert 정보)
    const ALERTMANAGER_URL = process.env.REACT_APP_ALERTMANAGER_URL || 'http://10.255.1.254:9093';
    const response = await fetch(`${ALERTMANAGER_URL}/api/v2/alerts`, {
      cache: 'no-cache', // 캐시 비활성화
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    const data = await response.json();
    
    if (Array.isArray(data)) {
      // Alertmanager 형식: [{labels: {...}, annotations: {...}, ...}]
      return data.map(alert => ({
        labels: alert.labels || {},
        annotations: alert.annotations || {},
        status: alert.status || {},
        startsAt: alert.startsAt,
        endsAt: alert.endsAt
      }));
    }
    
    // Fallback: Prometheus API 사용
    const promResponse = await fetch(`${PROMETHEUS_URL}/api/v1/alerts`);
    const promData = await promResponse.json();
    
    if (promData.status === 'success' && promData.data && promData.data.alerts) {
      return promData.data.alerts;
    }
    return [];
  } catch (error) {
    console.error('[Monitoring API] Alert 조회 실패:', error);
    return [];
  }
}


