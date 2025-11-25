#!/usr/bin/env node

/**
 * Prometheus Job 삭제 스크립트
 * 사용법: node scripts/remove-prometheus-job.js <jobName>
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const yaml = require('js-yaml');

const PLG_STACK_SERVER = process.env.PLG_STACK_SERVER || '10.255.1.254';
const PLG_STACK_USER = process.env.PLG_STACK_USER || 'ubuntu';
const PLG_STACK_SSH_KEY = process.env.PLG_STACK_SSH_KEY || '/Users/jhlee/Desktop/Work/Dana-Cloud-Oper/DanaIX-신규 VM 생성/00. SSH-PemKey-List/danainfra';
const PROMETHEUS_CONFIG_PATH = '/mnt/plg-stack/prometheus/prometheus.yml';

async function removePrometheusJob(jobName) {
  try {
    const sshCommand = `ssh -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${PLG_STACK_USER}@${PLG_STACK_SERVER}`;

    // 1. 현재 설정 파일 읽기
    const readCommand = `${sshCommand} "cat ${PROMETHEUS_CONFIG_PATH}"`;
    const { stdout: currentConfig } = await execPromise(readCommand);

    // 2. YAML 파싱
    const prometheusConfig = yaml.load(currentConfig);

    // 3. Job 제거
    if (!prometheusConfig.scrape_configs) {
      console.log('제거할 Job이 없습니다.');
      return { success: true, message: 'Job이 존재하지 않습니다.' };
    }

    const beforeCount = prometheusConfig.scrape_configs.length;
    prometheusConfig.scrape_configs = prometheusConfig.scrape_configs.filter(
      job => job.job_name !== jobName
    );
    const afterCount = prometheusConfig.scrape_configs.length;

    if (beforeCount === afterCount) {
      console.log(`Job '${jobName}'을 찾을 수 없습니다.`);
      return { success: true, message: `Job '${jobName}'이 존재하지 않습니다.` };
    }

    // 4. YAML로 변환
    const newConfigYaml = yaml.dump(prometheusConfig, {
      lineWidth: -1,
      noRefs: true
    });

    // 5. 설정 파일 백업
    const backupCommand = `${sshCommand} "sudo cp ${PROMETHEUS_CONFIG_PATH} ${PROMETHEUS_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"`;
    await execPromise(backupCommand);

    // 6. 새 설정 파일 작성
    const tempFile = `/tmp/prometheus_${Date.now()}.yml`;
    await fs.writeFile(tempFile, newConfigYaml);

    // 7. 원격 서버로 파일 복사
    const scpCommand = `scp -i "${PLG_STACK_SSH_KEY}" -o StrictHostKeyChecking=no ${tempFile} ${PLG_STACK_USER}@${PLG_STACK_SERVER}:/tmp/prometheus_new.yml`;
    await execPromise(scpCommand);

    // 8. 원격 서버에서 파일 이동
    const moveCommand = `${sshCommand} "sudo mv /tmp/prometheus_new.yml ${PROMETHEUS_CONFIG_PATH}"`;
    await execPromise(moveCommand);

    // 9. 임시 파일 삭제
    await fs.unlink(tempFile).catch(() => {});

    // 10. Prometheus 컨테이너 재시작
    const restartCommand = `${sshCommand} "sudo docker restart prometheus"`;
    await execPromise(restartCommand);

    return {
      success: true,
      jobName: jobName,
      message: `Prometheus Job '${jobName}'이 삭제되었습니다.`
    };
  } catch (error) {
    console.error(`[Prometheus] Job 삭제 실패:`, error);
    throw new Error(`Prometheus Job 삭제 실패: ${error.message}`);
  }
}

// 명령줄 인자 파싱
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('사용법: node scripts/remove-prometheus-job.js <jobName>');
  console.error('예시: node scripts/remove-prometheus-job.js vm-service-01');
  process.exit(1);
}

const jobName = args[0];

console.log(`Prometheus Job 삭제 중...`);
console.log(`Job 이름: ${jobName}`);
console.log('');

removePrometheusJob(jobName)
  .then(result => {
    console.log('✅ 성공:', result.message);
    console.log('Prometheus 컨테이너가 재시작되었습니다.');
  })
  .catch(error => {
    console.error('❌ 실패:', error.message);
    process.exit(1);
  });

