import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary — catches unhandled React errors and prevents
 * the entire app from crashing. Shows a recovery UI instead of a white screen.
 *
 * WHY: Without this, any unhandled throw in a component tree kills the app.
 * React 18 removed the ability to recover from errors without boundaries.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Log to monitoring in production
    console.error('[ErrorBoundary] Caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleGoHome = () => {
    this.handleReset();
    window.location.href = '/cluster';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="flex items-center justify-center min-h-[400px] p-8"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-lg w-full text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-200 mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                An unexpected error occurred. You can try recovering or go back to the dashboard.
              </p>
            </div>
            {this.state.error && (
              <details className="text-left bg-slate-900/50 rounded-lg border border-slate-700/50 p-4">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
                  Error details
                </summary>
                <pre className="mt-2 text-xs text-red-400/80 font-mono overflow-auto max-h-32 whitespace-pre-wrap">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600/50 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
