import React from 'react';

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unknown admin runtime error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Admin runtime error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif', color: '#10211b' }}>
        <section style={{ maxWidth: 760, border: '1px solid #fecaca', background: '#fff1f2', borderRadius: 16, padding: 20 }}>
          <h1 style={{ marginTop: 0, color: '#7f1d1d' }}>Admin screen could not load</h1>
          <p>
            This page encountered a runtime error instead of loading normally. Refresh once.
            If it continues, share the message below with the technical team.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#ffffff', borderRadius: 12, padding: 12 }}>
            {this.state.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 16px', borderRadius: 999, border: 0, background: '#14532d', color: '#ffffff', fontWeight: 700 }}
          >
            Reload admin
          </button>
        </section>
      </main>
    );
  }
}
