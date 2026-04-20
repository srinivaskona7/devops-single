import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { useNamespace } from '@/hooks/useNamespace';
import { Monitor, Search, RefreshCw, FileText } from 'lucide-react';
import { useState } from 'react';
import { ResourceYamlPanel } from '@/components/shared/ResourceYamlPanel';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import type { DaemonSet } from '@/types';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';

export default function DaemonSetsPage() {
  const nsFromHook = useNamespace();
  const [, setSearchParams] = useSearchParams();
  const { namespace: nsParam } = useParams<{ namespace?: string }>();
  const navigate = useNavigate();
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [yamlItem, setYamlItem] = useState<{name: string; namespace?: string} | null>(null);
  const ns = nsFromHook || (nsData?.items?.[0]?.name ?? '');

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: DaemonSet[] }>({
    queryKey: ['daemonsets', ns],
    queryFn: () => api.daemonsets(ns),
    enabled: !!ns,
    refetchInterval: REFETCH_INTERVAL,
  });

  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  if (isLoading) return (<div className="p-6"><LoadingState resource="DaemonSets" /></div>);
  if (isError) return (<div className="p-6"><ErrorState title="Failed to load daemonsets" error={error} onRetry={() => refetch()} /></div>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">DaemonSets</h1>
          <span className="text-xs text-slate-500">({items.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
            value={ns}
            onChange={e => {
              if (nsParam) {
                navigate(`/namespaces/${e.target.value}/daemonsets`);
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
          placeholder="Filter daemonsets..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
      ) : (
        <div className="k-card p-0 overflow-hidden">
          <table className="k-table">
            <thead><tr><th className="pl-4">Name</th><th>Namespace</th><th>Desired/Ready</th><th>Age</th></tr></thead>
            <tbody>
              {items.map(d => (
                <tr key={d.name}>
                  <td className="pl-4 font-mono text-xs text-indigo-400 cursor-pointer hover:text-indigo-300" onClick={() => setYamlItem({name: d.name, namespace: d.namespace})}>{d.name}</td>
                  <td className="text-xs text-slate-500">{d.namespace}</td>
                  <td className="text-xs font-mono">
                    <span className={cn('kyma-badge text-[10px]', d.ready >= d.desired ? 'badge-ok' : 'badge-warn')}>
                      {d.ready}/{d.desired}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500 py-8">{ns ? 'No daemonsets found' : 'Select a namespace'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {yamlItem && (
        <div className="mt-3">
          <ResourceYamlPanel kind="daemonset" name={yamlItem.name} namespace={yamlItem.namespace} onClose={() => setYamlItem(null)} />
        </div>
      )}
    </div>
  );
}
