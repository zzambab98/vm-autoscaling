import api from './api';

export const autoscalingApi = {
  // 설정 목록 조회
  getConfigs: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.enabled !== undefined) params.append('enabled', filters.enabled);
    if (filters.serviceName) params.append('serviceName', filters.serviceName);
    
    const queryString = params.toString();
    const url = `/api/autoscaling/configs${queryString ? `?${queryString}` : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  // 설정 상세 조회
  getConfigById: async (configId) => {
    const response = await api.get(`/api/autoscaling/configs/${configId}`);
    return response.data;
  },

  // 설정 생성
  createConfig: async (configData) => {
    const response = await api.post('/api/autoscaling/configs', configData);
    return response.data;
  },

  // 설정 수정
  updateConfig: async (configId, configData) => {
    const response = await api.put(`/api/autoscaling/configs/${configId}`, configData);
    return response.data;
  },

  // 설정 삭제
  deleteConfig: async (configId) => {
    const response = await api.delete(`/api/autoscaling/configs/${configId}`);
    return response.data;
  },

  // 설정 활성화
  enableConfig: async (configId) => {
    const response = await api.post(`/api/autoscaling/configs/${configId}/enable`);
    return response.data;
  },

  // 설정 비활성화
  disableConfig: async (configId) => {
    const response = await api.post(`/api/autoscaling/configs/${configId}/disable`);
    return response.data;
  }
};

export default autoscalingApi;

