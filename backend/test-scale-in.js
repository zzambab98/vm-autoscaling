const { createAlertRule } = require('./src/services/prometheusAlertService');
const { addRoutingRule } = require('./src/services/alertmanagerService');
const fs = require('fs');

const configs = JSON.parse(fs.readFileSync('data/autoscaling-configs.json', 'utf8'));
const config = configs[0];

console.log('=== 스케일인 기능 테스트 준비 ===');
console.log('서비스 이름:', config.serviceName);
console.log('설정 ID:', config.id);
console.log('활성화 상태:', config.enabled);
console.log('\n스케일인 조건:');
console.log('  - CPU 임계값:', config.monitoring.scaleInCpuThreshold, '%');
console.log('  - Memory 임계값:', config.monitoring.scaleInMemoryThreshold, '%');
console.log('  - 지속 시간:', config.monitoring.scaleInDuration, '분');
console.log('  - 최소 VM 수:', config.scaling.minVms);

(async () => {
  try {
    console.log('\n=== 1. Alert Rule 확인/생성 ===');
    const alertResult = await createAlertRule(config);
    console.log('✅ Alert Rule:', alertResult.message);
    
    console.log('\n=== 2. Alertmanager 라우팅 규칙 확인/생성 ===');
    const routingResult = await addRoutingRule(config);
    console.log('✅ 라우팅 규칙:', routingResult.message);
    console.log('  - 스케일아웃 Webhook:', routingResult.scaleOut.webhookUrl);
    console.log('  - 스케일인 Webhook:', routingResult.scaleIn.webhookUrl);
    
    console.log('\n=== 3. 테스트 방법 ===');
    console.log('스케일인 테스트를 위해 다음 중 하나를 선택하세요:');
    console.log('\n[A] 실제 리소스 사용률 낮추기 (권장)');
    console.log('  - 현재 VM들의 CPU/Memory 사용률을 30% 이하로 낮춤');
    console.log('  - 10분 이상 유지하면 스케일인 Alert 발생');
    console.log('  - Alertmanager가 plg-autoscale-in 파이프라인 실행');
    
    console.log('\n[B] 수동으로 Alert 전송 (테스트용)');
    console.log('  - curl로 Alertmanager에 직접 Alert 전송');
    console.log('  - 스케일인 Alert 발생 시뮬레이션');
    
    console.log('\n[C] Jenkins 파이프라인 직접 실행 (수동 테스트)');
    console.log('  - Jenkins UI에서 plg-autoscale-in 파이프라인 수동 실행');
    console.log('  - 파라미터 직접 입력하여 테스트');
    
    console.log('\n=== 준비 완료 ===');
    console.log('어떤 방법으로 테스트하시겠습니까?');
    
  } catch (error) {
    console.error('에러 발생:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

