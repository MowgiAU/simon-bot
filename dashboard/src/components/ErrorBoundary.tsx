import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
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

    return this.children;
  }
}
