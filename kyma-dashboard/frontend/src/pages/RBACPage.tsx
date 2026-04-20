import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatAge, cn } from '@/lib/utils';
import { Users, Search, RefreshCw, X, FileText, Edit3, Save, ChevronRight, ChevronDown, AlertCircle, CheckCircle, Layers, Package, Shield, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNamespace } from '@/hooks/useNamespace';
import { REFETCH_INTERVAL } from '@/lib/constants';
import Editor from '@monaco-editor/react';
import type { ClusterRole, ClusterRoleBinding } from '@/types';

type TabKey = 'clusterroles' | 'clusterrolebindings' | 'roles' | 'rolebindings' | 'hpa' | 'crds' | 'customresources' | 'cani';

// ── Resource YAML viewer/editor panel ────────────────────────────────────────
interface YamlPanelProps {
  kind: string;
  name: string;
  namespace?: string;
  cluster?: boolean;
  onClose: () => void;
}

function YamlPanel({ kind, name, namespace, cluster, onClose }: YamlPanelProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [yaml, setYaml] = useState('');
  const [edited, setEdited] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSaveResult(null);
    const params = new URLSearchParams({ kind, name });
    if (namespace) params.set('namespace', namespace);
    if (cluster) params.set('cluster', 'true');
    fetch(`/api/resource-yaml?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); }
        else { setYaml(d.yaml || ''); setEdited(d.yaml || ''); }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [kind, name, namespace, cluster]);

  const save = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/resource-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: edited }),
      });
      const d = await res.json();
      setSaveResult({ ok: d.success, msg: d.output || d.error || 'Done' });
      if (d.success) { setYaml(edited); setMode('view'); }
    } catch (e: any) {
      setSaveResult({ ok: false, msg: e.message });
    }
    setSaving(false);
  };

  return (
    <div className="mt-3 rounded-xl border border-[rgba(99,102,241,0.2)] overflow-hidden" style={{ background: 'var(--bg-card)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(99,102,241,0.12)] bg-white/[0.02]">
        <FileText size={14} className="text-indigo-400 shrink-0" />
        <span className="font-mono text-sm font-semibold text-white truncate flex-1">{name}</span>
        <span className="text-xs text-slate-500">{kind}</span>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => { setMode('view'); setEdited(yaml); setSaveResult(null); }}
            className={cn('px-2.5 py-1 text-xs rounded transition-colors', mode === 'view' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300')}>
            View
          </button>
          <button onClick={() => { setMode('edit'); setSaveResult(null); }}
            className={cn('px-2.5 py-1 text-xs rounded flex items-center gap-1 transition-colors', mode === 'edit' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300')}>
            <Edit3 size={11} /> Edit
          </button>
        </div>
        <button onClick={onClose} className="ml-1 p-1 text-slate-500 hover:text-white transition-colors"><X size={14} /></button>
      </div>

      {/* Save result */}
      {saveResult && (
        <div className={cn('flex items-center gap-2 px-4 py-2 text-sm border-b', saveResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400')}>
          {saveResult.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
          <pre className="font-mono text-xs flex-1 whitespace-pre-wrap break-all">{saveResult.msg}</pre>
        </div>
      )}

      {/* Body */}
      <div className="max-h-[60vh] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-sm">Loading YAML…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 text-red-400 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        ) : mode === 'view' ? (
          <pre className="text-xs font-mono text-slate-300 p-4 overflow-auto leading-relaxed h-full max-h-[55vh]">{yaml}</pre>
        ) : (
          <div className="h-[55vh]">
            <Editor
              height="100%"
              defaultLanguage="yaml"
              value={edited}
              onChange={v => setEdited(v || '')}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true, fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
        )}
      </div>

      {/* Save button in edit mode */}
      {mode === 'edit' && !loading && (
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-[rgba(99,102,241,0.12)]">
          <button onClick={() => { setMode('view'); setEdited(yaml); setSaveResult(null); }} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded text-xs text-white transition-colors">
            <Save size={12} className={saving ? 'animate-spin' : ''} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── CRDs Tab ──────────────────────────────────────────────────────────────────
function CRDsTab({ filter }: { filter: string }) {
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedCr, setSelectedCr] = useState<{ kind: string; name: string; namespace?: string } | null>(null);
  const [expandedCrd, setExpandedCrd] = useState<string | null>(null);
  const [crResources, setCrResources] = useState<Record<string, any[]>>({});
  const [loadingCr, setLoadingCr] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['crds'],
    queryFn: () => fetch('/api/crds').then(r => r.json()),
    refetchInterval: 60_000,
  });

  const crds = (data?.items || []).filter((d: any) =>
    !filter || d.name.toLowerCase().includes(filter.toLowerCase()) || d.kind.toLowerCase().includes(filter.toLowerCase())
  );

  const toggleCrd = async (crd: any) => {
    if (expandedCrd === crd.name) { setExpandedCrd(null); return; }
    setExpandedCrd(crd.name);
    if (!crResources[crd.name]) {
      setLoadingCr(crd.name);
      try {
        const res = await fetch(`/api/custom-resources?crd=${encodeURIComponent(crd.name)}&namespace=-all-`);
        const d = await res.json();
        setCrResources(prev => ({ ...prev, [crd.name]: d.items || [] }));
      } catch {}
      setLoadingCr(null);
    }
  };

  if (isLoading) return <div className="py-10 text-center text-slate-500 text-sm flex items-center justify-center gap-2"><RefreshCw size={14} className="animate-spin" /> Loading CRDs…</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => refetch()} className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-400 flex items-center gap-1"><RefreshCw size={11} /> Refresh</button>
      </div>
      <div className="k-card p-0 overflow-hidden">
        <table className="k-table">
          <thead>
            <tr>
              <th className="pl-4 w-8"></th>
              <th>Name</th>
              <th>Kind</th>
              <th>Group</th>
              <th>Scope</th>
              <th>Versions</th>
              <th>Age</th>
              <th className="pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {crds.map((d: any) => (
              <>
                <tr key={d.name} className="cursor-pointer hover:bg-white/[0.03] group">
                  <td className="pl-4 w-8">
                    <button onClick={() => toggleCrd(d)} className="p-0.5 text-slate-500 hover:text-white transition-colors">
                      {expandedCrd === d.name ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  </td>
                  <td className="font-mono text-xs text-indigo-400 cursor-pointer hover:text-indigo-300" onClick={() => setSelected(selected?.name === d.name ? null : d)}>{d.name}</td>
                  <td className="text-xs text-slate-300">{d.kind}</td>
                  <td className="text-xs text-slate-500 font-mono">{d.group}</td>
                  <td className="text-xs"><span className={cn('kyma-badge text-[10px]', d.scope === 'Cluster' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25')}>{d.scope}</span></td>
                  <td className="text-xs text-slate-500">{(d.versions || []).join(', ')}</td>
                  <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                  <td className="pr-4 text-right">
                    <button onClick={() => setSelected(selected?.name === d.name ? null : d)}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded transition-all">
                      View YAML
                    </button>
                  </td>
                </tr>
                {/* Expanded CR list */}
                {expandedCrd === d.name && (
                  <tr key={`${d.name}-expanded`}>
                    <td colSpan={8} className="p-0 bg-white/[0.01]">
                      <div className="pl-12 pr-4 py-2 border-t border-white/[0.04]">
                        {loadingCr === d.name ? (
                          <div className="text-xs text-slate-500 py-2 flex items-center gap-1.5"><RefreshCw size={11} className="animate-spin" /> Loading custom resources…</div>
                        ) : (crResources[d.name] || []).length === 0 ? (
                          <div className="text-xs text-slate-600 py-2">No custom resources found</div>
                        ) : (
                          <div className="space-y-0.5">
                            {(crResources[d.name] || []).map((cr: any) => (
                              <div key={`${cr.name}/${cr.namespace}`} className="flex items-center gap-3 py-1.5 text-xs hover:bg-white/[0.03] rounded px-2 group/cr cursor-pointer"
                                onClick={() => setSelectedCr(selectedCr?.name === cr.name && selectedCr?.namespace === cr.namespace ? null : { kind: d.kind.toLowerCase(), name: cr.name, namespace: cr.namespace || undefined })}>
                                <Package size={11} className="text-slate-600 shrink-0" />
                                <span className={`font-mono flex-1 ${selectedCr?.name === cr.name && selectedCr?.namespace === cr.namespace ? 'text-indigo-300' : 'text-indigo-400/80'}`}>{cr.name}</span>
                                {cr.namespace && <span className="text-slate-600">{cr.namespace}</span>}
                                {cr.status && <span className="text-slate-500">{cr.status}</span>}
                                <span className="text-slate-600">{cr.created ? formatAge(cr.created) : ''}</span>
                                <span className="opacity-0 group-hover/cr:opacity-100 text-[10px] text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded transition-all">
                                  {selectedCr?.name === cr.name && selectedCr?.namespace === cr.namespace ? 'Close' : 'View YAML'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {crds.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-8">No CRDs found</td></tr>}
          </tbody>
        </table>
      </div>
      {selected && <YamlPanel kind="crd" name={selected.name} cluster onClose={() => setSelected(null)} />}
      {selectedCr && <YamlPanel kind={selectedCr.kind} name={selectedCr.name} namespace={selectedCr.namespace} onClose={() => setSelectedCr(null)} />}
    </div>
  );
}

// ── Can I Tab ─────────────────────────────────────────────────────────────────
function CanITab({ namespace }: { namespace: string }) {
  const [filter, setFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['rbac-cani', namespace],
    queryFn: () => fetch(`/api/rbac-cani?namespace=${namespace}`).then(r => r.json()),
    enabled: !!namespace,
    refetchInterval: REFETCH_INTERVAL,
  });
  const rows = (data?.rows || []).filter((r: any) => !filter || r.resources?.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="p-2.5 rounded text-xs" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
        Showing permissions for the current service account in: <strong>{namespace || 'default'}</strong>
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input placeholder="Filter resources..." value={filter} onChange={e => setFilter(e.target.value)}
          className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60" />
      </div>
      {isLoading ? <div className="text-sm text-center py-8 text-slate-500">Loading permissions...</div> : (
        <div className="k-card p-0 overflow-hidden">
          <table className="k-table">
            <thead><tr><th className="pl-4">Resources</th><th>Non-Resource URLs</th><th>Resource Names</th><th>Verbs</th></tr></thead>
            <tbody>
              {rows.map((row: any, i: number) => (
                <tr key={i}>
                  <td className="pl-4 font-mono text-xs text-indigo-400">{row.resources || '-'}</td>
                  <td className="text-xs text-slate-400">{row.nonResourceURLs || '-'}</td>
                  <td className="text-xs text-slate-500">{row.resourceNames || '*'}</td>
                  <td className="text-xs"><div className="flex flex-wrap gap-1">
                    {(row.verbs || '').replace(/[\[\]]/g, '').split(',').map((v: string) => v.trim()).filter(Boolean).map((v: string) => (
                      <span key={v} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: v === '*' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.1)', color: v === '*' ? '#818cf8' : '#10b981' }}>{v}</span>
                    ))}
                  </div></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-sm text-slate-500">{data?.error ? `Error: ${data.error}` : 'No permissions found'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main RBACPage ──────────────────────────────────────────────────────────
export default function RBACPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') || 'clusterroles') as TabKey;
  const [filter, setFilter] = useState('');
  const [selectedRole, setSelectedRole] = useState<ClusterRole | null>(null);
  const [selectedBinding, setSelectedBinding] = useState<ClusterRoleBinding | null>(null);
  const nsFromHook = useNamespace();
  const namespace = searchParams.get('namespace') || nsFromHook || 'default';

  const { data: rolesData, isLoading: loadingRoles, refetch: refetchRoles } = useQuery<{ items: ClusterRole[] }>({
    queryKey: ['clusterroles'],
    queryFn: api.clusterroles,
    refetchInterval: REFETCH_INTERVAL,
    enabled: tab === 'clusterroles',
  });
  const { data: bindingsData, isLoading: loadingBindings, refetch: refetchBindings } = useQuery<{ items: ClusterRoleBinding[] }>({
    queryKey: ['clusterrolebindings'],
    queryFn: api.clusterrolebindings,
    refetchInterval: REFETCH_INTERVAL,
    enabled: tab === 'clusterrolebindings',
  });
  const { data: nsRolesData, isLoading: loadingNsRoles, refetch: refetchNsRoles } = useQuery<{ items: any[] }>({
    queryKey: ['roles', namespace],
    queryFn: () => api.roles(namespace),
    refetchInterval: REFETCH_INTERVAL,
    enabled: tab === 'roles' && !!namespace,
  });
  const { data: nsBindingsData, isLoading: loadingNsBindings, refetch: refetchNsBindings } = useQuery<{ items: any[] }>({
    queryKey: ['rolebindings', namespace],
    queryFn: () => api.rolebindings(namespace),
    refetchInterval: REFETCH_INTERVAL,
    enabled: tab === 'rolebindings' && !!namespace,
  });
  const { data: hpaData, isLoading: loadingHpa, refetch: refetchHpa } = useQuery<{ items: any[] }>({
    queryKey: ['hpa', namespace],
    queryFn: () => api.hpa(namespace),
    refetchInterval: REFETCH_INTERVAL,
    enabled: tab === 'hpa' && !!namespace,
  });

  const isLoading = tab === 'clusterroles' ? loadingRoles
    : tab === 'clusterrolebindings' ? loadingBindings
    : tab === 'roles' ? loadingNsRoles
    : tab === 'rolebindings' ? loadingNsBindings
    : tab === 'hpa' ? loadingHpa
    : false;
  const refetch = tab === 'clusterroles' ? refetchRoles
    : tab === 'clusterrolebindings' ? refetchBindings
    : tab === 'roles' ? refetchNsRoles
    : tab === 'rolebindings' ? refetchNsBindings
    : refetchHpa;
  const roles = (rolesData?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  const bindings = (bindingsData?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  const nsRoles = (nsRolesData?.items || []).filter((d: any) => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  const nsBindings = (nsBindingsData?.items || []).filter((d: any) => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  const hpaItems = (hpaData?.items || []).filter((d: any) => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'clusterroles',        label: 'Cluster Roles',         icon: <Shield size={13} /> },
    { key: 'clusterrolebindings', label: 'Cluster Role Bindings', icon: <Users size={13} /> },
    { key: 'roles',               label: 'Roles',                 icon: <Shield size={13} className="text-cyan-400" /> },
    { key: 'rolebindings',        label: 'Role Bindings',         icon: <Users size={13} className="text-cyan-400" /> },
    { key: 'hpa',                 label: 'Autoscalers (HPA)',     icon: <BarChart3 size={13} /> },
    { key: 'crds',                label: 'CRDs',                  icon: <Layers size={13} /> },
    { key: 'customresources',     label: 'Custom Resources',      icon: <Package size={13} /> },
    { key: 'cani',                label: 'Can I?',                icon: <CheckCircle size={13} /> },
  ];

  const setTab = (t: TabKey) => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', t); return n; });
    setFilter('');
    setSelectedRole(null);
    setSelectedBinding(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">RBAC & CRDs</h1>
        </div>
        {tab !== 'cani' && tab !== 'crds' && tab !== 'customresources' && (
          <button onClick={() => refetch()} className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300 flex items-center gap-1">
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[rgba(99,102,241,0.15)]">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              tab === t.key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* CRDs tab */}
      {tab === 'crds' && (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
              placeholder="Filter CRDs..." value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          <CRDsTab filter={filter} />
        </>
      )}

      {/* Custom Resources tab */}
      {tab === 'customresources' && (        <div className="space-y-3">
          <div className="p-3 rounded text-sm text-slate-500 border border-white/[0.05] bg-white/[0.02]">
            Select a CRD from the <button onClick={() => setTab('crds')} className="text-indigo-400 hover:text-indigo-300 underline">CRDs tab</button> and expand it to view custom resources.
          </div>
        </div>
      )}

      {/* Can I tab */}
      {tab === 'cani' && <CanITab namespace={namespace} />}

      {/* Namespace-scoped Roles tab */}
      {tab === 'roles' && (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
              placeholder="Filter roles..." value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          {loadingNsRoles ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
          ) : (
            <div className="k-card p-0 overflow-hidden">
              <table className="k-table">
                <thead><tr><th className="pl-4">Name</th><th>Namespace</th><th>Age</th><th className="pr-4 text-right">Actions</th></tr></thead>
                <tbody>
                  {nsRoles.map((d: any) => (
                    <tr key={d.name} className="cursor-pointer hover:bg-white/[0.03] group" onClick={() => setSelectedRole(selectedRole?.name === d.name ? null : d)}>
                      <td className="pl-4 font-mono text-xs text-indigo-400">{d.name}</td>
                      <td className="text-xs text-slate-500">{d.namespace || namespace}</td>
                      <td className="text-xs text-slate-500">{d.age || '-'}</td>
                      <td className="pr-4 text-right"><span className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded transition-all">{selectedRole?.name === d.name ? 'Close' : 'View YAML'}</span></td>
                    </tr>
                  ))}
                  {nsRoles.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500 py-8">No roles found in {namespace}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {selectedRole && <YamlPanel kind="role" name={selectedRole.name} namespace={namespace} onClose={() => setSelectedRole(null)} />}
        </>
      )}

      {/* Namespace-scoped RoleBindings tab */}
      {tab === 'rolebindings' && (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
              placeholder="Filter role bindings..." value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          {loadingNsBindings ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
          ) : (
            <div className="k-card p-0 overflow-hidden">
              <table className="k-table">
                <thead><tr><th className="pl-4">Name</th><th>Role</th><th>Subjects</th><th>Age</th><th className="pr-4 text-right">Actions</th></tr></thead>
                <tbody>
                  {nsBindings.map((d: any) => (
                    <tr key={d.name} className="cursor-pointer hover:bg-white/[0.03] group" onClick={() => setSelectedBinding(selectedBinding?.name === d.name ? null : d)}>
                      <td className="pl-4 font-mono text-xs text-indigo-400">{d.name}</td>
                      <td className="text-xs text-slate-400">{d.role || '-'}</td>
                      <td className="text-xs text-slate-400 max-w-xs truncate">{Array.isArray(d.subjects) ? d.subjects.join(', ') : (d.subjects || '-')}</td>
                      <td className="text-xs text-slate-500">{d.age || '-'}</td>
                      <td className="pr-4 text-right"><span className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded transition-all">{selectedBinding?.name === d.name ? 'Close' : 'View YAML'}</span></td>
                    </tr>
                  ))}
                  {nsBindings.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-8">No role bindings found in {namespace}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {selectedBinding && <YamlPanel kind="rolebinding" name={selectedBinding.name} namespace={namespace} onClose={() => setSelectedBinding(null)} />}
        </>
      )}

      {/* HPA tab */}
      {tab === 'hpa' && (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
              placeholder="Filter HPAs..." value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          {loadingHpa ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
          ) : (
            <div className="k-card p-0 overflow-hidden">
              <table className="k-table">
                <thead><tr><th className="pl-4">Name</th><th>Target</th><th>Min/Max</th><th>Current</th><th>Age</th><th className="pr-4 text-right">Actions</th></tr></thead>
                <tbody>
                  {hpaItems.map((d: any) => (
                    <tr key={d.name} className="cursor-pointer hover:bg-white/[0.03] group" onClick={() => setSelectedRole(selectedRole?.name === d.name ? null : d)}>
                      <td className="pl-4 font-mono text-xs text-indigo-400">{d.name}</td>
                      <td className="text-xs text-slate-400">{d.target || '-'}</td>
                      <td className="text-xs text-slate-400">{d.minReplicas ?? '-'}/{d.maxReplicas ?? '-'}</td>
                      <td className="text-xs font-mono text-slate-300">{d.currentReplicas ?? '-'}</td>
                      <td className="text-xs text-slate-500">{d.age || '-'}</td>
                      <td className="pr-4 text-right"><span className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded transition-all">{selectedRole?.name === d.name ? 'Close' : 'View YAML'}</span></td>
                    </tr>
                  ))}
                  {hpaItems.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-8">No HPAs found in {namespace}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {selectedRole && <YamlPanel kind="hpa" name={selectedRole.name} namespace={namespace} onClose={() => setSelectedRole(null)} />}
        </>
      )}

      {/* ClusterRoles + ClusterRoleBindings */}
      {(tab === 'clusterroles' || tab === 'clusterrolebindings') && (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
              placeholder={`Filter ${tab}...`} value={filter} onChange={e => setFilter(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
          ) : (
            <div className="k-card p-0 overflow-hidden">
              {tab === 'clusterroles' && (
                <table className="k-table">
                  <thead><tr><th className="pl-4">Name</th><th>Age</th><th className="pr-4 text-right">Actions</th></tr></thead>
                  <tbody>
                    {roles.map(d => (
                      <tr key={d.name} className="cursor-pointer hover:bg-white/[0.03] group" onClick={() => setSelectedRole(selectedRole?.name === d.name ? null : d)}>
                        <td className="pl-4 font-mono text-xs text-indigo-400 hover:text-indigo-300">{d.name}</td>
                        <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                        <td className="pr-4 text-right">
                          <span className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded transition-all">
                            {selectedRole?.name === d.name ? 'Close' : 'View YAML'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {roles.length === 0 && <tr><td colSpan={3} className="text-center text-slate-500 py-8">No cluster roles found</td></tr>}
                  </tbody>
                </table>
              )}
              {tab === 'clusterrolebindings' && (
                <table className="k-table">
                  <thead><tr><th className="pl-4">Name</th><th>Role Ref</th><th>Subjects</th><th>Age</th><th className="pr-4 text-right">Actions</th></tr></thead>
                  <tbody>
                    {bindings.map(d => (
                      <tr key={d.name} className="cursor-pointer hover:bg-white/[0.03] group" onClick={() => setSelectedBinding(selectedBinding?.name === d.name ? null : d)}>
                        <td className="pl-4 font-mono text-xs text-indigo-400 hover:text-indigo-300">{d.name}</td>
                        <td className="text-xs text-slate-400">{d.roleRef || '-'}</td>
                        <td className="text-xs text-slate-400 max-w-xs truncate">{typeof d.subjects === 'string' ? d.subjects : (Array.isArray(d.subjects) ? d.subjects.map((s: any) => s.name).join(', ') : '-')}</td>
                        <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                        <td className="pr-4 text-right">
                          <span className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded transition-all">
                            {selectedBinding?.name === d.name ? 'Close' : 'View YAML'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {bindings.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-8">No cluster role bindings found</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* YAML Panel for ClusterRoles */}
          {tab === 'clusterroles' && selectedRole && (
            <YamlPanel kind="clusterrole" name={selectedRole.name} cluster onClose={() => setSelectedRole(null)} />
          )}
          {/* YAML Panel for ClusterRoleBindings */}
          {tab === 'clusterrolebindings' && selectedBinding && (
            <YamlPanel kind="clusterrolebinding" name={selectedBinding.name} cluster onClose={() => setSelectedBinding(null)} />
          )}
        </>
      )}
    </div>
  );
}
