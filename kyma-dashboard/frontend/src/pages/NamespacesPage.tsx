import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { Search, Plus, ArrowUpDown, Info, Trash2, X, ChevronDown, ChevronUp, Cpu, MemoryStick } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Namespace } from '@/types';

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface KVPair {
  key: string;
  value: string;
}

function KVEditor({
  label,
  pairs,
  onChange,
}: {
  label: string;
  pairs: KVPair[];
  onChange: (pairs: KVPair[]) => void;
}) {
  const add = () => onChange([...pairs, { key: '', value: '' }]);
  const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'key' | 'value', val: string) => {
    const next = [...pairs];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
        <button
          type="button"
          onClick={add}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
        >
          <Plus size={11} /> Add
        </button>
      </div>
      {pairs.length === 0 && (
        <p className="text-xs text-slate-600 italic">No {label.toLowerCase()} defined.</p>
      )}
      {pairs.map((p, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className="flex-1 h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            placeholder="key"
            value={p.key}
            onChange={e => update(i, 'key', e.target.value)}
          />
          <span className="text-slate-600 text-xs">=</span>
          <input
            className="flex-1 h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            placeholder="value"
            value={p.value}
            onChange={e => update(i, 'value', e.target.value)}
          />
          <button type="button" onClick={() => remove(i)} className="text-slate-600 hover:text-red-400">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function CreatePanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'form' | 'yaml'>('form');
  const [name, setName] = useState('');
  const [labels, setLabels] = useState<KVPair[]>([]);
  const [annotations, setAnnotations] = useState<KVPair[]>([]);
  const [sidecarInjection, setSidecarInjection] = useState(false);
  const [memoryQuotas, setMemoryQuotas] = useState(false);
  const [memLimits, setMemLimits] = useState('');
  const [memRequests, setMemRequests] = useState('');
  const [limitsPerContainer, setLimitsPerContainer] = useState(false);
  const [lcpMax, setLcpMax] = useState('');
  const [lcpDefault, setLcpDefault] = useState('');
  const [lcpDefaultRequest, setLcpDefaultRequest] = useState('');

  const yamlPreview = `apiVersion: v1
kind: Namespace
metadata:
  name: ${name || '<name>'}${labels.filter(l => l.key).length > 0 ? `
  labels:
${labels.filter(l => l.key).map(l => `    ${l.key}: "${l.value}"`).join('\n')}` : ''}${annotations.filter(a => a.key).length > 0 ? `
  annotations:
${annotations.filter(a => a.key).map(a => `    ${a.key}: "${a.value}"`).join('\n')}` : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="w-[420px] bg-[#0a1628] border-l border-[rgba(99,102,241,0.2)] flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(99,102,241,0.15)]">
          <h2 className="text-sm font-semibold text-white">Create Namespace</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgba(99,102,241,0.15)]">
          {(['form', 'yaml'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-xs font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'yaml' ? 'YAML' : 'Form'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {activeTab === 'form' ? (
            <>
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  className="w-full h-8 px-3 text-sm bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
                  placeholder="namespace-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              {/* Labels */}
              <KVEditor label="Labels" pairs={labels} onChange={setLabels} />

              {/* Annotations */}
              <KVEditor label="Annotations" pairs={annotations} onChange={setAnnotations} />

              {/* Sidecar Injection */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setSidecarInjection(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    sidecarInjection ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      sidecarInjection ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span className="text-xs text-slate-300 group-hover:text-slate-200">
                  Enable Sidecar Injection
                </span>
              </label>

              {/* Memory Quotas */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memoryQuotas}
                    onChange={e => setMemoryQuotas(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-600 bg-[#060d1f] accent-indigo-500"
                  />
                  <span className="text-xs text-slate-300">Apply Total Memory Quotas</span>
                </label>
                {memoryQuotas && (
                  <div className="ml-5 space-y-3 border-l border-[rgba(99,102,241,0.15)] pl-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Memory Limits</label>
                      <input
                        className="w-full h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
                        placeholder="e.g. 4Gi"
                        value={memLimits}
                        onChange={e => setMemLimits(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Memory Requests</label>
                      <input
                        className="w-full h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
                        placeholder="e.g. 2Gi"
                        value={memRequests}
                        onChange={e => setMemRequests(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Limits per Container */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={limitsPerContainer}
                    onChange={e => setLimitsPerContainer(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-600 bg-[#060d1f] accent-indigo-500"
                  />
                  <span className="text-xs text-slate-300">Apply Limits per Container</span>
                </label>
                {limitsPerContainer && (
                  <div className="ml-5 space-y-3 border-l border-[rgba(99,102,241,0.15)] pl-3">
                    {[
                      { label: 'Max', value: lcpMax, setter: setLcpMax, placeholder: 'e.g. 1Gi' },
                      { label: 'Default', value: lcpDefault, setter: setLcpDefault, placeholder: 'e.g. 512Mi' },
                      { label: 'Default Request', value: lcpDefaultRequest, setter: setLcpDefaultRequest, placeholder: 'e.g. 256Mi' },
                    ].map(({ label, value, setter, placeholder }) => (
                      <div key={label} className="space-y-1">
                        <label className="text-xs text-slate-400">{label}</label>
                        <input
                          className="w-full h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
                          placeholder={placeholder}
                          value={value}
                          onChange={e => setter(e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">YAML preview (read-only; edit in Form tab)</p>
              <pre className="text-xs font-mono text-emerald-300 bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded p-3 whitespace-pre-wrap leading-relaxed">
                {yamlPreview}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[rgba(99,102,241,0.15)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 text-xs rounded border border-[rgba(99,102,241,0.2)] text-slate-300 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            className="h-8 px-4 text-xs rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

type SortField = 'name' | 'created';
type SortDir = 'asc' | 'desc';

export default function NamespacesPage() {
  const { data, isLoading, isError, error, refetch } = useQuery<{ items: Namespace[] }>({
    queryKey: ['namespaces'],
    queryFn: api.namespaces,
    refetchInterval: REFETCH_INTERVAL,
  });

  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const namespaces = (data?.items || [])
    .filter(ns => !filter || ns.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'created') cmp = (a.created || '').localeCompare(b.created || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={11} className="text-slate-600 ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="text-indigo-400 ml-1" />
      : <ChevronDown size={11} className="text-indigo-400 ml-1" />;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Namespaces</h1>
          <button
            title="Namespaces are Kubernetes objects that provide a mechanism for isolating groups of resources within a single cluster."
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Info size={15} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              className="w-full h-8 pl-8 pr-3 text-sm bg-[#0d1b2e] border border-[rgba(99,102,241,0.15)] rounded text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              placeholder="Search namespaces..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>

          {/* Sort */}
          <button
            onClick={() => toggleSort(sortField)}
            title="Toggle sort direction"
            className="h-8 px-3 bg-[#0d1b2e] border border-[rgba(99,102,241,0.15)] rounded text-xs text-slate-400 hover:text-slate-200 hover:border-indigo-500/30 flex items-center gap-1.5 transition-colors"
          >
            <ArrowUpDown size={13} />
            Sort
          </button>

          {/* Create */}
          <button
            onClick={() => setShowCreate(true)}
            className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white flex items-center gap-1.5 transition-colors font-medium"
          >
            <Plus size={13} />
            Create
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6"><LoadingState resource="Namespaces" /></div>
        ) : isError ? (
          <div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>
        ) : (
          <div className="k-card p-0 overflow-hidden">
            <table className="k-table">
              <thead>
                <tr>
                  <th className="pl-4 w-1/4">
                    <button
                      onClick={() => toggleSort('name')}
                      className="flex items-center hover:text-white transition-colors"
                    >
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="w-1/5">
                    <button
                      onClick={() => toggleSort('created')}
                      className="flex items-center hover:text-white transition-colors"
                    >
                      Created <SortIcon field="created" />
                    </button>
                  </th>
                  <th className="w-20">Status</th>
                  <th className="w-24">Pods</th>
                  <th className="w-24">CPU Req</th>
                  <th className="w-24">Mem Req</th>
                  <th className="w-16 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {namespaces.map(ns => (
                  <tr key={ns.name}>
                    <td className="pl-4">
                      <Link
                        to={`/namespaces/${ns.name}`}
                        className="text-indigo-400 hover:text-indigo-300 font-mono text-xs hover:underline underline-offset-2 transition-colors"
                      >
                        {ns.name}
                      </Link>
                    </td>
                    <td className="text-xs text-slate-400 tabular-nums">
                      {formatDateTime(ns.created)}
                    </td>
                    <td>
                      <span className="kyma-badge badge-ok flex items-center gap-1 w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {ns.status || 'Active'}
                      </span>
                    </td>
                    <td>
                      {(ns as any).pods !== undefined ? (
                        <span className="flex items-center gap-1 text-xs">
                          <span className="text-emerald-400 font-mono font-bold">{(ns as any).running_pods ?? 0}</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-slate-400 font-mono">{(ns as any).pods ?? 0}</span>
                        </span>
                      ) : <span className="text-slate-600 text-xs">-</span>}
                    </td>
                    <td>
                      <span className="text-xs font-mono text-cyan-400/80">{(ns as any).cpu_requests || '-'}</span>
                    </td>
                    <td>
                      <span className="text-xs font-mono text-violet-400/80">{(ns as any).mem_requests || '-'}</span>
                    </td>
                    <td className="text-right pr-4">
                      <button
                        title={`Delete namespace ${ns.name}`}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {namespaces.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-10 text-sm">
                      {filter ? `No namespaces matching "${filter}"` : 'No namespaces found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Row count footer */}
            {namespaces.length > 0 && (
              <div className="px-4 py-2 border-t border-[rgba(99,102,241,0.08)] text-xs text-slate-600">
                {namespaces.length} namespace{namespaces.length !== 1 ? 's' : ''}
                {filter && ` matching "${filter}"`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create side panel */}
      {showCreate && <CreatePanel onClose={() => setShowCreate(false)} />}
    </>
  );
}
