import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { useNamespace } from '@/hooks/useNamespace';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { Lock, Search, RefreshCw, X, Eye, EyeOff, FileText } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import type { Secret, SecretDetail } from '@/types';
import { ResourceYamlPanel } from '@/components/shared/ResourceYamlPanel';

function SecretTypeBadge({ type }: { type: string }) {
  const short = type === 'kubernetes.io/service-account-token' ? 'service-account-token'
    : type === 'kubernetes.io/dockerconfigjson' ? 'dockerconfigjson'
    : type === 'kubernetes.io/tls' ? 'tls'
    : type === 'bootstrap.kubernetes.io/token' ? 'bootstrap-token'
    : type || 'Opaque';
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono border border-violet-500/20">
      {short}
    </span>
  );
}

function SecretKeyRow({ keyName, b64Value }: { keyName: string; b64Value: string }) {
  const [decoded, setDecoded] = useState<string | null>(null);
  const [showDecoded, setShowDecoded] = useState(false);

  function handleDecode() {
    if (decoded === null) {
      try {
        const dec = atob(b64Value);
        setDecoded(dec);
      } catch {
        setDecoded('[decode error: invalid base64]');
      }
    }
    setShowDecoded(v => !v);
  }

  return (
    <div className="border border-[rgba(99,102,241,0.12)] rounded-lg mb-2 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0a1628]">
        <span className="font-mono text-xs text-indigo-300">{keyName}</span>
        <button
          onClick={handleDecode}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          {showDecoded ? <EyeOff size={10} /> : <Eye size={10} />}
          {showDecoded ? 'Hide' : 'Decode'}
        </button>
      </div>
      <div className="px-3 py-2 bg-[#060d1f]">
        {showDecoded && decoded !== null ? (
          <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap break-all overflow-auto max-h-48">{decoded}</pre>
        ) : (
          <span className="text-sm tracking-widest text-slate-600 select-none">••••••••••••</span>
        )}
      </div>
    </div>
  );
}

function SecretEvents({ namespace, name }: { namespace: string; name: string }) {
  const { data } = useQuery<{ items: any[] }>({
    queryKey: ['events', namespace],
    queryFn: () => api.events(namespace),
    enabled: !!(namespace),
    refetchInterval: 30_000,
  });

  const events = (data?.items || []).filter(e =>
    (e.involvedObject || '').toLowerCase().includes(name.toLowerCase())
  );

  if (events.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Events ({events.length})
      </h3>
      <div className="space-y-1">
        {events.slice(0, 10).map((e, i) => (
          <div key={i} className="flex gap-2 text-[10px] p-2 bg-white/[0.02] rounded">
            <span className={`font-medium ${e.type === 'Warning' ? 'text-amber-400' : 'text-green-400'}`}>{e.type}</span>
            <span className="text-slate-500">{e.reason}</span>
            <span className="text-slate-400 flex-1 truncate">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecretDetailPanel({ name, namespace, onClose }: { name: string; namespace: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');

  const { data, isLoading } = useQuery<{ data: SecretDetail | null; error: string | null }>({
    queryKey: ['secret-detail', namespace, name],
    queryFn: () => api.secretDetail(namespace, name),
    enabled: !!(name && namespace),
    refetchInterval: 30_000,
  });

  const detail = data?.data;

  return (
    <div className="flex flex-col h-full bg-[#0a1628] border-l border-[rgba(99,102,241,0.15)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(99,102,241,0.15)] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Lock size={14} className="text-indigo-400 flex-shrink-0" />
          <span className="font-mono text-sm text-white truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20">
            Delete
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(99,102,241,0.15)] flex-shrink-0">
        {(['view', 'edit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs capitalize font-medium transition-colors ${
              activeTab === tab
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Warning banner */}
        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
          <Lock size={10} className="flex-shrink-0" />
          Secret values are base64 encoded, not encrypted. Use RBAC to restrict access.
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : !detail ? (
          <div className="text-xs text-red-400 p-3 bg-red-500/10 rounded">{data?.error || 'Failed to load'}</div>
        ) : (
          <>
            {/* Metadata card */}
            <div className="k-card p-3 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Metadata</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-slate-600 uppercase">Resource Type</div>
                  <div className="text-xs text-slate-300 font-mono">Secret</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase">Age</div>
                  <div className="text-xs text-slate-300">{detail.creationTimestamp ? formatAge(detail.creationTimestamp) : '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase">Namespace</div>
                  <div className="text-xs text-slate-300 font-mono">{detail.namespace}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase">Keys</div>
                  <div className="text-xs text-slate-300">{detail.dataKeys.length}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-600 uppercase mb-1">Secret Type</div>
                <SecretTypeBadge type={detail.type} />
              </div>

              {Object.keys(detail.labels).length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-600 uppercase mb-1">Labels</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(detail.labels).map(([k, v]) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">
                        {k}={v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(detail.annotations).length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-600 uppercase mb-1">Annotations</div>
                  <div className="space-y-0.5">
                    {Object.entries(detail.annotations).slice(0, 5).map(([k, v]) => (
                      <div key={k} className="flex gap-1 text-[10px]">
                        <span className="text-slate-500 font-mono truncate max-w-[40%]">{k}:</span>
                        <span className="text-slate-400 truncate">{v}</span>
                      </div>
                    ))}
                    {Object.keys(detail.annotations).length > 5 && (
                      <div className="text-[10px] text-slate-600">+{Object.keys(detail.annotations).length - 5} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Data section */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Data ({detail.dataKeys.length} keys)
              </h3>
              {detail.dataKeys.length === 0 ? (
                <div className="text-xs text-slate-600 italic p-3 bg-white/[0.02] rounded">No data</div>
              ) : (
                detail.dataKeys.map(k => (
                  <SecretKeyRow key={k} keyName={k} b64Value={detail.data[k] || ''} />
                ))
              )}
            </div>

            {/* Events */}
            <SecretEvents namespace={namespace} name={name} />
          </>
        )}
      </div>
    </div>
  );
}

export default function SecretsPage() {
  const nsFromHook = useNamespace();
  const [, setSearchParams] = useSearchParams();
  const { namespace: nsParam } = useParams<{ namespace?: string }>();
  const navigate = useNavigate();
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Secret | null>(null);
  const [yamlItem, setYamlItem] = useState<{name: string; namespace?: string} | null>(null);
  const ns = nsFromHook || (nsData?.items?.[0]?.name ?? '');

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: Secret[] }>({
    queryKey: ['secrets', ns],
    queryFn: () => api.secrets(ns),
    enabled: !!ns,
    refetchInterval: REFETCH_INTERVAL,
  });

  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  if (isLoading) return (<div className="p-6"><LoadingState resource="Secrets" /></div>);
  if (isError) return (<div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>);

  return (
    <div className={`flex gap-4 h-full ${selected ? 'overflow-hidden' : ''}`}>
      {/* Left: list */}
      <div className={`space-y-4 ${selected ? 'w-1/2 flex-shrink-0' : 'w-full'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">Secrets</h1>
            <span className="text-xs text-slate-500">({items.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
              value={ns}
              onChange={e => {
                setSelected(null);
                if (nsParam) {
                  navigate(`/namespaces/${e.target.value}/secrets`);
                } else {
                  setSearchParams({ namespace: e.target.value });
                }
              }}
            >
              <option value="">Select namespace</option>
              {(nsData?.items || []).map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
            </select>
            <button onClick={() => refetch()} className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300">
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
            placeholder="Filter secrets..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div className="k-card p-3 bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
          Secret values are not displayed for security. Click a row to view keys and decode values on demand.
        </div>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
        ) : (
          <div className="k-card p-0 overflow-hidden">
            <table className="k-table">
              <thead><tr><th className="pl-4">Name</th><th>Namespace</th><th>Type</th><th>Keys</th><th>Age</th><th className="w-12">Actions</th></tr></thead>
              <tbody>
                {items.map(d => (
                  <tr
                    key={d.name}
                    className={`cursor-pointer ${selected?.name === d.name ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'}`}
                    onClick={() => setSelected(selected?.name === d.name ? null : d)}
                  >
                    <td className="pl-4 font-mono text-xs text-indigo-400 cursor-pointer hover:text-indigo-300" onClick={(e) => { e.stopPropagation(); setYamlItem({name: d.name, namespace: d.namespace || ns}); }}>{d.name}</td>
                    <td className="text-xs text-slate-500">{d.namespace}</td>
                    <td className="text-xs text-slate-400">{d.type || '-'}</td>
                    <td className="text-xs text-slate-400">{(d.dataKeys || []).slice(0, 5).join(', ') || '-'}</td>
                    <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button onClick={() => setYamlItem({name: d.name, namespace: d.namespace || ns})} title="View/Edit YAML" className="text-slate-500 hover:text-indigo-400 p-1"><FileText size={12}/></button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-8">{ns ? 'No secrets found' : 'Select a namespace'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden border border-[rgba(99,102,241,0.15)]">
          <SecretDetailPanel
            name={selected.name}
            namespace={selected.namespace || ns}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
      {yamlItem && <div className="mt-3"><ResourceYamlPanel kind="secret" name={yamlItem.name} namespace={yamlItem.namespace} onClose={() => setYamlItem(null)} /></div>}
    </div>
  );
}
