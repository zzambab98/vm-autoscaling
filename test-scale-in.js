/**
 * 스케일인 테스트 스크립트
 * Alertmanager 형식의 웹훅을 백엔드로 전송하여 스케일인을 트리거합니다.
 */

const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:6010';
const SERVICE_NAME = 'auto-vm-test-AutoScaling';

// Alertmanager 형식의 스케일인 Alert 페이로드
const scaleInAlertPayload = {
  receiver: `jenkins-webhook-${SERVICE_NAME}-in`,
  status: 'firing',
  alerts: [
    {
      status: 'firing',
      labels: {
        alertname: `${SERVICE_NAME}_LowResourceUsage`,
        autoscaleConfigId: 'config-1765353828931',
        cluster: 'plg-stack-prod',
        environment: 'production',
        instance: 'all',
        service: SERVICE_NAME,
        severity: 'info',
        scaleAction: 'scale-in'
      },
      annotations: {
        description: '모든 서버의 CPU와 Memory 사용률이 임계값(30% CPU, 30% Memory) 이하여서 10분 이상 지속되었습니다. 자동 스케일인이 필요합니다.',
        instances: 'auto-vm-test/all',
        summary: `${SERVICE_NAME} 자동 스케일인 필요 (리소스 사용률 낮음)`
      },
      startsAt: new Date().toISOString(),
      endsAt: '0001-01-01T00:00:00Z',
      generatorURL: 'http://test:9090/graph',
      fingerprint: 'test-scale-in-fingerprint'
    }
  ],
  groupLabels: {
    alertname: `${SERVICE_NAME}_LowResourceUsage`,
    cluster: 'plg-stack-prod',
    service: SERVICE_NAME
  },
  commonLabels: {
    alertname: `${SERVICE_NAME}_LowResourceUsage`,
    autoscaleConfigId: 'config-1765353828931',
    cluster: 'plg-stack-prod',
    environment: 'production',
    instance: 'all',
    service: SERVICE_NAME,
    severity: 'info',
    scaleAction: 'scale-in'
  },
  commonAnnotations: {
    description: '모든 서버의 CPU와 Memory 사용률이 임계값(30% CPU, 30% Memory) 이하여서 10분 이상 지속되었습니다. 자동 스케일인이 필요합니다.',
    instances: 'auto-vm-test/all',
    summary: `${SERVICE_NAME} 자동 스케일인 필요 (리소스 사용률 낮음)`
  },
  externalURL: 'http://test:9093',
  version: '4',
  groupKey: `{}/{alertname="${SERVICE_NAME}_LowResourceUsage",service="${SERVICE_NAME}"}:{alertname="${SERVICE_NAME}_LowResourceUsage", cluster="plg-stack-prod", service="${SERVICE_NAME}"}`,
  truncatedAlerts: 0
};

async function triggerScaleIn() {
  try {
    console.log(`[스케일인 테스트] 서비스: ${SERVICE_NAME}`);
    console.log(`[스케일인 테스트] 백엔드 URL: ${BACKEND_URL}/api/webhook/autoscale/${SERVICE_NAME}`);
    console.log(`[스케일인 테스트] 웹훅 전송 중...`);
    
    const response = await axios.post(
      `${BACKEND_URL}/api/webhook/autoscale/${SERVICE_NAME}`,
      scaleInAlertPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log(`[스케일인 테스트] ✅ 성공:`);
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error(`[스케일인 테스트] ❌ 실패:`);
    if (error.response) {
      console.error(`HTTP ${error.response.status}:`, error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

triggerScaleIn();



