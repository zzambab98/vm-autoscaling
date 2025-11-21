import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Node Exporter API
export const nodeExporterApi = {
  // Node Exporter 설치
  install: async (serverIp, options = {}) => {
    const response = await api.post('/api/node-exporter/install', {
      serverIp,
      ...options
    });
    return response.data;
  },

  // 여러 서버에 설치
  installMultiple: async (serverIps, options = {}) => {
    const response = await api.post('/api/node-exporter/install', {
      serverIps,
      ...options
    });
    return response.data;
  },

  // 상태 확인
  checkStatus: async (serverIp, options = {}) => {
    const params = new URLSearchParams({ serverIp, ...options });
    const response = await api.get(`/api/node-exporter/status?${params}`);
    return response.data;
  }
};

// Prometheus API
export const prometheusApi = {
  // Job 추가
  addJob: async (jobName, targets, labels = {}) => {
    const response = await api.post('/api/prometheus/jobs', {
      jobName,
      targets,
      labels
    });
    return response.data;
  },

  // Job 목록 조회
  getJobs: async () => {
    const response = await api.get('/api/prometheus/jobs');
    return response.data;
  },

  // Target 상태 확인
  getTargets: async (jobName) => {
    const response = await api.get(`/api/prometheus/targets?jobName=${jobName}`);
    return response.data;
  }
};

// Health Check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;

