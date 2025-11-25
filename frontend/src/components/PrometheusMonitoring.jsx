import { useState, useEffect } from 'react';
import { prometheusApi } from '../services/api';

function PrometheusMonitoring() {
  const [jobName, setJobName] = useState('auto-vm-test-service');
  const [targets, setTargets] = useState([
    { ip: '10.255.48.230', port: '9100', enabled: true },
    { ip: '10.255.48.231', port: '9100', enabled: true }
  ]);
  const [labels, setLabels] = useState({
    instance: 'auto-vm-test-service',
    service: 'auto-vm-test',
    environment: 'test'
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [targetStatus, setTargetStatus] = useState(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const result = await prometheusApi.getJobs();
      if (result.success) {
        setJobs(result.jobs);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const addJob = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const targetList = targets
        .filter(t => t.enabled)
        .map(t => `${t.ip}:${t.port}`);

      if (targetList.length === 0) {
        setMessage({ type: 'error', text: '최소 하나의 Target을 선택해야 합니다.' });
        setLoading(false);
        return;
      }

      const result = await prometheusApi.addJob(jobName, targetList, labels);

      if (result.success) {
        setMessage({ type: 'success', text: 'Prometheus Job이 추가되었습니다.' });
        await loadJobs();
        // 잠시 후 Target 상태 확인
        setTimeout(() => checkTargetStatus(), 3000);
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Job 추가 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const checkTargetStatus = async () => {
    if (!jobName) return;

    try {
      const result = await prometheusApi.getTargets(jobName);
      if (result.success) {
        setTargetStatus(result);
      }
    } catch (error) {
      console.error('Failed to check target status:', error);
    }
  };

  const deleteJob = async (jobNameToDelete) => {
    if (!confirm(`정말로 Job '${jobNameToDelete}'을 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await prometheusApi.deleteJob(jobNameToDelete);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        await loadJobs();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Job 삭제 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const toggleTarget = (index) => {
    setTargets(prev => prev.map((t, i) => 
      i === index ? { ...t, enabled: !t.enabled } : t
    ));
  };

  const addTarget = () => {
    setTargets(prev => [...prev, { ip: '', port: '9100', enabled: true }]);
  };

  const removeTarget = (index) => {
    setTargets(prev => prev.filter((_, i) => i !== index));
  };

  const updateTarget = (index, field, value) => {
    setTargets(prev => prev.map((t, i) => 
      i === index ? { ...t, [field]: value } : t
    ));
  };

  return (
    <div className="card">
      <h2>PLG Stack 모니터링 등록</h2>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label className="label">Job 이름</label>
        <input
          type="text"
          className="input"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          placeholder="auto-vm-test-service"
        />

        <label className="label">Labels</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <input
              type="text"
              className="input"
              value={labels.instance}
              onChange={(e) => setLabels({ ...labels, instance: e.target.value })}
              placeholder="instance"
            />
          </div>
          <div>
            <input
              type="text"
              className="input"
              value={labels.service}
              onChange={(e) => setLabels({ ...labels, service: e.target.value })}
              placeholder="service"
            />
          </div>
        </div>
        <input
          type="text"
          className="input"
          value={labels.environment}
          onChange={(e) => setLabels({ ...labels, environment: e.target.value })}
          placeholder="environment"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label className="label" style={{ marginBottom: 0 }}>Targets (서버 목록)</label>
          <button className="button" onClick={addTarget}>추가</button>
        </div>
        
        {targets.map((target, index) => (
          <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={target.enabled}
              onChange={() => toggleTarget(index)}
            />
            <input
              type="text"
              className="input"
              value={target.ip}
              onChange={(e) => updateTarget(index, 'ip', e.target.value)}
              placeholder="IP 주소"
              style={{ flex: 1 }}
            />
            <input
              type="text"
              className="input"
              value={target.port}
              onChange={(e) => updateTarget(index, 'port', e.target.value)}
              placeholder="포트"
              style={{ width: '100px' }}
            />
            <button
              className="button button-danger"
              onClick={() => removeTarget(index)}
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          className="button button-success"
          onClick={addJob}
          disabled={loading}
        >
          {loading ? '등록 중...' : 'Prometheus Job 등록'}
        </button>
        <button
          className="button"
          onClick={checkTargetStatus}
          disabled={loading || !jobName}
          style={{ marginLeft: '10px' }}
        >
          Target 상태 확인
        </button>
        <button
          className="button"
          onClick={loadJobs}
          disabled={loading}
          style={{ marginLeft: '10px' }}
        >
          Job 목록 새로고침
        </button>
      </div>

      {targetStatus && targetStatus.targets && (
        <div style={{ marginTop: '20px' }}>
          <h3>Target 상태</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Health</th>
                <th>Last Error</th>
                <th>Last Scrape</th>
              </tr>
            </thead>
            <tbody>
              {targetStatus.targets.map((target, index) => (
                <tr key={index}>
                  <td>{target.instance}</td>
                  <td>
                    <span className={`status-badge ${
                      target.health === 'up' ? 'status-success' : 'status-error'
                    }`}>
                      {target.health}
                    </span>
                  </td>
                  <td>{target.lastError || '-'}</td>
                  <td>{target.lastScrape ? new Date(target.lastScrape).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {jobs.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>등록된 Job 목록</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Job 이름</th>
                <th>Targets</th>
                <th>Labels</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => (
                <tr key={index}>
                  <td>{job.jobName}</td>
                  <td>{job.targets.join(', ')}</td>
                  <td>{JSON.stringify(job.labels)}</td>
                  <td>
                    <button
                      className="button button-danger"
                      onClick={() => deleteJob(job.jobName)}
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
    </div>
  );
}

export default PrometheusMonitoring;


