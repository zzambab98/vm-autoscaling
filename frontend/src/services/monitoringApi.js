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
 * CPU 사용률 조회
 * @param {string} jobName - Prometheus Job 이름
 * @param {number} duration - 조회 기간 (분)
 * @returns {Promise<Array>} CPU 사용률 데이터
 */
export async function getCpuUsage(jobName, duration = 60) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - (duration * 60);
  
  const query = `100 - (avg(rate(node_cpu_seconds_total{mode="idle",job="${jobName}"}[5m])) * 100)`;
  
  try {
    const results = await queryRangePrometheus(query, start, end, 15);
    
    // 데이터 변환 (Recharts 형식)
    if (results.length > 0 && results[0].values) {
      return results[0].values.map(([timestamp, value]) => ({
        time: new Date(timestamp * 1000).toLocaleTimeString(),
        cpu: parseFloat(value) || 0
      }));
    }
    return [];
  } catch (error) {
    console.error('[Monitoring API] CPU 사용률 조회 실패:', error);
    return [];
  }
}

/**
 * Memory 사용률 조회
 * @param {string} jobName - Prometheus Job 이름
 * @param {number} duration - 조회 기간 (분)
 * @returns {Promise<Array>} Memory 사용률 데이터
 */
export async function getMemoryUsage(jobName, duration = 60) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - (duration * 60);
  
  const query = `(1 - (avg(node_memory_MemAvailable_bytes{job="${jobName}"}) / avg(node_memory_MemTotal_bytes{job="${jobName}"}))) * 100`;
  
  try {
    const results = await queryRangePrometheus(query, start, end, 15);
    
    if (results.length > 0 && results[0].values) {
      return results[0].values.map(([timestamp, value]) => ({
        time: new Date(timestamp * 1000).toLocaleTimeString(),
        memory: parseFloat(value) || 0
      }));
    }
    return [];
  } catch (error) {
    console.error('[Monitoring API] Memory 사용률 조회 실패:', error);
    return [];
  }
}

/**
 * 현재 CPU 사용률 조회 (실시간)
 * @param {string} jobName - Prometheus Job 이름
 * @returns {Promise<number>} CPU 사용률 (%)
 */
export async function getCurrentCpuUsage(jobName) {
  const query = `100 - (avg(rate(node_cpu_seconds_total{mode="idle",job="${jobName}"}[5m])) * 100)`;
  
  try {
    const results = await queryPrometheus(query);
    
    if (results.length > 0 && results[0].value) {
      return parseFloat(results[0].value[1]) || 0;
    }
    return 0;
  } catch (error) {
    console.error('[Monitoring API] 현재 CPU 사용률 조회 실패:', error);
    return 0;
  }
}

/**
 * 현재 Memory 사용률 조회 (실시간)
 * @param {string} jobName - Prometheus Job 이름
 * @returns {Promise<number>} Memory 사용률 (%)
 */
export async function getCurrentMemoryUsage(jobName) {
  const query = `(1 - (avg(node_memory_MemAvailable_bytes{job="${jobName}"}) / avg(node_memory_MemTotal_bytes{job="${jobName}"}))) * 100`;
  
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
 * Prometheus Alerts 조회
 * @returns {Promise<Array>} Alert 목록
 */
export async function getPrometheusAlerts() {
  try {
    const response = await fetch(`${PROMETHEUS_URL}/api/v1/alerts`);
    const data = await response.json();
    
    if (data.status === 'success' && data.data && data.data.alerts) {
      return data.data.alerts;
    }
    return [];
  } catch (error) {
    console.error('[Monitoring API] Alert 조회 실패:', error);
    return [];
  }
}


