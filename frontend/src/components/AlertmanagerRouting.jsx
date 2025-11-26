import { useState, useEffect } from 'react';
import { alertmanagerApi } from '../services/api';

function AlertmanagerRouting() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    serviceName: '',
    receiver: '',
    webhookUrl: '',
    webhookToken: ''
  });

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const result = await alertmanagerApi.getRoutes();
      if (result.success) {
        setRoutes(result.routes || []);
      }
    } catch (error) {
      console.error('라우팅 규칙 조회 실패:', error);
      setMessage({ type: 'error', text: `라우팅 규칙 조회 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const addRoute = async () => {
    if (!formData.serviceName || !formData.webhookUrl) {
      setMessage({ type: 'error', text: '서비스 이름과 Webhook URL은 필수입니다.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await alertmanagerApi.addRoute({
        serviceName: formData.serviceName,
        receiver: formData.receiver || `jenkins-webhook-${formData.serviceName}`,
        webhookUrl: formData.webhookUrl,
        webhookToken: formData.webhookToken || `autoscale-${formData.serviceName.toLowerCase().replace(/\s+/g, '-')}-token`
      });

      if (result.success) {
        setMessage({ type: 'success', text: '라우팅 규칙이 추가되었습니다.' });
        setFormData({ serviceName: '', receiver: '', webhookUrl: '', webhookToken: '' });
        await loadRoutes();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `라우팅 규칙 추가 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const deleteRoute = async (serviceName) => {
    if (!confirm(`정말로 라우팅 규칙 '${serviceName}'을 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await alertmanagerApi.deleteRoute(serviceName);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        await loadRoutes();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `라우팅 규칙 삭제 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Alertmanager 라우팅 규칙 관리</h2>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      {/* 라우팅 규칙 추가 폼 */}
      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>새 라우팅 규칙 추가</h3>
        
        <label className="label">서비스 이름 *</label>
        <input
          type="text"
          className="input"
          value={formData.serviceName}
          onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
          placeholder="예: auto-vm-test-service"
          required
        />

        <label className="label">Receiver 이름 (선택)</label>
        <input
          type="text"
          className="input"
          value={formData.receiver}
          onChange={(e) => setFormData({ ...formData, receiver: e.target.value })}
          placeholder="자동 생성: jenkins-webhook-{서비스이름}"
        />

        <label className="label">Jenkins Webhook URL *</label>
        <input
          type="text"
          className="input"
          value={formData.webhookUrl}
          onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
          placeholder="예: http://10.255.0.103:8080/generic-webhook-trigger/invoke?token=plg-autoscale-token"
          required
        />

        <label className="label">Webhook 토큰 (선택)</label>
        <input
          type="text"
          className="input"
          value={formData.webhookToken}
          onChange={(e) => setFormData({ ...formData, webhookToken: e.target.value })}
          placeholder="자동 생성: autoscale-{서비스이름}-token"
        />

        <div style={{ marginTop: '15px' }}>
          <button
            className="button button-success"
            onClick={addRoute}
            disabled={loading}
          >
            {loading ? '등록 중...' : '라우팅 규칙 추가'}
          </button>
          <button
            className="button"
            onClick={loadRoutes}
            disabled={loading}
            style={{ marginLeft: '10px' }}
          >
            목록 새로고침
          </button>
        </div>
      </div>

      {/* 등록된 라우팅 규칙 목록 */}
      {routes.length > 0 && (
        <div>
          <h3>등록된 라우팅 규칙</h3>
          <table className="table">
            <thead>
              <tr>
                <th>서비스 이름</th>
                <th>Receiver</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route, index) => (
                <tr key={index}>
                  <td>{route.service}</td>
                  <td>{route.receiver}</td>
                  <td>
                    <button
                      className="button button-danger"
                      onClick={() => deleteRoute(route.service)}
                      disabled={loading}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {routes.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
          등록된 라우팅 규칙이 없습니다.
        </div>
      )}
    </div>
  );
}

export default AlertmanagerRouting;

