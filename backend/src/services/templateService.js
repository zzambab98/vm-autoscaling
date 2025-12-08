const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const TEMPLATES_DATA_PATH = path.join(__dirname, '../../data/templates.json');
const VCENTER_URL = process.env.GOVC_URL || process.env.VCENTER_URL;
const VCENTER_USERNAME = process.env.GOVC_USERNAME || process.env.VCENTER_USERNAME;
const VCENTER_PASSWORD = process.env.GOVC_PASSWORD || process.env.VCENTER_PASSWORD;
const DEFAULT_DATASTORE = process.env.GOVC_DATASTORE || process.env.VCENTER_DATASTORE || 'OS-Datastore-Power-Store';

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
  try {
    if (!VCENTER_URL || !VCENTER_USERNAME || !VCENTER_PASSWORD) {
      console.warn('[Template Service] vCenter 연결 정보가 설정되지 않았습니다.');
      console.warn(`  GOVC_URL: ${VCENTER_URL ? '설정됨' : '없음'}`);
      console.warn(`  GOVC_USERNAME: ${VCENTER_USERNAME ? '설정됨' : '없음'}`);
      console.warn(`  GOVC_PASSWORD: ${VCENTER_PASSWORD ? '설정됨' : '없음'}`);
      return [];
    }

    console.log('[Template Service] vCenter 템플릿 목록 조회 시작...');
    console.log(`  vCenter URL: ${VCENTER_URL}`);
    console.log(`  vCenter User: ${VCENTER_USERNAME}`);

    // vCenter에서 템플릿 목록 조회 (이름에 "template"이 포함된 VM)
    const command = `govc find / -type m -name "*template*"`;
    const { stdout, stderr } = await execPromise(command, {
      env: {
        ...process.env,
        GOVC_URL: VCENTER_URL,
        GOVC_USERNAME: VCENTER_USERNAME,
        GOVC_PASSWORD: VCENTER_PASSWORD,
        GOVC_INSECURE: process.env.GOVC_INSECURE || '1'
      }
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
  } catch (error) {
    console.error('[Template Service] vCenter 템플릿 목록 조회 실패:', error.message);
    console.error('[Template Service] 에러 상세:', {
      code: error.code,
      signal: error.signal,
      stdout: error.stdout,
      stderr: error.stderr
    });
    return [];
  }
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
    // vCenter 연결 정보 확인
    if (!VCENTER_URL || !VCENTER_USERNAME || !VCENTER_PASSWORD) {
      throw new Error('vCenter 연결 정보가 설정되지 않았습니다. 환경 변수를 확인하세요.');
    }

    // 1. VM이 존재하는지 확인하고 datastore 정보 가져오기
    const checkVmCommand = `govc vm.info -json "${vmName}"`;
    let vmInfo;
    try {
      const { stdout } = await execPromise(checkVmCommand, {
        env: {
          ...process.env,
          GOVC_URL: VCENTER_URL,
          GOVC_USERNAME: VCENTER_USERNAME,
          GOVC_PASSWORD: VCENTER_PASSWORD
        }
      });
      vmInfo = JSON.parse(stdout);
    } catch (error) {
      throw new Error(`VM '${vmName}'을 찾을 수 없습니다.`);
    }

    // VM의 datastore 정보 추출
    let datastore = null;
    if (vmInfo && vmInfo.Datastore) {
      // Datastore가 배열인 경우 첫 번째 사용
      const datastores = Array.isArray(vmInfo.Datastore) ? vmInfo.Datastore : [vmInfo.Datastore];
      if (datastores.length > 0) {
        // Datastore 객체에서 이름 추출
        const dsInfo = datastores[0];
        datastore = typeof dsInfo === 'string' ? dsInfo : (dsInfo.Value || dsInfo.Name || null);
      }
    }

    // 환경변수 또는 기본값에서 datastore 확인
    if (!datastore) {
      datastore = DEFAULT_DATASTORE;
      console.log(`[Template Service] Datastore를 기본값으로 사용: ${datastore}`);
    }

    // VM의 resource pool 정보 추출
    let resourcePool = null;
    
    // 방법 1: VM 정보에서 직접 추출
    if (vmInfo && vmInfo.ResourcePool) {
      const rpInfo = vmInfo.ResourcePool;
      if (typeof rpInfo === 'string') {
        resourcePool = rpInfo;
      } else if (rpInfo && rpInfo.Value) {
        resourcePool = rpInfo.Value;
      } else if (rpInfo && rpInfo.Name) {
        resourcePool = rpInfo.Name;
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
            GOVC_URL: VCENTER_URL,
            GOVC_USERNAME: VCENTER_USERNAME,
            GOVC_PASSWORD: VCENTER_PASSWORD
          }
        });
        const vmFullPath = vmPath.trim().split('\n')[0];
        
        if (vmFullPath) {
          // VM의 resource pool 직접 조회
          const rpCommand = `govc object.collect -s "${vmFullPath}" resourcePool`;
          const { stdout: rpOutput } = await execPromise(rpCommand, {
            env: {
              ...process.env,
              GOVC_URL: VCENTER_URL,
              GOVC_USERNAME: VCENTER_USERNAME,
              GOVC_PASSWORD: VCENTER_PASSWORD
            }
          });
          const rpValue = rpOutput.trim();
          if (rpValue && rpValue !== '' && rpValue !== 'null') {
            resourcePool = rpValue;
            console.log(`[Template Service] Resource Pool 찾음 (VM 경로): ${resourcePool}`);
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
              GOVC_URL: VCENTER_URL,
              GOVC_USERNAME: VCENTER_USERNAME,
              GOVC_PASSWORD: VCENTER_PASSWORD
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
            GOVC_URL: VCENTER_URL,
            GOVC_USERNAME: VCENTER_USERNAME,
            GOVC_PASSWORD: VCENTER_PASSWORD
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
    
    // resource pool이 없으면 에러 발생 (상세한 디버깅 정보 포함)
    if (!resourcePool) {
      console.error('[Template Service] Resource Pool을 찾을 수 없습니다.');
      console.error('[Template Service] VM Info:', JSON.stringify(vmInfo, null, 2));
      throw new Error('Resource Pool을 찾을 수 없습니다. 환경변수 GOVC_RESOURCE_POOL을 설정하거나 VM의 Resource Pool 정보를 확인하세요. 예: export GOVC_RESOURCE_POOL="/Datacenter/host/Cluster-01/Resources"');
    }
    
    console.log(`[Template Service] 최종 Resource Pool: ${resourcePool}`);

    // 2. VM을 템플릿으로 변환
    // 주의: govc vm.markastemplate은 VM을 직접 템플릿으로 변환합니다.
    // 템플릿 이름을 변경하려면 먼저 변환 후 이름을 변경해야 합니다.
    
    // 방법 1: VM을 템플릿으로 직접 변환 (이름 유지)
    // const command = `govc vm.markastemplate "${vmName}"`;
    
    // 방법 2: VM을 클론하여 템플릿으로 변환 (새 이름 사용)
    // 더 안전한 방법: VM을 클론한 후 템플릿으로 변환
    const cloneName = `${templateName}-temp-${Date.now()}`;
    
    console.log(`[Template Service] VM 클론 시작: ${vmName} -> ${cloneName}`);
    
    // govc vm.clone 명령어 구성
    // datastore와 resource pool이 여러 개인 경우 명시적으로 지정 필요
    let cloneCommand = `govc vm.clone -vm="${vmName}"`;
    
    if (datastore) {
      cloneCommand += ` -ds="${datastore}"`;
      console.log(`[Template Service] Datastore 지정: ${datastore}`);
    } else {
      console.warn('[Template Service] Datastore가 지정되지 않았습니다. 기본 datastore를 사용합니다.');
    }
    
    if (resourcePool) {
      cloneCommand += ` -pool="${resourcePool}"`;
      console.log(`[Template Service] Resource Pool 지정: ${resourcePool}`);
    } else {
      console.warn('[Template Service] Resource Pool이 지정되지 않았습니다. 기본 resource pool을 사용합니다.');
    }
    
    // 템플릿용 클론은 전원을 끈 상태로 생성 (-on=false)
    // 네트워크 설정 없이 생성하여 IP 중복 방지
    cloneCommand += ` -on=false "${cloneName}"`;
    
    console.log(`[Template Service] 클론 명령어: ${cloneCommand}`);
    await execPromise(cloneCommand, {
      env: {
        ...process.env,
        GOVC_URL: VCENTER_URL,
        GOVC_USERNAME: VCENTER_USERNAME,
        GOVC_PASSWORD: VCENTER_PASSWORD
      },
      timeout: 600000 // 10분 타임아웃
    });

    // 클론된 VM의 전원 상태 확인 및 강제 종료 (안전장치)
    console.log(`[Template Service] 클론된 VM 전원 상태 확인: ${cloneName}`);
    try {
      const powerStateCommand = `govc vm.power -get "${cloneName}"`;
      const { stdout: powerState } = await execPromise(powerStateCommand, {
        env: {
          ...process.env,
          GOVC_URL: VCENTER_URL,
          GOVC_USERNAME: VCENTER_USERNAME,
          GOVC_PASSWORD: VCENTER_PASSWORD
        }
      });
      
      if (powerState.trim().toLowerCase().includes('on') || powerState.trim().toLowerCase().includes('powered on')) {
        console.log(`[Template Service] VM이 전원이 켜져 있습니다. 전원을 끕니다: ${cloneName}`);
        const powerOffCommand = `govc vm.power -off -force "${cloneName}"`;
        await execPromise(powerOffCommand, {
          env: {
            ...process.env,
            GOVC_URL: VCENTER_URL,
            GOVC_USERNAME: VCENTER_USERNAME,
            GOVC_PASSWORD: VCENTER_PASSWORD
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
          GOVC_URL: VCENTER_URL,
          GOVC_USERNAME: VCENTER_USERNAME,
          GOVC_PASSWORD: VCENTER_PASSWORD,
          GOVC_INSECURE: process.env.GOVC_INSECURE || '1'
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
              GOVC_URL: VCENTER_URL,
              GOVC_USERNAME: VCENTER_USERNAME,
              GOVC_PASSWORD: VCENTER_PASSWORD,
              GOVC_INSECURE: process.env.GOVC_INSECURE || '1'
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
          GOVC_URL: VCENTER_URL,
          GOVC_USERNAME: VCENTER_USERNAME,
          GOVC_PASSWORD: VCENTER_PASSWORD,
          GOVC_INSECURE: process.env.GOVC_INSECURE || '1'
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
            GOVC_URL: VCENTER_URL,
            GOVC_USERNAME: VCENTER_USERNAME,
            GOVC_PASSWORD: VCENTER_PASSWORD,
            GOVC_INSECURE: process.env.GOVC_INSECURE || '1'
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
        GOVC_URL: VCENTER_URL,
        GOVC_USERNAME: VCENTER_USERNAME,
        GOVC_PASSWORD: VCENTER_PASSWORD
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
            GOVC_URL: VCENTER_URL,
            GOVC_USERNAME: VCENTER_USERNAME,
            GOVC_PASSWORD: VCENTER_PASSWORD
          }
        });
        const vmFullPath = vmPath.trim().split('\n')[0];
        
        if (vmFullPath) {
          // 전체 경로를 사용하여 이름 변경
          const renameCommand = `govc object.rename "${vmFullPath}" "${templateName}"`;
          await execPromise(renameCommand, {
            env: {
              ...process.env,
              GOVC_URL: VCENTER_URL,
              GOVC_USERNAME: VCENTER_USERNAME,
              GOVC_PASSWORD: VCENTER_PASSWORD
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
    if (VCENTER_URL && VCENTER_USERNAME && VCENTER_PASSWORD) {
      try {
        console.log(`[Template Service] vCenter에서 템플릿 삭제 시작 (디스크 포함): ${template.name}`);
        // govc vm.destroy는 VM과 템플릿 모두 삭제하며, 디스크 파일도 함께 삭제합니다
        // 이는 vCenter UI의 "디스크에서 삭제" 옵션과 동일합니다
        const deleteCommand = `govc vm.destroy "${template.name}"`;
        await execPromise(deleteCommand, {
          env: {
            ...process.env,
            GOVC_URL: VCENTER_URL,
            GOVC_USERNAME: VCENTER_USERNAME,
            GOVC_PASSWORD: VCENTER_PASSWORD,
            GOVC_INSECURE: process.env.GOVC_INSECURE || '1'
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
  try {
    if (!VCENTER_URL || !VCENTER_USERNAME || !VCENTER_PASSWORD) {
      console.warn('[Template Service] vCenter 연결 정보가 설정되지 않았습니다.');
      console.warn(`  GOVC_URL: ${VCENTER_URL ? '설정됨' : '없음'}`);
      console.warn(`  GOVC_USERNAME: ${VCENTER_USERNAME ? '설정됨' : '없음'}`);
      console.warn(`  GOVC_PASSWORD: ${VCENTER_PASSWORD ? '설정됨' : '없음'}`);
      throw new Error('vCenter 연결 정보가 설정되지 않았습니다. 환경 변수를 확인하세요.');
    }

    console.log('[Template Service] vCenter VM 목록 조회 시작...');
    console.log(`  vCenter URL: ${VCENTER_URL}`);
    console.log(`  vCenter User: ${VCENTER_USERNAME}`);

    // VM 목록 조회: /Datacenter/vm 경로 또는 find 명령 사용
    const command = `govc find / -type m`;
    const { stdout, stderr } = await execPromise(command, {
      env: {
        ...process.env,
        GOVC_URL: VCENTER_URL,
        GOVC_USERNAME: VCENTER_USERNAME,
        GOVC_PASSWORD: VCENTER_PASSWORD,
        GOVC_INSECURE: process.env.GOVC_INSECURE || '1'
      }
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
            GOVC_URL: VCENTER_URL,
            GOVC_USERNAME: VCENTER_USERNAME,
            GOVC_PASSWORD: VCENTER_PASSWORD,
            GOVC_INSECURE: process.env.GOVC_INSECURE || '1'
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
  } catch (error) {
    console.error('[Template Service] VM 목록 조회 실패:', error);
    console.error('[Template Service] 에러 상세:', error.message);
    console.error('[Template Service] Stack:', error.stack);
    throw error; // 에러를 다시 throw하여 API에서 에러 메시지를 반환할 수 있도록
  }
}

module.exports = {
  getTemplates,
  getTemplateById,
  convertVmToTemplate,
  saveTemplateMetadata,
  deleteTemplate,
  getVmList
};


