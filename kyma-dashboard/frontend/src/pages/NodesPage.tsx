import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge } from '@/lib/utils';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { Server, RefreshCw, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { NodeDetail } from '@/types';

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 font-mono w-8">{pct}%</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1 border-b border-white/[0.04] gap-4">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs text-slate-300 font-mono text-right break-all">{value}</span>
    </div>
  );
}

function ConditionBadge({ status }: { status: string }) {
  const ok = status === 'True';
  return (
    <span className={cn(
      'kyma-badge text-[10px]',
      ok ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-red-500/15 text-red-400 border border-red-500/25'
    )}>
      {status}
    </span>
  );
}

export default function NodesPage() {
  const { data, isLoading, isError, error, refetch: refetchNodes } = useQuery<{ nodes: any[] }>({
    queryKey: ['nodes'],
    queryFn: api.nodes,
    refetchInterval: REFETCH_INTERVAL,
  });

  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { data: detailData, isLoading: detailLoading } = useQuery<{ data: NodeDetail | null; error: string | null }>({
    queryKey: ['node-detail', selectedNode],
    queryFn: () => api.nodeDetail(selectedNode!),
    enabled: !!selectedNode,
  });

  const nodes = data?.nodes || [];
  const detail = detailData?.data;

  return (
    <div className="flex gap-4 h-full">
      {/* Main table */}
      <div className={cn('space-y-4 min-w-0', selectedNode ? 'flex-1' : 'w-full')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">Nodes</h1>
            <span className="text-xs text-slate-500">({nodes.length})</span>
          </div>
          <button
            onClick={() => refetchNodes()}
            className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300 flex items-center gap-1"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6"><LoadingState resource="Nodes" /></div>
        ) : isError ? (
          <div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetchNodes()} /></div>
        ) : (
          <div className="k-card p-0 overflow-hidden overflow-x-auto">
            <table className="k-table">
              <thead>
                <tr>
                  <th className="pl-4">Name</th>
                  <th>CPU</th>
                  <th>Memory</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Pool</th>
                  <th>Machine Type</th>
                  <th>Zone</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map(node => (
                  <tr
                    key={node.name}
                    className={cn(
                      'cursor-pointer',
                      selectedNode === node.name && 'bg-indigo-500/10'
                    )}
                    onClick={() => setSelectedNode(selectedNode === node.name ? null : node.name)}
                  >
                    <td className="pl-4">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-indigo-400 hover:underline">
                          {node.name}
                        </span>
                        <ChevronRight
                          size={12}
                          className={cn(
                            'text-slate-600 transition-transform',
                            selectedNode === node.name && 'rotate-90 text-indigo-400'
                          )}
                        />
                      </div>
                    </td>
                    <td>
                      {node.cpu_percent != null ? (
                        <ProgressBar
                          pct={node.cpu_percent}
                          color={node.cpu_percent > 80 ? 'bg-red-500' : node.cpu_percent > 60 ? 'bg-amber-500' : 'bg-cyan-400'}
                        />
                      ) : (
                        <span className="text-xs text-slate-500">{node.cpu || '-'}</span>
                      )}
                    </td>
                    <td>
                      {node.memory_percent != null ? (
                        <ProgressBar
                          pct={node.memory_percent}
                          color={node.memory_percent > 80 ? 'bg-red-500' : node.memory_percent > 60 ? 'bg-amber-500' : 'bg-purple-400'}
                        />
                      ) : (
                        <span className="text-xs text-slate-500">{node.memory || '-'}</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-500">
                      {node.age || '-'}
                    </td>
                    <td>
                      <span className={cn('kyma-badge text-[10px]', node.status === 'Ready' ? 'badge-ok' : 'badge-err')}>
                        {node.status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400 font-mono">{node.pool || '-'}</td>
                    <td className="text-xs text-slate-400">{node.machine_type || '-'}</td>
                    <td className="text-xs text-slate-500">{node.zone || '-'}</td>
                  </tr>
                ))}
                {nodes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-500 py-8">No nodes found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="w-96 shrink-0 space-y-3">
          <div className="k-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white truncate max-w-[280px]">{selectedNode}</h2>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X size={14} />
              </button>
            </div>

            {detailLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-4 animate-pulse bg-white/[0.04] rounded" />
                ))}
              </div>
            ) : detail ? (
              <div className="space-y-4">
                {/* Addresses */}
                {detail.addresses?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Addresses</p>
                    {detail.addresses.map(a => (
                      <DetailRow key={a.type} label={a.type} value={a.address} />
                    ))}
                  </div>
                )}

                {/* System Info */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">System Info</p>
                  <DetailRow label="OS" value={detail.nodeInfo?.osImage} />
                  <DetailRow label="Kernel" value={detail.nodeInfo?.kernelVersion} />
                  <DetailRow label="Container Runtime" value={detail.nodeInfo?.containerRuntimeVersion} />
                  <DetailRow label="Kubelet" value={detail.nodeInfo?.kubeletVersion} />
                  <DetailRow label="Architecture" value={detail.nodeInfo?.architecture} />
                </div>

                {/* Capacity */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Capacity / Allocatable</p>
                  {Object.entries(detail.capacity || {}).map(([k, v]) => (
                    <DetailRow
                      key={k}
                      label={k}
                      value={`${v} / ${detail.allocatable?.[k] || '-'}`}
                    />
                  ))}
                </div>

                {/* Conditions */}
                {detail.conditions?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Conditions</p>
                    <div className="space-y-1">
                      {detail.conditions.map(c => (
                        <div key={c.type} className="flex items-center justify-between py-0.5">
                          <span className="text-xs text-slate-400">{c.type}</span>
                          <ConditionBadge status={c.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Taints */}
                {detail.taints?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Taints</p>
                    {detail.taints.map((t, i) => (
                      <div key={i} className="text-xs text-amber-400 font-mono py-0.5">
                        {t.key}{t.value ? `=${t.value}` : ''}:{t.effect}
                      </div>
                    ))}
                  </div>
                )}

                {/* Labels */}
                {Object.keys(detail.labels || {}).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Labels</p>
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {Object.entries(detail.labels).map(([k, v]) => (
                        <div key={k} className="flex gap-1 text-[10px]">
                          <span className="text-slate-500 truncate max-w-[180px]">{k}</span>
                          <span className="text-slate-400">=</span>
                          <span className="text-slate-300 font-mono truncate">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creation */}
                <DetailRow label="Created" value={detail.creationTimestamp ? formatAge(detail.creationTimestamp) + ' ago' : undefined} />
              </div>
            ) : (
              <p className="text-xs text-slate-500">No detail available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
