import { useState, useEffect } from 'react';
import { autoscalingApi } from '../services/autoscalingApi';
import { templateApi } from '../services/templateApi';
import f5Api from '../services/f5Api';
import { prometheusApi } from '../services/api';

function AutoscalingConfigForm({ configId, onSuccess, onCancel }) {
  const [templates, setTemplates] = useState([]);
  const [f5Pools, setF5Pools] = useState([]);
  const [f5Vips, setF5Vips] = useState([]);
  const [f5Error, setF5Error] = useState(null);
  const [prometheusJobs, setPrometheusJobs] = useState([]);
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
    },
    vcenter: {
      resourcePool: '/Datacenter/host/Cluster-01/Resources',
      datastore: 'OS-Datastore-Power-Store'
    }
  });

  useEffect(() => {
    loadTemplates();
    loadF5Data();
    loadPrometheusJobs();
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

  const loadPrometheusJobs = async () => {
    try {
      const result = await prometheusApi.getJobs();
      if (result.success) {
        // 시스템 Job 제외 (prometheus, alertmanager, loki)
        const systemJobs = ['prometheus', 'alertmanager', 'loki'];
        const filteredJobs = result.jobs.filter(job => !systemJobs.includes(job.jobName));
        setPrometheusJobs(filteredJobs);
      }
    } catch (error) {
      console.error('Prometheus Job 목록 조회 실패:', error);
      setPrometheusJobs([]);
    }
  };

  const loadF5Data = async () => {
    setF5Error(null);
    console.log('[AutoscalingConfigForm] F5 데이터 조회 시작...');
    try {
      // F5 Pool 목록 조회
      console.log('[AutoscalingConfigForm] F5 Pool 목록 조회 중...');
      const poolsResult = await f5Api.getPools();
      console.log('[AutoscalingConfigForm] F5 Pool 목록 조회 결과:', poolsResult);
      if (poolsResult && poolsResult.success) {
        setF5Pools(poolsResult.pools || []);
        console.log('[AutoscalingConfigForm] F5 Pool 목록 설정 완료:', poolsResult.pools?.length || 0, '개');
      } else {
        const errorMsg = poolsResult?.error || '알 수 없는 오류';
        console.warn('[AutoscalingConfigForm] F5 Pool 목록 조회 실패:', errorMsg);
        setF5Pools([]);
        setF5Error(poolsResult?.error || 'F5 API 연결 실패. 환경 변수(F5_SERVERS, F5_USER, F5_PASSWORD)를 확인하세요.');
      }
      
      // F5 VIP 목록 조회
      console.log('[AutoscalingConfigForm] F5 VIP 목록 조회 중...');
      const vipsResult = await f5Api.getVips();
      console.log('[AutoscalingConfigForm] F5 VIP 목록 조회 결과:', vipsResult);
      if (vipsResult && vipsResult.success) {
        setF5Vips(vipsResult.vips || []);
        console.log('[AutoscalingConfigForm] F5 VIP 목록 설정 완료:', vipsResult.vips?.length || 0, '개');
      } else {
        const errorMsg = vipsResult?.error || '알 수 없는 오류';
        console.warn('[AutoscalingConfigForm] F5 VIP 목록 조회 실패:', errorMsg);
        setF5Vips([]);
        if (!f5Error) {
          setF5Error(vipsResult?.error || 'F5 API 연결 실패. 환경 변수(F5_SERVERS, F5_USER, F5_PASSWORD)를 확인하세요.');
        }
      }
    } catch (error) {
      console.error('[AutoscalingConfigForm] F5 데이터 조회 실패 (catch):', error);
      console.error('[AutoscalingConfigForm] Error details:', {
        message: error.message,
        stack: error.stack
      });
      setF5Pools([]);
      setF5Vips([]);
      setF5Error(error.message || 'F5 API 연결 실패. 환경 변수(F5_SERVERS, F5_USER, F5_PASSWORD)를 확인하세요.');
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
        const config = result.config;
        // vCenter 설정이 없으면 기본값 설정
        if (!config.vcenter) {
          config.vcenter = {
            resourcePool: '/Datacenter/host/Cluster-01/Resources',
            datastore: 'OS-Datastore-Power-Store'
          };
        }
        setFormData(config);
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
        {prometheusJobs.length > 0 ? (
          <select
            className="input"
            value={formData.monitoring.prometheusJobName}
            onChange={(e) => updateNestedField('monitoring', 'prometheusJobName', e.target.value)}
            required
          >
            <option value="">Job 선택 (PLG Stack 모니터링 등록에서 등록한 Job)</option>
            {prometheusJobs.map(job => (
              <option key={job.jobName} value={job.jobName}>
                {job.jobName} ({job.targets?.length || 0}개 target)
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="input"
            value={formData.monitoring.prometheusJobName}
            onChange={(e) => updateNestedField('monitoring', 'prometheusJobName', e.target.value)}
            placeholder="PLG Stack 모니터링 등록에서 등록한 Job 이름을 정확히 입력하세요 (예: auto-vm-test-service-job)"
            required
          />
        )}
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: '12px' }}>
          ⚠️ 중요: PLG Stack 모니터링 등록 메뉴에서 등록한 Job 이름과 정확히 일치해야 합니다.
        </div>

        {/* 스케일아웃 조건 설명 */}
        {formData.monitoring.prometheusJobName && (() => {
          const selectedJob = prometheusJobs.find(job => job.jobName === formData.monitoring.prometheusJobName);
          const targetCount = selectedJob?.targets?.length || 0;
          return (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              fontSize: '13px',
              lineHeight: '1.6'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '12px', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>📊</span>
                <span>스케일아웃 조건</span>
              </div>
              <div style={{ color: '#495057', marginBottom: '8px' }}>
                <strong>현재 Job:</strong> {formData.monitoring.prometheusJobName} ({targetCount}개 서버)
              </div>
              <div style={{ color: '#495057', marginBottom: '8px' }}>
                <strong>스케일아웃 조건:</strong>
              </div>
              <ul style={{ margin: '8px 0', paddingLeft: '20px', color: '#495057' }}>
                <li style={{ marginBottom: '6px' }}>
                  <strong>CPU 사용률:</strong> {targetCount > 1 
                    ? `${targetCount}개 서버 중 <span style="color: #dc3545; font-weight: 600;">한 대라도</span> CPU 사용률이 <strong>${formData.monitoring.cpuThreshold}%</strong>를 초과하면`
                    : `CPU 사용률이 <strong>${formData.monitoring.cpuThreshold}%</strong>를 초과하면`}
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Memory 사용률:</strong> {targetCount > 1 
                    ? `${targetCount}개 서버 중 <span style="color: #dc3545; font-weight: 600;">한 대라도</span> Memory 사용률이 <strong>${formData.monitoring.memoryThreshold}%</strong>를 초과하면`
                    : `Memory 사용률이 <strong>${formData.monitoring.memoryThreshold}%</strong>를 초과하면`}
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>지속 시간:</strong> 위 조건이 <strong>{formData.monitoring.duration}분</strong> 이상 지속되면
                </li>
              </ul>
              <div style={{ 
                marginTop: '12px', 
                padding: '10px', 
                backgroundColor: '#fff3cd', 
                border: '1px solid #ffc107', 
                borderRadius: '4px',
                color: '#856404',
                fontSize: '12px'
              }}>
                <strong>💡 참고:</strong> {targetCount > 1 
                  ? `여러 서버가 등록된 경우, <strong>모든 서버의 평균값이 아닌</strong> 각 서버별로 계산하여 <strong>가장 높은 값(최대값)</strong>이 임계치를 넘으면 스케일아웃이 발생합니다. 즉, 한 대라도 임계치를 넘으면 스케일아웃됩니다.`
                  : `단일 서버의 CPU 또는 Memory 사용률이 임계치를 넘으면 스케일아웃이 발생합니다.`}
              </div>
            </div>
          );
        })()}

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
        {f5Error && (
          <div style={{ 
            padding: '12px', 
            marginBottom: '16px', 
            backgroundColor: '#fff3cd', 
            border: '1px solid #ffc107', 
            borderRadius: '4px',
            color: '#856404',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ color: '#dc3545', fontWeight: '500' }}>{f5Error}</span>
          </div>
        )}
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
          <input
            type="text"
            className="input"
            value={formData.f5.poolName}
            onChange={(e) => updateNestedField('f5', 'poolName', e.target.value)}
            placeholder="F5 Pool 목록을 불러올 수 없습니다. F5 서버 정보를 확인하세요 (예: auto-vm-test-pool)"
            required
          />
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
              <input
                type="text"
                className="input"
                value={formData.f5.vip}
                onChange={(e) => updateNestedField('f5', 'vip', e.target.value)}
                placeholder="F5 VIP 목록을 불러올 수 없습니다. F5 서버 정보를 확인하세요 (예: 10.255.48.229)"
                required
              />
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

        {/* vCenter 설정 */}
        <h3 style={{ marginTop: '30px', marginBottom: '12px', color: '#2c3e50' }}>vCenter 설정</h3>
        <label className="label">Resource Pool *</label>
        <input
          type="text"
          className="input"
          value={formData.vcenter.resourcePool}
          onChange={(e) => updateNestedField('vcenter', 'resourcePool', e.target.value)}
          placeholder="예: /Datacenter/host/Cluster-01/Resources"
          required
        />
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: '12px' }}>
          vCenter 리소스 풀 경로를 입력하세요. (예: /Datacenter/host/Cluster-01/Resources)
        </div>

        <label className="label">Datastore *</label>
        <input
          type="text"
          className="input"
          value={formData.vcenter.datastore}
          onChange={(e) => updateNestedField('vcenter', 'datastore', e.target.value)}
          placeholder="예: OS-Datastore-Power-Store"
          required
        />
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: '12px' }}>
          vCenter 데이터스토어 이름을 입력하세요.
        </div>

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


