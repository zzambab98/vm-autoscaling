import { useState, useEffect } from 'react';
import { templateApi } from '../services/templateApi';

function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const result = await templateApi.getTemplates();
      if (result.success) {
        setTemplates(result.templates || []);
      }
    } catch (error) {
      setMessage({ type: 'error', text: `템플릿 목록 조회 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId, templateName) => {
    if (!deleteConfirm || deleteConfirm.id !== templateId) {
      setDeleteConfirm({ id: templateId, name: templateName });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await templateApi.deleteTemplate(templateId);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setDeleteConfirm(null);
        await loadTemplates();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `템플릿 삭제 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (loading && templates.length === 0) {
    return <div className="loading">템플릿 목록을 불러오는 중...</div>;
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>템플릿 목록</h2>
        <button className="button" onClick={loadTemplates} disabled={loading}>
          새로고침
        </button>
      </div>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      {templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          등록된 템플릿이 없습니다.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>템플릿 이름</th>
              <th>원본 VM</th>
              <th>설명</th>
              <th>생성일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(template => (
              <tr key={template.id}>
                <td>
                  <strong>{template.name}</strong>
                </td>
                <td>{template.originalVmName || '-'}</td>
                <td>{template.description || '-'}</td>
                <td>
                  {template.createdAt 
                    ? new Date(template.createdAt).toLocaleString('ko-KR')
                    : '-'}
                </td>
                <td>
                  {deleteConfirm?.id === template.id ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="button button-danger"
                        onClick={() => handleDelete(template.id, template.name)}
                      >
                        확인
                      </button>
                      <button
                        className="button"
                        onClick={cancelDelete}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      className="button button-danger"
                      onClick={() => handleDelete(template.id, template.name)}
                      disabled={loading}
                    >
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TemplateList;


