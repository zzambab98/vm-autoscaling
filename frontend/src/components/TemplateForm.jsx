import { useState, useEffect } from 'react';
import { templateApi } from '../services/templateApi';

function TemplateForm({ onSuccess }) {
  const [vmList, setVmList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    vmName: '',
    templateName: '',
    description: ''
  });

  useEffect(() => {
    loadVmList();
  }, []);

  const loadVmList = async () => {
    try {
      const result = await templateApi.getVmList();
      if (result.success) {
        setVmList(result.vms || []);
      }
    } catch (error) {
      console.error('VM 목록 조회 실패:', error);
      // VM 목록 조회 실패해도 계속 진행 가능
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!formData.vmName || !formData.templateName) {
      setMessage({ type: 'error', text: 'VM 이름과 템플릿 이름은 필수입니다.' });
      setLoading(false);
      return;
    }

    try {
      const result = await templateApi.createTemplate(
        formData.vmName,
        formData.templateName,
        formData.description
      );

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setFormData({ vmName: '', templateName: '', description: '' });
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: `템플릿 생성 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>템플릿 생성</h2>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label className="label">원본 VM 이름 *</label>
        {vmList.length > 0 ? (
          <select
            className="input"
            value={formData.vmName}
            onChange={(e) => setFormData({ ...formData, vmName: e.target.value })}
            required
          >
            <option value="">VM 선택</option>
            {vmList.map((vm, index) => {
              const vmName = typeof vm === 'string' ? vm : (vm?.name || `VM-${index}`);
              const vmValue = typeof vm === 'string' ? vm : (vm?.name || vm?.path || `VM-${index}`);
              return (
                <option key={vmValue || index} value={vmValue}>
                  {vmName}
                </option>
              );
            })}
          </select>
        ) : (
          <input
            type="text"
            className="input"
            value={formData.vmName}
            onChange={(e) => setFormData({ ...formData, vmName: e.target.value })}
            placeholder="VM 이름 입력 (예: auto-vm-test-01)"
            required
          />
        )}

        <label className="label">템플릿 이름 *</label>
        <input
          type="text"
          className="input"
          value={formData.templateName}
          onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
          placeholder="템플릿 이름 입력 (예: auto-vm-test-template)"
          required
        />

        <label className="label">설명</label>
        <textarea
          className="input"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="템플릿에 대한 설명"
          rows="3"
        />

        <button
          type="submit"
          className="button button-success"
          disabled={loading}
          style={{ marginTop: '16px' }}
        >
          {loading ? '생성 중...' : '템플릿 생성'}
        </button>
      </form>

      <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <strong>주의사항:</strong>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>템플릿 생성은 시간이 걸릴 수 있습니다 (5-10분)</li>
          <li>원본 VM이 실행 중이면 자동으로 종료됩니다</li>
          <li>템플릿 생성 중에는 원본 VM을 사용할 수 없습니다</li>
        </ul>
      </div>
    </div>
  );
}

export default TemplateForm;


