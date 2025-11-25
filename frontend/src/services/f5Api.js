import api from './api';

const f5Api = {
  /**
   * F5 Pool 목록 조회
   */
  async getPools() {
    try {
      const response = await api.get('/api/f5/pools');
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
      const response = await api.get('/api/f5/vips');
      return response.data;
    } catch (error) {
      console.error('F5 VIP 목록 조회 실패:', error);
      throw error;
    }
  },

  /**
   * F5 Pool 상세 정보 조회 (멤버 목록 포함)
   * @param {string} poolName - Pool 이름
   * @param {string} partition - Partition (선택, 기본값: Common)
   */
  async getPoolDetails(poolName, partition = 'Common') {
    try {
      const params = new URLSearchParams({ poolName, partition });
      const response = await api.get(`/api/f5/pools/${poolName}?${params}`);
      return response.data;
    } catch (error) {
      console.error('F5 Pool 상세 정보 조회 실패:', error);
      throw error;
    }
  }
};

export default f5Api;

