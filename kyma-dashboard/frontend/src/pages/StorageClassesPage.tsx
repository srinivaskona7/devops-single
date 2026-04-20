import { useQuery } from '@tanstack/react-query';
import { formatAge } from '@/lib/utils';
import { Archive, Search, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { StorageClass } from '@/types';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';

export default function StorageClassesPage() {
  const [filter, setFilter] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: StorageClass[] }>({
    queryKey: ['storageclasses'],
    queryFn: () => fetch('/api/storageclasses').then(r => r.json()),
    refetchInterval: REFETCH_INTERVAL,
  });

  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Storage Classes</h1>
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
          placeholder="Filter storage classes..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
      ) : (
        <div className="k-card p-0 overflow-hidden">
          <table className="k-table">
            <thead><tr><th className="pl-4">Name</th><th>Provisioner</th><th>Reclaim Policy</th><th>Volume Binding Mode</th><th>Default</th><th>Age</th></tr></thead>
            <tbody>
              {items.map(d => (
                <tr key={d.name}>
                  <td className="pl-4 font-mono text-xs text-indigo-400">{d.name}</td>
                  <td className="text-xs text-slate-400 font-mono">{d.provisioner || '-'}</td>
                  <td className="text-xs text-slate-400">{d.reclaimPolicy || '-'}</td>
                  <td className="text-xs text-slate-400">{d.volumeBindingMode || '-'}</td>
                  <td className="text-xs">
                    {d.allowVolumeExpansion ? (
                      <span className="kyma-badge badge-ok text-[10px]">Default</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-8">No storage classes found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
