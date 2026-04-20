import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge, statusBg } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { useNamespace } from '@/hooks/useNamespace';
import { Package, Search, RefreshCw, X, ChevronRight, FileText } from 'lucide-react';
import { useState } from 'react';
import { ResourceYamlPanel } from '@/components/shared/ResourceYamlPanel';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import type { PVC } from '@/types';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-1 border-b border-white/[0.04] gap-4">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs text-slate-300 font-mono text-right break-all">{value || '-'}</span>
    </div>
  );
}

export default function PVCsPage() {
  const nsFromHook = useNamespace();
  const [, setSearchParams] = useSearchParams();
  const { namespace: nsParam } = useParams<{ namespace?: string }>();
  const navigate = useNavigate();
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [selectedPVC, setSelectedPVC] = useState<PVC | null>(null);
  const [yamlItem, setYamlItem] = useState<{name: string; namespace?: string} | null>(null);
  const ns = nsFromHook || (nsData?.items?.[0]?.name ?? '');

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: PVC[] }>({
    queryKey: ['pvcs', ns],
    queryFn: () => api.pvcs(ns),
    enabled: !!ns,
    refetchInterval: REFETCH_INTERVAL,
  });

  const items = (data?.items || []).filter(
    d => !filter || d.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (isLoading) return (<div className="p-6"><LoadingState resource="Persistent Volume Claims" /></div>);
  if (isError) return (<div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>);

  return (
    <div className="space-y-4">
    <div className="flex gap-4 h-full">
      {/* Main table */}
      <div className={cn('space-y-4 min-w-0', selectedPVC ? 'flex-1' : 'w-full')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">Persistent Volume Claims</h1>
            <span className="text-xs text-slate-500">({items.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
              value={ns}
              onChange={e => {
                setSelectedPVC(null);
                if (nsParam) {
                  navigate(`/namespaces/${e.target.value}/pvcs`);
                } else {
                  setSearchParams({ namespace: e.target.value });
                }
              }}
            >
              <option value="">Select namespace</option>
              {(nsData?.items || []).map(n => (
                <option key={n.name} value={n.name}>{n.name}</option>
              ))}
            </select>
            <button
              onClick={() => refetch()}
              className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
            placeholder="Filter PVCs..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

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
                  <th className="pl-4">Name</th>
                  <th>Namespace</th>
                  <th>Status</th>
                  <th>Capacity</th>
                  <th>Access Modes</th>
                  <th>StorageClass</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {items.map(d => (
                  <tr
                    key={`${d.namespace}/${d.name}`}
                    className={cn(
                      'cursor-pointer',
                      selectedPVC?.name === d.name && selectedPVC?.namespace === d.namespace
                        ? 'bg-indigo-500/10'
                        : ''
                    )}
                    onClick={() =>
                      setSelectedPVC(
                        selectedPVC?.name === d.name && selectedPVC?.namespace === d.namespace
                          ? null
                          : d
                      )
                    }
                  >
                    <td className="pl-4" onClick={e => { e.stopPropagation(); setYamlItem({name: d.name, namespace: d.namespace}); }}>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-indigo-400 cursor-pointer hover:text-indigo-300">{d.name}</span>
                        <ChevronRight
                          size={12}
                          className={cn(
                            'text-slate-600 transition-transform',
                            selectedPVC?.name === d.name && selectedPVC?.namespace === d.namespace
                              ? 'rotate-90 text-indigo-400'
                              : ''
                          )}
                        />
                      </div>
                    </td>
                    <td className="text-xs text-slate-500">{d.namespace}</td>
                    <td>
                      <span className={cn('kyma-badge text-[10px]', statusBg(d.status))}>{d.status}</span>
                    </td>
                    <td className="text-xs font-mono text-slate-300">{d.capacity || '-'}</td>
                    <td className="text-xs text-slate-400">{(d.accessModes || []).join(', ') || '-'}</td>
                    <td className="text-xs text-slate-400">{d.storageClass || '-'}</td>
                    <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">
                      {ns ? 'No PVCs found' : 'Select a namespace'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedPVC && (
        <div className="w-80 shrink-0">
          <div className="k-card space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate">{selectedPVC.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedPVC.namespace}</p>
              </div>
              <button
                onClick={() => setSelectedPVC(null)}
                className="text-slate-500 hover:text-slate-300 shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span className={cn('kyma-badge text-[10px]', statusBg(selectedPVC.status))}>
                {selectedPVC.status}
              </span>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Details</p>
              <DetailRow label="Volume" value={selectedPVC.volume} />
              <DetailRow label="Capacity" value={selectedPVC.capacity} />
              <DetailRow
                label="Access Modes"
                value={(selectedPVC.accessModes || []).join(', ') || undefined}
              />
              <DetailRow label="Storage Class" value={selectedPVC.storageClass} />
              <DetailRow
                label="Age"
                value={selectedPVC.created ? formatAge(selectedPVC.created) : undefined}
              />
            </div>

            {/* Labels */}
            {selectedPVC.labels && Object.keys(selectedPVC.labels).length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Labels</p>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {Object.entries(selectedPVC.labels).map(([k, v]) => (
                    <div key={k} className="flex gap-1 text-[10px]">
                      <span className="text-slate-500 truncate max-w-[140px]">{k}</span>
                      <span className="text-slate-400">=</span>
                      <span className="text-slate-300 font-mono truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Annotations */}
            {selectedPVC.annotations && Object.keys(selectedPVC.annotations).length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Annotations</p>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {Object.entries(selectedPVC.annotations).map(([k, v]) => (
                    <div key={k} className="text-[10px]">
                      <span className="text-slate-500">{k}</span>
                      <div className="text-slate-400 font-mono break-all mt-0.5 pl-2">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {yamlItem && (
        <div className="mt-3">
          <ResourceYamlPanel kind="pvc" name={yamlItem.name} namespace={yamlItem.namespace} onClose={() => setYamlItem(null)} />
        </div>
      )}
    </div>
    </div>
  );
}
