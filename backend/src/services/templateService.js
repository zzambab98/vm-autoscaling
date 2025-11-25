const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');

const TEMPLATES_DATA_PATH = path.join(__dirname, '../../data/templates.json');
const VCENTER_URL = process.env.GOVC_URL || process.env.VCENTER_URL;
const VCENTER_USERNAME = process.env.GOVC_USERNAME || process.env.VCENTER_USERNAME;
const VCENTER_PASSWORD = process.env.GOVC_PASSWORD || process.env.VCENTER_PASSWORD;

/**
 * 데이터 파일 초기화
 */
async function ensureDataFile() {
  try {
    await fs.access(TEMPLATES_DATA_PATH);
  } catch {
    // 파일이 없으면 생성
    await fs.writeFile(TEMPLATES_DATA_PATH, JSON.stringify([], null, 2));
  }
}

/**
 * 템플릿 목록 조회
 * @returns {Promise<Array>} 템플릿 목록
 */
async function getTemplates() {
  await ensureDataFile();
  try {
    const data = await fs.readFile(TEMPLATES_DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Template Service] 템플릿 목록 조회 실패:', error);
    return [];
  }
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

    // 1. VM이 존재하는지 확인
    const checkVmCommand = `govc vm.info -json "${vmName}"`;
    try {
      await execPromise(checkVmCommand, {
        env: {
          ...process.env,
          GOVC_URL: VCENTER_URL,
          GOVC_USERNAME: VCENTER_USERNAME,
          GOVC_PASSWORD: VCENTER_PASSWORD
        }
      });
    } catch (error) {
      throw new Error(`VM '${vmName}'을 찾을 수 없습니다.`);
    }

    // 2. VM을 템플릿으로 변환
    // 주의: govc vm.markastemplate은 VM을 직접 템플릿으로 변환합니다.
    // 템플릿 이름을 변경하려면 먼저 변환 후 이름을 변경해야 합니다.
    
    // 방법 1: VM을 템플릿으로 직접 변환 (이름 유지)
    // const command = `govc vm.markastemplate "${vmName}"`;
    
    // 방법 2: VM을 클론하여 템플릿으로 변환 (새 이름 사용)
    // 더 안전한 방법: VM을 클론한 후 템플릿으로 변환
    const cloneName = `${templateName}-temp-${Date.now()}`;
    
    console.log(`[Template Service] VM 클론 시작: ${vmName} -> ${cloneName}`);
    const cloneCommand = `govc vm.clone -vm="${vmName}" -name="${cloneName}"`;
    
    await execPromise(cloneCommand, {
      env: {
        ...process.env,
        GOVC_URL: VCENTER_URL,
        GOVC_USERNAME: VCENTER_USERNAME,
        GOVC_PASSWORD: VCENTER_PASSWORD
      },
      timeout: 600000 // 10분 타임아웃
    });

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
      const renameCommand = `govc object.rename "${cloneName}" "${templateName}"`;
      
      await execPromise(renameCommand, {
        env: {
          ...process.env,
          GOVC_URL: VCENTER_URL,
          GOVC_USERNAME: VCENTER_USERNAME,
          GOVC_PASSWORD: VCENTER_PASSWORD
        }
      });
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
    await fs.copyFile(TEMPLATES_DATA_PATH, backupPath);

    // 파일 저장
    await fs.writeFile(TEMPLATES_DATA_PATH, JSON.stringify(templates, null, 2));

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
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
      throw new Error(`템플릿 '${templateId}'을 찾을 수 없습니다.`);
    }

    // vCenter에서 템플릿 삭제
    if (VCENTER_URL && VCENTER_USERNAME && VCENTER_PASSWORD) {
      try {
        const deleteCommand = `govc object.destroy "${template.name}"`;
        await execPromise(deleteCommand, {
          env: {
            ...process.env,
            GOVC_URL: VCENTER_URL,
            GOVC_USERNAME: VCENTER_USERNAME,
            GOVC_PASSWORD: VCENTER_PASSWORD
          }
        });
        console.log(`[Template Service] vCenter에서 템플릿 삭제 완료: ${template.name}`);
      } catch (error) {
        console.warn(`[Template Service] vCenter 템플릿 삭제 실패 (메타데이터는 삭제됨):`, error.message);
      }
    }

    // 메타데이터에서 삭제
    const filtered = templates.filter(t => t.id !== templateId);
    
    // 백업 생성
    const backupPath = `${TEMPLATES_DATA_PATH}.backup.${Date.now()}`;
    await fs.copyFile(TEMPLATES_DATA_PATH, backupPath);

    // 파일 저장
    await fs.writeFile(TEMPLATES_DATA_PATH, JSON.stringify(filtered, null, 2));

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
      return [];
    }

    const command = `govc ls -json /vm`;
    const { stdout } = await execPromise(command, {
      env: {
        ...process.env,
        GOVC_URL: VCENTER_URL,
        GOVC_USERNAME: VCENTER_USERNAME,
        GOVC_PASSWORD: VCENTER_PASSWORD
      }
    });

    const vms = JSON.parse(stdout);
    return vms.map(vm => ({
      name: vm.Path.split('/').pop(),
      path: vm.Path
    }));
  } catch (error) {
    console.error('[Template Service] VM 목록 조회 실패:', error);
    return [];
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


