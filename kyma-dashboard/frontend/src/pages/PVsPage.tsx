import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge, statusBg } from '@/lib/utils';
import { HardDrive, Search, RefreshCw, FileText } from 'lucide-react';
import { useState } from 'react';
import { ResourceYamlPanel } from '@/components/shared/ResourceYamlPanel';
import type { PV } from '@/types';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';

export default function PVsPage() {
  const [filter, setFilter] = useState('');
  const [yamlItem, setYamlItem] = useState<{name: string} | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: PV[] }>({
    queryKey: ['pvs'],
    queryFn: api.pvs,
    refetchInterval: REFETCH_INTERVAL,
  });

  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  if (isLoading) return (<div className="p-6"><LoadingState resource="Persistent Volumes" /></div>);
  if (isError) return (<div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Persistent Volumes</h1>
          <span className="text-xs text-slate-500">({items.length})</span>
        </div>
        <button onClick={() => refetch()} className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300 flex items-center gap-1">
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
          placeholder="Filter PVs..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
      ) : (
        <div className="k-card p-0 overflow-hidden">
          <table className="k-table">
            <thead><tr><th className="pl-4">Name</th><th>Capacity</th><th>Access Modes</th><th>Reclaim Policy</th><th>Status</th><th>StorageClass</th><th>Age</th></tr></thead>
            <tbody>
              {items.map(d => (
                <tr key={d.name}>
                  <td className="pl-4 font-mono text-xs text-indigo-400 cursor-pointer hover:text-indigo-300" onClick={() => setYamlItem({name: d.name})}>{d.name}</td>
                  <td className="text-xs font-mono text-slate-300">{d.capacity || '-'}</td>
                  <td className="text-xs text-slate-400">{(d.accessModes || []).join(', ') || '-'}</td>
                  <td className="text-xs text-slate-400">{d.reclaimPolicy || '-'}</td>
                  <td><span className={cn('kyma-badge text-[10px]', statusBg(d.status))}>{d.status}</span></td>
                  <td className="text-xs text-slate-400">{d.storageClass || '-'}</td>
                  <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">No persistent volumes found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {yamlItem && (
        <div className="mt-3">
          <ResourceYamlPanel kind="pv" name={yamlItem.name} cluster onClose={() => setYamlItem(null)} />
        </div>
      )}
    </div>
  );
}
