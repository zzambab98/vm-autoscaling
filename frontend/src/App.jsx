import { useState } from 'react';
import NodeExporterInstall from './components/NodeExporterInstall';
import PrometheusMonitoring from './components/PrometheusMonitoring';
import TemplateList from './components/TemplateList';
import TemplateForm from './components/TemplateForm';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('templates');
  const [refreshTemplates, setRefreshTemplates] = useState(0);

  const handleTemplateCreated = () => {
    setRefreshTemplates(prev => prev + 1);
  };

  return (
    <div className="container">
      <header style={{ marginBottom: '30px', padding: '20px 0', borderBottom: '2px solid #3498db' }}>
        <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>VM 오토스케일링 관리 시스템</h1>
        <p style={{ color: '#7f8c8d' }}>템플릿 관리, Node Exporter 설치 및 PLG Stack 모니터링 등록</p>
      </header>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        <button
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          템플릿 관리
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
      </div>

      {activeTab === 'templates' && (
        <>
          <TemplateForm key={refreshTemplates} onSuccess={handleTemplateCreated} />
          <TemplateList key={`list-${refreshTemplates}`} />
        </>
      )}
      {activeTab === 'node-exporter' && <NodeExporterInstall />}
      {activeTab === 'prometheus' && <PrometheusMonitoring />}
    </div>
  );
}

export default App;

