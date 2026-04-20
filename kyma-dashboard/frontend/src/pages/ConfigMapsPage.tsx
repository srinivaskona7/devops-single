import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatAge } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { useNamespace } from '@/hooks/useNamespace';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { FileText, Search, RefreshCw, X, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import type { ConfigMap, ConfigMapDetail } from '@/types';
import { ResourceYamlPanel } from '@/components/shared/ResourceYamlPanel';

// Detect if a string looks like JSON or YAML for display hint
function detectFormat(value: string): 'json' | 'yaml' | 'plain' {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.includes(':\n') || trimmed.includes(': ')) return 'yaml';
  return 'plain';
}

function DataKeyRow({ keyName, value }: { keyName: string; value: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLong = value.length > 200;
  const displayValue = !isLong || expanded ? value : value.slice(0, 200) + '…';
  const fmt = detectFormat(value);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="border border-[rgba(99,102,241,0.12)] rounded-lg mb-2 overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2 bg-[#0a1628] cursor-pointer hover:bg-[#0d1b2e] select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
          <span className="font-mono text-xs text-indigo-300">{keyName}</span>
          {fmt !== 'plain' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 uppercase">{fmt}</span>
          )}
        </div>
        <button
          className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          onClick={e => { e.stopPropagation(); handleCopy(); }}
        >
          {copied ? 'Copied!' : <Copy size={10} />}
        </button>
      </div>
      {expanded && (
        <pre className="text-xs font-mono bg-[#060d1f] p-3 text-slate-300 whitespace-pre-wrap break-all overflow-auto max-h-64">
          {displayValue}
        </pre>
      )}
      {!expanded && (
        <div className="px-3 py-1.5 bg-[#060d1f]">
          <span className="text-xs font-mono text-slate-500 truncate block">{value.slice(0, 80)}{value.length > 80 ? '…' : ''}</span>
        </div>
      )}
      {isLong && expanded && (
        <button
          className="w-full text-xs text-indigo-400 hover:text-indigo-300 py-1 bg-[#060d1f] border-t border-[rgba(99,102,241,0.12)]"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      )}
    </div>
  );
}

function ConfigMapDetailPanel({ name, namespace, onClose }: { name: string; namespace: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');

  const { data, isLoading } = useQuery<{ data: ConfigMapDetail | null; error: string | null }>({
    queryKey: ['configmap-detail', namespace, name],
    queryFn: () => api.configmapDetail(namespace, name),
    enabled: !!(name && namespace),
    refetchInterval: 30_000,
  });

  const detail = data?.data;

  return (
    <div className="flex flex-col h-full bg-[#0a1628] border-l border-[rgba(99,102,241,0.15)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(99,102,241,0.15)] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-indigo-400 flex-shrink-0" />
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
                  <div className="text-xs text-slate-300 font-mono">ConfigMap</div>
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
                  <div className="text-xs text-slate-300">{Object.keys(detail.data).length + detail.binaryData.length}</div>
                </div>
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
                Data ({Object.keys(detail.data).length} keys)
              </h3>
              {Object.keys(detail.data).length === 0 && detail.binaryData.length === 0 ? (
                <div className="text-xs text-slate-600 italic p-3 bg-white/[0.02] rounded">No data</div>
              ) : (
                <>
                  {Object.entries(detail.data).map(([k, v]) => (
                    <DataKeyRow key={k} keyName={k} value={v} />
                  ))}
                  {detail.binaryData.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] text-slate-600 uppercase mb-1">Binary Data Keys</div>
                      {detail.binaryData.map(k => (
                        <div key={k} className="text-xs font-mono text-slate-500 py-0.5">{k} (binary)</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Events panel */}
            <ConfigMapEvents namespace={namespace} name={name} />
          </>
        )}
      </div>
    </div>
  );
}

function ConfigMapEvents({ namespace, name }: { namespace: string; name: string }) {
  const { data } = useQuery<{ items: any[] }>({
    queryKey: ['events', namespace],
    queryFn: () => api.events(namespace),
    enabled: !!(namespace),
    refetchInterval: 30_000,
  });

  const events = (data?.items || []).filter(e =>
    e.involvedObject?.toLowerCase().includes(name.toLowerCase())
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

export default function ConfigMapsPage() {
  const nsFromHook = useNamespace();
  const [, setSearchParams] = useSearchParams();
  const { namespace: nsParam } = useParams<{ namespace?: string }>();
  const navigate = useNavigate();
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<ConfigMap | null>(null);
  const [yamlItem, setYamlItem] = useState<{name: string; namespace?: string} | null>(null);
  const ns = nsFromHook || (nsData?.items?.[0]?.name ?? '');

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: ConfigMap[] }>({
    queryKey: ['configmaps', ns],
    queryFn: () => api.configmaps(ns),
    enabled: !!ns,
    refetchInterval: REFETCH_INTERVAL,
  });

  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  if (isLoading) return (<div className="p-6"><LoadingState resource="ConfigMaps" /></div>);
  if (isError) return (<div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>);

  return (
    <div className={`flex gap-4 h-full ${selected ? 'overflow-hidden' : ''}`}>
      {/* Left: list */}
      <div className={`space-y-4 ${selected ? 'w-1/2 flex-shrink-0' : 'w-full'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">ConfigMaps</h1>
            <span className="text-xs text-slate-500">({items.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
              value={ns}
              onChange={e => {
                setSelected(null);
                if (nsParam) {
                  navigate(`/namespaces/${e.target.value}/configmaps`);
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
            placeholder="Filter configmaps..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
        ) : (
          <div className="k-card p-0 overflow-hidden">
            <table className="k-table">
              <thead><tr><th className="pl-4">Name</th><th>Namespace</th><th>Data Keys</th><th>Age</th><th className="w-12">Actions</th></tr></thead>
              <tbody>
                {items.map(d => (
                  <tr
                    key={d.name}
                    className={`cursor-pointer ${selected?.name === d.name ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'}`}
                    onClick={() => setSelected(selected?.name === d.name ? null : d)}
                  >
                    <td className="pl-4 font-mono text-xs text-indigo-400 cursor-pointer hover:text-indigo-300" onClick={(e) => { e.stopPropagation(); setYamlItem({name: d.name, namespace: d.namespace || ns}); }}>{d.name}</td>
                    <td className="text-xs text-slate-500">{d.namespace}</td>
                    <td className="text-xs text-slate-400">{(d.dataKeys || []).slice(0, 5).join(', ') || '-'}</td>
                    <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button onClick={() => setYamlItem({name: d.name, namespace: d.namespace || ns})} title="View/Edit YAML" className="text-slate-500 hover:text-indigo-400 p-1"><FileText size={12}/></button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-8">{ns ? 'No configmaps found' : 'Select a namespace'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden border border-[rgba(99,102,241,0.15)]">
          <ConfigMapDetailPanel
            name={selected.name}
            namespace={selected.namespace || ns}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
      {yamlItem && <div className="mt-3"><ResourceYamlPanel kind="configmap" name={yamlItem.name} namespace={yamlItem.namespace} onClose={() => setYamlItem(null)} /></div>}
    </div>
  );
}
