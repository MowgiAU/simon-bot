import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

const CHUNK_RELOAD_KEY = 'chunkErrorReloaded';

function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Importing a module script failed') ||
    error.name === 'ChunkLoadError'
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isChunkError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    const chunkError = isChunkLoadError(error);

    // Auto-reload once for chunk errors to pick up the new build
    if (chunkError) {
      const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY);
      if (!alreadyReloaded) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        // Return a loading state — the reload will happen before render
        return { hasError: false, error: null, isChunkError: true };
      }
    }

    return { hasError: true, error, isChunkError: chunkError };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public componentDidMount() {
    // Clear the reload flag on successful mount so future deploys can reload again
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div style={{
            padding: '40px',
            backgroundColor: '#1a1a2e',
            color: '#fff',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'sans-serif',
          }}>
            <h1 style={{ marginBottom: '16px', color: '#22c55e' }}>Update Available</h1>
            <p style={{ color: '#ccc', marginBottom: '24px', textAlign: 'center', maxWidth: '500px' }}>
              The dashboard was updated while you had it open. Please reload to get the latest version.
            </p>
            <button
              onClick={() => { sessionStorage.removeItem(CHUNK_RELOAD_KEY); window.location.reload(); }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Reload to Update
            </button>
          </div>
        );
      }

      return (
        <div style={{ 
          padding: '40px', 
          backgroundColor: '#1a1a2e', 
          color: '#ff4d4d', 
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ marginBottom: '16px' }}>Dashboard Crash Detected</h1>
          <p style={{ color: '#fff', marginBottom: '24px', textAlign: 'center', maxWidth: '600px' }}>
            The application encountered a runtime error. This is usually caused by a component trying to access a property that doesn't exist or a failed import.
          </p>
          <div style={{ 
            backgroundColor: '#000', 
            padding: '20px', 
            borderRadius: '8px', 
            width: '100%', 
            maxWidth: '800px',
            overflow: 'auto',
            border: '1px solid #333'
          }}>
            <pre style={{ margin: 0, color: '#0f0' }}>{this.state.error?.toString()}</pre>
            <pre style={{ margin: '10px 0 0 0', color: '#888', fontSize: '12px' }}>{this.state.error?.stack}</pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              marginTop: '24px', 
              padding: '12px 24px', 
              backgroundColor: '#22c55e', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

