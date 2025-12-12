/**
 * 스케일인 스위치 서비스
 * 최소 VM 개수 도달 시 스케일인 OFF, 최소 VM 개수 이상 시 스케일인 ON
 */

// 메모리 기반 스위치 상태 저장 (서비스별)
const scaleInSwitchState = new Map();

/**
 * 스케일인 스위치 상태 조회
 * @param {string} serviceName - 서비스 이름
 * @returns {object} 스위치 상태
 */
function getScaleInSwitchState(serviceName) {
  const state = scaleInSwitchState.get(serviceName);
  if (!state) {
    // 기본값: 활성화 (스케일인 가능)
    return {
      enabled: true,
      reason: null,
      updatedAt: null
    };
  }
  return state;
}

/**
 * 스케일인 스위치 OFF (최소 VM 개수 도달)
 * @param {string} serviceName - 서비스 이름
 * @param {number} currentVmCount - 현재 VM 개수
 * @param {number} minVms - 최소 VM 개수
 * @returns {object} 업데이트 결과
 */
function disableScaleIn(serviceName, currentVmCount, minVms) {
  const state = {
    enabled: false,
    reason: `최소 VM 개수 도달 (현재: ${currentVmCount}, 최소: ${minVms})`,
    currentVmCount: currentVmCount,
    minVms: minVms,
    updatedAt: new Date().toISOString()
  };
  
  scaleInSwitchState.set(serviceName, state);
  console.log(`[ScaleInSwitch] 스케일인 OFF: ${serviceName} - ${state.reason}`);
  
  return {
    success: true,
    serviceName: serviceName,
    enabled: false,
    state: state
  };
}

/**
 * 스케일인 스위치 ON (최소 VM 개수 이상)
 * @param {string} serviceName - 서비스 이름
 * @param {number} currentVmCount - 현재 VM 개수
 * @param {number} minVms - 최소 VM 개수
 * @returns {object} 업데이트 결과
 */
function enableScaleIn(serviceName, currentVmCount, minVms) {
  const previousState = scaleInSwitchState.get(serviceName);
  
  const state = {
    enabled: true,
    reason: `최소 VM 개수 이상 (현재: ${currentVmCount}, 최소: ${minVms})`,
    currentVmCount: currentVmCount,
    minVms: minVms,
    updatedAt: new Date().toISOString()
  };
  
  scaleInSwitchState.set(serviceName, state);
  
  // 이전에 OFF 상태였다면 로그 출력
  if (previousState && !previousState.enabled) {
    console.log(`[ScaleInSwitch] 스케일인 ON: ${serviceName} - ${state.reason}`);
  }
  
  return {
    success: true,
    serviceName: serviceName,
    enabled: true,
    state: state
  };
}

/**
 * VM 개수에 따라 스케일인 스위치 자동 업데이트
 * @param {string} serviceName - 서비스 이름
 * @param {number} currentVmCount - 현재 VM 개수
 * @param {number} minVms - 최소 VM 개수
 * @returns {object} 업데이트 결과
 */
function updateScaleInSwitch(serviceName, currentVmCount, minVms) {
  if (currentVmCount <= minVms) {
    // 최소 VM 개수 도달 → 스케일인 OFF
    return disableScaleIn(serviceName, currentVmCount, minVms);
  } else {
    // 최소 VM 개수 이상 → 스케일인 ON
    return enableScaleIn(serviceName, currentVmCount, minVms);
  }
}

/**
 * 스케일인 스위치 상태 확인 (스케일인 가능 여부)
 * @param {string} serviceName - 서비스 이름
 * @returns {boolean} 스케일인 가능 여부
 */
function isScaleInEnabled(serviceName) {
  const state = getScaleInSwitchState(serviceName);
  return state.enabled;
}

/**
 * 모든 서비스의 스케일인 스위치 상태 조회
 * @returns {object} 모든 서비스의 스위치 상태
 */
function getAllScaleInSwitchStates() {
  const states = {};
  scaleInSwitchState.forEach((state, serviceName) => {
    states[serviceName] = state;
  });
  return states;
}

module.exports = {
  getScaleInSwitchState,
  disableScaleIn,
  enableScaleIn,
  updateScaleInSwitch,
  isScaleInEnabled,
  getAllScaleInSwitchStates
};

