const jenkinsService = require('./src/services/jenkinsService');
const fs = require('fs');

const configs = JSON.parse(fs.readFileSync('data/autoscaling-configs.json', 'utf8'));
const config = configs[0];

console.log('=== plg-autoscale-in 공통 파이프라인 생성 ===');

(async () => {
  try {
    console.log('\nplg-autoscale-in 파이프라인 생성 중...');
    // createScaleInJenkinsJob은 내부 함수이므로 직접 호출
    // 대신 createJenkinsJob을 사용하되, 공통 파이프라인만 생성
    const result = await jenkinsService.createJenkinsJob(config);
    console.log('생성 완료:', result.message);
    console.log('스케일아웃 Job:', result.scaleOut.jobName);
    console.log('스케일인 Job:', result.scaleIn.jobName);
    console.log('스케일인 Webhook Token:', result.scaleIn.webhookToken);
    console.log('스케일인 Webhook URL:', result.scaleIn.webhookUrl);
    
    console.log('\n=== 작업 완료 ===');
  } catch (error) {
    if (error.message && error.message.includes('이미 존재')) {
      console.log('plg-autoscale-in 파이프라인이 이미 존재합니다.');
    } else {
      console.error('에러 발생:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
})();

