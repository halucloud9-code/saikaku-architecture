import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#F5F0E8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: '#FDFCFA',
              borderRadius: 16,
              border: '1px solid #D4C9B0',
              padding: '40px 48px',
              maxWidth: 480,
              textAlign: 'center',
              boxShadow: '0 4px 24px rgba(42,37,32,0.08)',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 20 }}>⚠️</div>
            <h2
              style={{
                fontFamily: 'Shippori Mincho, serif',
                fontSize: 20,
                fontWeight: 700,
                color: '#2A2520',
                margin: '0 0 12px',
              }}
            >
              予期しないエラーが発生しました
            </h2>
            <p style={{ fontSize: 14, color: '#7A7060', lineHeight: 1.7, margin: '0 0 28px' }}>
              ページを再読み込みしてお試しください。
              <br />
              問題が続く場合は主催者にお問い合わせください。
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 28px',
                borderRadius: 8,
                border: 'none',
                background: '#2A2520',
                color: '#FDFCFA',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Noto Sans JP, sans-serif',
              }}
            >
              ページを再読み込み
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ marginTop: 20, textAlign: 'left' }}>
                <summary style={{ fontSize: 12, color: '#7A7060', cursor: 'pointer' }}>
                  エラー詳細（開発用）
                </summary>
                <pre
                  style={{
                    fontSize: 11,
                    color: '#A84432',
                    background: '#F8EDEA',
                    padding: 12,
                    borderRadius: 6,
                    marginTop: 8,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
