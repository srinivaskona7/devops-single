import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { useNamespace } from '@/hooks/useNamespace';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { Globe, Search, RefreshCw, X, Trash2, FileText } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import type { Service, ServiceDetail, KEvent } from '@/types';
import { ResourceYamlPanel } from '@/components/shared/ResourceYamlPanel';

function typeBadge(type: string) {
  if (type === 'LoadBalancer') return 'bg-green-500/15 text-green-400 border border-green-500/25';
  if (type === 'NodePort') return 'bg-amber-500/15 text-amber-400 border border-amber-500/25';
  if (type === 'ExternalName') return 'bg-purple-500/15 text-purple-400 border border-purple-500/25';
  return 'bg-blue-500/15 text-blue-400 border border-blue-500/25';
}

function LabelTag({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
      <span className="text-slate-400">{k}:</span>{v}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 mt-4 first:mt-0">
      {children}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[11px] text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-[11px] text-slate-300 font-mono break-all">{children}</span>
    </div>
  );
}

function ServiceDetailPanel({
  ns,
  serviceName,
  onClose,
}: {
  ns: string;
  serviceName: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'view' | 'events'>('view');

  const { data: detailResp, isLoading } = useQuery<{ data: ServiceDetail | null; error: string | null }>({
    queryKey: ['service-detail', ns, serviceName],
    queryFn: () => api.serviceDetail(ns, serviceName),
    enabled: !!serviceName && !!ns,
    refetchInterval: 30_000,
  });

  const { data: eventsResp } = useQuery<{ items: KEvent[] }>({
    queryKey: ['events', ns],
    queryFn: () => api.events(ns),
    enabled: tab === 'events' && !!ns,
    refetchInterval: 30_000,
  });

  const detail = detailResp?.data;
  const serviceEvents = (eventsResp?.items || []).filter(e =>
    e.involvedObject === serviceName || e.involvedObject?.includes(serviceName)
  );

  return (
    <div className="w-[420px] shrink-0 k-card flex flex-col max-h-[calc(100vh-140px)] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{serviceName}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Service · {ns}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            className="h-7 px-2 flex items-center gap-1 text-[11px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded transition-colors"
            title="Delete service"
          >
            <Trash2 size={11} />
            Delete
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-3 mb-1">
        {(['view', 'events'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1 text-[11px] rounded font-medium transition-colors',
              tab === t
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pr-1 mt-1">
        {isLoading ? (
          <div className="space-y-2 mt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 rounded animate-pulse bg-white/[0.03]" />
            ))}
          </div>
        ) : !detail ? (
          <div className="text-xs text-slate-500 text-center py-8">{detailResp?.error || 'Failed to load'}</div>
        ) : tab === 'view' ? (
          <>
            {/* Metadata card */}
            <div className="k-card p-3 bg-white/[0.02]">
              <SectionTitle>Metadata</SectionTitle>
              <DetailRow label="Resource Type">Service</DetailRow>
              <DetailRow label="Namespace">{detail.namespace}</DetailRow>
              <DetailRow label="Age">{detail.creationTimestamp ? formatAge(detail.creationTimestamp) : '-'}</DetailRow>
              {Object.keys(detail.labels).length > 0 && (
                <div className="flex items-start gap-2 py-1.5 border-b border-white/[0.04]">
                  <span className="text-[11px] text-slate-500 w-28 shrink-0">Labels</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(detail.labels).map(([k, v]) => (
                      <LabelTag key={k} k={k} v={v} />
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(detail.annotations).length > 0 && (
                <div className="flex items-start gap-2 py-1.5">
                  <span className="text-[11px] text-slate-500 w-28 shrink-0">Annotations</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(detail.annotations)
                      .filter(([k]) => !k.includes('kubectl.kubernetes.io/last-applied'))
                      .map(([k, v]) => (
                        <LabelTag key={k} k={k.split('/').pop() || k} v={v} />
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Service Details card */}
            <div className="k-card p-3 bg-white/[0.02] mt-2">
              <SectionTitle>Service Details</SectionTitle>
              <DetailRow label="Type">
                <span className={cn('kyma-badge text-[10px]', typeBadge(detail.type))}>{detail.type}</span>
              </DetailRow>
              <DetailRow label="Cluster IP">{detail.clusterIP || 'None'}</DetailRow>
              {detail.externalIPs.length > 0 && (
                <DetailRow label="External IPs">{detail.externalIPs.join(', ')}</DetailRow>
              )}
              {detail.loadBalancerIP && (
                <DetailRow label="LB IP">{detail.loadBalancerIP}</DetailRow>
              )}
              {Object.keys(detail.selector).length > 0 && (
                <div className="flex items-start gap-2 py-1.5 border-b border-white/[0.04]">
                  <span className="text-[11px] text-slate-500 w-28 shrink-0">Selector</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(detail.selector).map(([k, v]) => (
                      <LabelTag key={k} k={k} v={v} />
                    ))}
                  </div>
                </div>
              )}

              {/* Ports table */}
              {detail.ports.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] text-slate-500 mb-1.5">Ports</div>
                  <div className="rounded overflow-hidden border border-white/[0.06]">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-white/[0.03]">
                          <th className="text-left px-2 py-1.5 text-slate-500 font-medium">Name</th>
                          <th className="text-left px-2 py-1.5 text-slate-500 font-medium">Port</th>
                          <th className="text-left px-2 py-1.5 text-slate-500 font-medium">Target</th>
                          <th className="text-left px-2 py-1.5 text-slate-500 font-medium">Proto</th>
                          {detail.type === 'NodePort' && (
                            <th className="text-left px-2 py-1.5 text-slate-500 font-medium">NodePort</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.ports.map((p, i) => (
                          <tr key={i} className="border-t border-white/[0.04]">
                            <td className="px-2 py-1.5 font-mono text-slate-400">{p.name || '-'}</td>
                            <td className="px-2 py-1.5 font-mono text-cyan-400">{p.port}</td>
                            <td className="px-2 py-1.5 font-mono text-slate-300">{p.targetPort}</td>
                            <td className="px-2 py-1.5 text-slate-400">{p.protocol}</td>
                            {detail.type === 'NodePort' && (
                              <td className="px-2 py-1.5 font-mono text-amber-400">{p.nodePort ?? '-'}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Endpoints section */}
            <div className="k-card p-3 bg-white/[0.02] mt-2">
              <SectionTitle>Endpoints</SectionTitle>
              {detail.endpoints.length === 0 ? (
                <div className="text-[11px] text-slate-500">No endpoints — no pods match the selector</div>
              ) : (
                <div className="space-y-2">
                  {detail.endpoints.map((ep, i) => (
                    <div key={i} className="rounded bg-white/[0.02] border border-white/[0.04] p-2">
                      <div className="text-[10px] text-slate-500 mb-1">
                        Ports: <span className="text-cyan-400 font-mono">{ep.ports.join(' · ') || '-'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ep.addresses.map(addr => (
                          <span
                            key={addr}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-green-500/10 border border-green-500/15 text-green-400"
                          >
                            {addr}
                          </span>
                        ))}
                        {ep.addresses.length === 0 && (
                          <span className="text-[11px] text-slate-500">No ready addresses</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Events tab */
          <div className="mt-1">
            {serviceEvents.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-8">No events for this service</div>
            ) : (
              <div className="space-y-1.5">
                {serviceEvents.map((ev, i) => (
                  <div key={i} className="k-card p-2.5 bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          'kyma-badge text-[10px]',
                          ev.type === 'Warning'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                            : 'bg-green-500/15 text-green-400 border border-green-500/25'
                        )}
                      >
                        {ev.type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{ev.reason}</span>
                    </div>
                    <div className="text-[11px] text-slate-300">{ev.message}</div>
                    {ev.count > 1 && (
                      <div className="text-[10px] text-slate-500 mt-1">×{ev.count}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const nsFromHook = useNamespace();
  const [, setSearchParams] = useSearchParams();
  const { namespace: nsParam } = useParams<{ namespace?: string }>();
  const navigate = useNavigate();
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [yamlItem, setYamlItem] = useState<{name: string; namespace?: string} | null>(null);
  const ns = nsFromHook || (nsData?.items?.[0]?.name ?? '');

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: Service[] }>({
    queryKey: ['services', ns],
    queryFn: () => api.services(ns),
    enabled: !!ns,
    refetchInterval: REFETCH_INTERVAL,
  });

  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  if (isLoading) return (<div className="p-6"><LoadingState resource="Services" /></div>);
  if (isError) return (<div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Services</h1>
          <span className="text-xs text-slate-500">({items.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
            value={ns}
            onChange={e => {
              setSelectedService(null);
              if (nsParam) {
                navigate(`/namespaces/${e.target.value}/services`);
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
          placeholder="Filter services..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      <div className="flex gap-4 items-start">
        {/* Table */}
        <div className={cn('flex-1 min-w-0 transition-all', selectedService ? 'min-w-0' : 'w-full')}>
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
                    <th>Type</th>
                    <th>Cluster IP</th>
                    <th>External IP</th>
                    <th>Ports</th>
                    <th>Age</th>
                    <th className="w-12">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(d => (
                    <tr
                      key={d.name}
                      className={cn(
                        'cursor-pointer hover:bg-indigo-500/5 transition-colors',
                        selectedService === d.name && 'bg-indigo-500/8 border-l-2 border-indigo-500'
                      )}
                      onClick={() => setSelectedService(selectedService === d.name ? null : d.name)}
                    >
                      <td className="pl-4 font-mono text-xs text-indigo-400 cursor-pointer hover:text-indigo-300" onClick={(e) => { e.stopPropagation(); setYamlItem({name: d.name, namespace: d.namespace || ns}); }}>{d.name}</td>
                      <td className="text-xs text-slate-500">{d.namespace}</td>
                      <td>
                        <span className={cn('kyma-badge text-[10px]', typeBadge(d.type))}>{d.type}</span>
                      </td>
                      <td className="text-xs font-mono text-slate-400">{d.clusterIP || '-'}</td>
                      <td className="text-xs font-mono text-slate-400">{d.externalIP || '-'}</td>
                      <td className="text-xs text-slate-400">
                        {Array.isArray(d.ports)
                          ? (d.ports as any[]).map((p: any) => `${p.port}/${p.protocol || 'TCP'}`).join(', ')
                          : d.ports || '-'}
                      </td>
                      <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button onClick={() => setYamlItem({name: d.name, namespace: d.namespace || ns})} title="View/Edit YAML" className="text-slate-500 hover:text-indigo-400 p-1"><FileText size={12}/></button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-slate-500 py-8">
                        {ns ? 'No services found' : 'Select a namespace'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail side panel */}
        {selectedService && (
          <ServiceDetailPanel
            ns={ns}
            serviceName={selectedService}
            onClose={() => setSelectedService(null)}
          />
        )}
      </div>
      {yamlItem && <div className="mt-3"><ResourceYamlPanel kind="service" name={yamlItem.name} namespace={yamlItem.namespace} onClose={() => setYamlItem(null)} /></div>}
    </div>
  );
}
