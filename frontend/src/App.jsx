import { useState, useEffect } from 'react';
import NodeExporterInstall from './components/NodeExporterInstall';
import PrometheusMonitoring from './components/PrometheusMonitoring';
import TemplateList from './components/TemplateList';
import TemplateForm from './components/TemplateForm';
import AutoscalingConfigList from './components/AutoscalingConfigList';
import AutoscalingConfigForm from './components/AutoscalingConfigForm';
import MonitoringDashboard from './components/MonitoringDashboard';
import ScaleOutEventList from './components/ScaleOutEventList';
import AlertmanagerRouting from './components/AlertmanagerRouting';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('templates');
  const [refreshTemplates, setRefreshTemplates] = useState(0);
  const [refreshConfigs, setRefreshConfigs] = useState(0);
  const [editingConfigId, setEditingConfigId] = useState(null);
  const [viewingConfigId, setViewingConfigId] = useState(null);

  // 컴포넌트 마운트 시 에러 확인
  useEffect(() => {
    console.log('App component mounted');
    console.log('Active tab:', activeTab);
  }, [activeTab]);

  const handleTemplateCreated = () => {
    setRefreshTemplates(prev => prev + 1);
  };

  const handleConfigCreated = () => {
    setRefreshConfigs(prev => prev + 1);
    setEditingConfigId(null);
  };

  const handleEditConfig = (configId) => {
    setEditingConfigId(configId);
    setActiveTab('autoscaling');
  };

  const handleViewConfig = (configId) => {
    setViewingConfigId(configId);
    // 상세 보기는 향후 구현
  };

  const handleCancelEdit = () => {
    setEditingConfigId(null);
  };

  return (
    <div className="container">
      <header style={{ marginBottom: '30px', padding: '20px 0', borderBottom: '2px solid #3498db' }}>
        <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>VM 오토스케일링 관리 시스템</h1>
        <p style={{ color: '#7f8c8d' }}>템플릿 관리, 오토스케일링 설정, Node Exporter 설치 및 PLG Stack 모니터링 등록</p>
      </header>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #ddd', flexWrap: 'wrap' }}>
        <button
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          템플릿 관리
        </button>
        <button
          className={`tab-button ${activeTab === 'autoscaling' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('autoscaling');
            setEditingConfigId(null);
          }}
        >
          오토스케일링 설정
        </button>
        <button
          className={`tab-button ${activeTab === 'node-exporter' ? 'active' : ''}`}
          onClick={() => setActiveTab('node-exporter')}
        >
          Node Exporter 설치
        </button>
        <button
          className={`tab-button ${activeTab === 'prometheus' ? 'active' : ''}`}
          onClick={() => setActiveTab('prometheus')}
        >
          PLG Stack 모니터링 등록
        </button>
        <button
          className={`tab-button ${activeTab === 'alertmanager' ? 'active' : ''}`}
          onClick={() => setActiveTab('alertmanager')}
        >
          Alertmanager 라우팅
        </button>
        <button
          className={`tab-button ${activeTab === 'monitoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitoring')}
        >
          모니터링 대시보드
        </button>
        <button
          className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          스케일아웃 이벤트
        </button>
      </div>

      {activeTab === 'templates' && (
        <ErrorBoundary>
          <TemplateForm key={refreshTemplates} onSuccess={handleTemplateCreated} />
          <ErrorBoundary>
            <TemplateList key={`list-${refreshTemplates}`} />
          </ErrorBoundary>
        </ErrorBoundary>
      )}

      {activeTab === 'autoscaling' && (
        <ErrorBoundary>
          {editingConfigId ? (
            <AutoscalingConfigForm
              key={editingConfigId}
              configId={editingConfigId}
              onSuccess={handleConfigCreated}
              onCancel={handleCancelEdit}
            />
          ) : (
            <>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="button button-success"
                  onClick={() => setEditingConfigId('new')}
                >
                  새 설정 생성
                </button>
              </div>
              {editingConfigId === 'new' && (
                <AutoscalingConfigForm
                  onSuccess={handleConfigCreated}
                  onCancel={handleCancelEdit}
                />
              )}
              <AutoscalingConfigList
                key={refreshConfigs}
                onEdit={handleEditConfig}
                onView={handleViewConfig}
              />
            </>
          )}
        </ErrorBoundary>
      )}

      {activeTab === 'node-exporter' && (
        <ErrorBoundary>
          <NodeExporterInstall />
        </ErrorBoundary>
      )}
      {activeTab === 'prometheus' && (
        <ErrorBoundary>
          <PrometheusMonitoring />
        </ErrorBoundary>
      )}
      {activeTab === 'alertmanager' && (
        <ErrorBoundary>
          <AlertmanagerRouting />
        </ErrorBoundary>
      )}
      {activeTab === 'monitoring' && (
        <ErrorBoundary>
          <MonitoringDashboard />
        </ErrorBoundary>
      )}
      {activeTab === 'events' && (
        <ErrorBoundary>
          <ScaleOutEventList />
        </ErrorBoundary>
      )}
    </div>
  );
}

export default App;

