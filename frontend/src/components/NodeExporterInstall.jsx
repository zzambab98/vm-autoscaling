import { useState, useEffect } from 'react';
import { nodeExporterApi } from '../services/api';
import { templateApi } from '../services/templateApi';

function NodeExporterInstall() {
  const sshKeyOptions = [
    {
      label: 'danainfra',
      value: '/Users/jhlee/Desktop/Work/Dana-Cloud-Oper/DanaIX-신규 VM 생성/00. SSH-PemKey-List/danainfra'
    },
    {
      label: 'dana-cocktail',
      value: '/Users/jhlee/Desktop/Work/Dana-Cloud-Oper/DanaIX-신규 VM 생성/00. SSH-PemKey-List/dana-cocktail'
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

  // 컴포넌트 마운트 시 vCenter에서 모든 VM 조회
  useEffect(() => {
    loadVmList();
  }, []);

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
              installing: false
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })); // 이름 기준 정렬
        console.log('[NodeExporterInstall] 변환된 서버 목록:', vmServers.length, '개');
        setServers(vmServers);
        if (vmServers.length === 0) {
          setMessage({ type: 'info', text: 'VM 목록이 비어있습니다.' });
        } else {
          setMessage({ type: 'success', text: `${vmServers.length}개의 VM을 불러왔습니다.` });
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

  const checkStatus = async (serverIp) => {
    try {
      const result = await nodeExporterApi.checkStatus(serverIp, {
        sshUser,
        sshKey: getEffectiveSshKey()
      });
      
      setServers(prev => prev.map(s => 
        s.ip === serverIp 
          ? { ...s, status: result.installed ? (result.isActive ? 'installed' : 'installed') : 'not_installed' }
          : s
      ));
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const installOnServer = async (serverIp) => {
    setServers(prev => prev.map(s => 
      s.ip === serverIp ? { ...s, installing: true } : s
    ));
    setMessage(null);

    try {
      const result = await nodeExporterApi.install(serverIp, {
        sshUser,
        sshKey: getEffectiveSshKey()
      });

      if (result.success) {
        setMessage({ type: 'success', text: `${serverIp}: Node Exporter 설치 완료` });
        await checkStatus(serverIp);
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
      const serverIps = servers.map(s => s.ip);
      const result = await nodeExporterApi.installMultiple(serverIps, {
        sshUser,
        sshKey: getEffectiveSshKey()
      });

      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `설치 완료: ${result.summary.success}/${result.summary.total}개 서버` 
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
    for (const server of servers) {
      await checkStatus(server.ip);
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <h2>Node Exporter 설치</h2>
      
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
          disabled={loading || servers.length === 0}
          style={{ marginLeft: '10px' }}
        >
          전체 설치
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
                <span className={`status-badge ${
                  server.status === 'installed' ? 'status-success' :
                  server.status === 'not_installed' ? 'status-error' :
                  'status-info'
                }`}>
                  {server.status === 'installed' ? '설치됨' :
                   server.status === 'not_installed' ? '미설치' :
                   '확인 필요'}
                </span>
              </td>
              <td>
                <button
                  className="button"
                  onClick={() => checkStatus(server.ip)}
                  disabled={server.installing}
                  style={{ marginRight: '8px' }}
                >
                  확인
                </button>
                <button
                  className="button button-success"
                  onClick={() => installOnServer(server.ip)}
                  disabled={server.installing}
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

