const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const TEMPLATES_DATA_PATH = path.join(__dirname, '../../data/templates.json');
// Datastore는 환경 변수에서만 가져오거나 VM에서 동적으로 추출 (하드코딩 제거)
const DEFAULT_DATASTORE = process.env.GOVC_DATASTORE || process.env.VCENTER_DATASTORE || null;

// vCenter 연결 상태 관리
let vCenterConnectionState = {
  lastCheckTime: null,
  lastSuccessTime: null,
  isConnected: false,
  consecutiveFailures: 0,
  maxConsecutiveFailures: 3
};

// 연결 상태 확인 주기 (밀리초)
const CONNECTION_CHECK_INTERVAL = 30000; // 30초
const CONNECTION_CHECK_TIMEOUT = 10000; // 10초

/**
 * vCenter 연결 정보 가져오기 (런타임에 읽음)
 */
function getVCenterConfig() {
  return {
    url: process.env.GOVC_URL || process.env.VCENTER_URL,
    username: process.env.GOVC_USERNAME || process.env.VCENTER_USERNAME,
    password: process.env.GOVC_PASSWORD || process.env.VCENTER_PASSWORD,
    insecure: process.env.GOVC_INSECURE || '1'
  };
}

/**
 * vCenter 연결 상태 확인
 * @returns {Promise<boolean>} 연결 성공 여부
 */
async function checkVCenterConnection() {
  const now = Date.now();
  
  // 최근에 확인했고 성공했으면 캐시된 결과 반환
  if (vCenterConnectionState.isConnected && 
      vCenterConnectionState.lastSuccessTime && 
      (now - vCenterConnectionState.lastSuccessTime) < CONNECTION_CHECK_INTERVAL) {
    return true;
  }
  
  // 최근에 확인했으면 바로 재확인하지 않음 (너무 자주 호출 방지)
  if (vCenterConnectionState.lastCheckTime && 
      (now - vCenterConnectionState.lastCheckTime) < 5000) {
    return vCenterConnectionState.isConnected;
  }
  
  vCenterConnectionState.lastCheckTime = now;
  
  try {
    const vcenterConfig = getVCenterConfig();
    
    if (!vcenterConfig.url || !vcenterConfig.username || !vcenterConfig.password) {
      console.warn('[Template Service] vCenter 연결 정보가 설정되지 않았습니다.');
      vCenterConnectionState.isConnected = false;
      vCenterConnectionState.consecutiveFailures++;
      return false;
    }
    
    // 간단한 연결 테스트: govc about 명령 사용
    const testCommand = `govc about`;
    await execPromise(testCommand, {
      env: {
        ...process.env,
        GOVC_URL: vcenterConfig.url,
        GOVC_USERNAME: vcenterConfig.username,
        GOVC_PASSWORD: vcenterConfig.password,
        GOVC_INSECURE: vcenterConfig.insecure
      },
      timeout: CONNECTION_CHECK_TIMEOUT
    });
    
    // 연결 성공
    vCenterConnectionState.isConnected = true;
    vCenterConnectionState.lastSuccessTime = now;
    vCenterConnectionState.consecutiveFailures = 0;
    console.log('[Template Service] ✅ vCenter 연결 확인 성공');
    return true;
    
  } catch (error) {
    // 연결 실패
    vCenterConnectionState.isConnected = false;
    vCenterConnectionState.consecutiveFailures++;
    console.error(`[Template Service] ❌ vCenter 연결 확인 실패 (연속 실패: ${vCenterConnectionState.consecutiveFailures}회):`, error.message);
    
    // 연속 실패가 너무 많으면 경고
    if (vCenterConnectionState.consecutiveFailures >= vCenterConnectionState.maxConsecutiveFailures) {
      console.error(`[Template Service] ⚠️ vCenter 연결이 ${vCenterConnectionState.consecutiveFailures}회 연속 실패했습니다. 환경 변수를 확인하세요.`);
    }
    
    return false;
  }
}

/**
 * vCenter 연결 상태 확인 후 재시도 로직 포함
 * @param {Function} operation - 실행할 vCenter 작업 함수
 * @param {number} maxRetries - 최대 재시도 횟수 (기본값: 3)
 * @param {number} retryDelay - 재시도 대기 시간 (밀리초, 기본값: 2000)
 * @returns {Promise<any>} 작업 결과
 */
async function executeWithVCenterConnection(operation, maxRetries = 3, retryDelay = 2000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 연결 상태 확인
      const isConnected = await checkVCenterConnection();
      
      if (!isConnected && attempt > 1) {
        // 재시도 전에 잠시 대기
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
      // 작업 실행
      return await operation();
      
    } catch (error) {
      lastError = error;
      console.warn(`[Template Service] vCenter 작업 실패 (시도 ${attempt}/${maxRetries}):`, error.message);
      
      // 마지막 시도가 아니면 재시도
      if (attempt < maxRetries) {
        // 연결 상태 초기화하여 다음 시도에서 다시 확인
        vCenterConnectionState.isConnected = false;
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }
  
  // 모든 재시도 실패
  throw lastError || new Error('vCenter 작업 실패: 알 수 없는 오류');
}

/**
 * 데이터 파일 초기화
 */
async function ensureDataFile() {
  try {
    await fsPromises.access(TEMPLATES_DATA_PATH);
  } catch {
    // 파일이 없으면 생성
    await fsPromises.writeFile(TEMPLATES_DATA_PATH, JSON.stringify([], null, 2));
  }
}

/**
 * vCenter에서 템플릿 목록 조회
 * @returns {Promise<Array>} 템플릿 목록
 */
async function getTemplatesFromVCenter() {
  return executeWithVCenterConnection(async () => {
    const vcenterConfig = getVCenterConfig();
    
    if (!vcenterConfig.url || !vcenterConfig.username || !vcenterConfig.password) {
      console.warn('[Template Service] vCenter 연결 정보가 설정되지 않았습니다.');
      console.warn(`  GOVC_URL: ${vcenterConfig.url ? '설정됨' : '없음'}`);
      console.warn(`  GOVC_USERNAME: ${vcenterConfig.username ? '설정됨' : '없음'}`);
      console.warn(`  GOVC_PASSWORD: ${vcenterConfig.password ? '설정됨' : '없음'}`);
      return [];
    }

    console.log('[Template Service] vCenter 템플릿 목록 조회 시작...');
    console.log(`  vCenter URL: ${vcenterConfig.url}`);
    console.log(`  vCenter User: ${vcenterConfig.username}`);

    // vCenter에서 템플릿 목록 조회 (이름에 "template"이 포함된 VM)
    const command = `govc find / -type m -name "*template*"`;
    const { stdout, stderr } = await execPromise(command, {
      env: {
        ...process.env,
        GOVC_URL: vcenterConfig.url,
        GOVC_USERNAME: vcenterConfig.username,
        GOVC_PASSWORD: vcenterConfig.password,
        GOVC_INSECURE: vcenterConfig.insecure
      },
      timeout: 30000 // 30초 타임아웃
    });

    if (stderr && stderr.trim()) {
      console.warn('[Template Service] govc stderr:', stderr);
    }

    const lines = stdout.trim().split('\n').filter(line => line.trim());
    console.log(`[Template Service] vCenter 템플릿 ${lines.length}개 발견`);
    
    return lines.map(path => {
      const parts = path.split('/');
      const name = parts[parts.length - 1];
      return {
        name: name,
        path: path,
        source: 'vcenter'
      };
    });
  }, 3, 2000).catch(error => {
    console.error('[Template Service] vCenter 템플릿 목록 조회 실패:', error.message);
    console.error('[Template Service] 에러 상세:', {
      code: error.code,
      signal: error.signal,
      stdout: error.stdout,
      stderr: error.stderr
    });
    return [];
  });
}

/**
 * 템플릿 목록 조회 (vCenter + 로컬 저장소 병합)
 * @returns {Promise<Array>} 템플릿 목록
 */
async function getTemplates() {
  await ensureDataFile();
  
  // vCenter에서 템플릿 목록 조회
  const vcenterTemplates = await getTemplatesFromVCenter();
  
  // 로컬 저장소에서 템플릿 메타데이터 조회
  let localTemplates = [];
  try {
    const data = await fsPromises.readFile(TEMPLATES_DATA_PATH, 'utf8');
    localTemplates = JSON.parse(data);
  } catch (error) {
    console.warn('[Template Service] 로컬 템플릿 목록 조회 실패:', error);
  }

  // vCenter 템플릿과 로컬 메타데이터 병합
  const mergedTemplates = vcenterTemplates.map(vcTemplate => {
    // 로컬에 저장된 메타데이터가 있으면 사용
    const localMeta = localTemplates.find(lt => lt.name === vcTemplate.name);
    if (localMeta) {
      return {
        ...localMeta,
        path: vcTemplate.path,
        source: 'vcenter'
      };
    }
    // 없으면 vCenter 정보만 사용 (ID는 이름 기반으로 일관되게 생성)
    // 이름 기반 해시를 사용하여 ID 일관성 유지
    const crypto = require('crypto');
    const nameHash = crypto.createHash('md5').update(vcTemplate.name).digest('hex').substring(0, 8);
    return {
      id: `vcenter-${nameHash}-${vcTemplate.name}`,
      name: vcTemplate.name,
      originalVmName: vcTemplate.name,
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      path: vcTemplate.path,
      source: 'vcenter'
    };
  });

  return mergedTemplates;
}

/**
 * 템플릿 ID로 조회
 * @param {string} templateId - 템플릿 ID
 * @returns {Promise<object|null>} 템플릿 정보
 */
async function getTemplateById(templateId) {
  const templates = await getTemplates();
  return templates.find(t => t.id === templateId) || null;
}

/**
 * VM을 템플릿으로 변환
 * @param {string} vmName - VM 이름
 * @param {string} templateName - 템플릿 이름
 * @param {object} metadata - 추가 메타데이터
 * @returns {Promise<object>} 변환 결과
 */
async function convertVmToTemplate(vmName, templateName, metadata = {}) {
  try {
    // vCenter 연결 정보 확인 (런타임에 읽음)
    const vcenterConfig = getVCenterConfig();
    if (!vcenterConfig.url || !vcenterConfig.username || !vcenterConfig.password) {
      throw new Error('vCenter 연결 정보가 설정되지 않았습니다. 환경 변수를 확인하세요.');
    }

    // 1. VM이 존재하는지 확인하고 datastore 정보 가져오기
    const checkVmCommand = `govc vm.info -json "${vmName}"`;
    let vmInfo;
    try {
      const { stdout } = await execPromise(checkVmCommand, {
        env: {
          ...process.env,
          GOVC_URL: vcenterConfig.url,
          GOVC_USERNAME: vcenterConfig.username,
          GOVC_PASSWORD: vcenterConfig.password,
          GOVC_INSECURE: vcenterConfig.insecure
        }
      });
      vmInfo = JSON.parse(stdout);
    } catch (error) {
      throw new Error(`VM '${vmName}'을 찾을 수 없습니다.`);
    }
    
    // VM이 사용 가능한 상태인지 확인 및 전원 상태 처리
    console.log(`[Template Service] VM 사용 가능 상태 확인: ${vmName}`);
    let vmWasPoweredOn = false;
    let retryCount = 0;
    const maxRetries = 6; // 최대 30초 대기 (5초씩 6번)
    
    while (retryCount < maxRetries) {
      try {
        // VM의 현재 작업 상태 확인
        const taskCommand = `govc vm.info "${vmName}" 2>&1 | grep -i "task\|busy\|locked" || echo "ready"`;
        const { stdout: taskStatus } = await execPromise(taskCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          },
          shell: true
        });
        
        // VM 전원 상태 확인
        const powerStateCommand = `govc vm.power -get "${vmName}"`;
        const { stdout: powerState } = await execPromise(powerStateCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          }
        });
        
        const powerStateLower = powerState.trim().toLowerCase();
        const isPoweredOn = powerStateLower.includes('on') || powerStateLower.includes('powered on');
        
        // VM이 사용 가능한 상태인지 확인 (다른 작업이 없으면 OK)
        if (taskStatus.toLowerCase().includes('ready') || !taskStatus.toLowerCase().includes('busy')) {
          if (isPoweredOn) {
            // 전원이 켜져 있으면 템플릿 생성을 위해 전원 끄기
            vmWasPoweredOn = true;
            console.log(`[Template Service] VM이 전원이 켜져 있습니다. 템플릿 생성을 위해 전원을 끕니다: ${vmName}`);
            
            const powerOffCommand = `govc vm.power -off -force "${vmName}"`;
            await execPromise(powerOffCommand, {
              env: {
                ...process.env,
                GOVC_URL: vcenterConfig.url,
                GOVC_USERNAME: vcenterConfig.username,
                GOVC_PASSWORD: vcenterConfig.password,
                GOVC_INSECURE: vcenterConfig.insecure
              },
              timeout: 60000 // 1분 타임아웃
            });
            
            // VM이 완전히 꺼질 때까지 대기 (최대 2분)
            console.log(`[Template Service] VM 전원 끄기 대기 중...`);
            let waitTime = 0;
            const maxWait = 120; // 2분
            
            while (waitTime < maxWait) {
              await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
              waitTime += 5;
              
              try {
                const checkPowerCommand = `govc vm.power -get "${vmName}"`;
                const { stdout: checkPowerState } = await execPromise(checkPowerCommand, {
                  env: {
                    ...process.env,
                    GOVC_URL: vcenterConfig.url,
                    GOVC_USERNAME: vcenterConfig.username,
                    GOVC_PASSWORD: vcenterConfig.password,
                    GOVC_INSECURE: vcenterConfig.insecure
                  }
                });
                
                const checkPowerStateLower = checkPowerState.trim().toLowerCase();
                const isStillPoweredOn = checkPowerStateLower.includes('on') || checkPowerStateLower.includes('powered on');
                
                if (!isStillPoweredOn) {
                  console.log(`[Template Service] VM 전원 꺼짐 확인 (${waitTime}초)`);
                  break;
                }
              } catch (error) {
                // 전원 상태 확인 실패는 무시하고 계속 대기
              }
            }
            
            console.log(`[Template Service] VM이 전원이 꺼진 상태입니다. 클론 작업을 진행합니다: ${vmName}`);
            break;
          } else {
            // 전원이 이미 꺼져 있으면 바로 진행
            console.log(`[Template Service] VM이 전원이 꺼져 있어 클론 가능한 상태입니다: ${vmName}`);
            break;
          }
        } else {
          // VM이 다른 작업 중이면 대기
          retryCount++;
          console.log(`[Template Service] VM이 다른 작업 중입니다. 대기 중... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
        }
      } catch (error) {
        // 오류가 발생해도 재시도
        retryCount++;
        if (retryCount >= maxRetries) {
          console.warn(`[Template Service] VM 상태 확인 실패, 클론 작업 계속 진행:`, error.message);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
      }
    }

    // VM의 datastore 정보 추출
    let datastore = null;
    
    // 방법 1: VM 경로를 찾아서 object.collect로 VmPathName 조회 (가장 정확)
    try {
      const findCommand = `govc find . -type m -name "${vmName}"`;
      const { stdout: vmPath } = await execPromise(findCommand, {
        env: {
          ...process.env,
          GOVC_URL: vcenterConfig.url,
          GOVC_USERNAME: vcenterConfig.username,
          GOVC_PASSWORD: vcenterConfig.password,
          GOVC_INSECURE: vcenterConfig.insecure
        }
      });
      const vmFullPath = vmPath.trim().split('\n')[0];
      
      if (vmFullPath) {
        // VM의 VmPathName 직접 조회
        const vmPathNameCommand = `govc object.collect -s "${vmFullPath}" config.files.vmPathName`;
        const { stdout: vmPathName } = await execPromise(vmPathNameCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          }
        });
        
        const vmPathNameValue = vmPathName.trim();
        if (vmPathNameValue) {
          // 형식: [Datastore-Name] path/to/vm.vmx
          const match = vmPathNameValue.match(/\[([^\]]+)\]/);
          if (match && match[1]) {
            datastore = match[1];
            console.log(`[Template Service] Datastore 찾음 (object.collect): ${datastore}`);
          }
        }
      }
    } catch (error) {
      console.warn('[Template Service] Datastore 조회 실패 (object.collect):', error.message);
    }
    
    // 방법 2: Files.VmPathName에서 Datastore 이름 추출
    if (!datastore && vmInfo && vmInfo.Files && vmInfo.Files.VmPathName) {
      const vmPathName = vmInfo.Files.VmPathName;
      // 형식: [Datastore-Name] path/to/vm.vmx
      const match = vmPathName.match(/\[([^\]]+)\]/);
      if (match && match[1]) {
        datastore = match[1];
        console.log(`[Template Service] Datastore 찾음 (VmPathName): ${datastore}`);
      }
    }
    
    // 방법 3: Datastore 필드에서 추출
    if (!datastore && vmInfo && vmInfo.Datastore) {
      // Datastore가 배열인 경우 첫 번째 사용
      const datastores = Array.isArray(vmInfo.Datastore) ? vmInfo.Datastore : [vmInfo.Datastore];
      if (datastores.length > 0) {
        // Datastore 객체에서 이름 추출
        const dsInfo = datastores[0];
        if (typeof dsInfo === 'string') {
          datastore = dsInfo;
        } else if (dsInfo && dsInfo.Value) {
          // Value가 전체 경로일 수 있으므로 이름만 추출
          const valueParts = dsInfo.Value.split('/');
          datastore = valueParts[valueParts.length - 1] || dsInfo.Value;
        } else if (dsInfo && dsInfo.Name) {
          datastore = dsInfo.Name;
        }
        if (datastore) {
          console.log(`[Template Service] Datastore 찾음 (Datastore 필드): ${datastore}`);
        }
      }
    }

    // 환경변수에서 datastore 확인 (하드코딩된 기본값 제거)
    if (!datastore && DEFAULT_DATASTORE) {
      datastore = DEFAULT_DATASTORE;
      console.log(`[Template Service] Datastore를 환경 변수에서 사용: ${datastore}`);
    }
    
    // Datastore가 없으면 에러 발생 (하드코딩된 기본값 사용하지 않음)
    if (!datastore) {
      console.error('[Template Service] Datastore를 찾을 수 없습니다.');
      console.error('[Template Service] VM Info:', JSON.stringify(vmInfo, null, 2));
      throw new Error('Datastore를 찾을 수 없습니다. VM의 Datastore 정보를 확인하거나 환경 변수 GOVC_DATASTORE를 설정하세요.');
    }
    
    console.log(`[Template Service] 최종 Datastore: ${datastore}`);

    // VM의 resource pool 정보 추출
    let resourcePool = null;
    
    /**
     * Resource Pool 경로를 전체 경로로 변환하는 함수
     * @param {string} rpValue - Resource Pool 값 (예: "ResourcePool:resgroup-10" 또는 "/Datacenter/host/Cluster/Resources")
     * @returns {Promise<string|null>} 전체 경로 또는 null
     */
    const convertResourcePoolToPath = async (rpValue) => {
      if (!rpValue || rpValue === 'null' || rpValue === '') {
        return null;
      }
      
      // 이미 전체 경로 형식인 경우 (예: "/Datacenter/host/Cluster/Resources")
      if (rpValue.startsWith('/')) {
        return rpValue;
      }
      
      // ResourcePool:resgroup-XX 형식인 경우 전체 경로로 변환
      if (rpValue.startsWith('ResourcePool:')) {
        try {
          // resgroup ID 추출
          const resgroupId = rpValue.replace('ResourcePool:', '');
          
          // govc object.collect로 해당 resgroup의 전체 경로 찾기
          const collectCommand = `govc object.collect -s "${rpValue}" name`;
          const { stdout: rpName } = await execPromise(collectCommand, {
            env: {
              ...process.env,
              GOVC_URL: vcenterConfig.url,
              GOVC_USERNAME: vcenterConfig.username,
              GOVC_PASSWORD: vcenterConfig.password,
              GOVC_INSECURE: vcenterConfig.insecure
            }
          });
          
          // Resource Pool의 부모 경로를 찾아서 전체 경로 구성
          // 먼저 Resource Pool의 부모(클러스터 또는 호스트) 찾기
          const parentCommand = `govc object.collect -s "${rpValue}" parent`;
          const { stdout: parentPath } = await execPromise(parentCommand, {
            env: {
              ...process.env,
              GOVC_URL: vcenterConfig.url,
              GOVC_USERNAME: vcenterConfig.username,
              GOVC_PASSWORD: vcenterConfig.password,
              GOVC_INSECURE: vcenterConfig.insecure
            }
          });
          
          const parent = parentPath.trim();
          const rpNameValue = rpName.trim();
          
          if (parent && parent.startsWith('/') && rpNameValue) {
            const fullPath = `${parent}/${rpNameValue}`;
            console.log(`[Template Service] Resource Pool 경로 변환 성공: ${rpValue} -> ${fullPath}`);
            return fullPath;
          }
          
          // 대안: govc find로 직접 찾기
          const findCommand = `govc find . -type p | grep -i "${resgroupId}" | head -1`;
          const { stdout: rpPath } = await execPromise(findCommand, {
            env: {
              ...process.env,
              GOVC_URL: vcenterConfig.url,
              GOVC_USERNAME: vcenterConfig.username,
              GOVC_PASSWORD: vcenterConfig.password,
              GOVC_INSECURE: vcenterConfig.insecure
            },
            shell: true
          });
          
          const fullPath = rpPath.trim().split('\n')[0];
          if (fullPath && fullPath.startsWith('/')) {
            console.log(`[Template Service] Resource Pool 경로 변환 성공 (find): ${rpValue} -> ${fullPath}`);
            return fullPath;
          }
        } catch (error) {
          console.warn(`[Template Service] Resource Pool 경로 변환 실패 (${rpValue}):`, error.message);
        }
      }
      
      // 그 외의 경우 그대로 반환 (이름만 있는 경우 등)
      return rpValue;
    };
    
    // 방법 1: VM 정보에서 직접 추출
    if (vmInfo && vmInfo.ResourcePool) {
      const rpInfo = vmInfo.ResourcePool;
      let rpValue = null;
      
      if (typeof rpInfo === 'string') {
        rpValue = rpInfo;
      } else if (rpInfo && rpInfo.Value) {
        rpValue = rpInfo.Value;
      } else if (rpInfo && rpInfo.Name) {
        rpValue = rpInfo.Name;
      }
      
      if (rpValue) {
        resourcePool = await convertResourcePoolToPath(rpValue);
        if (resourcePool) {
          console.log(`[Template Service] Resource Pool 찾음 (VM Info): ${resourcePool}`);
        }
      }
    }
    
    // 방법 2: VM의 경로를 찾아서 resource pool 조회
    if (!resourcePool) {
      try {
        // VM의 전체 경로 찾기
        const findCommand = `govc find . -type m -name "${vmName}"`;
        const { stdout: vmPath } = await execPromise(findCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          }
        });
        const vmFullPath = vmPath.trim().split('\n')[0];
        
        if (vmFullPath) {
          // VM의 resource pool 직접 조회
          const rpCommand = `govc object.collect -s "${vmFullPath}" resourcePool`;
          const { stdout: rpOutput } = await execPromise(rpCommand, {
            env: {
              ...process.env,
              GOVC_URL: vcenterConfig.url,
              GOVC_USERNAME: vcenterConfig.username,
              GOVC_PASSWORD: vcenterConfig.password,
              GOVC_INSECURE: vcenterConfig.insecure
            }
          });
          const rpValue = rpOutput.trim();
          if (rpValue && rpValue !== '' && rpValue !== 'null') {
            resourcePool = await convertResourcePoolToPath(rpValue);
            if (resourcePool) {
              console.log(`[Template Service] Resource Pool 찾음 (VM 경로): ${resourcePool}`);
            }
          }
        }
      } catch (error) {
        console.warn('[Template Service] Resource Pool 조회 실패 (VM 경로):', error.message);
      }
    }
    
    // 방법 3: VM의 호스트를 통해 클러스터의 기본 resource pool 찾기
    if (!resourcePool && vmInfo && vmInfo.Runtime && vmInfo.Runtime.Host) {
      try {
        const hostInfo = vmInfo.Runtime.Host;
        let hostValue = null;
        
        if (typeof hostInfo === 'string') {
          hostValue = hostInfo;
        } else if (hostInfo && hostInfo.Value) {
          hostValue = hostInfo.Value;
        } else if (hostInfo && hostInfo.Name) {
          hostValue = hostInfo.Name;
        }
        
        if (hostValue) {
          console.log(`[Template Service] Host 정보: ${hostValue}`);
          
          // 호스트의 부모(클러스터) 찾기
          const parentCommand = `govc object.collect -s "${hostValue}" parent`;
          const { stdout: parentOutput } = await execPromise(parentCommand, {
            env: {
              ...process.env,
              GOVC_URL: vcenterConfig.url,
              GOVC_USERNAME: vcenterConfig.username,
              GOVC_PASSWORD: vcenterConfig.password,
              GOVC_INSECURE: vcenterConfig.insecure
            }
          });
          const parentValue = parentOutput.trim();
          
          console.log(`[Template Service] Parent (Cluster): ${parentValue}`);
          
          if (parentValue && parentValue !== 'null' && parentValue !== '') {
            // 클러스터의 기본 resource pool (Resources) 사용
            const clusterRpPath = `${parentValue}/Resources`;
            resourcePool = clusterRpPath;
            console.log(`[Template Service] Resource Pool 찾음 (클러스터 기본): ${resourcePool}`);
          }
        }
      } catch (error) {
        console.warn('[Template Service] Resource Pool 조회 실패 (클러스터):', error.message);
      }
    }
    
    // 방법 4: VM이 속한 클러스터의 기본 resource pool 사용 (최후의 수단)
    if (!resourcePool) {
      try {
        // 모든 클러스터의 기본 resource pool 찾기
        const findRpCommand = `govc find . -type p -name Resources | head -1`;
        const { stdout: rpOutput } = await execPromise(findRpCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          }
        });
        const rpValue = rpOutput.trim();
        if (rpValue && rpValue !== '') {
          resourcePool = rpValue;
          console.log(`[Template Service] Resource Pool 찾음 (기본 Resources): ${resourcePool}`);
        }
      } catch (error) {
        console.warn('[Template Service] Resource Pool 조회 실패 (기본 Resources):', error.message);
      }
    }

    // 방법 4: 환경변수에서 resource pool 확인
    if (!resourcePool) {
      resourcePool = process.env.GOVC_RESOURCE_POOL || process.env.VCENTER_RESOURCE_POOL;
    }
    
    // Resource Pool이 ResourcePool: 형식이면 클러스터의 기본 Resource Pool 사용
    if (resourcePool && resourcePool.startsWith('ResourcePool:')) {
      console.warn(`[Template Service] Resource Pool 경로 변환 실패, 클러스터 기본 Resource Pool 사용: ${resourcePool}`);
      resourcePool = null; // 다시 찾기
    }
    
    // resource pool이 없거나 변환 실패한 경우 클러스터의 기본 resource pool 사용
    if (!resourcePool) {
      try {
        // VM의 호스트를 통해 클러스터의 기본 resource pool 찾기
        if (vmInfo && vmInfo.Runtime && vmInfo.Runtime.Host) {
          const hostInfo = vmInfo.Runtime.Host;
          let hostValue = null;
          
          if (typeof hostInfo === 'string') {
            hostValue = hostInfo;
          } else if (hostInfo && hostInfo.Value) {
            hostValue = hostInfo.Value;
          } else if (hostInfo && hostInfo.Name) {
            hostValue = hostInfo.Name;
          }
          
          if (hostValue) {
            // 호스트의 부모(클러스터) 찾기
            const parentCommand = `govc object.collect -s "${hostValue}" parent`;
            const { stdout: parentOutput } = await execPromise(parentCommand, {
              env: {
                ...process.env,
                GOVC_URL: vcenterConfig.url,
                GOVC_USERNAME: vcenterConfig.username,
                GOVC_PASSWORD: vcenterConfig.password,
                GOVC_INSECURE: vcenterConfig.insecure
              }
            });
            const parentValue = parentOutput.trim();
            
            if (parentValue && parentValue !== 'null' && parentValue !== '') {
              // 클러스터의 기본 resource pool (Resources) 사용
              const clusterRpPath = `${parentValue}/Resources`;
              resourcePool = clusterRpPath;
              console.log(`[Template Service] Resource Pool 찾음 (클러스터 기본, Fallback): ${resourcePool}`);
            }
          }
        }
        
        // 여전히 없으면 모든 클러스터의 기본 resource pool 찾기
        if (!resourcePool) {
          const findRpCommand = `govc find . -type p -name Resources | head -1`;
          const { stdout: rpOutput } = await execPromise(findRpCommand, {
            env: {
              ...process.env,
              GOVC_URL: vcenterConfig.url,
              GOVC_USERNAME: vcenterConfig.username,
              GOVC_PASSWORD: vcenterConfig.password,
              GOVC_INSECURE: vcenterConfig.insecure
            }
          });
          const rpValue = rpOutput.trim();
          if (rpValue && rpValue !== '') {
            resourcePool = rpValue;
            console.log(`[Template Service] Resource Pool 찾음 (기본 Resources, Fallback): ${resourcePool}`);
          }
        }
      } catch (error) {
        console.warn('[Template Service] Resource Pool Fallback 실패:', error.message);
      }
    }
    
    // resource pool이 없으면 에러 발생 (상세한 디버깅 정보 포함)
    if (!resourcePool) {
      console.error('[Template Service] Resource Pool을 찾을 수 없습니다.');
      console.error('[Template Service] VM Info:', JSON.stringify(vmInfo, null, 2));
      throw new Error('Resource Pool을 찾을 수 없습니다. 환경변수 GOVC_RESOURCE_POOL을 설정하거나 VM의 Resource Pool 정보를 확인하세요. 예: export GOVC_RESOURCE_POOL="/Datacenter/host/Cluster-01/Resources"');
    }
    
    // 최종 검증: Resource Pool이 전체 경로 형식인지 확인
    if (!resourcePool.startsWith('/')) {
      console.error(`[Template Service] Resource Pool이 올바른 형식이 아닙니다: ${resourcePool}`);
      throw new Error(`Resource Pool 경로 형식 오류: ${resourcePool}. 전체 경로 형식이 필요합니다 (예: /Datacenter/host/Cluster/Resources)`);
    }
    
    console.log(`[Template Service] 최종 Resource Pool: ${resourcePool}`);

    // 2. VM을 템플릿으로 변환
    // 주의: govc vm.markastemplate은 VM을 직접 템플릿으로 변환합니다.
    // 템플릿 이름을 변경하려면 먼저 변환 후 이름을 변경해야 합니다.
    
    // 방법 1: VM을 템플릿으로 직접 변환 (이름 유지)
    // const command = `govc vm.markastemplate "${vmName}"`;
    
    // 방법 2: VM을 클론하여 템플릿으로 변환 (새 이름 사용)
    // 더 안전한 방법: VM을 클론한 후 템플릿으로 변환
    // templateName에서 공백 제거 및 정리
    const cleanTemplateName = templateName.trim().replace(/\s+/g, '-');
    const cloneName = `${cleanTemplateName}-temp-${Date.now()}`;
    
    console.log(`[Template Service] VM 클론 시작: ${vmName} -> ${cloneName}`);
    
    // Datastore는 반드시 지정해야 함 (여러 Datastore가 있을 경우)
    // 원본 VM이 있는 Datastore를 사용
    if (!datastore) {
      // VM의 VmPathName에서 Datastore 추출 (최종 시도)
      if (vmInfo && vmInfo.Files && vmInfo.Files.VmPathName) {
        const vmPathName = vmInfo.Files.VmPathName;
        const match = vmPathName.match(/\[([^\]]+)\]/);
        if (match && match[1]) {
          datastore = match[1];
          console.log(`[Template Service] Datastore 자동 지정 (VmPathName): ${datastore}`);
        }
      }
      
      if (!datastore) {
        throw new Error('Datastore를 찾을 수 없습니다. VM의 Datastore 정보를 확인하세요.');
      }
    }
    
    // Resource Pool도 반드시 지정해야 함 (여러 Resource Pool이 있을 경우)
    if (!resourcePool) {
      throw new Error('Resource Pool을 찾을 수 없습니다. VM의 Resource Pool 정보를 확인하세요.');
    }
    
    // VM이 있는 호스트 정보 추출 (클론 시 같은 호스트 사용하여 Datastore 접근 문제 방지)
    let vmHost = null;
    try {
      // govc vm.info로 호스트 정보 추출
      const hostInfoCommand = `govc vm.info "${vmName}" | grep -i "^  Host:" | awk '{print $2}'`;
      const { stdout: hostOutput } = await execPromise(hostInfoCommand, {
        env: {
          ...process.env,
          GOVC_URL: vcenterConfig.url,
          GOVC_USERNAME: vcenterConfig.username,
          GOVC_PASSWORD: vcenterConfig.password,
          GOVC_INSECURE: vcenterConfig.insecure
        },
        shell: true
      });
      const hostValue = hostOutput.trim();
      if (hostValue && hostValue !== '') {
        vmHost = hostValue;
        console.log(`[Template Service] VM 호스트 찾음: ${vmHost}`);
      }
    } catch (error) {
      console.warn(`[Template Service] VM 호스트 정보 추출 실패:`, error.message);
    }
    
    // govc vm.clone 명령어 구성
    // VM 이름을 사용하는 것이 더 안정적 (전체 경로는 때때로 문제를 일으킬 수 있음)
    let cloneCommand = `govc vm.clone -vm="${vmName}"`;
    
    // Datastore는 필수 (여러 Datastore가 있을 경우)
    if (datastore) {
      cloneCommand += ` -ds="${datastore}"`;
      console.log(`[Template Service] Datastore 지정 (원본 VM Datastore 사용): ${datastore}`);
    } else {
      throw new Error('Datastore를 찾을 수 없습니다. VM의 Datastore 정보를 확인하세요.');
    }
    
    // Resource Pool은 필수 (여러 Resource Pool이 있을 경우)
    cloneCommand += ` -pool="${resourcePool}"`;
    console.log(`[Template Service] Resource Pool 지정: ${resourcePool}`);
    
    // 호스트 지정 (선택사항, 지정하지 않으면 자동 선택)
    // 같은 호스트에 클론하면 Datastore 접근 문제를 방지할 수 있음
    if (vmHost) {
      cloneCommand += ` -host="${vmHost}"`;
      console.log(`[Template Service] 호스트 지정 (원본 VM 호스트 사용): ${vmHost}`);
    }
    
    // 클론은 전원 꺼진 상태로 생성
    cloneCommand += ` -on=false "${cloneName}"`;
    
    console.log(`[Template Service] 클론 명령어: ${cloneCommand}`);
    
    try {
      await execPromise(cloneCommand, {
        env: {
          ...process.env,
          GOVC_URL: vcenterConfig.url,
          GOVC_USERNAME: vcenterConfig.username,
          GOVC_PASSWORD: vcenterConfig.password,
          GOVC_INSECURE: vcenterConfig.insecure
        },
        timeout: 600000 // 10분 타임아웃
      });
    } catch (cloneError) {
      // 클론 실패 시 원본 VM 전원 상태 복원 (필요한 경우)
      if (!vmWasPoweredOn) {
        try {
          console.log(`[Template Service] 클론 실패, 원본 VM 전원 끄기 시도: ${vmName}`);
          const powerOffCommand = `govc vm.power -off -force "${vmName}"`;
          await execPromise(powerOffCommand, {
            env: {
              ...process.env,
              GOVC_URL: vcenterConfig.url,
              GOVC_USERNAME: vcenterConfig.username,
              GOVC_PASSWORD: vcenterConfig.password,
              GOVC_INSECURE: vcenterConfig.insecure
            },
            timeout: 30000
          });
        } catch (restoreError) {
          console.warn(`[Template Service] 원본 VM 전원 복원 실패:`, restoreError.message);
        }
      }
      throw cloneError; // 원래 에러를 다시 throw
    }

    // 클론된 VM의 전원 상태 확인 및 강제 종료 (안전장치)
    console.log(`[Template Service] 클론된 VM 전원 상태 확인: ${cloneName}`);
    try {
      const powerStateCommand = `govc vm.power -get "${cloneName}"`;
      const { stdout: powerState } = await execPromise(powerStateCommand, {
        env: {
          ...process.env,
          GOVC_URL: vcenterConfig.url,
          GOVC_USERNAME: vcenterConfig.username,
          GOVC_PASSWORD: vcenterConfig.password,
          GOVC_INSECURE: vcenterConfig.insecure
        }
      });
      
      if (powerState.trim().toLowerCase().includes('on') || powerState.trim().toLowerCase().includes('powered on')) {
        console.log(`[Template Service] VM이 전원이 켜져 있습니다. 전원을 끕니다: ${cloneName}`);
        const powerOffCommand = `govc vm.power -off -force "${cloneName}"`;
        await execPromise(powerOffCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          },
          timeout: 60000 // 1분 타임아웃
        });
        // 전원이 완전히 꺼질 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.warn(`[Template Service] 전원 상태 확인/종료 실패 (계속 진행):`, error.message);
    }

    // ==========================================
    // 네트워크 초기화 스크립트 실행 (템플릿 준비)
    // ==========================================
    console.log(`[Template Service] 템플릿 네트워크 초기화 시작: ${cloneName}`);
    
    try {
      // 1. VM 전원 켜기
      console.log(`[Template Service] VM 전원 켜기: ${cloneName}`);
      const powerOnCommand = `govc vm.power -on "${cloneName}"`;
      await execPromise(powerOnCommand, {
        env: {
          ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
        },
        timeout: 60000
      });
      
      // VM 부팅 대기 (최대 2분)
      console.log(`[Template Service] VM 부팅 대기 중...`);
      let vmIP = null;
      let waitTime = 0;
      const maxWait = 120; // 2분
      
      while (waitTime < maxWait && !vmIP) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
        waitTime += 10;
        
        try {
          const ipCheckCommand = `govc vm.ip "${cloneName}" | head -1`;
          const { stdout: ipOutput } = await execPromise(ipCheckCommand, {
            env: {
              ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
            }
          });
          
          const ip = ipOutput.trim();
          if (ip && ip !== '') {
            vmIP = ip;
            console.log(`[Template Service] VM IP 확인: ${vmIP}`);
            break;
          }
        } catch (error) {
          // IP 확인 실패는 계속 재시도
          console.log(`[Template Service] IP 확인 대기 중... (${waitTime}/${maxWait}초)`);
        }
      }
      
      if (!vmIP) {
        throw new Error('VM IP를 확인하지 못했습니다. 네트워크 초기화를 건너뜁니다.');
      }
      
      // 2. SSH 접속을 위한 SSH 키 찾기
      const sshKeyPaths = [
        process.env.SSH_KEY_PATH,
        path.join(__dirname, '../../pemkey/danainfra'),
        path.join(__dirname, '../../pemkey/dana-cocktail'),
        path.join(__dirname, '../../pemkey/jenkins'),
        '/home/ubuntu/workspace/vm-autoscaling/pemkey/danainfra',
        '/home/ubuntu/workspace/vm-autoscaling/pemkey/dana-cocktail',
        '/home/ubuntu/workspace/vm-autoscaling/pemkey/jenkins'
      ];
      
      let sshKey = null;
      for (const keyPath of sshKeyPaths) {
        if (keyPath && fs.existsSync(keyPath)) {
          sshKey = keyPath;
          console.log(`[Template Service] SSH 키 발견: ${sshKey}`);
          break;
        }
      }
      
      if (!sshKey) {
        throw new Error('SSH 키를 찾을 수 없습니다. 네트워크 초기화를 건너뜁니다.');
      }
      
      // SSH 키 권한 설정
      await execPromise(`chmod 600 "${sshKey}"`);
      
      // 3. 네트워크 초기화 스크립트 실행
      console.log(`[Template Service] 네트워크 초기화 스크립트 실행 중...`);
      
      // 네트워크 인터페이스 자동 감지 (ens33, ens192, ens160, eth0 등)
      const networkInitScript = `#!/bin/bash
set -e

echo "=== 템플릿 네트워크 초기화 시작 ==="

# 네트워크 인터페이스 자동 감지
INTERFACE=$(ip -br link show | grep -v lo | grep -E '^(ens33|ens192|ens160|eth0)' | head -1 | cut -d' ' -f1)
if [ -z "$INTERFACE" ]; then
    # 우선순위 인터페이스가 없으면 첫 번째 인터페이스 사용
    INTERFACE=$(ip -br link show | grep -v lo | head -1 | cut -d' ' -f1)
fi

if [ -z "$INTERFACE" ]; then
    echo "ERROR: 네트워크 인터페이스를 찾을 수 없습니다."
    exit 1
fi

echo "네트워크 인터페이스: $INTERFACE"

# netplan 파일 백업
mkdir -p /root/netplan-backup
cp /etc/netplan/*.yaml /root/netplan-backup/ 2>/dev/null || true

# static IP 제거하고 DHCP로 변경
cat <<EOF > /etc/netplan/01-netcfg.yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    $INTERFACE:
      dhcp4: yes
      dhcp6: no
EOF

echo "=== hostname 초기화 ==="
echo "localhost" > /etc/hostname
sed -i 's/127.0.1.1.*/127.0.1.1 localhost/' /etc/hosts 2>/dev/null || true

echo "=== cloud-init 비활성화 ==="
touch /etc/cloud/cloud-init.disabled

echo "=== SSH host key 초기화 ==="
rm -f /etc/ssh/ssh_host_*
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true

echo "=== 로그 정리 ==="
/usr/sbin/logrotate -f /etc/logrotate.conf 2>/dev/null || true
rm -rf /tmp/* 2>/dev/null || true
rm -rf /var/tmp/* 2>/dev/null || true
apt clean 2>/dev/null || true

echo "=== 네트워크 설정 적용 ==="
netplan apply
sleep 3

echo "=== 템플릿 네트워크 초기화 완료 ==="
`;
      
      // SSH로 스크립트 실행
      const sshCommand = `ssh -i "${sshKey}" \\
        -o StrictHostKeyChecking=no \\
        -o UserKnownHostsFile=/dev/null \\
        -o ConnectTimeout=10 \\
        ubuntu@${vmIP} bash -s << 'TEMPLATE_INIT_EOF'
${networkInitScript}
TEMPLATE_INIT_EOF`;
      
      await execPromise(sshCommand, {
        timeout: 120000 // 2분 타임아웃
      });
      
      console.log(`[Template Service] 네트워크 초기화 완료`);
      
      // 4. VM 전원 끄기
      console.log(`[Template Service] VM 전원 끄기: ${cloneName}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 네트워크 설정 적용 대기
      
      const powerOffCommand = `govc vm.power -off -force "${cloneName}"`;
      await execPromise(powerOffCommand, {
        env: {
          ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
        },
        timeout: 60000
      });
      
      // 전원이 완전히 꺼질 때까지 대기
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      console.warn(`[Template Service] 네트워크 초기화 실패 (템플릿 변환은 계속 진행):`, error.message);
      // 네트워크 초기화 실패해도 템플릿 변환은 계속 진행
      // VM이 켜져 있으면 강제 종료
      try {
        const powerOffCommand = `govc vm.power -off -force "${cloneName}"`;
        await execPromise(powerOffCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          },
          timeout: 60000
        });
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (powerOffError) {
        console.warn(`[Template Service] 전원 끄기 실패:`, powerOffError.message);
      }
    }

    console.log(`[Template Service] 템플릿으로 변환 시작: ${cloneName}`);
    const markTemplateCommand = `govc vm.markastemplate "${cloneName}"`;
    
    await execPromise(markTemplateCommand, {
      env: {
        ...process.env,
        GOVC_URL: vcenterConfig.url,
        GOVC_USERNAME: vcenterConfig.username,
        GOVC_PASSWORD: vcenterConfig.password,
        GOVC_INSECURE: vcenterConfig.insecure
      }
    });

    // 3. 템플릿 이름 변경 (필요한 경우)
    if (cloneName !== templateName) {
      console.log(`[Template Service] 템플릿 이름 변경: ${cloneName} -> ${templateName}`);
      
      // VM의 전체 경로 찾기
      try {
        const findCommand = `govc find . -type m -name "${cloneName}"`;
        const { stdout: vmPath } = await execPromise(findCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          }
        });
        const vmFullPath = vmPath.trim().split('\n')[0];
        
        if (vmFullPath) {
          // 전체 경로를 사용하여 이름 변경
          const renameCommand = `govc object.rename "${vmFullPath}" "${templateName}"`;
          await execPromise(renameCommand, {
            env: {
              ...process.env,
              GOVC_URL: vcenterConfig.url,
              GOVC_USERNAME: vcenterConfig.username,
              GOVC_PASSWORD: vcenterConfig.password,
              GOVC_INSECURE: vcenterConfig.insecure
            }
          });
          console.log(`[Template Service] 템플릿 이름 변경 완료: ${templateName}`);
        } else {
          console.warn(`[Template Service] VM 경로를 찾을 수 없어 이름 변경을 건너뜁니다: ${cloneName}`);
        }
      } catch (error) {
        console.warn(`[Template Service] 템플릿 이름 변경 실패 (템플릿은 생성됨):`, error.message);
        // 이름 변경 실패해도 템플릿은 생성되었으므로 계속 진행
      }
    }

    // 4. 템플릿 메타데이터 저장
    const templateData = {
      id: `template-${Date.now()}`,
      name: templateName,
      originalVmName: vmName,
      description: metadata.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...metadata
    };

    await saveTemplateMetadata(templateData);

    return {
      success: true,
      template: templateData,
      message: `VM '${vmName}'을 템플릿 '${templateName}'으로 변환했습니다.`
    };
  } catch (error) {
    console.error(`[Template Service] 템플릿 변환 실패:`, error);
    throw new Error(`템플릿 변환 실패: ${error.message}`);
  }
}

/**
 * 템플릿 메타데이터 저장
 * @param {object} templateData - 템플릿 데이터
 * @returns {Promise<object>} 저장된 템플릿 정보
 */
async function saveTemplateMetadata(templateData) {
  await ensureDataFile();
  try {
    const templates = await getTemplates();
    
    // 중복 체크
    const existing = templates.find(t => t.name === templateData.name);
    if (existing) {
      // 기존 템플릿 업데이트
      Object.assign(existing, templateData, {
        updatedAt: new Date().toISOString()
      });
    } else {
      // 새 템플릿 추가
      templates.push(templateData);
    }

    // 백업 생성
    const backupPath = `${TEMPLATES_DATA_PATH}.backup.${Date.now()}`;
    await fsPromises.copyFile(TEMPLATES_DATA_PATH, backupPath);

    // 파일 저장
    await fsPromises.writeFile(TEMPLATES_DATA_PATH, JSON.stringify(templates, null, 2));

    return existing || templateData;
  } catch (error) {
    console.error('[Template Service] 메타데이터 저장 실패:', error);
    throw new Error(`메타데이터 저장 실패: ${error.message}`);
  }
}

/**
 * 템플릿 삭제
 * @param {string} templateId - 템플릿 ID
 * @returns {Promise<object>} 삭제 결과
 */
async function deleteTemplate(templateId) {
  try {
    const templates = await getTemplates();
    // ID로 먼저 찾기
    let template = templates.find(t => t.id === templateId);
    
    // ID로 찾지 못하면 이름으로 찾기 (vCenter 템플릿의 경우 ID가 동적으로 생성될 수 있음)
    if (!template) {
      template = templates.find(t => t.name === templateId);
    }
    
    if (!template) {
      throw new Error(`템플릿 '${templateId}'을 찾을 수 없습니다.`);
    }

    // vCenter에서 템플릿 삭제 (디스크에서도 삭제)
    const vcenterConfig = getVCenterConfig();
    if (vcenterConfig.url && vcenterConfig.username && vcenterConfig.password) {
      try {
        console.log(`[Template Service] vCenter에서 템플릿 삭제 시작 (디스크 포함): ${template.name}`);
        // govc vm.destroy는 VM과 템플릿 모두 삭제하며, 디스크 파일도 함께 삭제합니다
        // 이는 vCenter UI의 "디스크에서 삭제" 옵션과 동일합니다
        const deleteCommand = `govc vm.destroy "${template.name}"`;
        await execPromise(deleteCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          },
          timeout: 300000 // 5분 타임아웃 (템플릿 삭제는 시간이 걸릴 수 있음)
        });
        console.log(`[Template Service] vCenter에서 템플릿 삭제 완료 (디스크 포함): ${template.name}`);
      } catch (error) {
        console.error(`[Template Service] vCenter 템플릿 삭제 실패:`, error.message);
        // vCenter 삭제 실패해도 메타데이터는 삭제 (일관성 유지)
        console.warn(`[Template Service] vCenter 템플릿 삭제 실패했지만 메타데이터는 삭제합니다.`);
      }
    }

    // 메타데이터에서 삭제 (ID 또는 이름으로 매칭)
    const filtered = templates.filter(t => t.id !== templateId && t.name !== template.name);
    
    // 백업 생성
    const backupPath = `${TEMPLATES_DATA_PATH}.backup.${Date.now()}`;
    await fsPromises.copyFile(TEMPLATES_DATA_PATH, backupPath);

    // 파일 저장
    await fsPromises.writeFile(TEMPLATES_DATA_PATH, JSON.stringify(filtered, null, 2));

    return {
      success: true,
      templateId: templateId,
      message: `템플릿 '${template.name}'이 삭제되었습니다.`
    };
  } catch (error) {
    console.error('[Template Service] 템플릿 삭제 실패:', error);
    throw new Error(`템플릿 삭제 실패: ${error.message}`);
  }
}

/**
 * vCenter에서 VM 목록 조회
 * @returns {Promise<Array>} VM 목록
 */
async function getVmList() {
  return executeWithVCenterConnection(async () => {
    const vcenterConfig = getVCenterConfig();
    if (!vcenterConfig.url || !vcenterConfig.username || !vcenterConfig.password) {
      console.warn('[Template Service] vCenter 연결 정보가 설정되지 않았습니다.');
      console.warn(`  GOVC_URL: ${vcenterConfig.url ? '설정됨' : '없음'}`);
      console.warn(`  GOVC_USERNAME: ${vcenterConfig.username ? '설정됨' : '없음'}`);
      console.warn(`  GOVC_PASSWORD: ${vcenterConfig.password ? '설정됨' : '없음'}`);
      throw new Error('vCenter 연결 정보가 설정되지 않았습니다. 환경 변수를 확인하세요.');
    }

    console.log('[Template Service] vCenter VM 목록 조회 시작...');
    console.log(`  vCenter URL: ${vcenterConfig.url}`);
    console.log(`  vCenter User: ${vcenterConfig.username}`);

    // VM 목록 조회: /Datacenter/vm 경로 또는 find 명령 사용
    const command = `govc find / -type m`;
    const { stdout, stderr } = await execPromise(command, {
      env: {
        ...process.env,
        GOVC_URL: vcenterConfig.url,
        GOVC_USERNAME: vcenterConfig.username,
        GOVC_PASSWORD: vcenterConfig.password,
        GOVC_INSECURE: vcenterConfig.insecure
      },
      timeout: 30000 // 30초 타임아웃
    });

    if (stderr && stderr.trim()) {
      console.warn('[Template Service] govc stderr:', stderr);
    }

    // govc find는 한 줄에 하나씩 경로를 반환합니다
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    
    // VM 정보 조회 (IP 주소 포함) - 병렬 처리로 속도 향상
    const vmPaths = lines
      .map(path => {
        const parts = path.split('/');
        const name = parts[parts.length - 1];
        return { name, path };
      })
      .filter(vm => !vm.name.startsWith('vCLS-')); // vCLS-로 시작하는 VM 제외
    
    // 병렬로 IP 조회 (Promise.all 사용)
    const vmListPromises = vmPaths.map(async ({ name, path }) => {
      let ips = [];
      try {
        const vmIpCommand = `govc vm.ip "${name}"`;
        const { stdout: ipOutput } = await execPromise(vmIpCommand, {
          env: {
            ...process.env,
            GOVC_URL: vcenterConfig.url,
            GOVC_USERNAME: vcenterConfig.username,
            GOVC_PASSWORD: vcenterConfig.password,
            GOVC_INSECURE: vcenterConfig.insecure
          },
          timeout: 3000 // 3초 타임아웃 (병렬 처리로 짧게 설정)
        });
        
        // govc vm.ip는 한 줄에 하나씩 IP를 반환 (여러 개일 수 있음)
        const ipLines = ipOutput.trim().split('\n').filter(line => line.trim());
        ipLines.forEach(ip => {
          const ipStr = ip.trim();
          // IPv4 주소만 추가 (IPv6 제외)
          if (ipStr && /^\d+\.\d+\.\d+\.\d+$/.test(ipStr) && !ips.includes(ipStr)) {
            ips.push(ipStr);
          }
        });
      } catch (error) {
        // IP 조회 실패는 경고만 출력 (VM 목록은 계속 반환)
        // VM이 꺼져 있거나 Guest Tools가 설치되지 않은 경우 IP를 가져올 수 없음
        // 타임아웃이나 에러는 무시하고 계속 진행
      }
      
      return {
        name: name,
        path: path,
        ips: ips
      };
    });
    
    // 모든 VM 정보를 병렬로 조회
    const vmList = await Promise.all(vmListPromises);
    
    // 이름 기준으로 정렬
    vmList.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    
    return vmList;
  }, 3, 2000).catch(error => {
    console.error('[Template Service] VM 목록 조회 실패:', error);
    console.error('[Template Service] 에러 상세:', error.message);
    console.error('[Template Service] Stack:', error.stack);
    throw error; // 에러를 다시 throw하여 API에서 에러 메시지를 반환할 수 있도록
  });
}

/**
 * vCenter 연결 상태 조회
 * @returns {object} 연결 상태 정보
 */
function getVCenterConnectionState() {
  return {
    ...vCenterConnectionState,
    lastCheckTime: vCenterConnectionState.lastCheckTime ? new Date(vCenterConnectionState.lastCheckTime).toISOString() : null,
    lastSuccessTime: vCenterConnectionState.lastSuccessTime ? new Date(vCenterConnectionState.lastSuccessTime).toISOString() : null
  };
}

/**
 * vCenter 연결 상태 초기화 및 주기적 확인 시작
 */
function startVCenterConnectionMonitor() {
  console.log('[Template Service] vCenter 연결 모니터링 시작...');
  
  // 서버 시작 시 즉시 연결 확인
  checkVCenterConnection().then(connected => {
    if (connected) {
      console.log('[Template Service] ✅ 초기 vCenter 연결 확인 성공');
    } else {
      console.warn('[Template Service] ⚠️ 초기 vCenter 연결 확인 실패');
    }
  });
  
  // 주기적으로 연결 상태 확인 (30초마다)
  setInterval(async () => {
    await checkVCenterConnection();
  }, CONNECTION_CHECK_INTERVAL);
  
  console.log(`[Template Service] vCenter 연결 모니터링이 ${CONNECTION_CHECK_INTERVAL / 1000}초마다 실행됩니다.`);
}

module.exports = {
  getTemplates,
  getTemplateById,
  convertVmToTemplate,
  saveTemplateMetadata,
  deleteTemplate,
  getVmList,
  getVCenterConnectionState,
  checkVCenterConnection,
  startVCenterConnectionMonitor
};


