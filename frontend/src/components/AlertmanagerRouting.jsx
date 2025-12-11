import { useEffect, useMemo, useState } from 'react';
import { alertmanagerApi } from '../services/api';

const DEFAULT_WEBHOOK_TOKEN = '11c729d250790bec23d77c6144053e7b03';
// Jenkins 서버는 고정 서버 (환경 변수로 오버라이드 가능)
const getDefaultWebhookUrl = () => {
  const jenkinsUrl = import.meta.env.VITE_JENKINS_URL || 'http://10.255.0.103:8080';  // Jenkins 서버
  return `${jenkinsUrl}/generic-webhook-trigger/invoke?token=${DEFAULT_WEBHOOK_TOKEN}`;
};

function AlertmanagerRouting() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    serviceName: '', // 기본값 제거 - 사용자가 입력하도록
    receiverName: '',
    webhookToken: DEFAULT_WEBHOOK_TOKEN,
    webhookUrl: getDefaultWebhookUrl(),
    useBackendWebhookProxy: false
  });

  const receiverPlaceholder = useMemo(() => {
    const name = formData.serviceName?.trim() || 'service';
    return `jenkins-webhook-${name.replace(/\s+/g, '-').toLowerCase()}`;
  }, [formData.serviceName]);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const result = await alertmanagerApi.getRoutes();
      if (result.success) {
        setRoutes(result.routes || []);
      }
    } catch (error) {
      setMessage({ type: 'error', text: `라우팅 목록 조회 실패: ${error.message}` });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.serviceName) {
      setMessage({ type: 'error', text: '서비스 이름을 입력하세요.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        serviceName: formData.serviceName.trim(),
        receiver: formData.receiverName?.trim() || receiverPlaceholder,
        webhookUrl: formData.webhookUrl?.trim() || undefined,
        webhookToken: formData.webhookToken?.trim() || undefined,
        jenkins: {
          useBackendWebhookProxy: formData.useBackendWebhookProxy,
          webhookUrl: formData.webhookUrl?.trim(),
          webhookToken: formData.webhookToken?.trim()
        }
      };

      const result = await alertmanagerApi.addRoute(payload);
      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Alertmanager 라우팅이 등록되었습니다.' });
        await loadRoutes();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `라우팅 등록 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (serviceName) => {
    if (!window.confirm(`'${serviceName}' 라우팅을 삭제할까요?`)) {
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
      setMessage({ type: 'error', text: `라우팅 삭제 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Alertmanager 라우팅</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
        Prometheus에서 service 라벨로 분류된 알람을 Jenkins 공통 파이프라인(plg-autoscale-out)으로 라우팅합니다.
        기본 Webhook URL/Token은 운영팀에서 제공한 값을 사용하며, 변경이 필요한 경우에만 수정하세요.
      </p>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label className="label">서비스 이름 *</label>
        <input
          type="text"
          className="input"
          value={formData.serviceName}
          onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
          placeholder="Prometheus 라벨 service 값과 동일"
          required
        />

        <label className="label">Receiver 이름 (선택)</label>
        <input
          type="text"
          className="input"
          value={formData.receiverName}
          onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
          placeholder={`${receiverPlaceholder} (자동 추천값)`}
        />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
          Alertmanager receivers[].name 값입니다. 비워두면 위 자동 이름이 사용됩니다.
        </p>

        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div>
            <label className="label">Jenkins Webhook Token</label>
            <input
              type="text"
              className="input"
              value={formData.webhookToken}
              onChange={(e) => setFormData({ ...formData, webhookToken: e.target.value })}
              placeholder={DEFAULT_WEBHOOK_TOKEN}
            />
          </div>
          <div>
            <label className="label">Jenkins Webhook URL</label>
            <input
              type="text"
              className="input"
              value={formData.webhookUrl}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
              placeholder={DEFAULT_WEBHOOK_URL}
            />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={formData.useBackendWebhookProxy}
            onChange={(e) => setFormData({ ...formData, useBackendWebhookProxy: e.target.checked })}
          />
          Backend Proxy 사용 (백엔드에서 Jenkins 호출)
        </label>

        <button className="button button-success" type="submit" disabled={loading}>
          {loading ? '등록 중...' : 'Alertmanager 라우팅 등록'}
        </button>
      </form>

      {routes.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 16 }}>등록된 라우팅</h3>
          <table className="table">
            <thead>
              <tr>
                <th>서비스</th>
                <th>수신자</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.service}>
                  <td>{route.service}</td>
                  <td>{route.receiver}</td>
                  <td>
                    <button
                      className="button button-danger button-small"
                      onClick={() => handleDelete(route.service)}
                      disabled={loading}
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
    </div>
  );
}

export default AlertmanagerRouting;

