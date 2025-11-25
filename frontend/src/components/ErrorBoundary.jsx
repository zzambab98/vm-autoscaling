import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error info:', errorInfo);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ margin: '20px', padding: '20px' }}>
          <h2 style={{ color: '#e74c3c' }}>오류가 발생했습니다</h2>
          <p style={{ marginTop: '10px', color: '#666' }}>
            애플리케이션을 로드하는 중 오류가 발생했습니다.
          </p>
          {this.state.error && (
            <details style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }} open>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>오류 상세 정보</summary>
              <div style={{ marginTop: '10px' }}>
                <p style={{ fontWeight: 'bold', color: '#e74c3c' }}>에러 메시지:</p>
                <pre style={{ fontSize: '12px', overflow: 'auto', backgroundColor: '#fff', padding: '10px', borderRadius: '4px' }}>
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <>
                      {'\n\n스택 트레이스:\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
                {this.state.errorInfo && (
                  <>
                    <p style={{ fontWeight: 'bold', color: '#e74c3c', marginTop: '15px' }}>컴포넌트 스택:</p>
                    <pre style={{ fontSize: '12px', overflow: 'auto', backgroundColor: '#fff', padding: '10px', borderRadius: '4px' }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}
          <button
            className="button"
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{ marginTop: '20px' }}
          >
            페이지 새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

