import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { useNamespace } from '@/hooks/useNamespace';
import { Activity, Search, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { REFETCH_INTERVAL } from '@/lib/constants';
import type { KEvent } from '@/types';

export default function EventsPage() {
  const nsFromHook = useNamespace();
  const [, setSearchParams] = useSearchParams();
  const { namespace: nsParam } = useParams<{ namespace?: string }>();
  const navigate = useNavigate();
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'warning' | 'normal'>('all');
  const ns = nsFromHook || '';

  const { data, isLoading, refetch } = useQuery<{ items?: KEvent[]; events?: KEvent[] }>({
    queryKey: ['events', ns || 'kube-system'],
    queryFn: () => api.events(ns || 'kube-system'),
    refetchInterval: REFETCH_INTERVAL,
  });

  const raw = data?.items || data?.events || [];
  const events = raw.filter(e => {
    if (typeFilter === 'warning' && e.type?.toLowerCase() !== 'warning') return false;
    if (typeFilter === 'normal' && e.type?.toLowerCase() !== 'normal') return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (
        e.message?.toLowerCase().includes(q) ||
        e.reason?.toLowerCase().includes(q) ||
        e.name?.toLowerCase().includes(q) ||
        e.namespace?.toLowerCase().includes(q) ||
        e.involvedObject?.toLowerCase().includes(q) ||
        e.source?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const warningCount = raw.filter(e => e.type?.toLowerCase() === 'warning').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <span className="text-xs text-slate-500">({events.length})</span>
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
              {warningCount} warnings
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
            value={ns}
            onChange={e => {
              if (nsParam) {
                navigate(`/namespaces/${e.target.value}/events`);
              } else {
                setSearchParams({ namespace: e.target.value });
              }
            }}
          >
            <option value="">kube-system</option>
            {(nsData?.items || []).map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
          </select>
          <button
            onClick={() => refetch()}
            className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300 flex items-center gap-1"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
            placeholder="Search events..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select
          className="h-8 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as 'all' | 'warning' | 'normal')}
        >
          <option value="all">All messages</option>
          <option value="warning">Warnings only</option>
          <option value="normal">Normal only</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
      ) : (
        <div className="k-card p-0 overflow-hidden">
          <table className="k-table">
            <thead>
              <tr>
                <th className="pl-4 w-24">Type</th>
                <th className="w-72">Message</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Involved Object</th>
                <th>Source</th>
                <th className="w-16">Count</th>
                <th className="w-24">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => {
                const isWarning = e.type?.toLowerCase() === 'warning';
                return (
                  <tr
                    key={i}
                    className={cn(
                      isWarning && 'bg-amber-500/[0.04] hover:bg-amber-500/[0.07]'
                    )}
                  >
                    <td className="pl-4">
                      <span
                        className={cn(
                          'kyma-badge text-[10px]',
                          isWarning
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                            : 'bg-slate-500/15 text-slate-400 border border-slate-500/25'
                        )}
                      >
                        {e.type || '-'}
                      </span>
                    </td>
                    <td
                      className="text-xs text-slate-400 max-w-[280px] truncate"
                      title={e.message}
                    >
                      {e.message?.length > 80
                        ? e.message.slice(0, 80) + '…'
                        : e.message || '-'}
                    </td>
                    <td className="text-xs text-slate-300 font-mono">{e.reason || '-'}</td>
                    <td className="text-xs text-slate-500">{e.namespace || '-'}</td>
                    <td className="text-xs text-indigo-400 font-mono">
                      {e.involvedObjectKind && e.involvedObjectName ? (
                        <span>
                          <span className="text-slate-500">{e.involvedObjectKind}/</span>
                          {e.involvedObjectName}
                        </span>
                      ) : (
                        e.involvedObject || '-'
                      )}
                    </td>
                    <td className="text-xs text-slate-500">{e.source || '-'}</td>
                    <td className="text-xs font-mono text-slate-500 text-center">
                      {e.count || '-'}
                    </td>
                    <td className="text-xs text-slate-500">
                      {e.lastTimestamp ? formatAge(e.lastTimestamp) : '-'}
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-500 py-8">
                    No events found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
