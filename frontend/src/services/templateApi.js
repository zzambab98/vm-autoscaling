import api from './api';

export const templateApi = {
  // 템플릿 목록 조회
  getTemplates: async () => {
    const response = await api.get('/api/templates');
    return response.data;
  },

  // 템플릿 상세 조회
  getTemplateById: async (templateId) => {
    const response = await api.get(`/api/templates/${templateId}`);
    return response.data;
  },

  // 템플릿 생성
  createTemplate: async (vmName, templateName, description = '') => {
    const response = await api.post('/api/templates', {
      vmName,
      templateName,
      description
    });
    return response.data;
  },

  // 템플릿 삭제
  deleteTemplate: async (templateId) => {
    const response = await api.delete(`/api/templates/${templateId}`);
    return response.data;
  },

  // VM 목록 조회
  getVmList: async () => {
    const response = await api.get('/api/vms');
    return response.data;
  }
};

export default templateApi;


