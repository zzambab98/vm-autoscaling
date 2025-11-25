import { useState } from 'react';
import { nodeExporterApi } from '../services/api';

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

  const [servers, setServers] = useState([
    { ip: '10.255.48.230', name: 'auto-vm-test-01', status: 'unknown', installing: false },
    { ip: '10.255.48.231', name: 'auto-vm-test-02', status: 'unknown', installing: false }
  ]);
  const [sshUser, setSshUser] = useState('ubuntu');
  const [selectedSshKey, setSelectedSshKey] = useState(sshKeyOptions[0].value); // danainfra를 기본값으로
  const [customSshKey, setCustomSshKey] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

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
        <div className={message.type === 'success' ? 'success' : 'error'}>
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
          onClick={checkAllStatus}
          disabled={loading}
        >
          전체 상태 확인
        </button>
        <button 
          className="button button-success" 
          onClick={installOnAll}
          disabled={loading}
          style={{ marginLeft: '10px' }}
        >
          전체 설치
        </button>
      </div>

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
          {servers.map(server => (
            <tr key={server.ip}>
              <td>{server.name}</td>
              <td>{server.ip}</td>
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
    </div>
  );
}

export default NodeExporterInstall;

