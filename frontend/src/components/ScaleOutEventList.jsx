import { useState, useEffect } from 'react';
import { getJenkinsJobs } from '../services/jenkinsApi';
import { getConfigs } from '../services/autoscalingApi';
import './ScaleOutEventList.css';

function ScaleOutEventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [configs, setConfigs] = useState([]);

  useEffect(() => {
    loadConfigs();
    loadEvents();
    
    // 30초마다 이벤트 목록 갱신
    const interval = setInterval(() => {
      loadEvents();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await getConfigs();
      if (response.success) {
        setConfigs(response.configs);
      }
    } catch (error) {
      console.error('설정 목록 로드 실패:', error);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Jenkins Job 목록 조회
      const jobsResponse = await getJenkinsJobs();
      
      if (jobsResponse.success) {
        // 오토스케일링 관련 Job만 필터링
        const autoscaleJobs = jobsResponse.jobs.filter(job => 
          job.name.startsWith('autoscale-')
        );

        // 각 Job의 빌드 이력 조회
        const eventsData = [];
        for (const job of autoscaleJobs) {
          try {
            // Job 이름에서 서비스 이름 추출
            const serviceName = job.name.replace('autoscale-', '');
            const config = configs.find(c => 
              c.serviceName.toLowerCase().replace(/\s+/g, '-') === serviceName
            );

            // 빌드 이력은 Jenkins API로 조회 (간단한 예시)
            eventsData.push({
              id: `${job.name}-${Date.now()}`,
              serviceName: config?.serviceName || serviceName,
              jobName: job.name,
              status: job.color === 'blue' ? 'success' : job.color === 'red' ? 'failed' : 'unknown',
              buildNumber: null, // 실제로는 빌드 번호 조회 필요
              buildUrl: job.url,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error(`Job ${job.name} 빌드 이력 조회 실패:`, error);
          }
        }

        setEvents(eventsData);
      }
    } catch (error) {
      console.error('이벤트 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    if (selectedService && event.serviceName !== selectedService) {
      return false;
    }
    if (selectedStatus && event.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    const statusMap = {
      success: { label: '성공', className: 'status-success' },
      failed: { label: '실패', className: 'status-failed' },
      running: { label: '실행 중', className: 'status-running' },
      unknown: { label: '알 수 없음', className: 'status-unknown' }
    };

    const statusInfo = statusMap[status] || statusMap.unknown;
    return (
      <span className={`status-badge ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  return (
    <div className="scale-out-event-list">
      <div className="event-list-header">
        <h2>스케일아웃 이벤트 목록</h2>
        <button 
          className="button button-primary"
          onClick={loadEvents}
          disabled={loading}
        >
          {loading ? '로딩 중...' : '새로고침'}
        </button>
      </div>

      <div className="event-filters">
        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          style={{ padding: '5px 10px', marginRight: '10px' }}
        >
          <option value="">모든 서비스</option>
          {configs.map(config => (
            <option key={config.id} value={config.serviceName}>
              {config.serviceName}
            </option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{ padding: '5px 10px' }}
        >
          <option value="">모든 상태</option>
          <option value="success">성공</option>
          <option value="failed">실패</option>
          <option value="running">실행 중</option>
        </select>
      </div>

      {loading && events.length === 0 ? (
        <div className="loading">로딩 중...</div>
      ) : filteredEvents.length > 0 ? (
        <table className="events-table">
          <thead>
            <tr>
              <th>서비스</th>
              <th>Jenkins Job</th>
              <th>상태</th>
              <th>빌드 번호</th>
              <th>시간</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((event, index) => (
              <tr key={event.id || index} className="event-row">
                <td>{event.serviceName}</td>
                <td>
                  <a 
                    href={event.buildUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="job-link"
                  >
                    {event.jobName}
                  </a>
                </td>
                <td>{getStatusBadge(event.status)}</td>
                <td>{event.buildNumber || '-'}</td>
                <td>{new Date(event.timestamp).toLocaleString()}</td>
                <td>
                  <a
                    href={event.buildUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button button-small"
                  >
                    상세 보기
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="no-data">이벤트가 없습니다.</div>
      )}
    </div>
  );
}

export default ScaleOutEventList;


