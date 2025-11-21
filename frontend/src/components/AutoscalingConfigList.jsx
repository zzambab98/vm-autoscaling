import { useState, useEffect } from 'react';
import { autoscalingApi } from '../services/autoscalingApi';

function AutoscalingConfigList({ onEdit, onView }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterEnabled, setFilterEnabled] = useState(null);

  useEffect(() => {
    loadConfigs();
  }, [filterEnabled]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (filterEnabled !== null) filters.enabled = filterEnabled;
      const result = await autoscalingApi.getConfigs(filters);
      if (result.success) {
        setConfigs(result.configs || []);
      }
    } catch (error) {
      setMessage({ type: 'error', text: `설정 목록 조회 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (configId, currentEnabled) => {
    setLoading(true);
    setMessage(null);

    try {
      if (currentEnabled) {
        await autoscalingApi.disableConfig(configId);
      } else {
        await autoscalingApi.enableConfig(configId);
      }
      setMessage({ type: 'success', text: `설정이 ${currentEnabled ? '비활성화' : '활성화'}되었습니다.` });
      await loadConfigs();
    } catch (error) {
      setMessage({ type: 'error', text: `설정 상태 변경 실패: ${error.message}` });
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
        setMessage({ type: 'success', text: result.message });
        setDeleteConfirm(null);
        await loadConfigs();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `설정 삭제 실패: ${error.message}` });
    } finally {
      setLoading(false);
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            className="input"
            value={filterEnabled === null ? 'all' : filterEnabled.toString()}
            onChange={(e) => {
              const value = e.target.value;
              setFilterEnabled(value === 'all' ? null : value === 'true');
            }}
            style={{ width: '150px' }}
          >
            <option value="all">전체</option>
            <option value="true">활성화</option>
            <option value="false">비활성화</option>
          </select>
          <button className="button" onClick={loadConfigs} disabled={loading}>
            새로고침
          </button>
        </div>
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
        <table className="table">
          <thead>
            <tr>
              <th>서비스 이름</th>
              <th>템플릿</th>
              <th>상태</th>
              <th>최소/최대 VM</th>
              <th>F5 Pool</th>
              <th>생성일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(config => (
              <tr key={config.id}>
                <td>
                  <strong>{config.serviceName}</strong>
                </td>
                <td>{config.templateId || '-'}</td>
                <td>
                  <span className={`status-badge ${
                    config.enabled ? 'status-success' : 'status-warning'
                  }`}>
                    {config.enabled ? '활성화' : '비활성화'}
                  </span>
                </td>
                <td>
                  {config.scaling?.minVms || '-'} / {config.scaling?.maxVms || '-'}
                </td>
                <td>{config.f5?.poolName || '-'}</td>
                <td>
                  {config.createdAt 
                    ? new Date(config.createdAt).toLocaleString('ko-KR')
                    : '-'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {onView && (
                      <button
                        className="button"
                        onClick={() => onView(config.id)}
                        disabled={loading}
                      >
                        상세
                      </button>
                    )}
                    {onEdit && (
                      <button
                        className="button"
                        onClick={() => onEdit(config.id)}
                        disabled={loading}
                      >
                        수정
                      </button>
                    )}
                    <button
                      className={`button ${config.enabled ? 'button-danger' : 'button-success'}`}
                      onClick={() => handleToggleEnabled(config.id, config.enabled)}
                      disabled={loading}
                    >
                      {config.enabled ? '비활성화' : '활성화'}
                    </button>
                    {deleteConfirm?.id === config.id ? (
                      <>
                        <button
                          className="button button-danger"
                          onClick={() => handleDelete(config.id, config.serviceName)}
                        >
                          확인
                        </button>
                        <button
                          className="button"
                          onClick={cancelDelete}
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <button
                        className="button button-danger"
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

