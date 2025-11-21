const fs = require('fs').promises;
const path = require('path');

const CONFIGS_DATA_PATH = path.join(__dirname, '../../data/autoscaling-configs.json');

/**
 * 데이터 파일 초기화
 */
async function ensureDataFile() {
  try {
    await fs.access(CONFIGS_DATA_PATH);
  } catch {
    await fs.writeFile(CONFIGS_DATA_PATH, JSON.stringify([], null, 2));
  }
}

/**
 * 설정 검증
 * @param {object} config - 설정 데이터
 * @returns {object} 검증 결과
 */
function validateConfig(config) {
  const errors = [];

  // 필수 필드 검증
  if (!config.serviceName) errors.push('serviceName은 필수입니다.');
  if (!config.templateId) errors.push('templateId는 필수입니다.');
  if (!config.monitoring) errors.push('monitoring 설정이 필요합니다.');
  if (!config.scaling) errors.push('scaling 설정이 필요합니다.');
  if (!config.f5) errors.push('f5 설정이 필요합니다.');
  if (!config.network) errors.push('network 설정이 필요합니다.');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 모니터링 설정 검증
  if (config.monitoring) {
    const { cpuThreshold, memoryThreshold, duration } = config.monitoring;
    if (cpuThreshold !== undefined && (cpuThreshold < 0 || cpuThreshold > 100)) {
      errors.push('CPU 임계값은 0-100 사이여야 합니다.');
    }
    if (memoryThreshold !== undefined && (memoryThreshold < 0 || memoryThreshold > 100)) {
      errors.push('Memory 임계값은 0-100 사이여야 합니다.');
    }
    if (duration !== undefined && duration < 1) {
      errors.push('지속 시간은 1분 이상이어야 합니다.');
    }
  }

  // 스케일링 설정 검증
  if (config.scaling) {
    const { minVms, maxVms, scaleOutStep, scaleInStep } = config.scaling;
    if (minVms !== undefined && minVms < 1) {
      errors.push('최소 VM 수는 1 이상이어야 합니다.');
    }
    if (maxVms !== undefined && maxVms < 1) {
      errors.push('최대 VM 수는 1 이상이어야 합니다.');
    }
    if (minVms !== undefined && maxVms !== undefined && minVms > maxVms) {
      errors.push('최소 VM 수는 최대 VM 수보다 작거나 같아야 합니다.');
    }
    if (scaleOutStep !== undefined && scaleOutStep < 1) {
      errors.push('Scale Out Step은 1 이상이어야 합니다.');
    }
    if (scaleInStep !== undefined && scaleInStep < 1) {
      errors.push('Scale In Step은 1 이상이어야 합니다.');
    }
  }

  // F5 설정 검증
  if (config.f5) {
    const { poolName, vip, vipPort } = config.f5;
    if (!poolName) errors.push('F5 Pool 이름은 필수입니다.');
    if (!vip) errors.push('VIP 주소는 필수입니다.');
    if (vipPort !== undefined && (vipPort < 1 || vipPort > 65535)) {
      errors.push('VIP 포트는 1-65535 사이여야 합니다.');
    }
  }

  // 네트워크 설정 검증
  if (config.network) {
    const { ipPoolStart, ipPoolEnd } = config.network;
    if (ipPoolStart && ipPoolEnd) {
      // IP 주소 형식 검증 (간단한 검증)
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(ipPoolStart)) {
        errors.push('IP Pool 시작 주소 형식이 올바르지 않습니다.');
      }
      if (!ipRegex.test(ipPoolEnd)) {
        errors.push('IP Pool 종료 주소 형식이 올바르지 않습니다.');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 설정 저장
 * @param {object} configData - 설정 데이터
 * @returns {Promise<object>} 저장된 설정
 */
async function saveConfig(configData) {
  await ensureDataFile();

  // 검증
  const validation = validateConfig(configData);
  if (!validation.valid) {
    throw new Error(`설정 검증 실패: ${validation.errors.join(', ')}`);
  }

  try {
    const configs = await getConfigs();
    
    // 새 설정인 경우 ID 생성
    if (!configData.id) {
      configData.id = `config-${Date.now()}`;
      configData.createdAt = new Date().toISOString();
    }
    
    configData.updatedAt = new Date().toISOString();
    configData.enabled = configData.enabled !== undefined ? configData.enabled : false;

    // 기존 설정 업데이트 또는 새 설정 추가
    const existingIndex = configs.findIndex(c => c.id === configData.id);
    if (existingIndex >= 0) {
      configs[existingIndex] = { ...configs[existingIndex], ...configData };
    } else {
      configs.push(configData);
    }

    // 백업 생성
    const backupPath = `${CONFIGS_DATA_PATH}.backup.${Date.now()}`;
    await fs.copyFile(CONFIGS_DATA_PATH, backupPath).catch(() => {});

    // 파일 저장
    await fs.writeFile(CONFIGS_DATA_PATH, JSON.stringify(configs, null, 2));

    return existingIndex >= 0 ? configs[existingIndex] : configData;
  } catch (error) {
    console.error('[Autoscaling Service] 설정 저장 실패:', error);
    throw new Error(`설정 저장 실패: ${error.message}`);
  }
}

/**
 * 설정 목록 조회
 * @param {object} filters - 필터 옵션
 * @returns {Promise<Array>} 설정 목록
 */
async function getConfigs(filters = {}) {
  await ensureDataFile();
  try {
    const data = await fs.readFile(CONFIGS_DATA_PATH, 'utf8');
    let configs = JSON.parse(data);

    // 필터링
    if (filters.enabled !== undefined) {
      configs = configs.filter(c => c.enabled === filters.enabled);
    }
    if (filters.serviceName) {
      configs = configs.filter(c => c.serviceName === filters.serviceName);
    }

    return configs;
  } catch (error) {
    console.error('[Autoscaling Service] 설정 목록 조회 실패:', error);
    return [];
  }
}

/**
 * 설정 ID로 조회
 * @param {string} configId - 설정 ID
 * @returns {Promise<object|null>} 설정 정보
 */
async function getConfigById(configId) {
  const configs = await getConfigs();
  return configs.find(c => c.id === configId) || null;
}

/**
 * 설정 수정
 * @param {string} configId - 설정 ID
 * @param {object} updates - 수정할 데이터
 * @returns {Promise<object>} 수정된 설정
 */
async function updateConfig(configId, updates) {
  const config = await getConfigById(configId);
  if (!config) {
    throw new Error(`설정을 찾을 수 없습니다: ${configId}`);
  }

  const updatedConfig = { ...config, ...updates };
  return await saveConfig(updatedConfig);
}

/**
 * 설정 삭제
 * @param {string} configId - 설정 ID
 * @returns {Promise<object>} 삭제 결과
 */
async function deleteConfig(configId) {
  try {
    const configs = await getConfigs();
    const config = configs.find(c => c.id === configId);
    
    if (!config) {
      throw new Error(`설정을 찾을 수 없습니다: ${configId}`);
    }

    // 관련 리소스 정리 (향후 Jenkins Job 삭제 등)
    // TODO: Jenkins Job 삭제 로직 추가

    // 메타데이터에서 삭제
    const filtered = configs.filter(c => c.id !== configId);
    
    // 백업 생성
    const backupPath = `${CONFIGS_DATA_PATH}.backup.${Date.now()}`;
    await fs.copyFile(CONFIGS_DATA_PATH, backupPath).catch(() => {});

    // 파일 저장
    await fs.writeFile(CONFIGS_DATA_PATH, JSON.stringify(filtered, null, 2));

    return {
      success: true,
      configId: configId,
      message: `설정 '${config.serviceName}'이 삭제되었습니다.`
    };
  } catch (error) {
    console.error('[Autoscaling Service] 설정 삭제 실패:', error);
    throw new Error(`설정 삭제 실패: ${error.message}`);
  }
}

/**
 * 설정 활성화/비활성화
 * @param {string} configId - 설정 ID
 * @param {boolean} enabled - 활성화 여부
 * @returns {Promise<object>} 업데이트된 설정
 */
async function setConfigEnabled(configId, enabled) {
  return await updateConfig(configId, { enabled });
}

module.exports = {
  saveConfig,
  getConfigs,
  getConfigById,
  updateConfig,
  deleteConfig,
  setConfigEnabled,
  validateConfig
};

