import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { useNamespace } from '@/hooks/useNamespace';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { Container, Search, RefreshCw, X, ChevronRight, Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import type { Deployment } from '@/types';
import { ResourceYamlPanel } from '@/components/shared/ResourceYamlPanel';

interface DeploymentDetail {
  name: string;
  namespace: string;
  creationTimestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  updatedReplicas: number;
  strategy: string;
  selector: Record<string, string>;
  containers: {
    name: string;
    image: string;
    imagePullPolicy: string;
    requests: Record<string, string>;
    limits: Record<string, string>;
    ports: string[];
  }[];
  conditions: {
    type: string;
    status: string;
    reason: string;
    message: string;
    lastUpdateTime: string;
  }[];
}

function StatChip({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[60px]',
      accent ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-white/[0.03] border border-white/[0.06]'
    )}>
      <span className={cn('text-base font-bold font-mono', accent ? 'text-indigo-300' : 'text-white')}>{value}</span>
      <span className="text-[10px] text-slate-500 mt-0.5">{label}</span>
    </div>
  );
}

function ConditionBadge({ status }: { status: string }) {
  const ok = status === 'True';
  return (
    <span className={cn(
      'kyma-badge text-[10px] font-mono',
      ok ? 'badge-ok' : 'badge-err'
    )}>
      {status}
    </span>
  );
}

function DeploymentDetailPanel({
  deployment,
  ns,
  onClose,
  navigate,
  onViewYaml,
}: {
  deployment: Deployment;
  ns: string;
  onClose: () => void;
  navigate: (path: string) => void;
  onViewYaml?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');

  const { data, isLoading } = useQuery<{ data: DeploymentDetail | null; error: string | null }>({
    queryKey: ['deployment-detail', ns, deployment.name],
    queryFn: () => api.deploymentDetail(ns, deployment.name),
    enabled: !!ns && !!deployment.name,
  });

  const detail = data?.data;

  return (
    <div className="w-[420px] flex-shrink-0 k-card flex flex-col max-h-[calc(100vh-120px)] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Container size={13} className="text-indigo-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Deployment</span>
          </div>
          <div className="text-sm font-bold text-white font-mono truncate">{deployment.name}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{ns}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn(
            'kyma-badge text-[10px]',
            (deployment.readyReplicas ?? 0) >= deployment.replicas ? 'badge-ok' : 'badge-warn'
          )}>
            {deployment.readyReplicas ?? 0}/{deployment.replicas} Ready
          </span>
          {onViewYaml && (
            <button
              onClick={onViewYaml}
              title="View/Edit YAML"
              className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-white/10 transition-colors"
            >
              <FileText size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* View/Edit tabs */}
      <div className="flex gap-1 mt-3 mb-3">
        {(['view', 'edit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-1 text-xs rounded capitalize transition-colors',
              activeTab === tab
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex-1 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : !detail ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
          {data?.error || 'Failed to load detail'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* Metadata card */}
          <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Metadata</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Resource Type</span>
                <span className="text-slate-300">Deployment</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Age</span>
                <span className="text-slate-300 font-mono">{detail.creationTimestamp ? formatAge(detail.creationTimestamp) : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Strategy</span>
                <span className="text-slate-300">{detail.strategy}</span>
              </div>
              {Object.keys(detail.labels).length > 0 && (
                <div>
                  <div className="text-slate-500 mb-1">Labels</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(detail.labels).map(([k, v]) => (
                      <span key={k} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                        {k}={v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(detail.selector).length > 0 && (
                <div>
                  <div className="text-slate-500 mb-1">Selector</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(detail.selector).map(([k, v]) => (
                      <span key={k} className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                        {k}={v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Replica stats */}
          <div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Replicas</div>
            <div className="flex gap-2 flex-wrap">
              <StatChip label="Ready" value={detail.readyReplicas} accent />
              <StatChip label="Available" value={detail.availableReplicas} />
              <StatChip label="Updated" value={detail.updatedReplicas} />
              <StatChip label="Total" value={detail.replicas} />
            </div>
          </div>

          {/* Containers */}
          {detail.containers.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">
                Containers ({detail.containers.length})
              </div>
              <div className="space-y-2">
                {detail.containers.map(c => (
                  <div key={c.name} className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Container size={11} className="text-indigo-400" />
                      <span className="text-xs font-bold text-white font-mono">{c.name}</span>
                      {c.imagePullPolicy && (
                        <span className="text-[10px] text-slate-500 ml-auto">{c.imagePullPolicy}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate mb-2" title={c.image}>
                      {c.image}
                    </div>
                    {(Object.keys(c.requests).length > 0 || Object.keys(c.limits).length > 0) && (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.keys(c.requests).length > 0 && (
                          <div>
                            <div className="text-[10px] text-slate-500 mb-1">Requests</div>
                            {Object.entries(c.requests).map(([k, v]) => (
                              <div key={k} className="text-[10px] font-mono text-slate-400">
                                <span className="text-slate-500">{k}:</span> {v}
                              </div>
                            ))}
                          </div>
                        )}
                        {Object.keys(c.limits).length > 0 && (
                          <div>
                            <div className="text-[10px] text-slate-500 mb-1">Limits</div>
                            {Object.entries(c.limits).map(([k, v]) => (
                              <div key={k} className="text-[10px] font-mono text-slate-400">
                                <span className="text-slate-500">{k}:</span> {v}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {c.ports.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.ports.map(p => (
                          <span key={p} className="bg-white/[0.04] text-slate-400 text-[10px] px-1.5 py-0.5 rounded font-mono">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conditions */}
          {detail.conditions.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Conditions</div>
              <div className="space-y-1.5">
                {detail.conditions.map(cond => (
                  <div key={cond.type} className="flex items-center justify-between bg-white/[0.02] rounded px-3 py-1.5 border border-white/[0.04]">
                    <div>
                      <span className="text-xs text-slate-300 font-mono">{cond.type}</span>
                      {cond.reason && (
                        <span className="text-[10px] text-slate-500 ml-2">{cond.reason}</span>
                      )}
                    </div>
                    <ConditionBadge status={cond.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View Pods button */}
          <button
            onClick={() => navigate(`/namespaces/${ns}/pods`)}
            className="w-full flex items-center justify-between px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg text-xs text-indigo-300 transition-colors"
          >
            <span>View Pods in {ns}</span>
            <ChevronRight size={12} />
          </button>

        </div>
      )}
    </div>
  );
}

export default function DeploymentsPage() {
  const nsFromHook = useNamespace();
  const [, setSearchParams] = useSearchParams();
  const { namespace: nsParam } = useParams<{ namespace?: string }>();
  const navigate = useNavigate();
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [yamlItem, setYamlItem] = useState<{name: string; namespace?: string} | null>(null);
  const ns = nsFromHook || (nsData?.items?.[0]?.name ?? '');

  const downloadManifest = async (kind: string, namespace: string, name: string) => {
    try {
      const res = await fetch(`/api/manifest?kind=${kind}&namespace=${namespace}&name=${name}`);
      const data = await res.json();
      if (data.yaml) {
        const blob = new Blob([data.yaml], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silent fail
    }
  };

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: Deployment[] }>({
    queryKey: ['deployments', ns],
    queryFn: () => api.deployments(ns),
    enabled: !!ns,
    refetchInterval: REFETCH_INTERVAL,
  });

  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  if (isLoading) return (<div className="p-6"><LoadingState resource="Deployments" /></div>);
  if (isError) return (<div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Container size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Deployments</h1>
          <span className="text-xs text-slate-500">({items.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
            value={ns}
            onChange={e => {
              if (nsParam) {
                navigate(`/namespaces/${e.target.value}/deployments`);
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
          placeholder="Filter deployments..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      <div className="flex gap-4">
        <div className={cn('flex-1 min-w-0 transition-all', selectedDeployment ? '' : 'w-full')}>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
          ) : (
            <div className="k-card p-0 overflow-hidden">
              <table className="k-table">
                <thead>
                  <tr>
                    <th className="pl-4">Name</th>
                    <th>Namespace</th>
                    <th>Ready</th>
                    <th>Image</th>
                    <th>Age</th>
                    <th className="w-12">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(d => (
                    <tr
                      key={d.name}
                      onClick={() => setSelectedDeployment(prev => prev?.name === d.name ? null : d)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-indigo-500/5',
                        selectedDeployment?.name === d.name && 'bg-indigo-500/10'
                      )}
                    >
                      <td className="pl-4 font-mono text-xs text-indigo-400 cursor-pointer hover:text-indigo-300" onClick={(e) => { e.stopPropagation(); setYamlItem({name: d.name, namespace: d.namespace || ns}); }}>{d.name}</td>
                      <td className="text-xs text-slate-500">{d.namespace}</td>
                      <td className="text-xs font-mono">
                        <span className={cn('kyma-badge text-[10px]', (d.readyReplicas ?? 0) >= d.replicas ? 'badge-ok' : 'badge-warn')}>
                          {d.readyReplicas ?? 0}/{d.replicas}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500 max-w-xs truncate">{d.image || '-'}</td>
                      <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          title="Download manifest"
                          onClick={() => downloadManifest('deployment', d.namespace || ns, d.name)}
                          className="text-slate-500 hover:text-emerald-400 p-0.5"
                        >
                          <Download size={12} />
                        </button>
                        <button onClick={() => setYamlItem({name: d.name, namespace: d.namespace || ns})} title="View/Edit YAML" className="text-slate-500 hover:text-indigo-400 p-1"><FileText size={12}/></button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-slate-500 py-8">{ns ? 'No deployments found' : 'Select a namespace'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedDeployment && (
          <DeploymentDetailPanel
            deployment={selectedDeployment}
            ns={ns}
            onClose={() => setSelectedDeployment(null)}
            navigate={navigate}
            onViewYaml={() => setYamlItem({name: selectedDeployment.name, namespace: selectedDeployment.namespace || ns})}
          />
        )}
      </div>
      {yamlItem && <div className="mt-3"><ResourceYamlPanel kind="deployment" name={yamlItem.name} namespace={yamlItem.namespace} onClose={() => setYamlItem(null)} /></div>}
    </div>
  );
}
