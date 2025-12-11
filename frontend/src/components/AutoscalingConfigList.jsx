import { useState, useEffect } from 'react';
import { autoscalingApi } from '../services/autoscalingApi';

function AutoscalingConfigList({ onEdit, onView }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [togglingConfigs, setTogglingConfigs] = useState(new Set());
  const [message, setMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async (preserveOnError = false) => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await autoscalingApi.getConfigs();
      if (result && result.success) {
        setConfigs(result.configs || []);
      } else {
        if (!preserveOnError) {
        setConfigs([]);
        }
        setMessage({ type: 'error', text: '설정 목록을 불러올 수 없습니다.' });
      }
    } catch (error) {
      console.error('설정 목록 조회 실패:', error);
      if (!preserveOnError) {
      setConfigs([]);
      }
      setMessage({ type: 'error', text: `설정 목록 조회 실패: ${error.message || '알 수 없는 오류'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (configId, serviceName) => {
    if (!deleteConfirm || deleteConfirm.id !== configId) {
      setDeleteConfirm({ id: configId, name: serviceName });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await autoscalingApi.deleteConfig(configId);
      if (result.success) {
        setMessage({ type: 'success', text: result.message || '설정이 삭제되었습니다.' });
        setDeleteConfirm(null);
        await loadConfigs();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `설정 삭제 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (configId, currentEnabled) => {
    // 이미 처리 중이면 무시
    if (togglingConfigs.has(configId)) {
      return;
    }

    // Optimistic update: 로컬 상태를 먼저 업데이트
    const newEnabled = !currentEnabled;
    setConfigs(prevConfigs => 
      prevConfigs.map(config => 
        config.id === configId ? { ...config, enabled: newEnabled } : config
      )
    );

    // 개별 버튼 로딩 상태 설정
    setTogglingConfigs(prev => new Set(prev).add(configId));
    setMessage(null);

    try {
      const result = currentEnabled 
        ? await autoscalingApi.disableConfig(configId)
        : await autoscalingApi.enableConfig(configId);
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `설정이 ${currentEnabled ? '비활성화' : '활성화'}되었습니다.` 
        });
        // 백그라운드에서 목록 갱신 (실패해도 기존 목록 유지)
        loadConfigs(true).catch(err => {
          console.error('목록 갱신 실패 (기존 목록 유지):', err);
        });
      } else {
        // 실패 시 원래 상태로 복원
        setConfigs(prevConfigs => 
          prevConfigs.map(config => 
            config.id === configId ? { ...config, enabled: currentEnabled } : config
          )
        );
        setMessage({ type: 'error', text: result.error || '설정 상태 변경 실패' });
      }
    } catch (error) {
      // 에러 발생 시 원래 상태로 복원
      setConfigs(prevConfigs => 
        prevConfigs.map(config => 
          config.id === configId ? { ...config, enabled: currentEnabled } : config
        )
      );
      setMessage({ type: 'error', text: `설정 상태 변경 실패: ${error.message}` });
    } finally {
      setTogglingConfigs(prev => {
        const next = new Set(prev);
        next.delete(configId);
        return next;
      });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (loading && configs.length === 0) {
    return <div className="loading">설정 목록을 불러오는 중...</div>;
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>오토스케일링 설정 목록</h2>
        <button className="button" onClick={loadConfigs} disabled={loading}>
          새로고침
        </button>
      </div>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      {configs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          등록된 설정이 없습니다.
        </div>
      ) : (
        <table className="table autoscaling-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '12%' }}>서비스 이름</th>
              <th style={{ width: '18%' }}>템플릿 ID</th>
              <th style={{ width: '7%' }}>상태</th>
              <th style={{ width: '9%' }}>CPU 임계값</th>
              <th style={{ width: '10%' }}>Memory 임계값</th>
              <th style={{ width: '9%' }}>VM 범위</th>
              <th style={{ width: '12%' }}>생성일</th>
              <th style={{ width: '23%' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(config => (
              <tr key={config.id}>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={config.serviceName}>
                  <strong>{config.serviceName}</strong>
                </td>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={config.templateId || '-'}>
                  {config.templateId || '-'}
                </td>
                <td>
                  <span 
                    style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: config.enabled ? '#d4edda' : '#f8d7da',
                      color: config.enabled ? '#155724' : '#721c24'
                    }}
                  >
                    {config.enabled ? '활성화' : '비활성화'}
                  </span>
                </td>
                <td>{config.monitoring?.cpuThreshold || '-'}%</td>
                <td>{config.monitoring?.memoryThreshold || '-'}%</td>
                <td>
                  {config.scaling?.minVms || '-'} ~ {config.scaling?.maxVms || '-'}
                </td>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={config.createdAt ? new Date(config.createdAt).toLocaleString('ko-KR') : '-'}>
                  {config.createdAt 
                    ? new Date(config.createdAt).toLocaleString('ko-KR')
                    : '-'}
                </td>
                <td className="actions-cell" style={{ overflow: 'visible', whiteSpace: 'normal' }}>
                  <div className="autoscaling-actions">
                    {onEdit && (
                      <button
                        className="button button-primary button-compact"
                        onClick={() => onEdit(config.id)}
                        disabled={loading}
                      >
                        수정
                      </button>
                    )}
                    <button
                      className={`button ${config.enabled ? 'button-warning' : 'button-success'} button-compact`}
                      onClick={() => handleToggleEnabled(config.id, config.enabled)}
                      disabled={loading || togglingConfigs.has(config.id)}
                    >
                      {togglingConfigs.has(config.id) ? '처리 중...' : (config.enabled ? '비활성화' : '활성화')}
                    </button>
                    {deleteConfirm?.id === config.id ? (
                      <>
                        <button
                          className="button button-danger button-compact"
                          onClick={() => handleDelete(config.id, config.serviceName)}
                        >
                          확인
                        </button>
                        <button
                          className="button button-compact"
                          onClick={cancelDelete}
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <button
                        className="button button-danger button-compact"
                        onClick={() => handleDelete(config.id, config.serviceName)}
                        disabled={loading}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AutoscalingConfigList;

