import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:6010';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 300000 // 5분 타임아웃 (템플릿 삭제 등 시간이 걸릴 수 있는 작업 대응)
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    console.log('[API] 요청:', config.method?.toUpperCase(), config.url, config.baseURL);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리
api.interceptors.response.use(
  (response) => {
    console.log('[API] 응답 성공:', response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error('[API] Error:', error);
    console.error('[API] Error details:', {
      message: error.message,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null,
      config: error.config ? {
        url: error.config.url,
        baseURL: error.config.baseURL,
        method: error.config.method
      } : null
    });
    
    // 네트워크 에러
    if (!error.response) {
      console.error('[API] Network error:', error.message);
      console.error('[API] 요청 URL:', error.config?.baseURL + error.config?.url);
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
  },

  // Node Exporter 삭제
  uninstall: async (serverIp, options = {}) => {
    const response = await api.post('/api/node-exporter/uninstall', {
      serverIp,
      ...options
    });
    return response.data;
  },

  // 여러 서버에서 Node Exporter 삭제
  uninstallMultiple: async (serverIps, options = {}) => {
    const response = await api.post('/api/node-exporter/uninstall', {
      serverIps,
      ...options
    });
    return response.data;
  }
};

// Promtail API
export const promtailApi = {
  // Promtail 설치
  install: async (serverIp, options = {}) => {
    const response = await api.post('/api/promtail/install', {
      serverIp,
      ...options
    });
    return response.data;
  },
  // 여러 서버에 Promtail 설치
  installMultiple: async (serverIps, options = {}) => {
    const response = await api.post('/api/promtail/install', {
      serverIps,
      ...options
    });
    return response.data;
  },
  // Promtail 설정 업데이트 (기존 설치된 서버용)
  updateConfig: async (serverIp, options = {}) => {
    const response = await api.post('/api/promtail/update-config', {
      serverIp,
      ...options
    });
    return response.data;
  },
  // 여러 서버의 Promtail 설정 업데이트
  updateConfigMultiple: async (serverIps, options = {}) => {
    const response = await api.post('/api/promtail/update-config', {
      serverIps,
      ...options
    });
    return response.data;
  },

  // Promtail 삭제
  uninstall: async (serverIp, options = {}) => {
    const response = await api.post('/api/promtail/uninstall', {
      serverIp,
      ...options
    });
    return response.data;
  },

  // 여러 서버에서 Promtail 삭제
  uninstallMultiple: async (serverIps, options = {}) => {
    const response = await api.post('/api/promtail/uninstall', {
      serverIps,
      ...options
    });
    return response.data;
  }
};

// JMX Exporter API
export const jmxExporterApi = {
  // JMX Exporter 설치
  install: async (serverIp, options = {}) => {
    const response = await api.post('/api/jmx-exporter/install', {
      serverIp,
      ...options
    });
    return response.data;
  },

  // 여러 서버에 설치
  installMultiple: async (serverIps, options = {}) => {
    const response = await api.post('/api/jmx-exporter/install', {
      serverIps,
      ...options
    });
    return response.data;
  },

  // 상태 확인
  checkStatus: async (serverIp, options = {}) => {
    const params = new URLSearchParams({ serverIp, ...options });
    const response = await api.get(`/api/jmx-exporter/status?${params}`);
    return response.data;
  },

  // JMX Exporter 삭제
  uninstall: async (serverIp, options = {}) => {
    const response = await api.post('/api/jmx-exporter/uninstall', {
      serverIp,
      ...options
    });
    return response.data;
  },

  // 여러 서버에서 JMX Exporter 삭제
  uninstallMultiple: async (serverIps, options = {}) => {
    const response = await api.post('/api/jmx-exporter/uninstall', {
      serverIps,
      ...options
    });
    return response.data;
  }
};

// Prometheus API
export const prometheusApi = {
  // Job 추가
  addJob: async (jobName, targets, labels = {}, dashboardOptions = {}) => {
    const response = await api.post('/api/prometheus/jobs', {
      jobName,
      targets,
      labels,
      ...dashboardOptions
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

  deleteJob: async (jobName) => {
    const response = await api.delete(`/api/prometheus/jobs/${encodeURIComponent(jobName)}`);
    return response.data;
  },

  // VM별 등록 상태 조회
  getVmStatus: async (vmName) => {
    const response = await api.get(`/api/prometheus/vm-status?vmName=${encodeURIComponent(vmName)}`);
    return response.data;
  },

  // 기능별 추가
  addFeatures: async (vmName, ip, port, features, labels = {}, sshUser, sshKey) => {
    const response = await api.post('/api/prometheus/add-features', {
      vmName,
      ip,
      port,
      features,
      labels,
      sshUser,
      sshKey
    });
    return response.data;
  },

  // 기능별 삭제
  removeFeatures: async (vmName, features) => {
    const response = await api.post('/api/prometheus/remove-features', {
      vmName,
      features
    });
    return response.data;
  }
};

export const alertmanagerApi = {
  getRoutes: async () => {
    const response = await api.get('/api/alertmanager/routing-rules');
    return response.data;
  },

  addRoute: async (payload) => {
    const response = await api.post('/api/alertmanager/routing-rules', payload);
    return response.data;
  },

  deleteRoute: async (serviceName) => {
    const response = await api.delete(`/api/alertmanager/routing-rules/${encodeURIComponent(serviceName)}`);
    return response.data;
  }
};

// SSH 설정 API
export const sshConfigApi = {
  // SSH 설정 조회 (SSH 키 목록 + 기본 설정)
  getConfig: async () => {
    const response = await api.get('/api/ssh-config');
    return response.data;
  }
};

// 네트워크/VLAN API
export const networkApi = {
  // 네트워크/VLAN 목록 조회
  getNetworks: async () => {
    const response = await api.get('/api/networks');
    return response.data;
  }
};

// Health Check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;


