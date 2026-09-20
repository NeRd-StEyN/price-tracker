import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught React UI error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
          <div className="glass-panel p-10 rounded-[12px] max-w-lg border border-danger-border shadow-xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl badge-danger flex items-center justify-center text-danger mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-text mb-2">Application Interface Error</h2>
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              An unexpected rendering issue occurred. Please retry or refresh the application page.
            </p>
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 rounded-xl badge-danger text-sm font-semibold hover:bg-danger hover:text-bg transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
