import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { useNamespaces } from '@/hooks/useClusterData';
import {
  Anchor, Search, RefreshCw, Ship, Trash2, Play, FileCode,
  Database, Plus, X, ChevronDown, RotateCcw, Terminal, CheckCircle, AlertCircle,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HelmRelease, HelmRepo, HelmSearchResult } from '@/types';
import { HelmReleaseDetail } from '@/components/helm/HelmReleaseDetail';

type TabKey = 'registries' | 'search' | 'releases';

// ── Helpers ─────────────────────────────────────────────────────────────────
function releaseStatusClass(status: string): string {
  switch (status?.toLowerCase()) {
    case 'deployed':         return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'failed':           return 'bg-red-500/20 text-red-400 border border-red-500/30';
    case 'pending':
    case 'pending-install':
    case 'pending-upgrade':
    case 'pending-rollback': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case 'uninstalling':     return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    default:                 return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
  }
}

// ── Toast ────────────────────────────────────────────────────────────────────
interface ToastMsg { id: number; text: string; type: 'success' | 'error' }
function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const push = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, push };
}

function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={cn(
          'px-4 py-2.5 rounded-lg text-xs font-medium shadow-xl border animate-fade-in',
          t.type === 'success'
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            : 'bg-red-500/20 border-red-500/40 text-red-300',
        )}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ── SSE stream helper ────────────────────────────────────────────────────────
async function streamSSE(
  url: string,
  body: object,
  onLine: (line: string) => void,
): Promise<'success' | 'failed'> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.body) throw new Error('No response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalStatus: 'success' | 'failed' = 'failed';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      if (!part.startsWith('data: ')) continue;
      const data = part.slice(6);
      if (data === 'SUCCESS') { finalStatus = 'success'; }
      else if (data === 'FAILED') { finalStatus = 'failed'; }
      else { onLine(data); }
    }
  }
  return finalStatus;
}

// ── CmdLog — shared terminal output panel ────────────────────────────────────
interface CmdLogProps {
  lines: string[];
  running: boolean;
  status: 'idle' | 'running' | 'success' | 'failed';
  height?: string;
}
function CmdLog({ lines, running, status, height = 'h-36' }: CmdLogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <div>
      <div ref={ref}
        className={`${height} overflow-auto font-mono text-xs p-3 rounded-t-lg`}
        style={{ background: '#030a18', border: '1px solid rgba(99,102,241,0.2)', borderBottom: 0 }}>
        {lines.length === 0 && !running && (
          <span className="text-slate-600">Output will appear here…</span>
        )}
        {lines.map((line, i) => (
          <div key={i} className={cn('whitespace-pre-wrap leading-5',
            line.startsWith('$')                                             ? 'text-indigo-300 font-semibold' :
            /error|failed|Error|Failed/i.test(line)                         ? 'text-red-400' :
            /successfully|deployed|STATUS: deployed|added to/i.test(line)   ? 'text-emerald-400' :
            'text-green-300',
          )}>{line || '\u00a0'}</div>
        ))}
        {running && <div className="text-slate-500 animate-pulse mt-1">▌ Running…</div>}
      </div>
      {/* Status bar */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-b-lg text-xs font-medium border border-t-0',
        status === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' :
        status === 'failed'  ? 'bg-red-500/10 border-red-500/25 text-red-400' :
        status === 'running' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
        'bg-white/[0.02] border-white/[0.06] text-slate-600',
      )}>
        {status === 'success' && <><CheckCircle size={12} /> Completed successfully</>}
        {status === 'failed'  && <><AlertCircle size={12} /> Command failed — see output above</>}
        {status === 'running' && <><RefreshCw size={12} className="animate-spin" /> Running in background…</>}
        {status === 'idle'    && <><Terminal size={12} /> Ready</>}
      </div>
    </div>
  );
}

// ── Popular repos catalog ────────────────────────────────────────────────────
const POPULAR_REPOS = [
  { name: 'bitnami',              url: 'https://charts.bitnami.com/bitnami',                 description: '200+ production-ready apps' },
  { name: 'ingress-nginx',        url: 'https://kubernetes.github.io/ingress-nginx',          description: 'NGINX Ingress Controller' },
  { name: 'cert-manager',         url: 'https://charts.jetstack.io',                         description: 'TLS certificate automation' },
  { name: 'prometheus-community', url: 'https://prometheus-community.github.io/helm-charts', description: 'Prometheus + Alertmanager' },
  { name: 'grafana',              url: 'https://grafana.github.io/helm-charts',              description: 'Grafana + Loki + Tempo' },
  { name: 'argo',                 url: 'https://argoproj.github.io/argo-helm',               description: 'ArgoCD + Argo Workflows' },
  { name: 'elastic',              url: 'https://helm.elastic.co',                            description: 'Elasticsearch + Kibana' },
  { name: 'strimzi',              url: 'https://strimzi.io/charts/',                         description: 'Apache Kafka on Kubernetes' },
];

// ── InstallPanel ─────────────────────────────────────────────────────────────
interface InstallPanelProps {
  chart: HelmSearchResult;
  namespaces: string[];
  onClose: () => void;
  onInstalled: () => void;
}
function InstallPanel({ chart, namespaces, onClose, onInstalled }: InstallPanelProps) {
  const [releaseName, setReleaseName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [version, setVersion] = useState('');
  const [versions, setVersions] = useState<string[]>([]);
  const [customValues, setCustomValues] = useState('');
  const [showValues, setShowValues] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.helmChartVersions(chart.name)
      .then((d: any) => setVersions(d.versions || []))
      .catch(() => {});
  }, [chart.name]);

  const scrollLog = () => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  };

  const install = async () => {
    if (!releaseName.trim()) return;
    setInstalling(true);
    setStatus('running');
    const vStr = version ? ` --version ${version}` : '';
    setLogLines([`$ helm install ${releaseName} ${chart.name} -n ${namespace}${vStr}`]);

    try {
      const res = await fetch('/api/helm-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart: chart.name,
          releaseName: releaseName.trim(),
          namespace,
          ...(version ? { version } : {}),
          ...(customValues.trim() ? { values: customValues } : {}),
        }),
      });

      if (!res.body) {
        setLogLines(p => [...p, 'ERROR: No response body']);
        setStatus('failed');
        setInstalling(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let hasError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            setLogLines(p => [...p, data]);
            if (data.includes('ERROR') || data.includes('Error:')) hasError = true;
            scrollLog();
          }
        }
      }
      setStatus(hasError ? 'failed' : 'success');
      if (!hasError) setTimeout(onInstalled, 1500);
    } catch (e: any) {
      setLogLines(p => [...p, `ERROR: ${e.message}`]);
      setStatus('failed');
    }
    setInstalling(false);
  };

  return (
    <div className="mt-3 rounded-xl border p-4 space-y-4"
      style={{ background: 'var(--bg-card, #0d1b2e)', borderColor: 'rgba(99,102,241,0.25)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-indigo-400" />
          <span className="text-sm font-semibold text-white">Install <span className="font-mono text-indigo-300">{chart.name}</span></span>
          <span className="text-xs text-slate-500">{chart.version}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Release Name *</label>
          <input
            className="w-full h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 focus:outline-none focus:border-indigo-500/60 font-mono"
            placeholder={`my-${chart.chart || chart.name}`}
            value={releaseName}
            onChange={e => setReleaseName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Namespace</label>
          <select
            className="w-full h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 focus:outline-none focus:border-indigo-500/60"
            value={namespace}
            onChange={e => setNamespace(e.target.value)}
          >
            {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
            {!namespaces.includes('default') && <option value="default">default</option>}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Version</label>
          {versions.length > 0 ? (
            <select
              className="w-full h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 focus:outline-none focus:border-indigo-500/60"
              value={version}
              onChange={e => setVersion(e.target.value)}
            >
              <option value="">Latest ({chart.version})</option>
              {versions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          ) : (
            <input
              className="w-full h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 focus:outline-none focus:border-indigo-500/60"
              placeholder={`Latest (${chart.version})`}
              value={version}
              onChange={e => setVersion(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Custom values toggle */}
      <div>
        <button
          onClick={() => setShowValues(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronDown size={13} className={cn('transition-transform', showValues && 'rotate-180')} />
          Custom Values (YAML)
        </button>
        {showValues && (
          <textarea
            className="mt-2 w-full h-32 px-3 py-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 font-mono focus:outline-none focus:border-indigo-500/60 resize-none"
            placeholder="replicaCount: 2&#10;service:&#10;  type: LoadBalancer"
            value={customValues}
            onChange={e => setCustomValues(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>

      {/* Terminal log */}
      <div
        ref={logRef}
        className="h-48 overflow-auto font-mono text-xs p-3 rounded-lg"
        style={{ background: '#030a18', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        {logLines.length === 0 && (
          <div className="text-slate-600">Install output will appear here...</div>
        )}
        {logLines.map((line, i) => (
          <div key={i} className={cn('whitespace-pre-wrap',
            line.includes('STATUS: deployed') ? 'text-emerald-400' :
            (line.includes('ERROR') || line.includes('Error:')) ? 'text-red-400' :
            line.startsWith('$') ? 'text-indigo-300' :
            'text-green-300',
          )}>
            {line || '\u00a0'}
          </div>
        ))}
        {installing && <div className="text-slate-600 animate-pulse">Running...</div>}
      </div>

      {/* Status indicator */}
      {status === 'success' && (
        <div className="text-xs text-emerald-400 flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-400 rounded-full" /> Deployed successfully
        </div>
      )}
      {status === 'failed' && (
        <div className="text-xs text-red-400 flex items-center gap-1.5">
          <span className="w-2 h-2 bg-red-400 rounded-full" /> Installation failed — see output above
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          {status === 'success' ? 'Close' : 'Cancel'}
        </button>
        <button
          onClick={install}
          disabled={!releaseName.trim() || installing || status === 'success'}
          className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          {installing
            ? <><RefreshCw size={11} className="animate-spin" /> Installing…</>
            : <><Play size={11} /> Install</>
          }
        </button>
      </div>
    </div>
  );
}

// ── UpgradePanel ─────────────────────────────────────────────────────────────
interface UpgradePanelProps {
  release: HelmRelease;
  namespaces: string[];
  onClose: () => void;
  onUpgraded: () => void;
}
function UpgradePanel({ release, onClose, onUpgraded }: Omit<UpgradePanelProps, 'namespaces'> & { namespaces?: string[] }) {
  const [version, setVersion] = useState('');
  const [customValues, setCustomValues] = useState('');
  const [showValues, setShowValues] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const upgrade = async () => {
    setUpgrading(true);
    setLogLines([`$ helm upgrade ${release.name} ${release.chart} -n ${release.namespace}${version ? ' --version ' + version : ''}`]);

    try {
      const res = await fetch('/api/helm-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseName: release.name,
          namespace: release.namespace,
          chart: release.chart,
          ...(version ? { version } : {}),
          ...(customValues.trim() ? { values: customValues } : {}),
        }),
      });
      const data = await res.json();
      if (data.output) setLogLines(p => [...p, ...data.output.split('\n')]);
      if (data.error) setLogLines(p => [...p, `ERROR: ${data.error}`]);
      else { setDone(true); setTimeout(onUpgraded, 1500); }
    } catch (e: any) {
      setLogLines(p => [...p, `ERROR: ${e.message}`]);
    }
    setUpgrading(false);
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  };

  return (
    <div className="mt-2 rounded-xl border p-4 space-y-4"
      style={{ background: 'var(--bg-card, #0d1b2e)', borderColor: 'rgba(99,102,241,0.25)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw size={14} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Upgrade <span className="font-mono text-amber-300">{release.name}</span></span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Chart (current: {release.chart})</label>
          <input
            className="w-full h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 focus:outline-none focus:border-indigo-500/60"
            placeholder={release.chart}
            readOnly
            value={release.chart}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">New Version (blank = latest)</label>
          <input
            className="w-full h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 focus:outline-none focus:border-indigo-500/60"
            placeholder="latest"
            value={version}
            onChange={e => setVersion(e.target.value)}
          />
        </div>
      </div>

      <div>
        <button onClick={() => setShowValues(v => !v)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <ChevronDown size={13} className={cn('transition-transform', showValues && 'rotate-180')} />
          Custom Values (YAML)
        </button>
        {showValues && (
          <textarea
            className="mt-2 w-full h-28 px-3 py-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 font-mono focus:outline-none focus:border-indigo-500/60 resize-none"
            placeholder="key: value"
            value={customValues}
            onChange={e => setCustomValues(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>

      <div ref={logRef} className="h-36 overflow-auto font-mono text-xs p-3 rounded-lg"
        style={{ background: '#030a18', border: '1px solid rgba(99,102,241,0.2)' }}>
        {logLines.length === 0 && <div className="text-slate-600">Upgrade output will appear here...</div>}
        {logLines.map((line, i) => (
          <div key={i} className={cn('whitespace-pre-wrap',
            line.startsWith('$') ? 'text-indigo-300' :
            line.includes('ERROR') ? 'text-red-400' :
            'text-green-300',
          )}>{line || '\u00a0'}</div>
        ))}
        {upgrading && <div className="text-slate-600 animate-pulse">Upgrading...</div>}
      </div>

      {done && <div className="text-xs text-emerald-400 flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-400 rounded-full" /> Upgraded successfully</div>}

      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
        <button
          onClick={upgrade}
          disabled={upgrading || done}
          className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded disabled:opacity-40 flex items-center gap-1.5"
        >
          {upgrading ? <><RefreshCw size={11} className="animate-spin" /> Upgrading…</> : <><RotateCcw size={11} /> Upgrade</>}
        </button>
      </div>
    </div>
  );
}

// ── Tab: Registries ──────────────────────────────────────────────────────────
function RegistriesTab({ toast }: { toast: (msg: string, type?: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const { data, refetch: _refetch } = useQuery<{ repos: HelmRepo[]; error: string | null }>({
    queryKey: ['helm-repos'],
    queryFn: api.helmRepoList,
    refetchInterval: 60_000,
  });
  const repos = data?.repos || [];
  const [addForm, setAddForm] = useState({ name: '', url: '' });
  const [removing, setRemoving] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateOutput, setUpdateOutput] = useState('');

  // SSE terminal state for registry add
  const [addLog, setAddLog]       = useState<string[]>([]);
  const [addStatus, setAddStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [addBusy, setAddBusy]     = useState(false);

  const addRepo = async (name: string, url: string) => {
    if (!name || !url) { toast('Name and URL required', 'error'); return; }
    setAddBusy(true);
    setAddStatus('running');
    setAddLog([`$ helm repo add ${name} ${url}`]);
    try {
      const status = await streamSSE('/api/helm-repo/add', { name, url }, line => {
        setAddLog(prev => [...prev, line]);
      });
      setAddStatus(status);
      if (status === 'success') {
        toast(`Registry "${name}" added`);
        qc.invalidateQueries({ queryKey: ['helm-repos'] });
        setAddForm({ name: '', url: '' });
      } else {
        toast(`Failed to add registry "${name}"`, 'error');
      }
    } catch (e: any) {
      setAddLog(prev => [...prev, `ERROR: ${e.message}`]);
      setAddStatus('failed');
      toast(e.message, 'error');
    }
    setAddBusy(false);
  };

  const removeRepo = async (name: string) => {
    if (!confirm(`Remove registry "${name}"?`)) return;
    setRemoving(name);
    try {
      const res = await api.helmRepoRemove(name);
      if (res.success) {
        toast(`Registry "${name}" removed`);
        qc.invalidateQueries({ queryKey: ['helm-repos'] });
      } else {
        toast(res.error || 'Failed to remove registry', 'error');
      }
    } catch (e: any) {
      toast(e.message, 'error');
    }
    setRemoving(null);
  };

  const updateAll = async () => {
    setUpdating(true);
    setUpdateOutput('');
    try {
      const res = await api.helmRepoUpdate();
      setUpdateOutput(res.output || res.error || 'Done');
      if (res.success) toast('All registries updated');
      else toast(res.error || 'Update failed', 'error');
    } catch (e: any) {
      toast(e.message, 'error');
    }
    setUpdating(false);
  };

  const alreadyAdded = (name: string) => repos.some(r => r.name === name);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">Chart Registries</h2>
          <p className="text-xs text-slate-500 mt-0.5">{repos.length} registr{repos.length === 1 ? 'y' : 'ies'} configured</p>
        </div>
        <button
          onClick={updateAll}
          disabled={updating || repos.length === 0}
          className="h-8 px-3 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded text-xs text-indigo-300 flex items-center gap-1.5 transition-colors disabled:opacity-40"
        >
          {updating ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Update All
        </button>
      </div>

      {/* Update output */}
      {updateOutput && (
        <pre className="text-xs font-mono p-3 rounded-lg max-h-32 overflow-auto whitespace-pre-wrap"
          style={{ background: '#030a18', border: '1px solid rgba(99,102,241,0.2)', color: '#86efac' }}>
          {updateOutput}
        </pre>
      )}

      {/* Added repos table */}
      <div className="k-card p-0 overflow-hidden">
        {repos.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">
            <Database size={28} className="mx-auto mb-2 opacity-30" />
            No registries configured yet — add one below
          </div>
        ) : (
          <table className="k-table">
            <thead>
              <tr>
                <th className="pl-4">Name</th>
                <th>URL</th>
                <th className="text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {repos.map(r => (
                <tr key={r.name}>
                  <td className="pl-4 font-mono text-xs text-indigo-300">{r.name}</td>
                  <td className="text-xs text-slate-400 max-w-xs truncate">{r.url}</td>
                  <td className="text-right pr-4">
                    <button
                      onClick={() => removeRepo(r.name)}
                      disabled={removing === r.name}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 rounded transition-colors disabled:opacity-40"
                    >
                      {removing === r.name ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Popular registries grid */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Popular Registries</h3>
        <div className="grid grid-cols-2 gap-2">
          {POPULAR_REPOS.map(p => (
            <div key={p.name} className="flex items-center justify-between rounded-lg border px-3 py-2.5"
              style={{ background: 'var(--bg-card, #0d1b2e)', borderColor: 'rgba(99,102,241,0.15)' }}>
              <div className="min-w-0">
                <div className="text-xs font-mono font-semibold text-slate-200">{p.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{p.description}</div>
                <div className="text-[10px] text-slate-600 font-mono truncate">{p.url}</div>
              </div>
              {alreadyAdded(p.name) ? (
                <span className="ml-3 text-[10px] text-emerald-400 border border-emerald-500/30 rounded px-1.5 py-0.5 shrink-0">Added</span>
              ) : (
                <button
                  onClick={() => addRepo(p.name, p.url)}
                  disabled={addBusy}
                  className="ml-3 inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 rounded transition-colors disabled:opacity-40 shrink-0"
                >
                  <Plus size={10} /> Add
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Custom registry form */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Custom Registry</h3>
        <div className="rounded-lg border p-4 space-y-3"
          style={{ background: 'var(--bg-card, #0d1b2e)', borderColor: 'rgba(99,102,241,0.15)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Registry Name</label>
              <input
                className="w-full h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 focus:outline-none focus:border-indigo-500/60 font-mono"
                placeholder="my-registry"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addRepo(addForm.name, addForm.url)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Registry URL</label>
              <input
                className="w-full h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 focus:outline-none focus:border-indigo-500/60"
                placeholder="https://charts.example.com"
                value={addForm.url}
                onChange={e => setAddForm(f => ({ ...f, url: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addRepo(addForm.name, addForm.url)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => addRepo(addForm.name, addForm.url)}
              disabled={!addForm.name || !addForm.url || addBusy}
              className="h-8 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded flex items-center gap-1.5 disabled:opacity-40 transition-colors"
            >
              {addBusy ? <RefreshCw size={11} className="animate-spin" /> : <Plus size={11} />}
              Add Registry
            </button>
          </div>
        </div>
      </div>

      {/* Terminal output for add operation */}
      {addStatus !== 'idle' && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Terminal size={11} /> <span>helm repo add — terminal output</span>
          </div>
          <CmdLog lines={addLog} running={addBusy} status={addStatus} />
        </div>
      )}
    </div>
  );
}

// ── UninstallPanel ────────────────────────────────────────────────────────────
interface UninstallPanelProps {
  release: HelmRelease;
  onClose: () => void;
  onUninstalled: () => void;
}
function UninstallPanel({ release, onClose, onUninstalled }: UninstallPanelProps) {
  const [log, setLog]       = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [busy, setBusy]     = useState(false);

  const run = async () => {
    setBusy(true);
    setStatus('running');
    setLog([`$ helm uninstall ${release.name} -n ${release.namespace}`]);
    try {
      const result = await streamSSE('/api/helm-uninstall',
        { releaseName: release.name, namespace: release.namespace },
        line => setLog(prev => [...prev, line]),
      );
      setStatus(result);
      if (result === 'success') setTimeout(onUninstalled, 1500);
    } catch (e: any) {
      setLog(prev => [...prev, `ERROR: ${e.message}`]);
      setStatus('failed');
    }
    setBusy(false);
  };

  return (
    <div className="mt-2 rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--bg-card, #0d1b2e)', borderColor: 'rgba(239,68,68,0.25)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trash2 size={13} className="text-red-400" />
          <span className="text-sm font-semibold text-white">Uninstall <span className="font-mono text-red-300">{release.name}</span></span>
          <span className="text-xs text-slate-500">namespace: {release.namespace}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={15} /></button>
      </div>

      <CmdLog lines={log} running={busy} status={status} />

      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          {status === 'success' ? 'Close' : 'Cancel'}
        </button>
        <button
          onClick={run}
          disabled={busy || status === 'success'}
          className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          {busy ? <><RefreshCw size={11} className="animate-spin" /> Uninstalling…</> : <><Trash2 size={11} /> Confirm Uninstall</>}
        </button>
      </div>
    </div>
  );
}

// ── Tab: Search ───────────────────────────────────────────────────────────────
function SearchTab({ namespaces, toast }: { namespaces: string[]; toast: (msg: string, type?: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const { data: repoData } = useQuery<{ repos: HelmRepo[] }>({
    queryKey: ['helm-repos'],
    queryFn: api.helmRepoList,
  });
  const repos = repoData?.repos || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [searchResults, setSearchResults] = useState<HelmSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedChart, setSelectedChart] = useState<HelmSearchResult | null>(null);
  const [filter, setFilter] = useState('');

  const doSearch = async (q: string, repo: string) => {
    if (!q.trim() && !repo) return;
    setSearching(true);
    setSearchError('');
    setSelectedChart(null);
    try {
      const res = await api.helmSearch(q, repo || undefined) as any;
      if (res.error) { setSearchError(res.error); setSearchResults([]); }
      else setSearchResults(res.charts || []);
    } catch (e: any) {
      setSearchError(e.message);
    }
    setSearching(false);
  };

  const handleSearch = () => {
    setSearchQuery(inputValue);
    doSearch(inputValue, selectedRepo);
  };

  const filtered = searchResults.filter(c =>
    !filter || c.name.toLowerCase().includes(filter.toLowerCase()) || c.description.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full h-9 pl-9 pr-3 text-sm bg-[#0d1b2e] border border-[rgba(99,102,241,0.15)] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40"
            placeholder="Search charts (e.g. nginx, redis, cert-manager)…"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <select
          className="h-9 px-2 text-xs bg-[#0d1b2e] border border-[rgba(99,102,241,0.15)] rounded-lg text-slate-300 focus:outline-none"
          value={selectedRepo}
          onChange={e => setSelectedRepo(e.target.value)}
        >
          <option value="">All Repos</option>
          {repos.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <button
          onClick={handleSearch}
          disabled={searching || (!inputValue.trim() && !selectedRepo)}
          className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg flex items-center gap-1.5 disabled:opacity-40 transition-colors"
        >
          {searching ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
          Search
        </button>
      </div>

      {repos.length === 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          No registries configured. Go to the Registries tab to add chart repositories first.
        </div>
      )}

      {searchError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{searchError}</div>
      )}

      {searchResults.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Found <span className="text-slate-300">{searchResults.length}</span> charts
            {searchQuery && <> for <span className="font-mono text-indigo-300">"{searchQuery}"</span></>}
          </span>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="h-7 pl-7 pr-2 text-xs bg-[#0d1b2e] border border-[rgba(99,102,241,0.15)] rounded text-slate-300 focus:outline-none w-40"
              placeholder="Filter results…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {filtered.length > 0 && (
        <div className="space-y-0">
          <div className="k-card p-0 overflow-hidden">
            <table className="k-table">
              <thead>
                <tr>
                  <th className="pl-4">Chart</th>
                  <th>Version</th>
                  <th>App Version</th>
                  <th>Repository</th>
                  <th>Description</th>
                  <th className="text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <>
                    <tr key={`${c.name}-${c.version}`} className={cn(selectedChart?.name === c.name && 'bg-indigo-500/5')}>
                      <td className="pl-4 font-mono text-xs text-indigo-400">{c.name}</td>
                      <td className="text-xs font-mono text-slate-400">{c.version}</td>
                      <td className="text-xs text-slate-500">{c.appVersion || '-'}</td>
                      <td>
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                          {c.repo}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500 max-w-xs truncate">{c.description}</td>
                      <td className="text-right pr-4">
                        <button
                          onClick={() => setSelectedChart(prev => prev?.name === c.name ? null : c)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 text-[10px] border rounded transition-colors',
                            selectedChart?.name === c.name
                              ? 'bg-indigo-600/30 border-indigo-500/40 text-indigo-300'
                              : 'bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-400 border-indigo-500/20',
                          )}
                        >
                          <Play size={10} /> Install
                        </button>
                      </td>
                    </tr>
                    {selectedChart?.name === c.name && (
                      <tr key={`${c.name}-${c.version}-panel`}>
                        <td colSpan={6} className="p-2">
                          <InstallPanel
                            chart={c}
                            namespaces={namespaces}
                            onClose={() => setSelectedChart(null)}
                            onInstalled={() => {
                              toast(`${c.name} installed successfully`);
                              setSelectedChart(null);
                              qc.invalidateQueries({ queryKey: ['helm-releases'] });
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {searchResults.length === 0 && !searching && searchQuery && !searchError && (
        <div className="text-center py-12 text-slate-500">
          <Search size={28} className="mx-auto mb-2 opacity-30" />
          No charts found for "{searchQuery}"
        </div>
      )}

      {!searchQuery && searchResults.length === 0 && !searching && (
        <div className="text-center py-12 text-slate-600">
          <Anchor size={28} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">Search for Helm charts across your configured registries</p>
          <p className="text-xs mt-1">Try: nginx, redis, postgresql, grafana, cert-manager</p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Releases ─────────────────────────────────────────────────────────────
function ReleasesTab({ namespaces, toast }: { namespaces: string[]; toast: (msg: string, type?: 'success' | 'error') => void }) {
  const [ns, setNs] = useState('-all-');
  const [filter, setFilter] = useState('');
  const [upgradeRelease, setUpgradeRelease]     = useState<HelmRelease | null>(null);
  const [uninstallRelease, setUninstallRelease] = useState<HelmRelease | null>(null);
  const [selectedRelease, setSelectedRelease]   = useState<HelmRelease | null>(null);
  const qc = useQueryClient();

  const { data: relData, isLoading, refetch } = useQuery<{ items: HelmRelease[]; error: string | null }>({
    queryKey: ['helm-releases', ns],
    queryFn: () => api.helmReleases(ns),
    refetchInterval: 30_000,
  });

  const releases = (relData?.items || []).filter(d =>
    !filter || d.name.toLowerCase().includes(filter.toLowerCase()) || d.namespace.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
            placeholder="Filter releases…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select
          className="h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
          value={ns}
          onChange={e => setNs(e.target.value)}
        >
          <option value="-all-">All Namespaces</option>
          {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button onClick={() => refetch()} className="h-8 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300 flex items-center gap-1">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Upgrade panel */}
      {upgradeRelease && (
        <UpgradePanel
          release={upgradeRelease}
          namespaces={namespaces}
          onClose={() => setUpgradeRelease(null)}
          onUpgraded={() => {
            toast(`Release "${upgradeRelease.name}" upgraded`);
            setUpgradeRelease(null);
            qc.invalidateQueries({ queryKey: ['helm-releases'] });
          }}
        />
      )}

      {/* Uninstall panel */}
      {uninstallRelease && (
        <UninstallPanel
          release={uninstallRelease}
          onClose={() => setUninstallRelease(null)}
          onUninstalled={() => {
            toast(`Release "${uninstallRelease.name}" uninstalled`);
            setUninstallRelease(null);
            qc.invalidateQueries({ queryKey: ['helm-releases'] });
          }}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
      ) : (
        <div className="k-card p-0 overflow-hidden">
          <table className="k-table">
            <thead>
              <tr>
                <th className="pl-4">Name</th>
                <th>Namespace</th>
                <th>Chart</th>
                <th>Version</th>
                <th>Status</th>
                <th>Updated</th>
                <th className="text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.map(d => (
                <tr key={`${d.name}-${d.namespace}`} className="hover:bg-white/[0.02]">
                  <td className="pl-4 font-mono text-xs text-indigo-400 cursor-pointer hover:text-indigo-300" onClick={() => setSelectedRelease(d)}>{d.name}</td>
                  <td className="text-xs text-slate-500">{d.namespace}</td>
                  <td className="text-xs text-slate-400">{d.chart || '-'}</td>
                  <td className="text-xs font-mono text-slate-400">{d.version || '-'}</td>
                  <td>
                    <span className={cn('kyma-badge text-[10px]', releaseStatusClass(d.status))}>
                      {d.status}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">{d.updated || '-'}</td>
                  <td className="text-right pr-4">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => { setUpgradeRelease(upgradeRelease?.name === d.name ? null : d); setUninstallRelease(null); }}
                        title={`Upgrade ${d.name}`}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 text-[10px] border rounded transition-colors',
                          upgradeRelease?.name === d.name
                            ? 'bg-amber-600/30 border-amber-500/40 text-amber-300'
                            : 'bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border-amber-500/20',
                        )}
                      >
                        <RotateCcw size={10} /> Upgrade
                      </button>
                      <button
                        onClick={() => { setUninstallRelease(uninstallRelease?.name === d.name ? null : d); setUpgradeRelease(null); }}
                        title={`Uninstall ${d.name}`}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 text-[10px] border rounded transition-colors',
                          uninstallRelease?.name === d.name
                            ? 'bg-red-600/30 border-red-500/40 text-red-300'
                            : 'bg-red-500/10 hover:bg-red-500/25 text-red-400 border-red-500/20',
                        )}
                      >
                        <Trash2 size={10} /> Uninstall
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {releases.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-500 py-10">No helm releases found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedRelease && (
        <HelmReleaseDetail
          release={selectedRelease}
          onClose={() => setSelectedRelease(null)}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HelmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') || 'releases') as TabKey;
  const { data: nsData } = useNamespaces();
  const namespaces = (nsData?.items || []).map((n: any) => n.name);
  const { toasts, push: toast } = useToast();

  const [showApply, setShowApply] = useState(false);
  const [applyYaml, setApplyYaml] = useState('');
  const [applyResult, setApplyResult] = useState('');
  const [applying, setApplying] = useState(false);

  const doApply = async () => {
    if (!applyYaml.trim()) return;
    setApplying(true);
    setApplyResult('Applying…');
    try {
      const escaped = applyYaml.replace(/'/g, `'"'"'`);
      const data = await api.execute(`echo '${escaped}' | kubectl apply -f -`);
      setApplyResult(data.output || data.error || 'Applied');
    } catch {
      setApplyResult('Failed — check backend logs');
    }
    setApplying(false);
  };

  const TABS: { key: TabKey; label: string; Icon: any }[] = [
    { key: 'releases', label: 'Releases', Icon: Ship },
    { key: 'registries', label: 'Registries', Icon: Database },
    { key: 'search', label: 'Search Charts', Icon: Search },
  ];

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Anchor size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Helm</h1>
        </div>
        <button
          onClick={() => setShowApply(true)}
          className="h-7 px-3 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded text-xs text-indigo-300 flex items-center gap-1.5 transition-colors"
        >
          <FileCode size={12} /> Apply YAML
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[rgba(99,102,241,0.15)]">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setSearchParams({ tab: key })}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'registries' && <RegistriesTab toast={toast} />}
      {tab === 'search' && <SearchTab namespaces={namespaces} toast={toast} />}
      {tab === 'releases' && <ReleasesTab namespaces={namespaces} toast={toast} />}

      {/* Apply YAML modal */}
      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="k-card w-[600px] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCode size={14} className="text-indigo-400" />
                Apply YAML to Cluster
              </h3>
              <button onClick={() => { setShowApply(false); setApplyYaml(''); setApplyResult(''); }}
                className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            <textarea
              className="w-full h-56 px-3 py-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 font-mono focus:outline-none focus:border-indigo-500/60 resize-none"
              placeholder="Paste Kubernetes YAML here…"
              value={applyYaml}
              onChange={e => setApplyYaml(e.target.value)}
              spellCheck={false}
            />
            {applyResult && (
              <pre className="text-xs bg-[#060d1f] text-green-400 p-3 rounded font-mono max-h-36 overflow-auto whitespace-pre-wrap">
                {applyResult}
              </pre>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowApply(false); setApplyYaml(''); setApplyResult(''); }}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
              <button onClick={doApply} disabled={!applyYaml.trim() || applying}
                className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50 flex items-center gap-1.5">
                {applying ? <><RefreshCw size={11} className="animate-spin" /> Applying…</> : <><FileCode size={11} /> Apply</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
