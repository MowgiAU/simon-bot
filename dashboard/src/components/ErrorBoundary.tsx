import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

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
  window.location.reload();
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isChunkError: false,
    reportStatus: 'idle',
    showDetails: false,
  };

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
      } catch {
        hardReload();
      }
    } else {
      try { sessionStorage.removeItem('__chunk_recover_attempted'); } catch {}
    }
  }

  private sendReport = async () => {
    const { error, errorInfo } = this.state;
    if (!error) return;

    this.setState({ reportStatus: 'sending' });
    try {
      const description = [
        `Dashboard crash: ${error.message}`,
        '',
        'Stack trace:',
        error.stack || '(none)',
        '',
        'Component stack:',
        errorInfo?.componentStack || '(none)',
        '',
        `URL: ${window.location.href}`,
        `User agent: ${navigator.userAgent}`,
      ].join('\n');

      const fd = new FormData();
      fd.append('description', description.slice(0, 5000));
      fd.append('pageUrl', window.location.href);

      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      this.setState({ reportStatus: res.ok ? 'sent' : 'failed' });
    } catch {
      this.setState({ reportStatus: 'failed' });
    }
  };

  public render() {
    if (!this.state.hasError) return this.props.children;

    // ── Chunk/stale-cache error ─────────────────────────────────────────────
    if (this.state.isChunkError) {
      return (
        <div style={styles.page}>
          <div style={styles.card}>
            <div style={styles.iconWrap('#22c55e')}>
              <span style={{ fontSize: '28px' }}>🔄</span>
            </div>
            <h1 style={{ ...styles.title, color: '#22c55e' }}>Update Available</h1>
            <p style={styles.body}>
              Fuji Studio was updated while you had it open. Reload to get the latest version — your data is safe.
            </p>
            <button onClick={() => hardReload()} style={styles.btnPrimary('#22c55e')}>
              Reload to Update
            </button>
          </div>
        </div>
      );
    }

    // ── Runtime error ───────────────────────────────────────────────────────
    const { reportStatus, showDetails, error } = this.state;

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.iconWrap('#ef4444')}>
            <span style={{ fontSize: '28px' }}>😵</span>
          </div>

          <h1 style={{ ...styles.title, color: '#f8fafc' }}>Something went wrong</h1>

          <p style={styles.body}>
            A part of the dashboard hit an unexpected error and couldn't recover. Your data is safe — this only affects what you're viewing right now.
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
            <button onClick={() => window.location.reload()} style={styles.btnPrimary('#10b981')}>
              Reload Page
            </button>
            <button onClick={() => { window.location.href = '/'; }} style={styles.btnSecondary}>
              Go to Home
            </button>
          </div>

          {/* Send report */}
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            {reportStatus === 'sent' ? (
              <p style={{ color: '#10b981', fontSize: '14px', margin: 0 }}>
                ✓ Report sent — thanks for helping us fix this!
              </p>
            ) : reportStatus === 'failed' ? (
              <p style={{ color: '#f87171', fontSize: '14px', margin: 0 }}>
                Couldn't send report. You may not be logged in.
              </p>
            ) : (
              <button
                onClick={this.sendReport}
                disabled={reportStatus === 'sending'}
                style={{
                  background: 'none',
                  border: '1px solid rgba(239,68,68,0.35)',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  color: '#f87171',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: reportStatus === 'sending' ? 'wait' : 'pointer',
                  opacity: reportStatus === 'sending' ? 0.6 : 1,
                }}
              >
                {reportStatus === 'sending' ? 'Sending…' : '🐛 Send Error Report'}
              </button>
            )}
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', margin: '6px 0 0' }}>
              Sends the error details to the Fuji Studio team
            </p>
          </div>

          {/* Collapsible technical details */}
          <button
            onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '12px', cursor: 'pointer', padding: '4px 0', marginBottom: '8px' }}
          >
            {showDetails ? '▲ Hide technical details' : '▼ Show technical details'}
          </button>

          {showDetails && (
            <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', maxHeight: '200px', overflowY: 'auto', width: '100%', maxWidth: '640px' }}>
              <pre style={{ margin: 0, color: '#f87171', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{error?.message}</pre>
              <pre style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.3)', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{error?.stack}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0e121a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as React.CSSProperties,

  card: {
    backgroundColor: '#1a1f2e',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '20px',
    padding: '40px 32px',
    maxWidth: '540px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
  },

  iconWrap: (color: string) => ({
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    backgroundColor: `${color}15`,
    border: `1px solid ${color}30`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  } as React.CSSProperties),

  title: {
    margin: '0 0 12px',
    fontSize: '22px',
    fontWeight: 700,
    lineHeight: 1.2,
  } as React.CSSProperties,

  body: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: '14px',
    lineHeight: 1.7,
    margin: '0 0 24px',
  } as React.CSSProperties,

  btnPrimary: (color: string) => ({
    padding: '11px 24px',
    backgroundColor: color,
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
  } as React.CSSProperties),

  btnSecondary: {
    padding: '11px 24px',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
  } as React.CSSProperties,
};
