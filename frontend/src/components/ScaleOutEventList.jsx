import { useState, useEffect } from 'react';
import { getJenkinsJobs, getJenkinsJobBuilds } from '../services/jenkinsApi';
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
          job.name.startsWith('autoscale-') || job.name === 'plg-autoscale-out' || job.name === 'plg-autoscale-in'
        );

        // 각 Job의 빌드 이력 조회
        const eventsData = [];
        for (const job of autoscaleJobs) {
          try {
            // 빌드 이력 조회 (최근 10개)
            const buildsResponse = await getJenkinsJobBuilds(job.name, 10);

            if (buildsResponse.success && buildsResponse.builds.length > 0) {
              // Job 이름에서 서비스 이름 추출
              let serviceName = job.name;
              if (job.name.startsWith('autoscale-')) {
                serviceName = job.name.replace(/^autoscale-/, '').replace(/-out$/, '').replace(/-in$/, '');
              } else if (job.name === 'plg-autoscale-out' || job.name === 'plg-autoscale-in') {
                // 공통 Jenkins Job인 경우 설정에서 서비스 이름 찾기
                // 설정이 없으면 Job 이름 그대로 사용
                serviceName = job.name;
              }

              const config = configs.find(c =>
                c.serviceName.toLowerCase().replace(/\s+/g, '-') === serviceName
              );

              // 각 빌드를 이벤트로 변환
              buildsResponse.builds.forEach(build => {
                eventsData.push({
                  id: `${job.name}-${build.buildNumber}`,
                  serviceName: config?.serviceName || serviceName,
                  jobName: job.name,
                  status: build.status,
                  buildNumber: build.buildNumber,
                  buildUrl: build.url,
                  timestamp: new Date(build.timestamp).toISOString(),
                  duration: build.duration
                });
              });
            }
          } catch (error) {
            console.error(`Job ${job.name} 빌드 이력 조회 실패:`, error);
          }
        }

        // 시간순 정렬 (최신순)
        eventsData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
        <h2>스케일아웃/인 이벤트 목록</h2>
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


