import { useState, useEffect } from 'react';
import { autoscalingApi } from '../services/autoscalingApi';
import { templateApi } from '../services/templateApi';

function AutoscalingConfigForm({ configId, onSuccess, onCancel }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    serviceName: '',
    templateId: '',
    enabled: false,
    monitoring: {
      cpuThreshold: 80,
      memoryThreshold: 80,
      duration: 5,
      prometheusJobName: ''
    },
    scaling: {
      minVms: 2,
      maxVms: 10,
      scaleOutStep: 1,
      scaleInStep: 1,
      cooldownPeriod: 300
    },
    f5: {
      poolName: '',
      vip: '',
      vipPort: 80,
      healthCheckPath: '/'
    },
    network: {
      ipPoolStart: '',
      ipPoolEnd: '',
      subnet: '255.255.255.0',
      gateway: '',
      vlan: ''
    }
  });

  useEffect(() => {
    loadTemplates();
    if (configId) {
      loadConfig();
    }
  }, [configId]);

  const loadTemplates = async () => {
    try {
      const result = await templateApi.getTemplates();
      if (result.success) {
        setTemplates(result.templates || []);
      }
    } catch (error) {
      console.error('템플릿 목록 조회 실패:', error);
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const result = await autoscalingApi.getConfigById(configId);
      if (result.success && result.config) {
        setFormData(result.config);
      }
    } catch (error) {
      setMessage({ type: 'error', text: `설정 조회 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      let result;
      if (configId) {
        result = await autoscalingApi.updateConfig(configId, formData);
      } else {
        result = await autoscalingApi.createConfig(formData);
      }

      if (result.success) {
        setMessage({ type: 'success', text: `설정이 ${configId ? '수정' : '생성'}되었습니다.` });
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1000);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: `설정 ${configId ? '수정' : '생성'} 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const updateNestedField = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  return (
    <div className="card">
      <h2>{configId ? '오토스케일링 설정 수정' : '오토스케일링 설정 생성'}</h2>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 기본 정보 */}
        <h3 style={{ marginTop: '20px', marginBottom: '12px', color: '#2c3e50' }}>기본 정보</h3>
        <label className="label">서비스 이름 *</label>
        <input
          type="text"
          className="input"
          value={formData.serviceName}
          onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
          placeholder="예: auto-vm-test-service"
          required
        />

        <label className="label">템플릿 선택 *</label>
        <select
          className="input"
          value={formData.templateId}
          onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
          required
        >
          <option value="">템플릿 선택</option>
          {templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>

        {/* 모니터링 설정 */}
        <h3 style={{ marginTop: '30px', marginBottom: '12px', color: '#2c3e50' }}>모니터링 설정</h3>
        <label className="label">CPU 임계값 (%) *</label>
        <input
          type="number"
          className="input"
          value={formData.monitoring.cpuThreshold}
          onChange={(e) => updateNestedField('monitoring', 'cpuThreshold', parseInt(e.target.value))}
          min="0"
          max="100"
          required
        />

        <label className="label">Memory 임계값 (%) *</label>
        <input
          type="number"
          className="input"
          value={formData.monitoring.memoryThreshold}
          onChange={(e) => updateNestedField('monitoring', 'memoryThreshold', parseInt(e.target.value))}
          min="0"
          max="100"
          required
        />

        <label className="label">지속 시간 (분) *</label>
        <input
          type="number"
          className="input"
          value={formData.monitoring.duration}
          onChange={(e) => updateNestedField('monitoring', 'duration', parseInt(e.target.value))}
          min="1"
          required
        />

        <label className="label">Prometheus Job 이름 *</label>
        <input
          type="text"
          className="input"
          value={formData.monitoring.prometheusJobName}
          onChange={(e) => updateNestedField('monitoring', 'prometheusJobName', e.target.value)}
          placeholder="예: auto-vm-test-service"
          required
        />

        {/* 스케일링 설정 */}
        <h3 style={{ marginTop: '30px', marginBottom: '12px', color: '#2c3e50' }}>스케일링 설정</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label className="label">최소 VM 수 *</label>
            <input
              type="number"
              className="input"
              value={formData.scaling.minVms}
              onChange={(e) => updateNestedField('scaling', 'minVms', parseInt(e.target.value))}
              min="1"
              required
            />
          </div>
          <div>
            <label className="label">최대 VM 수 *</label>
            <input
              type="number"
              className="input"
              value={formData.scaling.maxVms}
              onChange={(e) => updateNestedField('scaling', 'maxVms', parseInt(e.target.value))}
              min="1"
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label className="label">Scale Out Step</label>
            <input
              type="number"
              className="input"
              value={formData.scaling.scaleOutStep}
              onChange={(e) => updateNestedField('scaling', 'scaleOutStep', parseInt(e.target.value))}
              min="1"
            />
          </div>
          <div>
            <label className="label">Scale In Step</label>
            <input
              type="number"
              className="input"
              value={formData.scaling.scaleInStep}
              onChange={(e) => updateNestedField('scaling', 'scaleInStep', parseInt(e.target.value))}
              min="1"
            />
          </div>
        </div>

        <label className="label">Cooldown Period (초)</label>
        <input
          type="number"
          className="input"
          value={formData.scaling.cooldownPeriod}
          onChange={(e) => updateNestedField('scaling', 'cooldownPeriod', parseInt(e.target.value))}
          min="60"
        />

        {/* F5 설정 */}
        <h3 style={{ marginTop: '30px', marginBottom: '12px', color: '#2c3e50' }}>F5 설정</h3>
        <label className="label">Pool 이름 *</label>
        <input
          type="text"
          className="input"
          value={formData.f5.poolName}
          onChange={(e) => updateNestedField('f5', 'poolName', e.target.value)}
          placeholder="예: auto-vm-test-pool"
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
          <div>
            <label className="label">VIP 주소 *</label>
            <input
              type="text"
              className="input"
              value={formData.f5.vip}
              onChange={(e) => updateNestedField('f5', 'vip', e.target.value)}
              placeholder="예: 10.255.48.229"
              required
            />
          </div>
          <div>
            <label className="label">VIP 포트 *</label>
            <input
              type="number"
              className="input"
              value={formData.f5.vipPort}
              onChange={(e) => updateNestedField('f5', 'vipPort', parseInt(e.target.value))}
              min="1"
              max="65535"
              required
            />
          </div>
        </div>

        <label className="label">Health Check 경로</label>
        <input
          type="text"
          className="input"
          value={formData.f5.healthCheckPath}
          onChange={(e) => updateNestedField('f5', 'healthCheckPath', e.target.value)}
          placeholder="예: /health"
        />

        {/* 네트워크 설정 */}
        <h3 style={{ marginTop: '30px', marginBottom: '12px', color: '#2c3e50' }}>네트워크 설정</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label className="label">IP Pool 시작 주소 *</label>
            <input
              type="text"
              className="input"
              value={formData.network.ipPoolStart}
              onChange={(e) => updateNestedField('network', 'ipPoolStart', e.target.value)}
              placeholder="예: 10.255.48.220"
              required
            />
          </div>
          <div>
            <label className="label">IP Pool 종료 주소 *</label>
            <input
              type="text"
              className="input"
              value={formData.network.ipPoolEnd}
              onChange={(e) => updateNestedField('network', 'ipPoolEnd', e.target.value)}
              placeholder="예: 10.255.48.225"
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label className="label">서브넷</label>
            <input
              type="text"
              className="input"
              value={formData.network.subnet}
              onChange={(e) => updateNestedField('network', 'subnet', e.target.value)}
              placeholder="예: 255.255.255.0"
            />
          </div>
          <div>
            <label className="label">게이트웨이</label>
            <input
              type="text"
              className="input"
              value={formData.network.gateway}
              onChange={(e) => updateNestedField('network', 'gateway', e.target.value)}
              placeholder="예: 10.255.48.1"
            />
          </div>
          <div>
            <label className="label">VLAN</label>
            <input
              type="text"
              className="input"
              value={formData.network.vlan}
              onChange={(e) => updateNestedField('network', 'vlan', e.target.value)}
              placeholder="예: vlan_1048"
            />
          </div>
        </div>

        <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            className="button button-success"
            disabled={loading}
          >
            {loading ? '저장 중...' : (configId ? '수정' : '생성')}
          </button>
          {onCancel && (
            <button
              type="button"
              className="button"
              onClick={onCancel}
              disabled={loading}
            >
              취소
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default AutoscalingConfigForm;


