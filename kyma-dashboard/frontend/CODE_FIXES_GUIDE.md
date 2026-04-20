# Code Fixes & Improvements Guide

## 🔧 Implementation Guide with Code Examples

---

## 1. FIX: XSS Vulnerability in HelmPage

### ❌ BEFORE (VULNERABLE)
```typescript
// HelmPage.tsx, line 1126
const doApply = async () => {
  if (!applyYaml.trim()) return;
  setApplying(true);
  setApplyResult('Applying…');
  try {
    const escaped = applyYaml.replace(/'/g, `'"'"'`);  // ❌ VULNERABLE!
    const data = await api.execute(`echo '${escaped}' | kubectl apply -f -`);
    setApplyResult(data.output || data.error || 'Applied');
  } catch {
    setApplyResult('Failed — check backend logs');
  }
  setApplying(false);
};
```

**Attack:** `'; rm -rf /; echo '` → command injection

### ✅ AFTER (SECURE)
```typescript
const doApply = async () => {
  if (!applyYaml.trim()) {
    setApplyResult('Error: YAML is empty');
    return;
  }
  
  setApplying(true);
  setApplyResult('Applying…');
  
  try {
    // Send YAML as data, not command substitution
    const res = await fetch('/api/kubectl-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: applyYaml }),
    });
    
    const data = await res.json();
    if (data.error) {
      setApplyResult(`Error: ${data.error}`);
    } else {
      setApplyResult(data.output || 'Applied successfully');
    }
  } catch (err) {
    console.error('Apply failed:', err);
    setApplyResult(`Failed: ${err.message}`);
  }
  
  setApplying(false);
};
```

---

## 2. FIX: Memory Leak in LogPanel

### ❌ BEFORE (MEMORY LEAK)
```typescript
// PodsPage.tsx, LogPanel component, lines 40-137
function LogPanel({ namespace, podName, containers, initialContainer }: LogPanelProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  const esRef = useRef<EventSource | null>(null);

  const startStream = (tail: number, cont: string) => {
    if (esRef.current) esRef.current.close();  // ❌ Race condition
    setLines([]);
    setStreaming(true);

    const url = api.podLogsStream(namespace, podName, cont, tail);
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      const line = JSON.parse(e.data) as string;
      setLines(prev => [...prev.slice(-2000), line]);  // ❌ Unbounded growth
    };

    es.addEventListener('end', () => { setStreaming(false); es.close(); });
    es.onerror = () => { setStreaming(false); es.close(); };
  };

  useEffect(() => {
    startStream(linesCount, container);
    return () => esRef.current?.close();  // ❌ May not actually close
  }, [podName, container]);
}
```

### ✅ AFTER (FIXED)
```typescript
function LogPanel({ namespace, podName, containers, initialContainer }: LogPanelProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  const esRef = useRef<EventSource | null>(null);
  const streamingRef = useRef(true);  // Track streaming status
  
  const MAX_LINES = 2000;
  const BATCH_SIZE = 50;  // Add lines in batches
  const linesBufferRef = useRef<string[]>([]);

  const startStream = useCallback((tail: number, cont: string) => {
    // Close existing connection
    if (esRef.current) {
      esRef.current.removeEventListener('message', handleMessage);
      esRef.current.close();
    }

    setLines([]);
    linesBufferRef.current = [];
    streamingRef.current = true;
    setStreaming(true);

    const url = api.podLogsStream(namespace, podName, cont, tail);
    const es = new EventSource(url);
    esRef.current = es;

    const handleMessage = (e: MessageEvent) => {
      try {
        const line = JSON.parse(e.data) as string;
        linesBufferRef.current.push(line);

        // Batch updates
        if (linesBufferRef.current.length >= BATCH_SIZE) {
          setLines(prev => {
            const updated = [...prev, ...linesBufferRef.current];
            linesBufferRef.current = [];
            // Hard cap at MAX_LINES
            return updated.slice(Math.max(0, updated.length - MAX_LINES));
          });
        }
      } catch (err) {
        console.error('Failed to parse log line:', err);
      }
    };

    const handleEnd = () => {
      // Flush remaining lines
      if (linesBufferRef.current.length > 0) {
        setLines(prev => {
          const updated = [...prev, ...linesBufferRef.current];
          return updated.slice(Math.max(0, updated.length - MAX_LINES));
        });
        linesBufferRef.current = [];
      }
      streamingRef.current = false;
      setStreaming(false);
      es.close();
    };

    const handleError = () => {
      console.error('Log stream error');
      streamingRef.current = false;
      setStreaming(false);
      es.close();
    };

    es.addEventListener('message', handleMessage);
    es.addEventListener('end', handleEnd);
    es.addEventListener('error', handleError);
  }, [namespace, podName]);

  useEffect(() => {
    startStream(linesCount, container);
    
    return () => {
      if (esRef.current) {
        esRef.current.close();
      }
    };
  }, [podName, container, linesCount, startStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      linesBufferRef.current = [];
      streamingRef.current = false;
      esRef.current?.close();
    };
  }, []);
}
```

---

## 3. FIX: Add Type Safety to API Responses

### ❌ BEFORE (NO TYPE SAFETY)
```typescript
// HelmPage.tsx, lines 174-176
useEffect(() => {
  api.helmChartVersions(chart.name)
    .then((d: any) => setVersions(d.versions || []))  // ❌ No validation
    .catch(() => {});  // ❌ Silent failure
}, [chart.name]);
```

### ✅ AFTER (TYPED & VALIDATED)
```typescript
// types/helm.ts
export interface HelmChartVersionResponse {
  versions: string[];
  error?: string;
}

// api/helm.ts
export async function helmChartVersions(chartName: string): Promise<HelmChartVersionResponse> {
  const res = await fetch(`/api/helm-chart-versions/${chartName}`);
  if (!res.ok) throw new Error(`Failed to fetch chart versions: ${res.statusText}`);
  
  const data = await res.json();
  
  // Validate response
  if (!Array.isArray(data.versions)) {
    throw new Error('Invalid response: versions is not an array');
  }
  
  return data as HelmChartVersionResponse;
}

// Component usage
useEffect(() => {
  api.helmChartVersions(chart.name)
    .then((response) => setVersions(response.versions))
    .catch((err) => {
      console.error('Failed to fetch chart versions:', err);
      setError(`Could not load versions: ${err.message}`);
      setVersions([]);
    });
}, [chart.name]);
```

---

## 4. FIX: Add Debouncing to Filter Inputs

### ❌ BEFORE (NO DEBOUNCING)
```typescript
// DeploymentsPage.tsx, lines 375-380
const [filter, setFilter] = useState('');

// ... later in render
<input
  className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b"
  placeholder="Filter deployments..."
  value={filter}
  onChange={e => setFilter(e.target.value)}  // ❌ Updates on every keystroke
/>

// Results in 10+ re-renders for "kubernetes"
const items = (data?.items || []).filter(d => 
  !filter || d.name.toLowerCase().includes(filter.toLowerCase())
);
```

### ✅ AFTER (DEBOUNCED)
```typescript
// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Component usage
const [filter, setFilter] = useState('');
const debouncedFilter = useDebounce(filter, 300);

const items = useMemo(() => {
  return (data?.items || []).filter(d =>
    !debouncedFilter || d.name.toLowerCase().includes(debouncedFilter.toLowerCase())
  );
}, [data?.items, debouncedFilter]);

// Render
<input
  value={filter}
  onChange={e => setFilter(e.target.value)}
/>
```

---

## 5. FIX: Add Error Boundary

### ✅ NEW COMPONENT (Add to codebase)
```typescript
// components/shared/ErrorBoundary.tsx
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    this.props.onError?.(error, errorInfo);
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <p className="text-sm font-medium text-slate-300">Something went wrong</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              {this.state.error?.message}
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-xs text-slate-600 max-w-xl">
                <summary className="cursor-pointer font-mono">Details</summary>
                <pre className="mt-2 bg-slate-900 p-2 rounded overflow-auto max-h-40">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

### Usage in pages
```typescript
// pages/DeploymentsPage.tsx
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export default function DeploymentsPage() {
  return (
    <ErrorBoundary
      onError={(err, info) => {
        // Could send to error tracking service
        console.error('Deployments page error:', err);
      }}
    >
      {/* existing component content */}
    </ErrorBoundary>
  );
}
```

---

## 6. FIX: Add Accessibility to Action Buttons

### ❌ BEFORE (NOT ACCESSIBLE)
```typescript
// PodsPage.tsx, lines 654-660
<button
  onClick={() => setOpenMenuId(openMenuId === pod.name ? null : pod.name)}
  className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
>
  <MoreHorizontal size={14} />  // ❌ Icon-only button
</button>
```

### ✅ AFTER (ACCESSIBLE)
```typescript
<button
  onClick={() => setOpenMenuId(openMenuId === pod.name ? null : pod.name)}
  className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
  aria-label={`Actions for pod ${pod.name}`}
  aria-expanded={openMenuId === pod.name}
  aria-haspopup="true"
  title={`Actions for ${pod.name}`}
>
  <MoreHorizontal size={14} aria-hidden="true" />
</button>

{/* Menu accessibility */}
{openMenuId === pod.name && (
  <>
    <div
      className="fixed inset-0 z-40"
      onClick={closeMenu}
      role="presentation"
      aria-hidden="true"
    />
    <div
      className="absolute right-2 top-8 z-50 w-40 rounded-lg shadow-xl overflow-hidden"
      role="menu"
      aria-label={`Menu for ${pod.name}`}
    >
      <button
        onClick={() => { setSelectedPod(pod); closeMenu(); }}
        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
        role="menuitem"
      >
        <FileText size={13} aria-hidden="true" /> Detail
      </button>
      {/* other menu items */}
    </div>
  </>
)}
```

---

## 7. FIX: Add Confirmation Dialogs for Destructive Actions

### ✅ NEW HOOK
```typescript
// hooks/useConfirmDialog.ts
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [onConfirmFn, setOnConfirmFn] = useState<(() => void) | null>(null);

  const confirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setTitle(title);
      setMessage(message);
      setOnConfirmFn(() => onConfirm);
      setIsOpen(true);
    },
    []
  );

  const handleConfirm = () => {
    onConfirmFn?.();
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setOnConfirmFn(null);
  };

  return {
    isOpen,
    title,
    message,
    confirm,
    handleConfirm,
    handleCancel,
  };
}

// Component
export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="k-card max-w-md">
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-slate-600 text-slate-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Usage in component
```typescript
const { confirm, ...dialog } = useConfirmDialog();

const handleDelete = (podName: string) => {
  confirm(
    'Delete Pod',
    `Are you sure you want to delete "${podName}"? This cannot be undone.`,
    async () => {
      try {
        await api.deletePod(namespace, podName);
        showSuccessToast(`Pod "${podName}" deleted`);
      } catch (err) {
        showErrorToast(`Failed to delete pod: ${err.message}`);
      }
    }
  );
};

return (
  <>
    <button onClick={() => handleDelete(pod.name)}>Delete</button>
    <ConfirmDialog {...dialog} />
  </>
);
```

---

## 8. FIX: Create Constants File

### ✅ NEW FILE: constants.ts
```typescript
// lib/constants.ts

// Intervals (ms)
export const REFETCH_INTERVALS = {
  LIVE: 5_000,      // Real-time data: pods, logs
  NORMAL: 30_000,   // Regular updates: deployments, services
  SLOW: 60_000,     // Infrequent: cluster metadata
} as const;

// Pagination
export const PAGINATION = {
  PAGE_SIZE_PODS: 20,
  PAGE_SIZE_EVENTS: 50,
  PAGE_SIZE_DEFAULT: 10,
} as const;

// Resource limits
export const LIMITS = {
  MAX_LOG_LINES: 2000,
  LOG_BATCH_SIZE: 50,
  MAX_YAML_SIZE_MB: 10,
  CPU_CORES_TOTAL: 3920,  // mCPU
  MEMORY_TOTAL_GB: 14.3,
} as const;

// Debounce delays (ms)
export const DEBOUNCE = {
  SEARCH: 300,
  FILTER: 300,
  RESIZE: 100,
} as const;

// UI
export const UI = {
  ANIMATION_DURATION: 300,
  TOAST_TIMEOUT: 4000,
  CONFIRMATION_TIMEOUT: 3000,
} as const;

// Colors (RGB values for calculations)
export const COLORS = {
  SUCCESS: '#22c55e',
  WARNING: '#eab308',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  LOAD_FAILED: 'Failed to load data',
  SAVE_FAILED: 'Failed to save changes',
  DELETE_FAILED: 'Failed to delete resource',
  NETWORK_ERROR: 'Unable to reach the server',
  TIMEOUT: 'Request timed out',
  INVALID_INPUT: 'Invalid input provided',
} as const;

// API endpoints
export const API_BASE = process.env.REACT_APP_API_BASE || '/api';
export const API_ENDPOINTS = {
  MANIFEST: `${API_BASE}/manifest`,
  HELM_INSTALL: `${API_BASE}/helm-install`,
  HELM_UPGRADE: `${API_BASE}/helm-upgrade`,
  KUBECTL_APPLY: `${API_BASE}/kubectl-apply`,
  POD_LOGS: `${API_BASE}/pod-logs`,
} as const;
```

---

## 9. FIX: Extract Reusable Utilities

### ✅ NEW FILE: utils/formatting.ts
```typescript
// lib/utils/formatting.ts

export const DATE_OPTIONS = {
  SHORT: {
    month: 'short' as const,
    day: '2-digit' as const,
    year: 'numeric' as const,
  },
  LONG: {
    month: 'short' as const,
    day: 'numeric' as const,
    year: 'numeric' as const,
    hour: '2-digit' as const,
    minute: '2-digit' as const,
    second: '2-digit' as const,
  },
} as const;

export function formatTimestamp(
  iso: string | null | undefined,
  format: 'short' | 'long' = 'short'
): string {
  if (!iso) return '-';
  try {
    const date = new Date(iso);
    return date.toLocaleString('en-US', DATE_OPTIONS[format]);
  } catch {
    return iso;
  }
}

export function formatAge(iso: string): string {
  if (!iso) return '-';
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  } catch {
    return '-';
  }
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
```

---

## 10. FIX: Add Request Cancellation with AbortController

### ✅ EXAMPLE
```typescript
// hooks/useQuery.ts
export function useQuery<T>(queryKey: string[], queryFn: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        const result = await queryFn(controller.signal);
        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Request was cancelled - don't update state
          return;
        }
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [queryKey.join(',')]);

  return { data, loading, error };
}

// Usage
const { data } = useQuery(['pods', ns], async (signal) => {
  const res = await fetch(`/api/pods?namespace=${ns}`, { signal });
  return res.json();
});
```

---

## Summary of Fixes by Priority

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| 🔴 CRITICAL | Fix XSS vulnerability | Security | 30min |
| 🔴 CRITICAL | Fix memory leaks | Performance | 1h |
| 🔴 CRITICAL | Add type safety | Maintainability | 2h |
| 🔴 HIGH | Add debouncing | UX/Performance | 1h |
| 🔴 HIGH | Add error boundaries | Stability | 30min |
| 🔴 HIGH | Add a11y labels | Accessibility | 1h |
| 🟡 MEDIUM | Extract constants | Code Quality | 2h |
| 🟡 MEDIUM | Add confirmations | UX | 1h |
| 🟢 LOW | Refactor utilities | Maintainability | 3h |

**Total estimated time: 12-15 hours**

---

*Last updated: 2024*
