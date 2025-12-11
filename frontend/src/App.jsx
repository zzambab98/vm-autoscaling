import { useMemo, useState } from 'react';
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

const TAB_FLOW = [
  { id: 'templates', label: '템플릿 관리', summary: 'Golden Image 생성 & 버전 관리' },
  { id: 'node-exporter', label: 'Node Exporter 설치', summary: 'VM 메트릭 수집 준비' },
  { id: 'prometheus', label: 'PLG Stack 모니터링 등록', summary: 'Job & Label 등록' },
  { id: 'autoscaling', label: '오토스케일링 설정', summary: '임계값 · VM 범위 · Jenkins 연동' },
  { id: 'alertmanager', label: 'Alertmanager 라우팅', summary: '서비스별 Jenkins webhook 연결' },
  { id: 'monitoring', label: '모니터링 대시보드', summary: 'Grafana에서 상태 확인' },
  { id: 'events', label: '스케일아웃/인 이벤트', summary: '최근 자동화 작업 내역' }
];

function App() {
  const [activeTab, setActiveTab] = useState(TAB_FLOW[0].id);
  const [refreshTemplates, setRefreshTemplates] = useState(0);
  const [refreshConfigs, setRefreshConfigs] = useState(0);
  const [editingConfigId, setEditingConfigId] = useState(null);

  const activeTabMeta = useMemo(
    () => TAB_FLOW.find((tab) => tab.id === activeTab),
    [activeTab]
  );

  const handleTemplateCreated = () => {
    setRefreshTemplates((prev) => prev + 1);
  };

  const handleConfigCreated = () => {
    setRefreshConfigs((prev) => prev + 1);
    setEditingConfigId(null);
  };

  const handleEditConfig = (configId) => {
    setEditingConfigId(configId);
    setActiveTab('autoscaling');
  };

  const handleCancelEdit = () => {
    setEditingConfigId(null);
  };

  return (
    <div className="container">
      <section
        className="glass-card"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #ffffff 0%, #e5edff 100%)'
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <img
              src="/logo.svg"
              alt="DanaIX"
              style={{ height: 64, width: 'auto' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <p style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.35em', color: 'var(--text-muted)' }}>
                Dana Cloud · Jenkins · PLG Stack
              </p>
              <h1
                style={{
                  marginTop: 6,
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  fontFamily: "'Space Grotesk', 'Inter', sans-serif"
                }}
              >
                DanaIX VM 오토스케일링 관리 시스템
              </h1>
            </div>
          </div>
          <p style={{ marginTop: 18, color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6 }}>
            템플릿 → Node Exporter → Prometheus → Autoscaling → Alertmanager → Grafana까지 이어지는 DanaIX 확장 파이프라인을
            한 화면에서 제어합니다. 운영 순서대로 탭을 정렬해두었으니 Flow를 따라가며 설정하세요.
          </p>

          <div className="hero-grid">
            <div className="hero-pill">
              <span role="img" aria-hidden="true">
                ⚙️
              </span>
              <div>
                <strong>vCenter · F5 자동화</strong>
                <div style={{ fontSize: 12 }}>템플릿 복제 + Pool 등록</div>
              </div>
            </div>
            <div className="hero-pill">
              <span role="img" aria-hidden="true">
                📈
              </span>
              <div>
                <strong>PLG Stack 연동</strong>
                <div style={{ fontSize: 12 }}>Prometheus + Alertmanager</div>
              </div>
            </div>
            <div className="hero-pill">
              <span role="img" aria-hidden="true">
                🤖
              </span>
              <div>
                <strong>공통 Jenkins 파이프라인</strong>
                <div style={{ fontSize: 12 }}>plg-autoscale-out</div>
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 85% 0%, rgba(82,109,255,0.25), transparent 60%), radial-gradient(circle at 10% 100%, rgba(31,201,167,0.2), transparent 55%)'
          }}
        />
      </section>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: 32 }}>
        {TAB_FLOW.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'autoscaling') {
                setEditingConfigId(null);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>


      {activeTab === 'templates' && (
        <ErrorBoundary>
          <TemplateForm key={refreshTemplates} onSuccess={handleTemplateCreated} />
          <ErrorBoundary>
            <TemplateList key={`template-list-${refreshTemplates}-${activeTab}`} />
          </ErrorBoundary>
        </ErrorBoundary>
      )}

      {activeTab === 'node-exporter' && (
        <ErrorBoundary>
          <NodeExporterInstall key={`node-exporter-${activeTab}`} />
        </ErrorBoundary>
      )}

      {activeTab === 'prometheus' && (
        <ErrorBoundary>
          <PrometheusMonitoring />
        </ErrorBoundary>
      )}

      {activeTab === 'autoscaling' && (
        <ErrorBoundary>
          {editingConfigId === 'new' || editingConfigId ? (
            <AutoscalingConfigForm
              key={editingConfigId || 'new-config'}
              configId={editingConfigId !== 'new' ? editingConfigId : undefined}
              onSuccess={handleConfigCreated}
              onCancel={handleCancelEdit}
            />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="button button-success" onClick={() => setEditingConfigId('new')}>
                  새 오토스케일링 설정
                </button>
              </div>
              <AutoscalingConfigList
                key={`config-list-${refreshConfigs}`}
                onEdit={handleEditConfig}
                onView={() => {}}
              />
            </>
          )}
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

