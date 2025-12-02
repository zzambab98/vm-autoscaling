import { useState, useEffect } from 'react';
import { nodeExporterApi } from '../services/api';
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
  
  // 자동 연동 옵션
  const [autoRegisterPrometheus, setAutoRegisterPrometheus] = useState(false);
  const [prometheusJobName, setPrometheusJobName] = useState('');
  const [prometheusServiceLabel, setPrometheusServiceLabel] = useState('');
  const [prometheusEnvironmentLabel, setPrometheusEnvironmentLabel] = useState('production');
  const [groupByJob, setGroupByJob] = useState(true);

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
      const installOptions = {
        sshUser,
        sshKey: getEffectiveSshKey(),
        autoRegisterPrometheus,
        prometheusJobName: prometheusJobName || null,
        prometheusLabels: {
          service: prometheusServiceLabel || undefined,
          environment: prometheusEnvironmentLabel || undefined
        }
      };

      const result = await nodeExporterApi.install(serverIp, installOptions);

      if (result.success) {
        let successMsg = `${serverIp}: Node Exporter 설치 완료`;
        if (result.promtailInstalled) {
          successMsg += ` + Promtail 설치 완료`;
        }
        if (result.prometheusRegistered) {
          successMsg += ` (Prometheus Job '${result.prometheusJobName}'에 자동 등록됨)`;
        }
        setMessage({ type: 'success', text: successMsg });
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
      const installOptions = {
        sshUser,
        sshKey: getEffectiveSshKey(),
        autoRegisterPrometheus,
        prometheusJobName: prometheusJobName || null,
        prometheusLabels: {
          service: prometheusServiceLabel || undefined,
          environment: prometheusEnvironmentLabel || undefined
        },
        groupByJob
      };

      const result = await nodeExporterApi.installMultiple(serverIps, installOptions);

      if (result.success) {
        let successMsg = `설치 완료: ${result.summary.success}/${result.summary.total}개 서버`;
        if (result.summary.promtailInstalled > 0) {
          successMsg += ` (Node Exporter + Promtail 설치: ${result.summary.promtailInstalled}개 서버)`;
        }
        if (result.summary.prometheusRegistered > 0) {
          successMsg += ` (Prometheus 자동 등록: ${result.summary.prometheusRegistered}개 서버)`;
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
    for (const server of servers) {
      await checkStatus(server.ip);
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <h2>Node Exporter 설치</h2>
      
      <div style={{ 
        padding: '12px 16px', 
        marginBottom: '20px', 
        backgroundColor: '#e7f3ff', 
        border: '1px solid #2196F3', 
        borderRadius: '6px',
        fontSize: '14px',
        lineHeight: '1.6'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>ℹ️</span>
          <div>
            <strong style={{ color: '#1976D2' }}>자동 설치 안내</strong>
            <div style={{ marginTop: '6px', color: '#424242' }}>
              Node Exporter 설치 시 <strong>Promtail (Loki 로그 수집)</strong>도 함께 자동으로 설치됩니다.
              <br />
              <span style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'block' }}>
                • Node Exporter: 메트릭 수집 (포트 9100)
                <br />
                • Promtail: 로그 수집 및 Loki 전송 (포트 9080)
              </span>
            </div>
          </div>
        </div>
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

      {/* Prometheus 자동 등록 옵션 */}
      <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
        <h3 style={{ marginTop: '0', marginBottom: '12px', fontSize: '16px', color: '#2c3e50' }}>
          🔗 Prometheus 자동 등록 (선택)
        </h3>
        
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRegisterPrometheus}
            onChange={(e) => setAutoRegisterPrometheus(e.target.checked)}
            style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>
            Node Exporter 설치 후 Prometheus에 자동 등록
          </span>
        </label>

        {autoRegisterPrometheus && (
          <div style={{ marginLeft: '26px', marginTop: '12px' }}>
            <label className="label">Prometheus Job 이름 (선택)</label>
            <input
              type="text"
              className="input"
              value={prometheusJobName}
              onChange={(e) => setPrometheusJobName(e.target.value)}
              placeholder="비워두면 자동 생성 (예: node-exporter-230 또는 node-exporter-10.255.48)"
              style={{ marginBottom: '10px' }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
              💡 여러 서버를 설치할 경우, Job 이름을 지정하면 하나의 Job으로 그룹화됩니다.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label className="label">Service Label (선택)</label>
                <input
                  type="text"
                  className="input"
                  value={prometheusServiceLabel}
                  onChange={(e) => setPrometheusServiceLabel(e.target.value)}
                  placeholder="예: web-server"
                />
              </div>
              <div>
                <label className="label">Environment Label</label>
                <input
                  type="text"
                  className="input"
                  value={prometheusEnvironmentLabel}
                  onChange={(e) => setPrometheusEnvironmentLabel(e.target.value)}
                  placeholder="예: production"
                />
              </div>
            </div>

            {servers.length > 1 && (
              <label style={{ display: 'flex', alignItems: 'center', marginTop: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={groupByJob}
                  onChange={(e) => setGroupByJob(e.target.checked)}
                  style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px' }}>
                  여러 서버를 하나의 Job으로 그룹화
                </span>
              </label>
            )}
          </div>
        )}
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

