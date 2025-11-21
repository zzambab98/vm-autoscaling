import { useState } from 'react';
import { nodeExporterApi } from '../services/api';

function NodeExporterInstall() {
  const [servers, setServers] = useState([
    { ip: '10.255.48.230', name: 'auto-vm-test-01', status: 'unknown', installing: false },
    { ip: '10.255.48.231', name: 'auto-vm-test-02', status: 'unknown', installing: false }
  ]);
  const [sshUser, setSshUser] = useState('ubuntu');
  const [sshKey, setSshKey] = useState('/Users/jhlee/Desktop/Work/Dana-Cloud-Oper/DanaIX-신규 VM 생성/00. SSH-PemKey-List/danainfra');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async (serverIp) => {
    try {
      const result = await nodeExporterApi.checkStatus(serverIp, {
        sshUser,
        sshKey
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
        sshKey
      });

      if (result.success) {
        setMessage({ type: 'success', text: `${serverIp}: Node Exporter 설치 완료` });
        await checkStatus(serverIp);
      } else {
        setMessage({ type: 'error', text: `${serverIp}: ${result.error}` });
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
        sshKey
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
        setMessage({ type: 'error', text: '일부 서버 설치 실패' });
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

        <label className="label">SSH Key 경로</label>
        <input
          type="text"
          className="input"
          value={sshKey}
          onChange={(e) => setSshKey(e.target.value)}
          placeholder="/path/to/ssh/key"
        />
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

