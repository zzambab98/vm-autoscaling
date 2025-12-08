import { useState, useEffect } from 'react';
import { templateApi } from '../services/templateApi';

function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // 컴포넌트가 마운트될 때마다 템플릿 목록 조회 (탭 클릭 시마다)
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setMessage(null);
    try {
      console.log('[TemplateList] 템플릿 목록 조회 시작...');
      const result = await templateApi.getTemplates();
      console.log('[TemplateList] API 응답:', result);
      
      if (result && result.success) {
        const templates = result.templates || [];
        console.log('[TemplateList] 템플릿 개수:', templates.length);
        setTemplates(templates);
        if (templates.length === 0) {
          setMessage({ type: 'info', text: '등록된 템플릿이 없습니다.' });
        }
      } else {
        console.warn('[TemplateList] 응답 형식 오류:', result);
        setTemplates([]);
        setMessage({ type: 'error', text: '템플릿 목록을 불러올 수 없습니다.' });
      }
    } catch (error) {
      console.error('[TemplateList] 템플릿 목록 조회 실패:', error);
      setTemplates([]);
      setMessage({ type: 'error', text: `템플릿 목록 조회 실패: ${error.message || '알 수 없는 오류'}` });
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
      console.log(`[TemplateList] 템플릿 삭제 시작: ${templateId} (${templateName})`);
      const result = await templateApi.deleteTemplate(templateId);
      console.log(`[TemplateList] 템플릿 삭제 응답:`, result);
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message || '템플릿이 삭제되었습니다.' });
        setDeleteConfirm(null);
        // 삭제 후 목록 새로고침
        try {
          await loadTemplates();
        } catch (loadError) {
          console.error('[TemplateList] 목록 새로고침 실패:', loadError);
          // 목록 새로고침 실패해도 삭제는 성공했으므로 에러 표시하지 않음
        }
      } else {
        setMessage({ type: 'error', text: result.error || result.message || '템플릿 삭제에 실패했습니다.' });
      }
    } catch (error) {
      console.error(`[TemplateList] 템플릿 삭제 오류:`, error);
      setMessage({ type: 'error', text: `템플릿 삭제 실패: ${error.message || '서버에 연결할 수 없습니다.'}` });
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


