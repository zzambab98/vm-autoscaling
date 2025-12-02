import { useState, useEffect } from 'react';
import { nodeExporterApi, promtailApi } from '../services/api';
import { templateApi } from '../services/templateApi';

function NodeExporterInstall() {
  const sshKeyOptions = [
    {
      label: 'danainfra',
      value: '/home/ubuntu/workspace/vm-autoscaling/pemkey/danainfra'
    },
    {
      label: 'dana-cocktail',
      value: '/home/ubuntu/workspace/vm-autoscaling/pemkey/dana-cocktail'
    },
    { label: '직접 입력', value: 'custom' }
  ];

  const [servers, setServers] = useState([]);
  const [sshUser, setSshUser] = useState('ubuntu');
  const [selectedSshKey, setSelectedSshKey] = useState(sshKeyOptions[0].value); // danainfra를 기본값으로
  const [customSshKey, setCustomSshKey] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingVms, setLoadingVms] = useState(false);
  
  // 설치 옵션
  const [installNodeExporter, setInstallNodeExporter] = useState(true);
  const [installPromtail, setInstallPromtail] = useState(true);

  // 컴포넌트 마운트 시 vCenter에서 모든 VM 조회
  useEffect(() => {
    loadVmList();
  }, []);

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
              nodeExporterInstalled: false,
              promtailInstalled: false
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
      const result = await nodeExporterApi.checkStatus(serverIp, {
        sshUser,
        sshKey: getEffectiveSshKey()
      });
      
      // Node Exporter와 Promtail 상태 모두 확인
      const nodeExporterStatus = result.nodeExporter?.installed ? 'installed' : 'not_installed';
      const promtailStatus = result.promtail?.installed ? 'installed' : 'not_installed';
      
      // 상태 문자열 생성
      let statusText = '';
      if (nodeExporterStatus === 'installed' && promtailStatus === 'installed') {
        statusText = 'both_installed';
      } else if (nodeExporterStatus === 'installed') {
        statusText = 'node_exporter_only';
      } else if (promtailStatus === 'installed') {
        statusText = 'promtail_only';
      } else {
        statusText = 'not_installed';
      }
      
      setServers(prev => prev.map(s => 
        s.ip === serverIp 
          ? { 
              ...s, 
              status: statusText,
              nodeExporterInstalled: result.nodeExporter?.installed || false,
              promtailInstalled: result.promtail?.installed || false
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
      if (!installNodeExporter && !installPromtail) {
        setMessage({ type: 'error', text: '최소 하나 이상의 도구를 선택해야 합니다.' });
        setServers(prev => prev.map(s => 
          s.ip === serverIp ? { ...s, installing: false } : s
        ));
        return;
      }

      // Promtail만 설치하는 경우
      if (!installNodeExporter && installPromtail) {
        const promtailResult = await promtailApi.install(serverIp, {
          sshUser,
          sshKey: getEffectiveSshKey()
        });
        
        if (promtailResult.success) {
          setMessage({ type: 'success', text: `${serverIp}: Promtail 설치 완료` });
          await checkStatus(serverIp, true);
        } else {
          setMessage({ type: 'error', text: `${serverIp}: Promtail 설치 실패 - ${promtailResult.error || '알 수 없는 오류'}` });
        }
        setServers(prev => prev.map(s => 
          s.ip === serverIp ? { ...s, installing: false } : s
        ));
        return;
      }
      
      // Node Exporter만 설치하는 경우
      if (installNodeExporter && !installPromtail) {
        installOptions.installPromtail = false;
      }

      const installOptions = {
        sshUser,
        sshKey: getEffectiveSshKey(),
        installPromtail: installPromtail
      };

      const result = await nodeExporterApi.install(serverIp, installOptions);

      if (result.success) {
        let successMsg = '';
        if (installNodeExporter && installPromtail) {
          successMsg = `${serverIp}: Node Exporter + Promtail 설치 완료`;
        } else if (installNodeExporter) {
          successMsg = `${serverIp}: Node Exporter 설치 완료`;
        } else if (installPromtail) {
          successMsg = `${serverIp}: Promtail 설치 완료`;
        }
        setMessage({ type: 'success', text: successMsg });
        if (installNodeExporter) {
          await checkStatus(serverIp);
        }
      } else {
        const errorMsg = result.error || result.details || '알 수 없는 오류';
        let displayMsg = errorMsg;
        
        // SSH 인증 실패인 경우
        if (errorMsg.includes('Permission denied')) {
          displayMsg = 'SSH 인증 실패 - 올바른 SSH 키를 선택했는지 확인하세요';
        }
        // 파일이 사용 중인 경우
        else if (errorMsg.includes('Text file busy')) {
          displayMsg = '파일이 사용 중입니다 - 재설치를 시도합니다';
        }
        
        setMessage({ type: 'error', text: `${serverIp}: ${displayMsg}` });
      }
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
      if (!installNodeExporter && !installPromtail) {
        setMessage({ type: 'error', text: '최소 하나 이상의 도구를 선택해야 합니다.' });
        setLoading(false);
        return;
      }

      // Promtail만 설치하는 경우
      if (!installNodeExporter && installPromtail) {
        const promtailResult = await promtailApi.installMultiple(serverIps, {
          sshUser,
          sshKey: getEffectiveSshKey()
        });
        
        if (promtailResult.success) {
          let successMsg = `Promtail 설치 완료: ${promtailResult.summary.success}/${promtailResult.summary.total}개 서버`;
          setMessage({ type: 'success', text: successMsg });
          
          // 모든 서버 상태 확인
          for (const serverIp of serverIps) {
            await checkStatus(serverIp);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          const failedServers = promtailResult.results?.filter(r => !r.success) || [];
          const errorMessages = failedServers.map(r => `${r.serverIp}: ${r.error || '알 수 없는 오류'}`);
          setMessage({ type: 'error', text: `일부 서버 Promtail 설치 실패:\n${errorMessages.join('\n')}` });
        }
        setLoading(false);
        return;
      }
      
      // Node Exporter만 설치하는 경우
      if (installNodeExporter && !installPromtail) {
        installOptions.installPromtail = false;
      }

      const serverIps = servers.map(s => s.ip);
      const installOptions = {
        sshUser,
        sshKey: getEffectiveSshKey(),
        installPromtail: installPromtail
      };

      const result = await nodeExporterApi.installMultiple(serverIps, installOptions);

      if (result.success) {
        let successMsg = '';
        if (installNodeExporter && installPromtail) {
          successMsg = `설치 완료: ${result.summary.success}/${result.summary.total}개 서버 (Node Exporter + Promtail)`;
        } else if (installNodeExporter) {
          successMsg = `설치 완료: ${result.summary.success}/${result.summary.total}개 서버 (Node Exporter)`;
        }
        setMessage({ 
          type: 'success', 
          text: successMsg
        });
        
        // 모든 서버 상태 확인
        for (const serverIp of serverIps) {
          await checkStatus(serverIp);
        }
      } else {
        // 상세한 에러 메시지 표시
        const failedServers = result.results?.filter(r => !r.success) || [];
        const errorMessages = failedServers.map(r => {
          const errorMsg = r.error || r.details || '알 수 없는 오류';
          // SSH 인증 실패인 경우
          if (errorMsg.includes('Permission denied')) {
            return `${r.serverIp}: SSH 인증 실패 - 올바른 SSH 키를 선택했는지 확인하세요`;
          }
          // 파일이 사용 중인 경우
          if (errorMsg.includes('Text file busy')) {
            return `${r.serverIp}: 파일이 사용 중입니다 - 재설치를 시도합니다`;
          }
          return `${r.serverIp}: ${errorMsg}`;
        });
        setMessage({ 
          type: 'error', 
          text: `일부 서버 설치 실패:\n${errorMessages.join('\n')}` 
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `설치 실패: ${error.message}` });
    } finally {
      setLoading(false);
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
        </div>

        {!installNodeExporter && !installPromtail && (
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
          placeholder="ubuntu"
        />

        <label className="label">SSH Key 선택</label>
        <select
          className="input"
          value={selectedSshKey}
          onChange={(e) => setSelectedSshKey(e.target.value)}
        >
          {sshKeyOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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
          disabled={loading || servers.length === 0 || (!installNodeExporter && !installPromtail)}
          style={{ marginLeft: '10px' }}
        >
          전체 설치 {installNodeExporter && installPromtail ? '(Node Exporter + Promtail)' : installNodeExporter ? '(Node Exporter)' : '(Promtail)'}
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
                  {!installNodeExporter && !installPromtail && (
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
                  disabled={server.installing || loading}
                  style={{ marginRight: '8px' }}
                >
                  확인
                </button>
                <button
                  className="button button-success"
                  onClick={() => installOnServer(server.ip)}
                  disabled={server.installing || (!installNodeExporter && !installPromtail)}
                >
                  {server.installing ? '설치 중...' : '설치'}
                </button>
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

