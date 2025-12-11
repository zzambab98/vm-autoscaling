const fs = require('fs').promises;
const path = require('path');

const COOLDOWN_DATA_PATH = path.join(__dirname, '../../data/cooldown.json');
const DEFAULT_COOLDOWN_PERIOD = parseInt(process.env.DEFAULT_COOLDOWN_PERIOD || '300', 10); // 기본 5분

// 데이터 디렉토리 생성
async function ensureDataDirectory() {
  const dataDir = path.dirname(COOLDOWN_DATA_PATH);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    // 디렉토리가 이미 존재하면 무시
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// 쿨다운 데이터 읽기
async function loadCooldownData() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(COOLDOWN_DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 파일이 없으면 빈 객체 반환
      return {};
    }
    throw error;
  }
}

// 쿨다운 데이터 저장
async function saveCooldownData(data) {
  await ensureDataDirectory();
  await fs.writeFile(COOLDOWN_DATA_PATH, JSON.stringify(data, null, 2));
}

/**
 * 쿨다운 시작
 * @param {string} serviceName - 서비스 이름
 * @param {string} scaleAction - 스케일 액션 ('scale-out' 또는 'scale-in')
 * @param {number} cooldownPeriod - 쿨다운 기간 (초), 기본값 사용 시 undefined
 * @returns {Promise<object>} 쿨다운 시작 결과
 */
async function startCooldown(serviceName, scaleAction, cooldownPeriod = undefined) {
  try {
    const data = await loadCooldownData();
    
    if (!data[serviceName]) {
      data[serviceName] = {};
    }

    const period = cooldownPeriod || DEFAULT_COOLDOWN_PERIOD;
    const now = Math.floor(Date.now() / 1000);

    if (scaleAction === 'scale-out') {
      data[serviceName].lastScaleOutTime = now;
      data[serviceName].scaleOutCooldownPeriod = period;
    } else if (scaleAction === 'scale-in') {
      data[serviceName].lastScaleInTime = now;
      data[serviceName].scaleInCooldownPeriod = period;
    } else {
      throw new Error(`잘못된 스케일 액션: ${scaleAction}`);
    }

    await saveCooldownData(data);

    console.log(`[Cooldown] ${serviceName}의 ${scaleAction} 쿨다운 시작 (${period}초)`);

    return {
      success: true,
      serviceName: serviceName,
      scaleAction: scaleAction,
      cooldownPeriod: period,
      startTime: now,
      endTime: now + period
    };
  } catch (error) {
    console.error(`[Cooldown] 쿨다운 시작 실패:`, error);
    throw new Error(`쿨다운 시작 실패: ${error.message}`);
  }
}

/**
 * 쿨다운 상태 확인
 * @param {string} serviceName - 서비스 이름
 * @param {string} scaleAction - 스케일 액션 ('scale-out' 또는 'scale-in')
 * @returns {Promise<object>} 쿨다운 상태
 */
async function checkCooldown(serviceName, scaleAction) {
  try {
    const data = await loadCooldownData();
    
    if (!data[serviceName]) {
      return {
        inCooldown: false,
        remainingTime: 0,
        message: '쿨다운 없음'
      };
    }

    const now = Math.floor(Date.now() / 1000);
    let lastActionTime = null;
    let cooldownPeriod = null;

    if (scaleAction === 'scale-out') {
      lastActionTime = data[serviceName].lastScaleOutTime;
      cooldownPeriod = data[serviceName].scaleOutCooldownPeriod || DEFAULT_COOLDOWN_PERIOD;
    } else if (scaleAction === 'scale-in') {
      lastActionTime = data[serviceName].lastScaleInTime;
      cooldownPeriod = data[serviceName].scaleInCooldownPeriod || DEFAULT_COOLDOWN_PERIOD;
    } else {
      throw new Error(`잘못된 스케일 액션: ${scaleAction}`);
    }

    if (!lastActionTime) {
      return {
        inCooldown: false,
        remainingTime: 0,
        message: '쿨다운 없음'
      };
    }

    const elapsed = now - lastActionTime;
    const remaining = Math.max(0, cooldownPeriod - elapsed);
    const inCooldown = remaining > 0;

    return {
      inCooldown: inCooldown,
      remainingTime: remaining,
      lastActionTime: lastActionTime,
      cooldownPeriod: cooldownPeriod,
      message: inCooldown 
        ? `쿨다운 중 (${remaining}초 남음)`
        : '쿨다운 종료'
    };
  } catch (error) {
    console.error(`[Cooldown] 쿨다운 확인 실패:`, error);
    // 에러 발생 시 쿨다운 없음으로 처리 (안전하게 진행)
    return {
      inCooldown: false,
      remainingTime: 0,
      message: `쿨다운 확인 실패: ${error.message}`
    };
  }
}

/**
 * 쿨다운 강제 종료 (테스트용)
 * @param {string} serviceName - 서비스 이름
 * @param {string} scaleAction - 스케일 액션 ('scale-out' 또는 'scale-in')
 * @returns {Promise<object>} 쿨다운 종료 결과
 */
async function clearCooldown(serviceName, scaleAction) {
  try {
    const data = await loadCooldownData();
    
    if (!data[serviceName]) {
      return {
        success: true,
        message: '쿨다운 데이터가 없습니다.'
      };
    }

    if (scaleAction === 'scale-out') {
      delete data[serviceName].lastScaleOutTime;
      delete data[serviceName].scaleOutCooldownPeriod;
    } else if (scaleAction === 'scale-in') {
      delete data[serviceName].lastScaleInTime;
      delete data[serviceName].scaleInCooldownPeriod;
    } else {
      throw new Error(`잘못된 스케일 액션: ${scaleAction}`);
    }

    // 서비스 데이터가 비어있으면 삭제
    if (Object.keys(data[serviceName]).length === 0) {
      delete data[serviceName];
    }

    await saveCooldownData(data);

    return {
      success: true,
      message: `${serviceName}의 ${scaleAction} 쿨다운이 종료되었습니다.`
    };
  } catch (error) {
    console.error(`[Cooldown] 쿨다운 종료 실패:`, error);
    throw new Error(`쿨다운 종료 실패: ${error.message}`);
  }
}

module.exports = {
  startCooldown,
  checkCooldown,
  clearCooldown
};




