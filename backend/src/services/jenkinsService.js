const axios = require('axios');

const JENKINS_URL = process.env.JENKINS_URL || 'http://10.255.0.103:8080';
const JENKINS_USER = process.env.JENKINS_WEB_USER || 'danacloud';
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN || '11c729d250790bec23d77c6144053e7b03';
const JENKINS_PASSWORD = process.env.JENKINS_WEB_PASSWORD || '!danacloud12'; // Web UI 로그인용
const JENKINS_SERVER = process.env.JENKINS_SERVER || '10.255.0.103';
const JENKINS_SSH_USER = process.env.JENKINS_SSH_USER || 'jenkins';
const JENKINS_SSH_PASSWORD = process.env.JENKINS_SSH_PASSWORD || '!danacloud12';
const GIT_REPO_URL = process.env.GIT_REPO_URL || 'https://github.com/zzambab98/vm-autoscaling.git';

// Jenkins API 인증 헤더 (API 토큰 사용)
function getAuthHeader() {
  // API 토큰이 있으면 사용자명:토큰 형식으로 사용, 없으면 사용자명:비밀번호 사용
  const credentials = JENKINS_API_TOKEN 
    ? `${JENKINS_USER}:${JENKINS_API_TOKEN}`
    : `${JENKINS_USER}:${JENKINS_PASSWORD}`;
  const auth = Buffer.from(credentials).toString('base64');
  return `Basic ${auth}`;
}

/**
 * Jenkins Job XML 생성
 * @param {object} config - 오토스케일링 설정
 * @returns {Promise<string>} Job XML
 */
async function generateJobXml(config) {
  const {
    serviceName,
    id: configId,
    monitoring: { prometheusJobName },
    scaling: { minVms, maxVms },
    f5: { poolName, vip, vipPort, healthCheckPath },
    network: { ipPoolStart, ipPoolEnd, subnet, gateway, vlan }
  } = config;

  // 템플릿 정보 가져오기
  let templateName = 'TEMPLATE_NAME';
  if (config.templateId) {
    try {
      const { getTemplateById } = require('./templateService');
      const template = await getTemplateById(config.templateId);
      if (template) {
        templateName = template.name;
      }
    } catch (error) {
      console.warn(`[Jenkins Service] 템플릿 조회 실패:`, error.message);
    }
  }

  const jobName = `autoscale-${serviceName.toLowerCase().replace(/\s+/g, '-')}-out`;
  const webhookToken = `autoscale-${serviceName.toLowerCase().replace(/\s+/g, '-')}-out-token`;

  // Jenkinsfile 경로 (Git 저장소 내)
  const jenkinsfilePath = 'jenkins/Jenkinsfile.autoscale';

  return `<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job@2.45">
  <description>자동 스케일아웃 파이프라인 - ${serviceName}</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
      <triggers>
        <org.jenkinsci.plugins.gwt.GenericTrigger plugin="generic-webhook-trigger@2.4.1">
          <spec></spec>
          <regexpFilterText></regexpFilterText>
          <regexpFilterExpression></regexpFilterExpression>
          <printPostContent>false</printPostContent>
          <printContributedVariables>false</printContributedVariables>
          <causeString>Generic Cause</causeString>
          <token>${webhookToken}</token>
          <tokenCredentialId></tokenCredentialId>
          <silentResponse>false</silentResponse>
          <overrideQuietPeriod>false</overrideQuietPeriod>
          <shouldNotFlatten>false</shouldNotFlatten>
          <variables>
            <org.jenkinsci.plugins.gwt.GenericTriggerVariables>
              <values>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>AUTOSCALE_CONFIG_ID</key>
                  <value>$.alerts[0].labels.autoscaleConfigId</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>SERVICE_NAME</key>
                  <value>$.alerts[0].labels.service</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>TEMPLATE_NAME</key>
                  <value>$.config.templateName</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>IP_POOL_START</key>
                  <value>$.config.network.ipPoolStart</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>IP_POOL_END</key>
                  <value>$.config.network.ipPoolEnd</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>SUBNET</key>
                  <value>$.config.network.subnet</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>GATEWAY</key>
                  <value>$.config.network.gateway</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>VLAN</key>
                  <value>$.config.network.vlan</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>F5_POOL_NAME</key>
                  <value>$.config.f5.poolName</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>VIP</key>
                  <value>$.config.f5.vip</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>VIP_PORT</key>
                  <value>$.config.f5.vipPort</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>HEALTH_CHECK_PATH</key>
                  <value>$.config.f5.healthCheckPath</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
              </values>
            </org.jenkinsci.plugins.gwt.GenericTriggerVariables>
          </variables>
          <requestParameterVariables></requestParameterVariables>
          <headerVariables></headerVariables>
        </org.jenkinsci.plugins.gwt.GenericTrigger>
      </triggers>
    </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps@2.92">
    <scm class="hudson.plugins.git.GitSCM" plugin="git@4.11.4">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${GIT_REPO_URL}</url>
          <credentialsId>github-credentials</credentialsId>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="list"/>
      <extensions/>
    </scm>
    <scriptPath>${jenkinsfilePath}</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>`;
}

/**
 * 스케일인 Jenkins Job XML 생성
 * @param {object} config - 오토스케일링 설정
 * @returns {Promise<string>} Job XML
 */
async function generateScaleInJobXml(config) {
  const {
    serviceName,
    id: configId,
    monitoring: { prometheusJobName },
    scaling: { minVms, scaleInStep },
    f5: { poolName, vip, vipPort }
  } = config;

  const jobName = `autoscale-${serviceName.toLowerCase().replace(/\s+/g, '-')}-in`;
  const webhookToken = `autoscale-${serviceName.toLowerCase().replace(/\s+/g, '-')}-in-token`;

  // Jenkinsfile 경로 (Git 저장소 내)
  const jenkinsfilePath = 'jenkins/Jenkinsfile.autoscale-in';

  return `<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job@2.45">
  <description>자동 스케일인 파이프라인 - ${serviceName}</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
      <triggers>
        <org.jenkinsci.plugins.gwt.GenericTrigger plugin="generic-webhook-trigger@2.4.1">
          <spec></spec>
          <regexpFilterText></regexpFilterText>
          <regexpFilterExpression></regexpFilterExpression>
          <printPostContent>false</printPostContent>
          <printContributedVariables>false</printContributedVariables>
          <causeString>Generic Cause</causeString>
          <token>${webhookToken}</token>
          <tokenCredentialId></tokenCredentialId>
          <silentResponse>false</silentResponse>
          <overrideQuietPeriod>false</overrideQuietPeriod>
          <shouldNotFlatten>false</shouldNotFlatten>
          <variables>
            <org.jenkinsci.plugins.gwt.GenericTriggerVariables>
              <values>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>AUTOSCALE_CONFIG_ID</key>
                  <value>$.alerts[0].labels.autoscaleConfigId</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>SERVICE_NAME</key>
                  <value>$.alerts[0].labels.service</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>PROMETHEUS_JOB_NAME</key>
                  <value>$.alerts[0].labels.job</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>F5_POOL_NAME</key>
                  <value>${poolName}</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>VIP</key>
                  <value>${vip}</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>VIP_PORT</key>
                  <value>${vipPort || '80'}</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>MIN_VMS</key>
                  <value>${minVms}</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                <org.jenkinsci.plugins.gwt.GenericTriggerVariable>
                  <key>SCALE_IN_STEP</key>
                  <value>${scaleInStep || 1}</value>
                  <regexpFilter></regexpFilter>
                </org.jenkinsci.plugins.gwt.GenericTriggerVariable>
              </values>
            </org.jenkinsci.plugins.gwt.GenericTriggerVariables>
          </variables>
        </org.jenkinsci.plugins.gwt.GenericTrigger>
      </triggers>
    </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps@2.92">
    <scm class="hudson.plugins.git.GitSCM" plugin="git@4.8.3">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${GIT_REPO_URL}</url>
          <credentialsId>github-credentials</credentialsId>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="list"/>
      <extensions/>
    </scm>
    <scriptPath>${jenkinsfilePath}</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>`;
}

/**
 * 스케일아웃 Jenkins Job 생성
 * @param {object} config - 오토스케일링 설정
 * @returns {Promise<object>} 생성 결과
 */
async function createScaleOutJenkinsJob(config) {
  const jobName = `autoscale-${config.serviceName.toLowerCase().replace(/\s+/g, '-')}-out`;
  const webhookToken = `autoscale-${config.serviceName.toLowerCase().replace(/\s+/g, '-')}-out-token`;

  try {
    // Job XML 생성
    const jobXml = await generateJobXml(config);

    // Jenkins API를 통해 Job 생성
    const createJobUrl = `${JENKINS_URL}/createItem?name=${encodeURIComponent(jobName)}`;

    const response = await axios.post(createJobUrl, jobXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': getAuthHeader()
      },
      validateStatus: (status) => status < 500 // 400번대는 에러로 처리
    });

    if (response.status === 200 || response.status === 201) {
      return {
        success: true,
        jobName: jobName,
        webhookToken: webhookToken,
        webhookUrl: `${JENKINS_URL}/generic-webhook-trigger/invoke?token=${webhookToken}`,
        message: `Jenkins Job '${jobName}'이 생성되었습니다.`
      };
    } else if (response.status === 400) {
      // Job이 이미 존재할 수 있음
      throw new Error(`Job '${jobName}'이 이미 존재하거나 생성에 실패했습니다.`);
    } else {
      throw new Error(`Jenkins Job 생성 실패: HTTP ${response.status}`);
    }
  } catch (error) {
    if (error.response) {
      console.error(`[Jenkins Service] Job 생성 실패 (${error.response.status}):`, error.response.data);
      throw new Error(`Jenkins Job 생성 실패: ${error.response.status} - ${error.response.statusText}`);
    } else {
      console.error(`[Jenkins Service] Job 생성 실패:`, error.message);
      throw new Error(`Jenkins Job 생성 실패: ${error.message}`);
    }
  }
}

/**
 * 스케일인 Jenkins Job 생성
 * @param {object} config - 오토스케일링 설정
 * @returns {Promise<object>} 생성 결과
 */
async function createScaleInJenkinsJob(config) {
  // 공통 파이프라인 사용
  const jobName = 'plg-autoscale-in';
  const webhookToken = 'plg-autoscale-in-token';

  try {
    // Job XML 생성
    const jobXml = await generateScaleInJobXml(config);

    // Jenkins API를 통해 Job 생성
    const createJobUrl = `${JENKINS_URL}/createItem?name=${encodeURIComponent(jobName)}`;

    const response = await axios.post(createJobUrl, jobXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': getAuthHeader()
      },
      validateStatus: (status) => status < 500 // 400번대는 에러로 처리
    });

    if (response.status === 200 || response.status === 201) {
      return {
        success: true,
        jobName: jobName,
        webhookToken: webhookToken,
        webhookUrl: `${JENKINS_URL}/generic-webhook-trigger/invoke?token=${webhookToken}`,
        message: `Jenkins Job '${jobName}'이 생성되었습니다.`
      };
    } else if (response.status === 400) {
      // Job이 이미 존재할 수 있음
      throw new Error(`Job '${jobName}'이 이미 존재하거나 생성에 실패했습니다.`);
    } else {
      throw new Error(`Jenkins Job 생성 실패: HTTP ${response.status}`);
    }
  } catch (error) {
    if (error.response) {
      console.error(`[Jenkins Service] Job 생성 실패 (${error.response.status}):`, error.response.data);
      throw new Error(`Jenkins Job 생성 실패: ${error.response.status} - ${error.response.statusText}`);
    } else {
      console.error(`[Jenkins Service] Job 생성 실패:`, error.message);
      throw new Error(`Jenkins Job 생성 실패: ${error.message}`);
    }
  }
}

/**
 * Jenkins Job 생성 (공통 파이프라인: plg-autoscale-in만 생성)
 * @param {object} config - 오토스케일링 설정
 * @returns {Promise<object>} 생성 결과
 */
async function createJenkinsJob(config) {
  try {
    // 스케일아웃은 기존 plg-autoscale-out 사용 (생성하지 않음)
    // 스케일인만 plg-autoscale-in 생성
    const scaleInResult = await createScaleInJenkinsJob(config);
    
    return {
      success: true,
      scaleOut: {
        jobName: 'plg-autoscale-out',
        message: '기존 공통 파이프라인 사용'
      },
      scaleIn: scaleInResult,
      message: `Jenkins Job이 생성되었습니다. (스케일아웃: plg-autoscale-out 사용, 스케일인: ${scaleInResult.jobName})`
    };
  } catch (error) {
    console.error(`[Jenkins Service] Job 생성 실패:`, error);
    throw error;
  }
}

/**
 * Jenkins Job 삭제 (스케일아웃 + 스케일인)
 * @param {string} serviceName - 서비스 이름
 * @returns {Promise<object>} 삭제 결과
 */
async function deleteJenkinsJob(serviceName) {
  const scaleOutJobName = `autoscale-${serviceName.toLowerCase().replace(/\s+/g, '-')}-out`;
  const scaleInJobName = `autoscale-${serviceName.toLowerCase().replace(/\s+/g, '-')}-in`;
  
  const results = {
    scaleOut: null,
    scaleIn: null
  };
  
  // 스케일아웃 Job 삭제
  try {
    results.scaleOut = await deleteSingleJenkinsJob(scaleOutJobName);
  } catch (error) {
    console.warn(`[Jenkins Service] 스케일아웃 Job 삭제 실패:`, error.message);
    results.scaleOut = { success: false, error: error.message };
  }
  
  // 스케일인 Job 삭제
  try {
    results.scaleIn = await deleteSingleJenkinsJob(scaleInJobName);
  } catch (error) {
    console.warn(`[Jenkins Service] 스케일인 Job 삭제 실패:`, error.message);
    results.scaleIn = { success: false, error: error.message };
  }
  
  return {
    success: (results.scaleOut?.success || results.scaleOut?.message?.includes('존재하지 않습니다')) &&
             (results.scaleIn?.success || results.scaleIn?.message?.includes('존재하지 않습니다')),
    scaleOut: results.scaleOut,
    scaleIn: results.scaleIn,
    message: `Jenkins Job 삭제 완료. (스케일아웃: ${scaleOutJobName}, 스케일인: ${scaleInJobName})`
  };
}

/**
 * 단일 Jenkins Job 삭제
 * @param {string} jobName - Job 이름
 * @returns {Promise<object>} 삭제 결과
 */
async function deleteSingleJenkinsJob(jobName) {
  try {
    const deleteJobUrl = `${JENKINS_URL}/job/${encodeURIComponent(jobName)}/doDelete`;

    const response = await axios.post(deleteJobUrl, '', {
      headers: {
        'Authorization': getAuthHeader()
      },
      validateStatus: (status) => status < 500
    });

    if (response.status === 200 || response.status === 302) {
      return {
        success: true,
        jobName: jobName,
        message: `Jenkins Job '${jobName}'이 삭제되었습니다.`
      };
    } else if (response.status === 404) {
      return {
        success: true,
        jobName: jobName,
        message: `Job '${jobName}'이 존재하지 않습니다.`
      };
    } else {
      throw new Error(`Jenkins Job 삭제 실패: HTTP ${response.status}`);
    }
  } catch (error) {
    if (error.response) {
      console.error(`[Jenkins Service] Job 삭제 실패 (${error.response.status}):`, error.response.data);
      throw new Error(`Jenkins Job 삭제 실패: ${error.response.status}`);
    } else {
      console.error(`[Jenkins Service] Job 삭제 실패:`, error.message);
      throw new Error(`Jenkins Job 삭제 실패: ${error.message}`);
    }
  }
}

/**
 * Jenkins Job 상태 조회
 * @param {string} jobName - Job 이름
 * @returns {Promise<object>} Job 상태
 */
async function getJenkinsJobStatus(jobName) {
  try {
    const jobUrl = `${JENKINS_URL}/job/${encodeURIComponent(jobName)}/api/json`;

    const response = await axios.get(jobUrl, {
      headers: {
        'Authorization': getAuthHeader()
      }
    });

    return {
      success: true,
      jobName: jobName,
      exists: true,
      color: response.data.color, // blue, red, yellow 등
      lastBuild: response.data.lastBuild ? {
        number: response.data.lastBuild.number,
        url: response.data.lastBuild.url
      } : null,
      lastSuccessfulBuild: response.data.lastSuccessfulBuild ? {
        number: response.data.lastSuccessfulBuild.number,
        url: response.data.lastSuccessfulBuild.url
      } : null,
      lastFailedBuild: response.data.lastFailedBuild ? {
        number: response.data.lastFailedBuild.number,
        url: response.data.lastFailedBuild.url
      } : null
    };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return {
        success: true,
        jobName: jobName,
        exists: false
      };
    }
    console.error(`[Jenkins Service] Job 상태 조회 실패:`, error.message);
    throw new Error(`Jenkins Job 상태 조회 실패: ${error.message}`);
  }
}

/**
 * Jenkins Job 목록 조회
 * @returns {Promise<Array>} Job 목록
 */
async function getJenkinsJobs() {
  try {
    const jobsUrl = `${JENKINS_URL}/api/json?tree=jobs[name,color,url]`;

    const response = await axios.get(jobsUrl, {
      headers: {
        'Authorization': getAuthHeader()
      }
    });

    return {
      success: true,
      jobs: response.data.jobs.map(job => ({
        name: job.name,
        color: job.color,
        url: job.url
      }))
    };
  } catch (error) {
    console.error(`[Jenkins Service] Job 목록 조회 실패:`, error.message);
    throw new Error(`Jenkins Job 목록 조회 실패: ${error.message}`);
  }
}

/**
 * Jenkins Job 빌드 실행
 * @param {string} jobName - Job 이름
 * @param {object} parameters - 빌드 파라미터
 * @returns {Promise<object>} 빌드 결과
 */
async function triggerJenkinsJob(jobName, parameters = {}) {
  try {
    let buildUrl;
    if (Object.keys(parameters).length > 0) {
      // 파라미터가 있는 경우
      const params = new URLSearchParams(parameters);
      buildUrl = `${JENKINS_URL}/job/${encodeURIComponent(jobName)}/buildWithParameters?${params.toString()}`;
    } else {
      // 파라미터가 없는 경우
      buildUrl = `${JENKINS_URL}/job/${encodeURIComponent(jobName)}/build`;
    }

    const response = await axios.post(buildUrl, '', {
      headers: {
        'Authorization': getAuthHeader()
      },
      validateStatus: (status) => status < 500
    });

    if (response.status === 201 || response.status === 200) {
      // Location 헤더에서 빌드 번호 추출
      const location = response.headers.location;
      const buildNumber = location ? location.match(/\/build\/(\d+)/)?.[1] : null;

      return {
        success: true,
        jobName: jobName,
        buildNumber: buildNumber,
        buildUrl: location ? `${JENKINS_URL}${location}` : null,
        message: `Jenkins Job '${jobName}' 빌드가 시작되었습니다.`
      };
    } else {
      throw new Error(`Jenkins Job 빌드 시작 실패: HTTP ${response.status}`);
    }
  } catch (error) {
    if (error.response) {
      console.error(`[Jenkins Service] Job 빌드 시작 실패 (${error.response.status}):`, error.response.data);
      throw new Error(`Jenkins Job 빌드 시작 실패: ${error.response.status}`);
    } else {
      console.error(`[Jenkins Service] Job 빌드 시작 실패:`, error.message);
      throw new Error(`Jenkins Job 빌드 시작 실패: ${error.message}`);
    }
  }
}

module.exports = {
  createJenkinsJob,
  deleteJenkinsJob,
  getJenkinsJobStatus,
  getJenkinsJobs,
  triggerJenkinsJob
};

