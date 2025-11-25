import { useState, useEffect } from 'react';
import { autoscalingApi } from '../services/autoscalingApi';
import { templateApi } from '../services/templateApi';
import f5Api from '../services/f5Api';

function AutoscalingConfigForm({ configId, onSuccess, onCancel }) {
  const [templates, setTemplates] = useState([]);
  const [f5Pools, setF5Pools] = useState([]);
  const [f5Vips, setF5Vips] = useState([]);
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
    loadF5Data();
    // configId가 있고 'new'가 아닐 때만 설정 조회
    if (configId && configId !== 'new') {
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

  const loadF5Data = async () => {
    try {
      // F5 Pool 목록 조회
      const poolsResult = await f5Api.getPools();
      if (poolsResult && poolsResult.success) {
        setF5Pools(poolsResult.pools || []);
      } else {
        console.warn('F5 Pool 목록 조회 실패:', poolsResult?.error || '알 수 없는 오류');
        setF5Pools([]);
      }
      
      // F5 VIP 목록 조회
      const vipsResult = await f5Api.getVips();
      if (vipsResult && vipsResult.success) {
        setF5Vips(vipsResult.vips || []);
      } else {
        console.warn('F5 VIP 목록 조회 실패:', vipsResult?.error || '알 수 없는 오류');
        setF5Vips([]);
      }
    } catch (error) {
      console.error('F5 데이터 조회 실패:', error);
      setF5Pools([]);
      setF5Vips([]);
    }
  };

  const loadConfig = async () => {
    // configId가 없거나 'new'이면 조회하지 않음 (새 설정 생성)
    if (!configId || configId === 'new') {
      return;
    }
    
    setLoading(true);
    setMessage(null); // 이전 메시지 초기화
    try {
      const result = await autoscalingApi.getConfigById(configId);
      if (result.success && result.config) {
        setFormData(result.config);
      } else {
        setMessage({ type: 'error', text: '설정을 찾을 수 없습니다.' });
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
      // configId가 있고 'new'가 아닐 때만 수정, 그 외에는 생성
      if (configId && configId !== 'new') {
        result = await autoscalingApi.updateConfig(configId, formData);
      } else {
        result = await autoscalingApi.createConfig(formData);
      }

      if (result.success) {
        const isUpdate = configId && configId !== 'new';
        setMessage({ type: 'success', text: `설정이 ${isUpdate ? '수정' : '생성'}되었습니다.` });
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1000);
        }
      }
    } catch (error) {
      const isUpdate = configId && configId !== 'new';
      setMessage({ type: 'error', text: `설정 ${isUpdate ? '수정' : '생성'} 실패: ${error.message}` });
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
      <h2>{configId && configId !== 'new' ? '오토스케일링 설정 수정' : '오토스케일링 설정 생성'}</h2>

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
        {f5Pools.length > 0 ? (
          <select
            className="input"
            value={formData.f5.poolName}
            onChange={(e) => updateNestedField('f5', 'poolName', e.target.value)}
            required
          >
            <option value="">Pool 선택</option>
            {f5Pools.map(pool => (
              <option key={pool.name} value={pool.name}>
                {pool.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              type="text"
              className="input"
              value={formData.f5.poolName}
              onChange={(e) => updateNestedField('f5', 'poolName', e.target.value)}
              placeholder="F5 Pool 목록을 불러올 수 없습니다. F5 서버 정보를 확인하세요 (예: auto-vm-test-pool)"
              required
            />
            <p style={{ fontSize: '12px', color: '#e74c3c', marginTop: '5px' }}>
              ⚠️ F5 API 연결 실패. 환경 변수(F5_SERVERS, F5_USER, F5_PASSWORD)를 확인하세요.
            </p>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
          <div>
            <label className="label">VIP 주소 *</label>
            {f5Vips.length > 0 ? (
              <select
                className="input"
                value={f5Vips.find(vip => vip.ip === formData.f5.vip && parseInt(vip.port) === formData.f5.vipPort)?.displayName || ''}
                onChange={(e) => {
                  const selectedVip = f5Vips.find(vip => vip.displayName === e.target.value);
                  if (selectedVip) {
                    updateNestedField('f5', 'vip', selectedVip.ip);
                    updateNestedField('f5', 'vipPort', parseInt(selectedVip.port));
                  }
                }}
                required
              >
                <option value="">VIP 선택</option>
                {f5Vips.map(vip => (
                  <option key={vip.name} value={vip.displayName}>
                    {vip.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  type="text"
                  className="input"
                  value={formData.f5.vip}
                  onChange={(e) => updateNestedField('f5', 'vip', e.target.value)}
                  placeholder="F5 VIP 목록을 불러올 수 없습니다. F5 서버 정보를 확인하세요 (예: 10.255.48.229)"
                  required
                />
                <p style={{ fontSize: '12px', color: '#e74c3c', marginTop: '5px' }}>
                  ⚠️ F5 API 연결 실패. 환경 변수(F5_SERVERS, F5_USER, F5_PASSWORD)를 확인하세요.
                </p>
              </>
            )}
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
            {loading ? '저장 중...' : (configId && configId !== 'new' ? '수정' : '저장')}
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


