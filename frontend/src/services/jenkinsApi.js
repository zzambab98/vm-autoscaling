import api from './api';

/**
 * Jenkins Job 목록 조회
 * @returns {Promise<object>} Job 목록
 */
export async function getJenkinsJobs() {
  try {
    const response = await api.get('/api/jenkins/jobs');
    return response.data;
  } catch (error) {
    console.error('[Jenkins API] Job 목록 조회 실패:', error);
    throw error;
  }
}

/**
 * Jenkins Job 상태 조회
 * @param {string} jobName - Job 이름
 * @returns {Promise<object>} Job 상태
 */
export async function getJenkinsJobStatus(jobName) {
  try {
    const response = await api.get(`/api/jenkins/jobs/${encodeURIComponent(jobName)}`);
    return response.data;
  } catch (error) {
    console.error('[Jenkins API] Job 상태 조회 실패:', error);
    throw error;
  }
}

/**
 * Jenkins Job 빌드 실행
 * @param {string} jobName - Job 이름
 * @param {object} parameters - 빌드 파라미터
 * @returns {Promise<object>} 빌드 결과
 */
export async function triggerJenkinsJob(jobName, parameters = {}) {
  try {
    const response = await api.post(`/api/jenkins/jobs/${encodeURIComponent(jobName)}/build`, {
      parameters
    });
    return response.data;
  } catch (error) {
    console.error('[Jenkins API] Job 빌드 실행 실패:', error);
    throw error;
  }
}

