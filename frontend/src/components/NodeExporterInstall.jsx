import { useState, useEffect } from 'react';
import { nodeExporterApi, promtailApi, jmxExporterApi, sshConfigApi } from '../services/api';
import { templateApi } from '../services/templateApi';

function NodeExporterInstall() {
  const [sshKeyOptions, setSshKeyOptions] = useState([
    { label: '직접 입력', value: 'custom' }
  ]);
  const [servers, setServers] = useState([]);
  const [sshUser, setSshUser] = useState('');
  const [selectedSshKey, setSelectedSshKey] = useState('');
  const [customSshKey, setCustomSshKey] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingVms, setLoadingVms] = useState(false);
  const [loadingSshConfig, setLoadingSshConfig] = useState(true);
  
  // 설치 옵션
  const [installNodeExporter, setInstallNodeExporter] = useState(true);
  const [installPromtail, setInstallPromtail] = useState(true);
  const [installJmxExporter, setInstallJmxExporter] = useState(false);

  // SSH 설정 로드
  useEffect(() => {
    loadSshConfig();
  }, []);

  // 컴포넌트 마운트 시 vCenter에서 모든 VM 조회
  useEffect(() => {
    loadVmList();
  }, []);

  const loadSshConfig = async () => {
    setLoadingSshConfig(true);
    try {
      const result = await sshConfigApi.getConfig();
      if (result && result.success) {
        // SSH 키 옵션 설정
        const keys = result.sshKeys || [];
        const options = [
          ...keys.map(key => ({
            label: key.label,
            value: key.value
          })),
          { label: '직접 입력', value: 'custom' }
        ];
        setSshKeyOptions(options);
        
        // 기본 SSH 사용자 설정
        if (result.defaultSshUser) {
          setSshUser(result.defaultSshUser);
        }
        
        // 기본 SSH 키 설정
        if (result.defaultSshKey) {
          setSelectedSshKey(result.defaultSshKey);
        } else if (options.length > 1) {
          // 기본 키가 없으면 첫 번째 키 선택 (직접 입력 제외)
          setSelectedSshKey(options[0].value);
        }
      }
    } catch (error) {
      console.error('[NodeExporterInstall] SSH 설정 로드 실패:', error);
      setMessage({ type: 'error', text: `SSH 설정 로드 실패: ${error.message}` });
    } finally {
      setLoadingSshConfig(false);
    }
  };

  // VM 목록 로드 후 상태 확인 (초기 로드 시)
  useEffect(() => {
    if (servers.length > 0 && servers.some(s => s.ip && s.status === 'unknown')) {
      // IP가 있고 상태가 unknown인 서버들만 자동 확인 (부하 방지)
      // 자동 확인은 하지 않고, 사용자가 수동으로 확인하도록 변경
      // 필요시 아래 주석을 해제하여 자동 확인 가능
      // checkAllStatus();
    }
  }, [servers.length]);

  const loadVmList = async () => {
    setLoadingVms(true);
    setMessage(null);
    try {
      console.log('[NodeExporterInstall] VM 목록 조회 시작...');
      const result = await templateApi.getVmList();
      console.log('[NodeExporterInstall] API 응답:', result);
      
      if (result && result.success && result.vms) {
        // VM 목록을 서버 목록으로 변환 (IP 정보 포함)
        const vmServers = result.vms
          .filter(vm => !vm.name.startsWith('vCLS-')) // vCLS-로 시작하는 VM 제외
          .map(vm => {
            const ips = vm.ips || [];
            return {
              ip: ips.length > 0 ? ips[0] : '', // 첫 번째 IP를 기본값으로
              ips: ips, // 모든 IP 목록
              name: vm.name,
              status: 'unknown',
              installing: false,
              uninstalling: false,
              nodeExporterInstalled: false,
              promtailInstalled: false,
              jmxExporterInstalled: false
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })); // 이름 기준 정렬
        console.log('[NodeExporterInstall] 변환된 서버 목록:', vmServers.length, '개');
        setServers(vmServers);
        if (vmServers.length === 0) {
          setMessage({ type: 'info', text: 'VM 목록이 비어있습니다.' });
        } else {
          setMessage({ type: 'success', text: `${vmServers.length}개의 VM을 불러왔습니다. 상태 확인 버튼을 클릭하여 설치 상태를 확인하세요.` });
        }
      } else {
        console.warn('[NodeExporterInstall] 응답 형식 오류:', result);
        const errorMsg = result?.error || 'VM 목록을 불러올 수 없습니다.';
        setMessage({ type: 'error', text: errorMsg });
        setServers([]);
      }
    } catch (error) {
      console.error('[NodeExporterInstall] VM 목록 조회 실패:', error);
      const errorMsg = error.response?.data?.error || error.message || 'VM 목록 조회 실패';
      setMessage({ type: 'error', text: errorMsg });
      setServers([]);
    } finally {
      setLoadingVms(false);
    }
  };

  const getEffectiveSshKey = () =>
    selectedSshKey === 'custom' ? customSshKey.trim() : selectedSshKey;

  const checkStatus = async (serverIp, showMessage = false) => {
    try {
      const sshOptions = {
        sshUser,
        sshKey: getEffectiveSshKey()
      };
      
      // Node Exporter와 Promtail 상태 확인
      const nodeExporterResult = await nodeExporterApi.checkStatus(serverIp, sshOptions);
      const nodeExporterStatus = nodeExporterResult.nodeExporter?.installed ? 'installed' : 'not_installed';
      const promtailStatus = nodeExporterResult.promtail?.installed ? 'installed' : 'not_installed';
      
      // JMX Exporter 상태 확인
      let jmxExporterStatus = 'not_installed';
      try {
        const jmxExporterResult = await jmxExporterApi.checkStatus(serverIp, sshOptions);
        jmxExporterStatus = jmxExporterResult.installed ? 'installed' : 'not_installed';
      } catch (jmxError) {
        console.warn(`JMX Exporter 상태 확인 실패 (${serverIp}):`, jmxError);
        jmxExporterStatus = 'not_installed';
      }
      
      // 상태 문자열 생성
      let statusText = '';
      const installedCount = [nodeExporterStatus, promtailStatus, jmxExporterStatus].filter(s => s === 'installed').length;
      if (installedCount === 3) {
        statusText = 'all_installed';
      } else if (installedCount === 2) {
        statusText = 'partial_installed';
      } else if (installedCount === 1) {
        statusText = 'single_installed';
      } else {
        statusText = 'not_installed';
      }
      
      setServers(prev => prev.map(s => 
        s.ip === serverIp 
          ? { 
              ...s, 
              status: statusText,
              nodeExporterInstalled: nodeExporterResult.nodeExporter?.installed || false,
              promtailInstalled: nodeExporterResult.promtail?.installed || false,
              jmxExporterInstalled: jmxExporterStatus === 'installed'
            }
          : s
      ));
      
      // 개별 확인 시에만 메시지 표시
      if (showMessage) {
        const serverName = servers.find(s => s.ip === serverIp)?.name || serverIp;
        setMessage({ 
          type: 'success', 
          text: `${serverName} (${serverIp}) 상태 확인 완료` 
        });
      }
    } catch (error) {
      console.error('Status check failed:', error);
      if (showMessage) {
        setMessage({ type: 'error', text: `${serverIp} 상태 확인 실패: ${error.message}` });
      }
    }
  };

  const installOnServer = async (serverIp) => {
    setServers(prev => prev.map(s => 
      s.ip === serverIp ? { ...s, installing: true } : s
    ));
    setMessage(null);

    try {
      if (!installNodeExporter && !installPromtail && !installJmxExporter) {
        setMessage({ type: 'error', text: '최소 하나 이상의 도구를 선택해야 합니다.' });
        setServers(prev => prev.map(s => 
          s.ip === serverIp ? { ...s, installing: false } : s
        ));
        return;
      }

      // VM 이름 찾기
      const server = servers.find(s => s.ip === serverIp);
      const vmName = server?.name || serverIp;

      const sshOptions = {
        sshUser,
        sshKey: getEffectiveSshKey()
      };

      const results = {
        nodeExporter: null,
        promtail: null,
        jmxExporter: null
      };

      // Node Exporter 설치 (선택된 경우)
      if (installNodeExporter) {
        try {
          const nodeExporterOptions = {
            ...sshOptions,
            autoRegisterPrometheus: false, // 설치만 수행, 등록은 PLG Stack 모니터링 메뉴에서
            installPromtail: false // Promtail은 별도로 설치하므로 false
          };
          
          const nodeExporterResult = await nodeExporterApi.install(serverIp, nodeExporterOptions);
          results.nodeExporter = nodeExporterResult;

          if (!nodeExporterResult.success) {
            const errorMsg = nodeExporterResult.error || nodeExporterResult.details || '알 수 없는 오류';
            let displayMsg = errorMsg;
            
            if (errorMsg.includes('Permission denied')) {
              displayMsg = 'SSH 인증 실패 - 올바른 SSH 키를 선택했는지 확인하세요';
            } else if (errorMsg.includes('Text file busy')) {
              displayMsg = '파일이 사용 중입니다 - 재설치를 시도합니다';
            }
            
            setMessage({ type: 'error', text: `${serverIp}: Node Exporter 설치 실패 - ${displayMsg}` });
            // Node Exporter 설치 실패 시 Promtail 설치도 중단
            setServers(prev => prev.map(s => 
              s.ip === serverIp ? { ...s, installing: false } : s
            ));
            return;
          }
        } catch (error) {
          setMessage({ type: 'error', text: `${serverIp}: Node Exporter 설치 실패 - ${error.message}` });
          setServers(prev => prev.map(s => 
            s.ip === serverIp ? { ...s, installing: false } : s
          ));
          return;
        }
      }

      // Promtail 설치 (선택된 경우)
      if (installPromtail) {
        try {
          console.log(`[NodeExporterInstall] Promtail 설치 시작: ${serverIp}`);
          const promtailResult = await promtailApi.install(serverIp, sshOptions);
          results.promtail = promtailResult;
          console.log(`[NodeExporterInstall] Promtail 설치 결과:`, promtailResult);

          if (!promtailResult.success) {
            const errorMsg = promtailResult.error || promtailResult.details || '알 수 없는 오류';
            console.error(`[NodeExporterInstall] Promtail 설치 실패:`, errorMsg);
            setMessage({ 
              type: 'error', // warning에서 error로 변경하여 더 명확하게 표시
              text: `${serverIp}: Promtail 설치 실패 - ${errorMsg} (Node Exporter는 설치 완료)` 
            });
          } else {
            console.log(`[NodeExporterInstall] Promtail 설치 성공: ${serverIp}`);
          }
        } catch (error) {
          console.error(`[NodeExporterInstall] Promtail 설치 중 예외 발생:`, error);
          setMessage({ 
            type: 'error', // warning에서 error로 변경
            text: `${serverIp}: Promtail 설치 실패 - ${error.message} (Node Exporter는 설치 완료)` 
          });
        }
      } else {
        console.log(`[NodeExporterInstall] Promtail 설치 건너뜀 (선택되지 않음): ${serverIp}`);
      }

      // JMX Exporter 설치 (선택된 경우)
      if (installJmxExporter) {
        try {
          console.log(`[NodeExporterInstall] JMX Exporter 설치 시작: ${serverIp}`);
          const jmxExporterResult = await jmxExporterApi.install(serverIp, sshOptions);
          results.jmxExporter = jmxExporterResult;
          console.log(`[NodeExporterInstall] JMX Exporter 설치 결과:`, jmxExporterResult);

          if (!jmxExporterResult.success) {
            const errorMsg = jmxExporterResult.error || jmxExporterResult.details || '알 수 없는 오류';
            console.error(`[NodeExporterInstall] JMX Exporter 설치 실패:`, errorMsg);
            setMessage({ 
              type: 'error',
              text: `${serverIp}: JMX Exporter 설치 실패 - ${errorMsg}` 
            });
          } else {
            console.log(`[NodeExporterInstall] JMX Exporter 설치 성공: ${serverIp}`);
          }
        } catch (error) {
          console.error(`[NodeExporterInstall] JMX Exporter 설치 중 예외 발생:`, error);
          setMessage({ 
            type: 'error',
            text: `${serverIp}: JMX Exporter 설치 실패 - ${error.message}` 
          });
        }
      } else {
        console.log(`[NodeExporterInstall] JMX Exporter 설치 건너뜀 (선택되지 않음): ${serverIp}`);
      }

      // 설치 결과 메시지 생성
      const successMessages = [];
      const failedMessages = [];
      
      if (installNodeExporter) {
        if (results.nodeExporter?.success) {
          successMessages.push('Node Exporter');
        } else {
          failedMessages.push('Node Exporter');
        }
      }
      
      if (installPromtail) {
        if (results.promtail?.success) {
          successMessages.push('Promtail');
        } else {
          failedMessages.push('Promtail');
        }
      }
      
      if (installJmxExporter) {
        if (results.jmxExporter?.success) {
          successMessages.push('JMX Exporter');
        } else {
          failedMessages.push('JMX Exporter');
        }
      }
      
      // Promtail 설치 실패 시 상세 에러 로그
      if (installPromtail && !results.promtail?.success) {
        console.error(`[NodeExporterInstall] Promtail 설치 실패 상세:`, {
          serverIp,
          result: results.promtail,
          error: results.promtail?.error,
          details: results.promtail?.details
        });
      }

      // 성공 메시지 표시
      if (successMessages.length > 0) {
        const messageText = failedMessages.length > 0
          ? `${serverIp}: ${successMessages.join(' + ')} 설치 완료 (${failedMessages.join(', ')} 설치 실패)`
          : `${serverIp}: ${successMessages.join(' + ')} 설치 완료`;
        
        setMessage({ 
          type: failedMessages.length > 0 ? 'warning' : 'success',
          text: messageText
        });
      } else if (failedMessages.length > 0) {
        // 모두 실패한 경우
        setMessage({ 
          type: 'error',
          text: `${serverIp}: ${failedMessages.join(', ')} 설치 실패` 
        });
      }

      // 상태 확인 (설치 성공 여부와 관계없이 항상 확인)
      // Promtail 설치 후 약간의 대기 시간 추가 (서비스 시작 시간 고려)
      if (installPromtail && results.promtail?.success) {
        console.log(`[NodeExporterInstall] Promtail 설치 후 대기 중... (${serverIp})`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
      }
      await checkStatus(serverIp, true);
    } catch (error) {
      setMessage({ type: 'error', text: `${serverIp}: 설치 실패 - ${error.message}` });
    } finally {
      setServers(prev => prev.map(s => 
        s.ip === serverIp ? { ...s, installing: false } : s
      ));
    }
  };

  const installOnAll = async () => {
    setLoading(true);
    setMessage(null);

    try {
      if (!installNodeExporter && !installPromtail && !installJmxExporter) {
        setMessage({ type: 'error', text: '최소 하나 이상의 도구를 선택해야 합니다.' });
        setLoading(false);
        return;
      }

      const serverIps = servers.filter(s => s.ip).map(s => s.ip);
      if (serverIps.length === 0) {
        setMessage({ type: 'error', text: 'IP 주소가 설정된 서버가 없습니다.' });
        setLoading(false);
        return;
      }

      const sshOptions = {
        sshUser,
        sshKey: getEffectiveSshKey()
      };

      const results = {
        nodeExporter: null,
        promtail: null
      };

      // Node Exporter 설치 (선택된 경우)
      if (installNodeExporter) {
        try {
          const nodeExporterOptions = {
            ...sshOptions,
            autoRegisterPrometheus: false, // 설치만 수행, 등록은 PLG Stack 모니터링 메뉴에서
            installPromtail: false // Promtail은 별도로 설치하므로 false
          };
          
          results.nodeExporter = await nodeExporterApi.installMultiple(serverIps, nodeExporterOptions);
          
          if (!results.nodeExporter.success) {
            const failedServers = results.nodeExporter.results?.filter(r => !r.success) || [];
            const errorMessages = failedServers.map(r => {
              const errorMsg = r.error || r.details || '알 수 없는 오류';
              if (errorMsg.includes('Permission denied')) {
                return `${r.serverIp}: SSH 인증 실패`;
              }
              if (errorMsg.includes('Text file busy')) {
                return `${r.serverIp}: 파일이 사용 중`;
              }
              return `${r.serverIp}: ${errorMsg}`;
            });
            setMessage({ 
              type: 'error', 
              text: `Node Exporter 설치 실패:\n${errorMessages.join('\n')}` 
            });
            setLoading(false);
            return;
          }
        } catch (error) {
          setMessage({ type: 'error', text: `Node Exporter 설치 실패: ${error.message}` });
          setLoading(false);
          return;
        }
      }

      // Promtail 설치 (선택된 경우)
      if (installPromtail) {
        try {
          results.promtail = await promtailApi.installMultiple(serverIps, sshOptions);
          
          if (!results.promtail.success) {
            const failedServers = results.promtail.results?.filter(r => !r.success) || [];
            const errorMessages = failedServers.map(r => `${r.serverIp}: ${r.error || '알 수 없는 오류'}`);
            setMessage({ 
              type: 'warning', 
              text: `Promtail 설치 일부 실패:\n${errorMessages.join('\n')}\n(Node Exporter는 설치 완료)` 
            });
          }
        } catch (error) {
          setMessage({ 
            type: 'warning', 
            text: `Promtail 설치 실패: ${error.message} (Node Exporter는 설치 완료)` 
          });
        }
      }

      // JMX Exporter 설치 (선택된 경우)
      if (installJmxExporter) {
        try {
          results.jmxExporter = await jmxExporterApi.installMultiple(serverIps, sshOptions);
          
          if (!results.jmxExporter.success) {
            const failedServers = results.jmxExporter.failures || [];
            const errorMessages = failedServers.map(r => `${r.serverIp}: ${r.error || '알 수 없는 오류'}`);
            setMessage({ 
              type: 'warning', 
              text: `JMX Exporter 설치 일부 실패:\n${errorMessages.join('\n')}` 
            });
          }
        } catch (error) {
          setMessage({ 
            type: 'warning', 
            text: `JMX Exporter 설치 실패: ${error.message}` 
          });
        }
      }

      // 설치 결과 메시지 생성
      const successMessages = [];
      if (results.nodeExporter?.success) {
        const successCount = results.nodeExporter.summary?.success || 0;
        const totalCount = results.nodeExporter.summary?.total || 0;
        successMessages.push(`Node Exporter (${successCount}/${totalCount})`);
      }
      if (results.promtail?.success) {
        const successCount = results.promtail.summary?.success || 0;
        const totalCount = results.promtail.summary?.total || 0;
        successMessages.push(`Promtail (${successCount}/${totalCount})`);
      }
      if (results.jmxExporter?.success) {
        const successCount = results.jmxExporter.successCount || 0;
        const totalCount = results.jmxExporter.total || 0;
        successMessages.push(`JMX Exporter (${successCount}/${totalCount})`);
      }

      if (successMessages.length > 0) {
        setMessage({ 
          type: 'success', 
          text: `설치 완료: ${successMessages.join(' + ')}` 
        });
      }
      
      // 모든 서버 상태 확인
      for (const serverIp of serverIps) {
        await checkStatus(serverIp);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      setMessage({ type: 'error', text: `설치 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const uninstallOnServer = async (serverIp, tool) => {
    let toolName = '';
    if (tool === 'node_exporter') {
      toolName = 'Node Exporter';
    } else if (tool === 'promtail') {
      toolName = 'Promtail';
    } else if (tool === 'jmx_exporter') {
      toolName = 'JMX Exporter';
    } else if (tool === 'all') {
      toolName = '모든 도구 (Node Exporter + Promtail + JMX Exporter)';
    } else if (tool.includes('+')) {
      const tools = tool.split('+').map(t => {
        if (t === 'node_exporter') return 'Node Exporter';
        if (t === 'promtail') return 'Promtail';
        if (t === 'jmx_exporter') return 'JMX Exporter';
        return t;
      });
      toolName = tools.join(' + ');
    } else {
      toolName = tool;
    }
    
    if (!confirm(`${serverIp}에서 ${toolName}를 삭제하시겠습니까?`)) {
      return;
    }

    setServers(prev => prev.map(s => 
      s.ip === serverIp ? { ...s, uninstalling: true } : s
    ));
    setMessage(null);

    try {
      // VM 이름 찾기
      const server = servers.find(s => s.ip === serverIp);
      const vmName = server?.name || serverIp;
      
      if (tool === 'node_exporter') {
        const result = await nodeExporterApi.uninstall(serverIp, {
          sshUser,
          sshKey: getEffectiveSshKey(),
          vmName: vmName // VM 이름 전달 (Prometheus Job 및 Grafana 대시보드 삭제용)
        });
        
        if (result.success) {
          setMessage({ type: 'success', text: `${serverIp}: Node Exporter 삭제 완료` });
          await checkStatus(serverIp, true);
        } else {
          setMessage({ type: 'error', text: `${serverIp}: Node Exporter 삭제 실패 - ${result.error || '알 수 없는 오류'}` });
        }
      } else if (tool === 'promtail') {
        const result = await promtailApi.uninstall(serverIp, {
          sshUser,
          sshKey: getEffectiveSshKey()
        });
        
        if (result.success) {
          setMessage({ type: 'success', text: `${serverIp}: Promtail 삭제 완료` });
          await checkStatus(serverIp, true);
        } else {
          setMessage({ type: 'error', text: `${serverIp}: Promtail 삭제 실패 - ${result.error || '알 수 없는 오류'}` });
        }
      } else if (tool === 'jmx_exporter') {
        const result = await jmxExporterApi.uninstall(serverIp, {
          sshUser,
          sshKey: getEffectiveSshKey()
        });
        
        if (result.success) {
          setMessage({ type: 'success', text: `${serverIp}: JMX Exporter 삭제 완료` });
          await checkStatus(serverIp, true);
        } else {
          setMessage({ type: 'error', text: `${serverIp}: JMX Exporter 삭제 실패 - ${result.error || '알 수 없는 오류'}` });
        }
      } else if (tool === 'both' || tool === 'all' || tool.includes('+')) {
        // 여러 도구 삭제
        const server = servers.find(s => s.ip === serverIp);
        const vmName = server?.name || serverIp;
        
        const tools = tool === 'both' ? ['node_exporter', 'promtail'] : 
                      tool === 'all' ? ['node_exporter', 'promtail', 'jmx_exporter'] :
                      tool.split('+');
        
        const results = {};
        const errors = [];
        
        if (tools.includes('node_exporter')) {
          results.nodeExporter = await nodeExporterApi.uninstall(serverIp, {
            sshUser,
            sshKey: getEffectiveSshKey(),
            vmName: vmName
          });
          if (!results.nodeExporter.success) {
            errors.push(`Node Exporter: ${results.nodeExporter.error}`);
          }
        }
        
        if (tools.includes('promtail')) {
          results.promtail = await promtailApi.uninstall(serverIp, {
            sshUser,
            sshKey: getEffectiveSshKey()
          });
          if (!results.promtail.success) {
            errors.push(`Promtail: ${results.promtail.error}`);
          }
        }
        
        if (tools.includes('jmx_exporter')) {
          results.jmxExporter = await jmxExporterApi.uninstall(serverIp, {
            sshUser,
            sshKey: getEffectiveSshKey()
          });
          if (!results.jmxExporter.success) {
            errors.push(`JMX Exporter: ${results.jmxExporter.error}`);
          }
        }
        
        if (errors.length === 0) {
          const toolNames = tools.map(t => {
            if (t === 'node_exporter') return 'Node Exporter';
            if (t === 'promtail') return 'Promtail';
            if (t === 'jmx_exporter') return 'JMX Exporter';
            return t;
          }).join(' + ');
          setMessage({ type: 'success', text: `${serverIp}: ${toolNames} 삭제 완료` });
          await checkStatus(serverIp, true);
        } else {
          setMessage({ type: 'error', text: `${serverIp}: 삭제 실패 - ${errors.join(', ')}` });
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: `${serverIp}: 삭제 실패 - ${error.message}` });
    } finally {
      setServers(prev => prev.map(s => 
        s.ip === serverIp ? { ...s, uninstalling: false } : s
      ));
    }
  };

  const checkAllStatus = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      // 모든 서버의 상태를 순차적으로 확인
      for (const server of servers) {
        if (server.ip) {
          await checkStatus(server.ip);
          // 부하를 줄이기 위해 약간의 딜레이 추가
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      setMessage({ type: 'success', text: `전체 ${servers.length}개 서버 상태 확인 완료` });
    } catch (error) {
      setMessage({ type: 'error', text: `상태 확인 중 오류 발생: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Node Exporter 설치</h2>
      
      {/* 설치 옵션 선택 */}
      <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
        <h3 style={{ marginTop: '0', marginBottom: '12px', fontSize: '16px', color: '#2c3e50' }}>
          📦 설치할 도구 선택
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #dee2e6' }}>
            <input
              type="checkbox"
              checked={installNodeExporter}
              onChange={(e) => setInstallNodeExporter(e.target.checked)}
              style={{ marginRight: '12px', width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
                Node Exporter
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                메트릭 수집 (포트 9100)
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #dee2e6' }}>
            <input
              type="checkbox"
              checked={installPromtail}
              onChange={(e) => setInstallPromtail(e.target.checked)}
              style={{ marginRight: '12px', width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
                Promtail
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                로그 수집 및 Loki 전송 (포트 9080)
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #dee2e6' }}>
            <input
              type="checkbox"
              checked={installJmxExporter}
              onChange={(e) => setInstallJmxExporter(e.target.checked)}
              style={{ marginRight: '12px', width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
                JMX Exporter
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Java 애플리케이션 메트릭 수집 (포트 9404)
              </div>
            </div>
          </label>
        </div>

        {!installNodeExporter && !installPromtail && !installJmxExporter && (
          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '13px', color: '#856404' }}>
            ⚠️ 최소 하나 이상의 도구를 선택해야 합니다.
          </div>
        )}
      </div>
      
      {message && (
        <div className={
          message.type === 'success' ? 'success' : 
          message.type === 'info' ? 'info' : 
          'error'
        }>
          {message.text}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label className="label">SSH 사용자</label>
        <input
          type="text"
          className="input"
          value={sshUser}
          onChange={(e) => setSshUser(e.target.value)}
          placeholder={loadingSshConfig ? '로딩 중...' : 'ubuntu'}
          disabled={loadingSshConfig}
        />

        <label className="label">SSH Key 선택</label>
        <select
          className="input"
          value={selectedSshKey}
          onChange={(e) => setSelectedSshKey(e.target.value)}
          disabled={loadingSshConfig}
        >
          {loadingSshConfig ? (
            <option value="">SSH 키 로딩 중...</option>
          ) : (
            sshKeyOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          )}
        </select>

        {selectedSshKey === 'custom' && (
          <>
            <label className="label">직접 입력 경로</label>
            <input
              type="text"
              className="input"
              value={customSshKey}
              onChange={(e) => setCustomSshKey(e.target.value)}
              placeholder="/path/to/ssh/key"
            />
          </>
        )}

        <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '8px' }}>
          선택된 SSH Key로 모든 서버에 접속합니다. 사용자별 키 추가가 필요하면 "직접 입력"을 사용하세요.
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button 
          className="button" 
          onClick={loadVmList}
          disabled={loadingVms}
        >
          {loadingVms ? 'VM 목록 조회 중...' : 'VM 목록 새로고침'}
        </button>
        <button 
          className="button" 
          onClick={checkAllStatus}
          disabled={loading || servers.length === 0}
          style={{ marginLeft: '10px' }}
        >
          전체 상태 확인
        </button>
        <button 
          className="button button-success" 
          onClick={installOnAll}
          disabled={loading || servers.length === 0 || (!installNodeExporter && !installPromtail && !installJmxExporter)}
          style={{ marginLeft: '10px' }}
        >
          전체 설치 {[
            installNodeExporter && 'Node Exporter',
            installPromtail && 'Promtail',
            installJmxExporter && 'JMX Exporter'
          ].filter(Boolean).join(' + ')}
        </button>
      </div>

      {loadingVms ? (
        <div className="loading">VM 목록을 불러오는 중...</div>
      ) : servers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          VM 목록이 없습니다. "VM 목록 새로고침" 버튼을 클릭하세요.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>서버 이름</th>
              <th>IP 주소</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server, index) => (
              <tr key={server.ip || server.name || index}>
                <td>{server.name}</td>
                <td>
                  {server.ips && server.ips.length > 1 ? (
                    // IP가 2개 이상인 경우 선택 버튼 표시
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {server.ips.map((ip, ipIndex) => (
                          <button
                            key={ipIndex}
                            className={`button ${server.ip === ip ? 'button-primary' : ''}`}
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '12px',
                              minWidth: 'auto',
                              background: server.ip === ip ? 'var(--primary-color)' : 'rgba(84, 107, 255, 0.1)',
                              color: server.ip === ip ? '#fff' : 'var(--text-light)'
                            }}
                            onClick={() => {
                              setServers(prev => prev.map((s, i) => 
                                i === index ? { ...s, ip: ip } : s
                              ));
                            }}
                          >
                            {ip}
                          </button>
                        ))}
                      </div>
                      <span style={{ fontSize: '11px', color: '#666' }}>
                        선택된 IP: {server.ip || '없음'}
                      </span>
                    </div>
                  ) : server.ip ? (
                    // IP가 1개인 경우 그냥 표시
                    <span>{server.ip}</span>
                  ) : (
                    // IP가 없는 경우 수동 입력
                    <input
                      type="text"
                      className="input"
                      placeholder="IP 주소 입력"
                      style={{ width: '150px', padding: '4px 8px', fontSize: '13px' }}
                      value={server.ip || ''}
                      onChange={(e) => {
                        setServers(prev => prev.map((s, i) => 
                          i === index ? { ...s, ip: e.target.value } : s
                        ));
                      }}
                    />
                  )}
                </td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {installNodeExporter && (
                    <span className={`status-badge ${
                      server.nodeExporterInstalled ? 'status-success' : 'status-error'
                    }`} style={{ fontSize: '12px', padding: '2px 8px' }}>
                      Node Exporter: {server.nodeExporterInstalled ? '설치됨' : '미설치'}
                    </span>
                  )}
                  {installPromtail && (
                    <span className={`status-badge ${
                      server.promtailInstalled ? 'status-success' : 'status-error'
                    }`} style={{ fontSize: '12px', padding: '2px 8px' }}>
                      Promtail: {server.promtailInstalled ? '설치됨' : '미설치'}
                    </span>
                  )}
                  {installJmxExporter && (
                    <span className={`status-badge ${
                      server.jmxExporterInstalled ? 'status-success' : 'status-error'
                    }`} style={{ fontSize: '12px', padding: '2px 8px' }}>
                      JMX Exporter: {server.jmxExporterInstalled ? '설치됨' : '미설치'}
                    </span>
                  )}
                  {!installNodeExporter && !installPromtail && !installJmxExporter && (
                    <span className="status-badge status-info" style={{ fontSize: '12px', padding: '2px 8px' }}>
                      확인 필요
                    </span>
                  )}
                </div>
              </td>
              <td>
                <button
                  className="button"
                  onClick={() => checkStatus(server.ip, true)}
                  disabled={server.installing || server.uninstalling || loading}
                  style={{ marginRight: '8px' }}
                >
                  확인
                </button>
                <button
                  className="button button-success"
                  onClick={() => installOnServer(server.ip)}
                  disabled={server.installing || server.uninstalling || (!installNodeExporter && !installPromtail && !installJmxExporter)}
                  style={{ marginRight: '8px' }}
                >
                  {server.installing ? '설치 중...' : '설치'}
                </button>
                {(server.nodeExporterInstalled || server.promtailInstalled) && (
                  <button
                    className="button"
                    onClick={() => {
                      if (server.nodeExporterInstalled && server.promtailInstalled) {
                        uninstallOnServer(server.ip, 'both');
                      } else if (server.nodeExporterInstalled) {
                        uninstallOnServer(server.ip, 'node_exporter');
                      } else if (server.promtailInstalled) {
                        uninstallOnServer(server.ip, 'promtail');
                      }
                    }}
                    disabled={server.installing || server.uninstalling || loading}
                    style={{ backgroundColor: '#f44336', color: '#fff' }}
                    title="설치된 도구 삭제"
                  >
                    {server.uninstalling ? '삭제 중...' : '삭제'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}

export default NodeExporterInstall;

