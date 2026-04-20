# Frontend Refactoring Examples
## Code-Ready Solutions for Common Issues

---

## 1. FIX: Navbar Re-render Issue (Issue 3.1)

### Current Problem
Entire Navbar re-renders on any state change, causing 100-200ms lag.

### Solution: Component Extraction + Memoization

**Step 1: Create `ClusterSelector.tsx`**
```typescript
import { memo, useState, useCallback } from 'react';
import { ChevronDown, Server, Plus } from 'lucide-react';
import type { SavedCluster } from '@/pages/ClustersPage';

interface ClusterSelectorProps {
  savedClusters: SavedCluster[];
  activeClusterName: string;
  onSwitch: (cluster: SavedCluster) => Promise<void>;
  onManageClusters: () => void;
}

export const ClusterSelector = memo(function ClusterSelector({
  savedClusters,
  activeClusterName,
  onSwitch,
  onManageClusters,
}: ClusterSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleSwitch = useCallback(async (cluster: SavedCluster) => {
    await onSwitch(cluster);
    setOpen(false);
  }, [onSwitch]);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-sm text-slate-300 transition-colors"
      >
        <span className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          activeClusterName ? 'status-dot-live' : 'bg-red-400'
        )} />
        <span className="font-mono text-xs truncate max-w-[160px]">{activeClusterName}</span>
        <ChevronDown size={12} className={cn('shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-9 left-0 z-50 w-64 rounded-lg overflow-hidden shadow-xl"
            style={{ background: 'var(--bg-sidebar, #0a1628)', border: '1px solid var(--border, rgba(99,102,241,0.2))' }}
          >
            {savedClusters.length === 0 ? (
              <div className="px-3 py-3 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted, #64748b)' }}>
                <Server size={12} />
                No saved clusters
              </div>
            ) : (
              savedClusters.map(c => (
                <button
                  key={c.name}
                  onClick={() => handleSwitch(c)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2 transition-colors"
                  style={{ color: 'var(--text-primary, #e2e8f0)' }}
                >
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    c.name === activeClusterName ? 'bg-emerald-400' : 'bg-slate-600'
                  )} />
                  <span className="font-mono truncate flex-1">{c.name}</span>
                  {c.name === activeClusterName && (
                    <span className="text-[11px] text-emerald-400 font-bold uppercase">active</span>
                  )}
                </button>
              ))
            )}
            <div className="border-t" style={{ borderColor: 'var(--border, rgba(99,102,241,0.15))' }} />
            <button
              onClick={() => {
                setOpen(false);
                onManageClusters();
              }}
              className="w-full text-left px-3 py-2 text-xs text-indigo-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
            >
              <Plus size={10} />
              {savedClusters.length === 0 ? 'Connect a cluster' : 'Manage clusters'}
            </button>
          </div>
        </>
      )}
    </div>
  );
});
```

**Step 2: Create `CommandInput.tsx`**
```typescript
import { memo, useState, useCallback } from 'react';
import { Play } from 'lucide-react';
import { api } from '@/lib/api';

interface CommandInputProps {
  onOutputChange: (output: string) => void;
  output: string;
}

export const CommandInput = memo(function CommandInput({
  onOutputChange,
  output,
}: CommandInputProps) {
  const [cmd, setCmd] = useState('');
  const [running, setRunning] = useState(false);

  const runCmd = useCallback(async () => {
    if (!cmd.trim() || running) return;
    setRunning(true);
    onOutputChange('');
    try {
      const res = await api.execute(cmd);
      onOutputChange(res.output || res.error || 'Done');
    } catch {
      onOutputChange('Command failed');
    } finally {
      setRunning(false);
    }
  }, [cmd, running, onOutputChange]);

  return (
    <div className="hidden 2xl:flex items-center gap-1.5 shrink-0">
      <input
        className="w-52 h-7 px-2 text-xs bg-white/[0.04] border border-white/10 rounded-md text-slate-300 font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all"
        placeholder="kubectl get pods -A"
        value={cmd}
        onChange={e => setCmd(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && runCmd()}
      />
      <button
        onClick={runCmd}
        disabled={running}
        className="btn-primary-cta h-7 disabled:opacity-50"
      >
        <Play size={10} /> {running ? 'Running…' : 'Exec'}
      </button>
    </div>
  );
});
```

**Step 3: Refactor `Navbar.tsx`**
```typescript
import { memo, useState, useCallback, useMemo } from 'react';
import { Menu, Search, MessageSquare, HelpCircle, Settings, RefreshCw } from 'lucide-react';
import { useClusterStatus } from '@/hooks/useClusterData';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEY, ACTIVE_KEY } from '@/pages/ClustersPage';
import { ClusterSelector } from './ClusterSelector';
import { CommandInput } from './CommandInput';
import { cn } from '@/lib/utils';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

function NavbarContent({ onToggleSidebar }: NavbarProps) {
  const { data: status } = useClusterStatus();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cmdOutput, setCmdOutput] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const savedClusters = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }, []);

  const activeClusterName = useMemo(() => {
    return localStorage.getItem(ACTIVE_KEY) || 'my-kyma-cluster-admin';
  }, []);

  const switchCluster = useCallback(async (cluster: any) => {
    localStorage.setItem(ACTIVE_KEY, cluster.name);
    try {
      await fetch('/api/switch-cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kubeconfig: cluster.kubeconfig, clusterName: cluster.name }),
      });
    } catch {}
    queryClient.invalidateQueries();
    navigate('/cluster');
  }, [queryClient, navigate]);

  const cpuPct = status?.avg_cpu_percent ?? 0;
  const memPct = status?.avg_memory_percent ?? 0;
  const connected = status?.connection_alive ?? false;
  const daysLeft = status?.days_left ?? 0;

  return (
    <>
      <header
        className="h-[56px] flex items-center px-4 gap-3 shrink-0 z-50"
        style={{
          background: 'linear-gradient(90deg, #07112a 0%, #0a1630 60%, #08112a 100%)',
          borderBottom: '1px solid rgba(79,126,255,0.14)',
          boxShadow: '0 1px 24px rgba(0,0,0,0.45)',
        }}
      >
        <button
          onClick={onToggleSidebar}
          className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-white/5 transition-colors shrink-0"
          title="Toggle sidebar"
        >
          <Menu size={18} />
        </button>

        <div
          className="flex items-center gap-2 cursor-pointer shrink-0"
          onClick={() => window.location.href = '/cluster'}
        >
          <svg className="w-7 h-7 shrink-0" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#326CE5"/>
            <path fill="white" d="M16 5.5a1.2 1.2 0 0 0-1.1.75L12.4 12.1l-6.6.55a1.2 1.2 0 0 0-.68 2.1l5 4.4-1.5 6.4a1.2 1.2 0 0 0 1.78 1.3L16 23.4l5.6 3.45a1.2 1.2 0 0 0 1.78-1.3l-1.5-6.4 5-4.4a1.2 1.2 0 0 0-.68-2.1l-6.6-.55-2.5-5.85A1.2 1.2 0 0 0 16 5.5z"/>
          </svg>
          <span className="font-semibold text-white text-base hidden sm:block whitespace-nowrap">Srinivas-kyma</span>
        </div>

        {/* ✅ Memoized component */}
        <ClusterSelector
          savedClusters={savedClusters}
          activeClusterName={activeClusterName}
          onSwitch={switchCluster}
          onManageClusters={() => navigate('/clusters')}
        />

        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <div className="flex items-center h-8 px-3 bg-white/5 border border-white/10 rounded-lg gap-2 cursor-text hover:border-indigo-500/30 transition-colors">
            <Search size={13} className="text-slate-500 shrink-0" />
            <span className="text-xs text-slate-600 flex-1 select-none">Quick navigation</span>
            <kbd className="text-[12px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-sans select-none leading-none">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* CPU / MEM metrics */}
        <div className="hidden xl:flex items-center gap-3 shrink-0">
          <MetricsDisplay cpu={cpuPct} mem={memPct} />
        </div>

        {/* Expiry badge */}
        {daysLeft > 0 && (
          <ExpiryBadge daysLeft={daysLeft} />
        )}

        {/* ✅ Memoized component */}
        <CommandInput
          onOutputChange={setCmdOutput}
          output={cmdOutput}
        />

        {/* Right action icons */}
        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          <button
            onClick={() => queryClient.invalidateQueries()}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={15} />
          </button>
          {/* Other buttons... */}
        </div>
      </header>

      {/* Command output bar */}
      {cmdOutput && (
        <div className="bg-[#060d1f] border-b border-[rgba(99,102,241,0.15)] px-4 py-2 max-h-32 overflow-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11.5px] text-slate-500 uppercase font-bold">Output</span>
            <button
              onClick={() => setCmdOutput('')}
              className="text-[11.5px] text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          </div>
          <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">{cmdOutput}</pre>
        </div>
      )}
    </>
  );
}

// ✅ Memoize entire component
export const Navbar = memo(NavbarContent);

// Helper components
const MetricsDisplay = memo(({ cpu, mem }: { cpu: number; mem: number }) => (
  <>
    <div className="flex items-center gap-1.5">
      <span className="text-[11.5px] text-slate-500 uppercase font-bold w-8">CPU</span>
      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            cpu > 80 ? 'bg-red-500' : cpu > 60 ? 'bg-amber-500' : 'bg-cyan-400'
          )}
          style={{ width: `${cpu}%` }}
        />
      </div>
      <span className="text-[11.5px] text-slate-400 font-mono w-8">{cpu}%</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="text-[11.5px] text-slate-500 uppercase font-bold w-8">MEM</span>
      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            mem > 80 ? 'bg-red-500' : mem > 60 ? 'bg-amber-500' : 'bg-purple-400'
          )}
          style={{ width: `${mem}%` }}
        />
      </div>
      <span className="text-[11.5px] text-slate-400 font-mono w-8">{mem}%</span>
    </div>
  </>
));

const ExpiryBadge = memo(({ daysLeft }: { daysLeft: number }) => (
  <span className={cn(
    'kyma-badge text-[11.5px] shrink-0 hidden sm:inline-flex',
    daysLeft <= 3 ? 'bg-red-500/15 text-red-400 border border-red-500/25' :
    daysLeft <= 7 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
  )}>
    {daysLeft}d left
  </span>
));
```

---

## 2. FIX: Type Safety Issues (Issues 2.1 & 2.2)

### Current Problem
`api.ts` uses `any` types and `tsconfig.json` is too permissive.

### Solution A: Strict TypeScript Config

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    
    "strict": true,
    "noUnusedLocals": true,        // ✅ Was false
    "noUnusedParameters": true,    // ✅ Was false
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Solution B: Type-Safe API Layer

**lib/api.ts (Refactored)**
```typescript
interface ApiErrorResponse {
  error?: string;
  message?: string;
  code?: string;
}

class ApiError extends Error {
  status: number;
  body: unknown;
  
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

const TIMEOUT_MS = 15_000;

// ✅ Dependency injection instead of direct store access
interface ApiClientConfig {
  getToken: () => string | null;
  baseUrl?: string;
}

export function createApiClient(config: ApiClientConfig) {
  const { getToken, baseUrl = '' } = config;

  async function f<T>(
    url: string,
    init?: RequestInit
  ): Promise<T> {
    const token = getToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${url}`, {
        ...init,
        headers: {
          ...init?.headers,
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        signal: controller.signal
      });

      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = await response.text().catch(() => null);
        }

        const errorMsg = extractErrorMessage(body) || `Request failed (${response.status})`;
        throw new ApiError(errorMsg, response.status, body);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }

      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        throw new ApiError('Network error', 0);
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError('Request timed out', 408);
      }

      throw new ApiError(
        err instanceof Error ? err.message : 'Unknown error',
        0
      );
    } finally {
      clearTimeout(timer);
    }
  }

  function post<T>(url: string, body?: unknown): Promise<T> {
    return f<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  }

  return { f, post };
}

// ✅ Safe error extraction
function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const error = record.error ?? record.message ?? record.detail;

  if (typeof error === 'string') {
    return error;
  }

  return null;
}

// ✅ Create instance with dependency injection
import { useAppStore } from '@/store/useAppStore';

const apiClient = createApiClient({
  getToken: () => useAppStore.getState().token,
});

export const api = {
  /* cluster */
  clusterStatus: () => apiClient.f('/api/cluster-status'),
  namespaceOverview: (ns: string) => apiClient.f(`/api/namespace-overview?namespace=${ns}`),
  namespaces: () => apiClient.f('/api/namespaces'),
  nodes: () => apiClient.f('/api/nodes'),
  nodeDetail: (name: string) => apiClient.f(`/api/node-detail?name=${encodeURIComponent(name)}`),

  // ... rest of API surface

  execute: (command: string) => apiClient.post('/api/execute', { command }),
};

export type { ApiError };
```

---

## 3. FIX: Accessibility - Missing Focus Indicators (Issue 6.4)

**Sidebar.tsx - Updated styles**
```typescript
// Add to every interactive element
className={() =>
  cn(
    'flex items-center gap-2.5 pl-4 pr-3 py-[7px] text-[13.5px] transition-all duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500', // ✅
    isActive
      ? 'bg-gradient-to-r from-blue-500/12 to-transparent text-blue-300 border-l-2 border-blue-400 font-semibold'
      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border-l-2 border-transparent hover:border-slate-600/50 focus-visible:bg-white/5'
  )
}
```

**Add to index.css**
```css
@layer base {
  /* ── Accessible focus indicators ── */
  *:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* Reduce motion for users who prefer it */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

---

## 4. FIX: Sidebar Memoization (Issue 3.2)

**Sidebar.tsx - Optimized**
```typescript
import { useMemo } from 'react';

// ✅ Memoize section builder
function SidebarSectionGroup({
  section,
  collapsed,
}: {
  section: SidebarSection;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(
    section.collapsible ? (section.defaultOpen ?? false) : true
  );
  const location = useLocation();

  // ✅ Memoize section items
  const sectionItems = useMemo(() => {
    return section.items.map(item => {
      const pathPart = item.path.split('?')[0];
      const queryPart = item.path.split('?')[1] ?? '';
      const isActive =
        location.pathname === pathPart &&
        (queryPart ? location.search.includes(queryPart) : true);

      return { ...item, isActive };
    });
  }, [section.items, location]);

  // ... rest of component
}

// ✅ Memoize the entire component
export const Sidebar = memo(function Sidebar({ collapsed }: SidebarProps) {
  const { data: nsData } = useNamespaces();
  const namespaces = useMemo(() => nsData?.items || [], [nsData]);
  
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ Memoize namespace detection
  const { activeNamespace, isNamespaceMode } = useMemo(() => {
    const nsMatch = location.pathname.match(/^\/namespaces\/([^/]+)/);
    const activeNamespace = nsMatch?.[1];
    return {
      activeNamespace,
      isNamespaceMode: !!activeNamespace,
    };
  }, [location.pathname]);

  // ✅ Memoize sections
  const sections = useMemo(() => {
    return isNamespaceMode && activeNamespace
      ? buildNamespaceSections(activeNamespace)
      : clusterSections;
  }, [isNamespaceMode, activeNamespace]);

  return (
    <aside /* ... */>
      {/* ... */}
      <nav className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-700/40 scrollbar-track-transparent">
        {sections.map(section => (
          <SidebarSectionGroup
            key={section.title}
            section={section}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </aside>
  );
});
```

---

## 5. FIX: Error Boundary (Issue 1.2 & 5.1)

**components/ErrorBoundary.tsx** (New file)
```typescript
import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback?.(this.state.error, this.reset) || (
          <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
            <div className="max-w-md p-8 bg-slate-900 rounded-xl shadow-2xl border border-red-500/30 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
              <p className="text-slate-400 mb-6 text-sm">{this.state.error.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={this.reset}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors"
                >
                  Go Home
                </button>
              </div>
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-slate-500 text-xs">Details</summary>
                <pre className="mt-2 text-xs bg-slate-800 p-2 rounded overflow-auto max-h-48 text-red-300">
                  {this.state.error.stack}
                </pre>
              </details>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

**App.tsx - Usage**
```typescript
export default function App() {
  // ... existing code ...

  return (
    <ErrorBoundary>
      <Routes>
        {/* All routes */}
      </Routes>
    </ErrorBoundary>
  );
}
```

---

## 6. FIX: Query Hooks Consistency (Issue 8.2)

**hooks/useClusterData.ts** (Fixed)
```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';          // ✅ Use queryKey factory
import { POLL, STALE } from '@/lib/constants'; // ✅ Use constants
import type { ClusterStatus, Namespace } from '@/types';

export function useClusterStatus() {
  return useQuery({
    queryKey: qk.clusterStatus(),      // ✅ Use qk factory
    queryFn: api.clusterStatus,
    refetchInterval: POLL.NORMAL,      // ✅ Use POLL constant
    staleTime: STALE.LONG,
  });
}

export function useNamespaces() {
  return useQuery({
    queryKey: qk.namespaces(),         // ✅ Use qk factory
    queryFn: api.namespaces,
    refetchInterval: POLL.NORMAL,      // ✅ Use POLL constant
    staleTime: STALE.LONG,
  });
}
```

---

## 7. FIX: CSS Hardcoding (Issue 9.1)

**index.css** (Add component classes)
```css
@layer components {
  .header-shell {
    background: linear-gradient(
      90deg,
      var(--bg-base) 0%,
      color-mix(in srgb, var(--bg-base) 90%, white) 60%,
      var(--bg-base) 100%
    );
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 24px rgba(0, 0, 0, 0.45);
  }

  .sidebar-shell {
    background: linear-gradient(180deg, var(--bg-base) 0%, color-mix(in srgb, var(--bg-base) 95%, black) 100%);
    border-right: 1px solid var(--border);
    box-shadow: 1px 0 24px rgba(0, 0, 0, 0.3);
  }
}
```

**Navbar.tsx & Sidebar.tsx** (Use classes instead of inline styles)
```typescript
// Navbar.tsx
<header className="h-[56px] flex items-center px-4 gap-3 shrink-0 z-50 header-shell">
  {/* content */}
</header>

// Sidebar.tsx
<aside className={cn('flex flex-col shrink-0 transition-all duration-200 overflow-hidden', 'sidebar-shell')}>
  {/* content */}
</aside>
```

---

## Testing the Fixes

### Performance Testing
```bash
# Test Navbar memoization
npm run dev
# Open DevTools → Performance tab
# Record cluster selector click
# Compare before/after: should see <50ms total paint time instead of 100-200ms
```

### Type Safety Testing
```bash
# Strict compile check
npx tsc --noEmit --strict
# Should show 0 errors

# Build
npm run build
# Check for any type errors
```

### Accessibility Testing
```bash
# Install axe DevTools: https://www.deque.com/axe/devtools/
# Tab through sidebar: all items should show focus ring
# Check color contrast with WCAG contrast checker
```

