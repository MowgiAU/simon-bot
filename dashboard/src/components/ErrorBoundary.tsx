import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
  reportStatus: 'idle' | 'sending' | 'sent' | 'failed';
  showDetails: boolean;
}

function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Importing a module script failed') ||
    error.name === 'ChunkLoadError'
  );
}

async function hardReload(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {}
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch {}
  try { sessionStorage.removeItem('__chunk_recover_attempted'); } catch {}
  // Navigate with a cache-busting query param so the browser fetches index.html
  // fresh from the server rather than serving from disk/CDN cache.
  const url = new URL(window.location.href);
  url.searchParams.set('_reload', Date.now().toString());
  window.location.replace(url.toString());
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
      reportStatus: 'idle',
      showDetails: false,
    };
    this.sendReport = this.sendReport.bind(this);
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('Uncaught error:', error, errorInfo);
    if (isChunkLoadError(error)) {
      try {
        if (!sessionStorage.getItem('__chunk_recover_attempted')) {
          sessionStorage.setItem('__chunk_recover_attempted', '1');
          hardReload();
        }
      } catch { hardReload(); }
    } else {
      try { sessionStorage.removeItem('__chunk_recover_attempted'); } catch {}
    }
  }

  async sendReport() {
    const { error, errorInfo } = this.state;
    if (!error) return;
    this.setState({ reportStatus: 'sending' });
    try {
      const description = [
        'Dashboard crash: ' + error.message,
        '',
        'Stack trace:',
        error.stack || '(none)',
        '',
        'Component stack:',
        errorInfo?.componentStack || '(none)',
        '',
        'URL: ' + window.location.href,
        'User agent: ' + navigator.userAgent,
      ].join('\n');

      const fd = new FormData();
      fd.append('description', description.slice(0, 5000));
      fd.append('pageUrl', window.location.href);

      const res = await fetch('/api/bug-reports', { method: 'POST', credentials: 'include', body: fd });
      this.setState({ reportStatus: res.ok ? 'sent' : 'failed' });
    } catch {
      this.setState({ reportStatus: 'failed' });
    }
  }

  public render() {
    if (!this.state.hasError) return this.props.children;

    const { error, isChunkError, reportStatus, showDetails } = this.state;

    const page: React.CSSProperties = {
      minHeight: '100vh', backgroundColor: '#0e121a', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    };
    const card: React.CSSProperties = {
      backgroundColor: '#1a1f2e', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '20px', padding: '40px 32px', maxWidth: '540px', width: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
    };
    const bodyText: React.CSSProperties = {
      color: 'rgba(255,255,255,0.55)', fontSize: '14px', lineHeight: 1.7, margin: '0 0 24px',
    };
    const btnGreen: React.CSSProperties = {
      padding: '11px 24px', backgroundColor: '#F2780A', color: '#fff',
      border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
    };
    const btnGhost: React.CSSProperties = {
      padding: '11px 24px', backgroundColor: 'rgba(255,255,255,0.07)',
      color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
    };

    if (isChunkError) {
      return (
        <div style={page}>
          <div style={card}>
            <div style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 28 }}>🔄</div>
            <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: '#22c55e' }}>Update Available</h1>
            <p style={bodyText}>Fuji Studio was updated while you had it open. Reload to get the latest version — your data is safe.</p>
            <button onClick={() => hardReload()} style={{ ...btnGreen, backgroundColor: '#22c55e' }}>Reload to Update</button>
          </div>
        </div>
      );
    }

    return (
      <div style={page}>
        <div style={card}>
          <div style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 28 }}>😵</div>

          <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: '#f8fafc' }}>Something went wrong</h1>
          <p style={bodyText}>
            A part of the dashboard hit an unexpected error and couldn't recover. Your data is safe — this only affects what you're viewing right now.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
            <button onClick={() => window.location.reload()} style={btnGreen}>Reload Page</button>
            <button onClick={() => { window.location.href = '/'; }} style={btnGhost}>Go to Home</button>
          </div>

          <div style={{ marginBottom: 20 }}>
            {reportStatus === 'sent' ? (
              <p style={{ color: '#F2780A', fontSize: 14, margin: 0 }}>✓ Report sent — thanks for helping us fix this!</p>
            ) : reportStatus === 'failed' ? (
              <p style={{ color: '#f87171', fontSize: 14, margin: 0 }}>Couldn't send the report. You may not be logged in.</p>
            ) : (
              <button
                onClick={this.sendReport}
                disabled={reportStatus === 'sending'}
                style={{ background: 'none', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '8px 18px', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: reportStatus === 'sending' ? 'wait' : 'pointer', opacity: reportStatus === 'sending' ? 0.6 : 1 }}
              >
                {reportStatus === 'sending' ? 'Sending…' : '🐛 Send Error Report'}
              </button>
            )}
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, margin: '6px 0 0' }}>Sends the error details to the Fuji Studio team</p>
          </div>

          <button
            onClick={() => this.setState({ showDetails: !showDetails })}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', padding: '4px 0', marginBottom: 8 }}
          >
            {showDetails ? '▲ Hide technical details' : '▼ Show technical details'}
          </button>

          {showDetails && (
            <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', maxHeight: 200, overflowY: 'auto', width: '100%' }}>
              <pre style={{ margin: 0, color: '#f87171', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{error?.message}</pre>
              <pre style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.3)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{error?.stack}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }
}
