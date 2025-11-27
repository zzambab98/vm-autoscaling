import api from './api';

const f5Api = {
  /**
   * F5 Pool 목록 조회
   */
  async getPools() {
    try {
      const response = await api.get('/api/f5/pools');
      console.log('[F5 API] Pool 목록 조회 성공:', response.data);
      return response.data;
    } catch (error) {
      console.error('[F5 API] Pool 목록 조회 실패:', error);
      console.error('[F5 API] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // 에러가 발생해도 빈 배열과 에러 메시지를 반환
      return {
        success: false,
        pools: [],
        error: error.response?.data?.error || error.message || 'F5 Pool 목록 조회 실패'
      };
    }
  },

  /**
   * F5 VIP 목록 조회
   */
  async getVips() {
    try {
      const response = await api.get('/api/f5/vips');
      console.log('[F5 API] VIP 목록 조회 성공:', response.data);
      return response.data;
    } catch (error) {
      console.error('[F5 API] VIP 목록 조회 실패:', error);
      console.error('[F5 API] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // 에러가 발생해도 빈 배열과 에러 메시지를 반환
      return {
        success: false,
        vips: [],
        error: error.response?.data?.error || error.message || 'F5 VIP 목록 조회 실패'
      };
    }
  }
};

export default f5Api;

