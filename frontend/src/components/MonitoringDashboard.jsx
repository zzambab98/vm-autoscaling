import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getCpuUsage, getMemoryUsage, getCurrentCpuUsage, getCurrentMemoryUsage, getPrometheusAlerts } from '../services/monitoringApi';
import { getConfigs } from '../services/autoscalingApi';
import './MonitoringDashboard.css';

function MonitoringDashboard() {
  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [cpuData, setCpuData] = useState([]);
  const [memoryData, setMemoryData] = useState([]);
  const [currentCpu, setCurrentCpu] = useState(0);
  const [currentMemory, setCurrentMemory] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(60); // 분

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (selectedConfig) {
      loadMetrics();
      const interval = setInterval(() => {
        loadCurrentMetrics();
      }, 10000); // 10초마다 업데이트

      return () => clearInterval(interval);
    }
  }, [selectedConfig, duration]);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(() => {
      loadAlerts();
    }, 30000); // 30초마다 업데이트

    return () => clearInterval(interval);
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await getConfigs();
      if (response.success) {
        const enabledConfigs = response.configs.filter(c => c.enabled);
        setConfigs(enabledConfigs);
        if (enabledConfigs.length > 0 && !selectedConfig) {
          setSelectedConfig(enabledConfigs[0]);
        }
      }
    } catch (error) {
      console.error('설정 목록 로드 실패:', error);
    }
  };

  const loadMetrics = async () => {
    if (!selectedConfig || !selectedConfig.monitoring?.prometheusJobName) {
      return;
    }

    setLoading(true);
    try {
      const jobName = selectedConfig.monitoring.prometheusJobName;
      console.log('[MonitoringDashboard] 메트릭 로드 시작:', jobName, duration);
      const [cpu, memory] = await Promise.all([
        getCpuUsage(jobName, duration),
        getMemoryUsage(jobName, duration)
      ]);
      console.log('[MonitoringDashboard] CPU 데이터:', cpu.length, '개 포인트');
      console.log('[MonitoringDashboard] Memory 데이터:', memory.length, '개 포인트');
      if (cpu.length > 0) {
        console.log('[MonitoringDashboard] CPU 데이터 샘플:', cpu[0]);
        console.log('[MonitoringDashboard] CPU 데이터 키:', Object.keys(cpu[0] || {}));
      }
      setCpuData(cpu);
      setMemoryData(memory);
    } catch (error) {
      console.error('[MonitoringDashboard] 메트릭 로드 실패:', error);
      console.error('[MonitoringDashboard] 에러 상세:', error.message, error.stack);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentMetrics = async () => {
    if (!selectedConfig || !selectedConfig.monitoring?.prometheusJobName) {
      return;
    }

    try {
      const jobName = selectedConfig.monitoring.prometheusJobName;
      const [cpu, memory] = await Promise.all([
        getCurrentCpuUsage(jobName),
        getCurrentMemoryUsage(jobName)
      ]);
      setCurrentCpu(cpu);
      setCurrentMemory(memory);
    } catch (error) {
      console.error('현재 메트릭 로드 실패:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const alertsData = await getPrometheusAlerts();
      // 오토스케일링 관련 Alert만 필터링
      const autoscaleAlerts = alertsData.filter(alert => 
        alert.labels?.autoscaleConfigId || alert.labels?.service
      );
      setAlerts(autoscaleAlerts);
    } catch (error) {
      console.error('Alert 로드 실패:', error);
    }
  };

  const getAlertSeverity = (alert) => {
    return alert.labels?.severity || 'warning';
  };

  const getAlertStatus = (alert) => {
    return alert.state || 'unknown';
  };

  return (
    <div className="monitoring-dashboard">
      <div className="dashboard-header">
        <h2>모니터링 대시보드</h2>
        <div className="dashboard-controls">
          <select
            value={selectedConfig?.id || ''}
            onChange={(e) => {
              const config = configs.find(c => c.id === e.target.value);
              setSelectedConfig(config);
            }}
            style={{ marginRight: '10px', padding: '5px 10px' }}
          >
            <option value="">서비스 선택</option>
            {configs.map(config => (
              <option key={config.id} value={config.id}>
                {config.serviceName}
              </option>
            ))}
          </select>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ padding: '5px 10px' }}
          >
            <option value={15}>최근 15분</option>
            <option value={30}>최근 30분</option>
            <option value={60}>최근 1시간</option>
            <option value={180}>최근 3시간</option>
            <option value={360}>최근 6시간</option>
          </select>
        </div>
      </div>

      {selectedConfig && (
        <>
          <div className="metrics-summary">
            <div className="metric-card">
              <div className="metric-label">현재 CPU 사용률 (최대값)</div>
              <div className="metric-value" style={{ color: currentCpu > (selectedConfig.monitoring?.cpuThreshold || 80) ? '#e74c3c' : '#27ae60' }}>
                {currentCpu.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                모든 서버 중 최대값
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">현재 Memory 사용률 (최대값)</div>
              <div className="metric-value" style={{ color: currentMemory > (selectedConfig.monitoring?.memoryThreshold || 80) ? '#e74c3c' : '#27ae60' }}>
                {currentMemory.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                모든 서버 중 최대값
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">임계값 (CPU)</div>
              <div className="metric-value">
                {selectedConfig.monitoring?.cpuThreshold || 80}%
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">임계값 (Memory)</div>
              <div className="metric-value">
                {selectedConfig.monitoring?.memoryThreshold || 80}%
              </div>
            </div>
          </div>

          <div className="charts-container">
            <div className="chart-card">
              <h3>CPU 사용률</h3>
              {loading ? (
                <div className="loading">로딩 중...</div>
              ) : cpuData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={cpuData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} label={{ value: '사용률 (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    {Object.keys(cpuData[0] || {}).filter(key => key !== 'time').map((instance, index) => {
                      const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
                      return (
                        <Line
                          key={instance}
                          type="monotone"
                          dataKey={instance}
                          stroke={colors[index % colors.length]}
                          strokeWidth={2}
                          name={`${instance} CPU (%)`}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">데이터가 없습니다.</div>
              )}
            </div>

            <div className="chart-card">
              <h3>Memory 사용률</h3>
              {loading ? (
                <div className="loading">로딩 중...</div>
              ) : memoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={memoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} label={{ value: '사용률 (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    {Object.keys(memoryData[0] || {}).filter(key => key !== 'time').map((instance, index) => {
                      const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
                      return (
                        <Line
                          key={instance}
                          type="monotone"
                          dataKey={instance}
                          stroke={colors[index % colors.length]}
                          strokeWidth={2}
                          name={`${instance} Memory (%)`}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">데이터가 없습니다.</div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="alerts-section">
        <h3>알림 목록</h3>
        {alerts.length > 0 ? (
          <table className="alerts-table">
            <thead>
              <tr>
                <th>서비스</th>
                <th>Alert 이름</th>
                <th>상태</th>
                <th>심각도</th>
                <th>요약</th>
                <th>시작 시간</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, index) => (
                <tr key={index} className={`alert-row alert-${getAlertSeverity(alert)}`}>
                  <td>{alert.labels?.service || '-'}</td>
                  <td>{alert.labels?.alertname || '-'}</td>
                  <td>
                    <span className={`alert-status alert-status-${getAlertStatus(alert)}`}>
                      {getAlertStatus(alert)}
                    </span>
                  </td>
                  <td>
                    <span className={`alert-severity alert-severity-${getAlertSeverity(alert)}`}>
                      {getAlertSeverity(alert)}
                    </span>
                  </td>
                  <td>{alert.annotations?.summary || '-'}</td>
                  <td>
                    {alert.activeAt ? new Date(alert.activeAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">알림이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

export default MonitoringDashboard;


