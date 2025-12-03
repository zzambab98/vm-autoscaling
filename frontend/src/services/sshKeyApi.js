import api from './api';

/**
 * SSH 키 목록 조회
 * @returns {Promise<object>} SSH 키 목록
 */
export async function getSshKeys() {
  try {
    const response = await api.get('/api/ssh-keys');
    return response.data;
  } catch (error) {
    console.error('[SSH Key API] SSH 키 목록 조회 실패:', error);
    throw error;
  }
}
