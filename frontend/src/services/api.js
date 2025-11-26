import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4410';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30초 타임아웃
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    // 디버깅: 요청 URL 로그
    console.log('[API Request]', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    console.error('[API Error Details]', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // 네트워크 에러
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject(new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.'));
    }
    
    // HTTP 에러
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message || '알 수 없는 오류가 발생했습니다.';
    
    if (status === 500) {
      return Promise.reject(new Error(`서버 오류: ${message}`));
    } else if (status === 404) {
      return Promise.reject(new Error(`요청한 리소스를 찾을 수 없습니다: ${message}`));
    } else if (status === 400) {
      return Promise.reject(new Error(`잘못된 요청: ${message}`));
    }
    
    return Promise.reject(new Error(message));
  }
);

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
  },

  // Job 삭제
  deleteJob: async (jobName) => {
    const response = await api.delete(`/api/prometheus/jobs/${encodeURIComponent(jobName)}`);
    return response.data;
  }
};

// Alertmanager API
export const alertmanagerApi = {
  // 라우팅 규칙 목록 조회
  getRoutes: async () => {
    const response = await api.get('/api/alertmanager/routing-rules');
    return response.data;
  },

  // 라우팅 규칙 추가
  addRoute: async (routeData) => {
    const response = await api.post('/api/alertmanager/routing-rules', routeData);
    return response.data;
  },

  // 라우팅 규칙 삭제
  deleteRoute: async (serviceName) => {
    const response = await api.delete(`/api/alertmanager/routing-rules/${encodeURIComponent(serviceName)}`);
    return response.data;
  }
};

// Health Check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;


