/**
 * 스케일인 웹훅 발생 여부 점검 스크립트
 */

const axios = require('axios');
const ALERTMANAGER_URL = process.env.ALERTMANAGER_URL || 'http://10.255.1.254:9093';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:6010';

async function checkScaleInWebhookStatus() {
  console.log('=== 스케일인 웹훅 상태 점검 ===\n');

  try {
    // 1. Alertmanager 활성 Silence 확인
    console.log('1. Alertmanager 활성 Silence 확인...');
    const silencesResponse = await axios.get(
      `${ALERTMANAGER_URL}/api/v2/silences`,
      { params: { active: true }, timeout: 10000 }
    );
    
    const activeSilences = silencesResponse.data || [];
    console.log(`   활성 Silence 개수: ${activeSilences.length}`);
    
    if (activeSilences.length > 0) {
      console.log('\n   활성 Silence 목록:');
      activeSilences.forEach(silence => {
        const matchers = silence.matchers || [];
        const serviceMatch = matchers.find(m => m.name === 'service');
        const alertnameMatch = matchers.find(m => m.name === 'alertname');
        
        if (alertnameMatch && alertnameMatch.value.includes('LowResourceUsage')) {
          console.log(`   - Service: ${serviceMatch?.value || 'N/A'}`);
          console.log(`     Alert: ${alertnameMatch.value}`);
          console.log(`     Silence ID: ${silence.id}`);
          console.log(`     상태: ${silence.status?.state || 'N/A'}`);
          console.log(`     시작: ${silence.startsAt || 'N/A'}`);
          console.log(`     종료: ${silence.endsAt || 'N/A'}`);
          console.log(`     생성자: ${silence.createdBy || 'N/A'}`);
          console.log(`     코멘트: ${silence.comment || 'N/A'}`);
          console.log('');
        }
      });
    } else {
      console.log('   활성 Silence 없음 (스케일인 웹훅이 발생할 수 있음)\n');
    }

    // 2. 백엔드 스케일인 스위치 상태 확인 (API가 있다면)
    console.log('2. 백엔드 스케일인 스위치 상태 확인...');
    try {
      // 스케일인 스위치 상태 조회 API가 있다면 호출
      // 없으면 직접 확인 불가능
      console.log('   (백엔드 API를 통한 스위치 상태 조회는 현재 구현되지 않음)');
    } catch (error) {
      console.log(`   스위치 상태 확인 실패: ${error.message}`);
    }

    // 3. 최근 Alertmanager 알림 확인
    console.log('3. 최근 Alertmanager 알림 확인...');
    try {
      const alertsResponse = await axios.get(
        `${ALERTMANAGER_URL}/api/v2/alerts`,
        { params: { active: true }, timeout: 10000 }
      );
      
      const activeAlerts = alertsResponse.data || [];
      const scaleInAlerts = activeAlerts.filter(alert => {
        const alertname = alert.labels?.alertname || '';
        return alertname.includes('LowResourceUsage');
      });
      
      console.log(`   활성 스케일인 알림 개수: ${scaleInAlerts.length}`);
      
      if (scaleInAlerts.length > 0) {
        console.log('\n   활성 스케일인 알림 목록:');
        scaleInAlerts.forEach(alert => {
          console.log(`   - Service: ${alert.labels?.service || 'N/A'}`);
          console.log(`     Alert: ${alert.labels?.alertname || 'N/A'}`);
          console.log(`     상태: ${alert.status?.state || 'N/A'}`);
          console.log(`     시작: ${alert.startsAt || 'N/A'}`);
          console.log(`     Silence 여부: ${alert.status?.silenced ? 'Yes' : 'No'}`);
          console.log('');
        });
      } else {
        console.log('   활성 스케일인 알림 없음\n');
      }
    } catch (error) {
      console.log(`   알림 확인 실패: ${error.message}`);
    }

    // 4. 점검 결과 요약
    console.log('\n=== 점검 결과 요약 ===');
    const scaleInSilences = activeSilences.filter(silence => {
      const matchers = silence.matchers || [];
      const alertnameMatch = matchers.find(m => m.name === 'alertname');
      return alertnameMatch && alertnameMatch.value.includes('LowResourceUsage');
    });
    
    if (scaleInSilences.length > 0) {
      console.log('✓ 스케일인 Silence가 활성화되어 있어 웹훅이 차단되고 있습니다.');
      console.log(`  활성 Silence 개수: ${scaleInSilences.length}`);
    } else {
      console.log('⚠ 스케일인 Silence가 없어 웹훅이 발생할 수 있습니다.');
      console.log('  최소 VM 개수에 도달한 서비스가 있다면 Silence가 생성되어야 합니다.');
    }

  } catch (error) {
    console.error('점검 중 오류 발생:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    }
  }
}

// 실행
checkScaleInWebhookStatus().catch(console.error);

