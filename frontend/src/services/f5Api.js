import api from './api';

const f5Api = {
  /**
   * F5 Pool 목록 조회
   */
  async getPools() {
    try {
      const response = await api.get('/f5/pools');
      return response.data;
    } catch (error) {
      console.error('F5 Pool 목록 조회 실패:', error);
      throw error;
    }
  },

  /**
   * F5 VIP 목록 조회
   */
  async getVips() {
    try {
      const response = await api.get('/f5/vips');
      return response.data;
    } catch (error) {
      console.error('F5 VIP 목록 조회 실패:', error);
      throw error;
    }
  }
};

export default f5Api;

