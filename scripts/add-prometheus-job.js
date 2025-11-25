#!/usr/bin/env node

/**
 * Prometheus Job 추가 스크립트
 * 사용법: node scripts/add-prometheus-job.js <jobName> <ip1> <ip2> ...
 */

const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:4410';
const DEFAULT_PORT = '9100';

function addPrometheusJob(jobName, targets, labels = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jobName,
      targets,
      labels
    });

    const url = new URL(`${API_URL}/api/prometheus/jobs`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (res.statusCode === 200) {
            resolve(result);
          } else {
            reject(new Error(result.error || `HTTP ${res.statusCode}`));
          }
        } catch (error) {
          reject(new Error(`응답 파싱 실패: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`요청 실패: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

// 명령줄 인자 파싱
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('사용법: node scripts/add-prometheus-job.js <jobName> <ip1> [ip2] ...');
  console.error('예시: node scripts/add-prometheus-job.js vm-service-01 10.255.48.230 10.255.48.231');
  process.exit(1);
}

const jobName = args[0];
const ips = args.slice(1);

// IP 주소를 targets 형식으로 변환 (포트 9100 추가)
const targets = ips.map(ip => {
  // 이미 포트가 포함되어 있으면 그대로 사용
  if (ip.includes(':')) {
    return ip;
  }
  return `${ip}:${DEFAULT_PORT}`;
});

// 기본 labels
const labels = {
  instance: jobName,
  service: jobName,
  environment: 'production'
};

console.log(`Prometheus Job 추가 중...`);
console.log(`Job 이름: ${jobName}`);
console.log(`Targets: ${targets.join(', ')}`);
console.log(`Labels:`, labels);
console.log('');

addPrometheusJob(jobName, targets, labels)
  .then(result => {
    console.log('✅ 성공:', result.message);
    console.log(`Job 이름: ${result.jobName}`);
    console.log(`Targets: ${result.targets.join(', ')}`);
    console.log('');
    console.log('Prometheus 컨테이너가 재시작되었습니다.');
    console.log('몇 초 후 Grafana에서 확인할 수 있습니다.');
    console.log(`Grafana URL: http://10.255.1.254:3000`);
  })
  .catch(error => {
    console.error('❌ 실패:', error.message);
    process.exit(1);
  });

