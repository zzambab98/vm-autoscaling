const { createAlertRule } = require('./src/services/prometheusAlertService');
const { addRoutingRule } = require('./src/services/alertmanagerService');
const { createJenkinsJob } = require('./src/services/jenkinsService');
const fs = require('fs');

const configs = JSON.parse(fs.readFileSync('data/autoscaling-configs.json', 'utf8'));
const config = configs[0];

console.log('=== Jenkins Job 생성 시작 ===');
console.log('서비스 이름:', config.serviceName);
console.log('설정 ID:', config.id);
console.log('활성화 상태:', config.enabled);

(async () => {
  try {
    console.log('\n1. Alert Rule 생성 중...');
    const alertResult = await createAlertRule(config);
    console.log('Alert Rule 생성 완료:', alertResult.message);
    
    console.log('\n2. Alertmanager 라우팅 규칙 추가 중...');
    const routingResult = await addRoutingRule(config);
    console.log('라우팅 규칙 추가 완료:', routingResult.message);
    
    console.log('\n3. Jenkins Job 생성 중...');
    const jenkinsResult = await createJenkinsJob(config);
    console.log('Jenkins Job 생성 완료:', jenkinsResult.message);
    console.log('스케일아웃 Job:', jenkinsResult.scaleOut.jobName);
    console.log('스케일인 Job:', jenkinsResult.scaleIn.jobName);
    
    console.log('\n=== 모든 작업 완료 ===');
  } catch (error) {
    console.error('에러 발생:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();


