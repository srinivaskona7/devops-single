import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
}

function getErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error);
}

export function ErrorState({
  title = 'Failed to load data',
  error,
  onRetry,
}: ErrorStateProps) {
  const message = getErrorMessage(error);
  const isTimeout = message.toLowerCase().includes('timeout') || message.includes('408');
  const isNetwork = message.toLowerCase().includes('network') || message.includes('fetch');

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="h-5 w-5 text-red-400" />
      </div>
      <p className="text-sm font-medium text-kyma-text">{title}</p>
      <p className="text-xs text-kyma-muted mt-1 max-w-md">
        {isTimeout
          ? 'The request took too long. The cluster may be slow or unreachable.'
          : isNetwork
            ? 'Unable to reach the server. Check your connection and try again.'
            : message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-accent/10 text-accent border border-accent/20
                     hover:bg-accent/20 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}
