#!/usr/bin/env node

/**
 * Grafana 대시보드 삭제 스크립트
 * 사용법: node scripts/delete-grafana-dashboards.js [tag]
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const GRAFANA_URL = process.env.GRAFANA_URL || 'http://10.255.1.254:3000';
const GRAFANA_USER = process.env.GRAFANA_USER || 'admin';
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD || 'admin123';

// HTTP/HTTPS 요청 함수
function makeRequest(url, method, data, auth) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    };

    const req = client.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(result)}`));
          }
        } catch (error) {
          reject(new Error(`응답 파싱 실패: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`요청 실패: ${error.message}`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// 대시보드 목록 조회
async function getDashboards(auth) {
  try {
    const response = await makeRequest(
      `${GRAFANA_URL}/api/search?type=dash-db`,
      'GET',
      null,
      auth
    );
    return response;
  } catch (error) {
    throw new Error(`대시보드 목록 조회 실패: ${error.message}`);
  }
}

// 대시보드 삭제
async function deleteDashboard(uid, auth) {
  try {
    await makeRequest(
      `${GRAFANA_URL}/api/dashboards/uid/${uid}`,
      'DELETE',
      null,
      auth
    );
    return true;
  } catch (error) {
    throw new Error(`대시보드 삭제 실패: ${error.message}`);
  }
}

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const tag = args[0]; // 선택적 태그 필터

// Basic Auth 생성
const auth = Buffer.from(`${GRAFANA_USER}:${GRAFANA_PASSWORD}`).toString('base64');

console.log('Grafana 대시보드 목록 조회 중...');
console.log(`Grafana URL: ${GRAFANA_URL}`);
if (tag) {
  console.log(`태그 필터: ${tag}`);
}
console.log('');

getDashboards(auth)
  .then(dashboards => {
    // 태그 필터 적용
    let filteredDashboards = dashboards;
    if (tag) {
      filteredDashboards = dashboards.filter(d => d.tags && d.tags.includes(tag));
    }

    if (filteredDashboards.length === 0) {
      console.log('삭제할 대시보드가 없습니다.');
      return;
    }

    console.log(`삭제할 대시보드 ${filteredDashboards.length}개 발견:`);
    filteredDashboards.forEach(d => {
      console.log(`  - ${d.title} (UID: ${d.uid})`);
    });
    console.log('');

    // 각 대시보드 삭제
    const deletePromises = filteredDashboards.map(dashboard => 
      deleteDashboard(dashboard.uid, auth)
        .then(() => {
          console.log(`✅ 삭제 완료: ${dashboard.title}`);
          return dashboard;
        })
        .catch(error => {
          console.error(`❌ 삭제 실패: ${dashboard.title} - ${error.message}`);
          return null;
        })
    );

    return Promise.all(deletePromises);
  })
  .then(results => {
    const successCount = results.filter(r => r !== null).length;
    console.log('');
    console.log(`총 ${successCount}개의 대시보드가 삭제되었습니다.`);
  })
  .catch(error => {
    console.error('❌ 실패:', error.message);
    process.exit(1);
  });

