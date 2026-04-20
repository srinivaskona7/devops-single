import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useNamespaces } from '@/hooks/useClusterData';
import { Globe, Search, RefreshCw, GitBranch, Shield, Lock, Network, Layers } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ResourceYamlPanel } from '@/components/shared/ResourceYamlPanel';

type TabKey = 'virtualservices' | 'gateways' | 'destinationrules' | 'peerauth' | 'authzpolicies' | 'serviceentries' | 'apirules' | 'requestauth' | 'sidecars';

// kind used for kubectl get / YAML fetch
const TAB_KIND: Record<TabKey, string> = {
  virtualservices:  'virtualservice',
  gateways:         'gateway',
  destinationrules: 'destinationrule',
  peerauth:         'peerauthentication',
  authzpolicies:    'authorizationpolicy',
  serviceentries:   'serviceentry',
  apirules:         'apirule',
  requestauth:      'requestauthentication',
  sidecars:         'sidecar',
};

function formatAge(dateStr: string): string {
  if (!dateStr) return '-';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function IstioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') || 'virtualservices') as TabKey;
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [ns, setNs] = useState(searchParams.get('namespace') || '');
  const [yamlItem, setYamlItem] = useState<{ name: string; namespace: string } | null>(null);
  const currentNs = ns || (nsData?.items?.[0]?.name ?? '');

  const enabled = (t: TabKey) => !!currentNs && tab === t;

  const { data: vsData,  isLoading: loadingVs,  refetch: refetchVs  } = useQuery({ queryKey: ['istio-vs',  currentNs], queryFn: () => api.istioVs(currentNs),      enabled: enabled('virtualservices'),  refetchInterval: REFETCH_INTERVAL });
  const { data: gwData,  isLoading: loadingGw,  refetch: refetchGw  } = useQuery({ queryKey: ['istio-gw',  currentNs], queryFn: () => api.istioGw(currentNs),      enabled: enabled('gateways'),          refetchInterval: REFETCH_INTERVAL });
  const { data: drData,  isLoading: loadingDr,  refetch: refetchDr  } = useQuery({ queryKey: ['istio-dr',  currentNs], queryFn: () => api.istioDr(currentNs),      enabled: enabled('destinationrules'),  refetchInterval: REFETCH_INTERVAL });
  const { data: paData,  isLoading: loadingPa,  refetch: refetchPa  } = useQuery({ queryKey: ['istio-pa',  currentNs], queryFn: () => api.istioPa(currentNs),      enabled: enabled('peerauth'),          refetchInterval: REFETCH_INTERVAL });
  const { data: apData,  isLoading: loadingAp,  refetch: refetchAp  } = useQuery({ queryKey: ['istio-ap',  currentNs], queryFn: () => api.istioAp(currentNs),      enabled: enabled('authzpolicies'),     refetchInterval: REFETCH_INTERVAL });
  const { data: seData,  isLoading: loadingSe,  refetch: refetchSe  } = useQuery({ queryKey: ['istio-se',  currentNs], queryFn: () => api.istioSe(currentNs),      enabled: enabled('serviceentries'),   refetchInterval: REFETCH_INTERVAL });
  const { data: arData,  isLoading: loadingAr,  refetch: refetchAr  } = useQuery({ queryKey: ['kyma-ar',   currentNs], queryFn: () => api.kymaApiRules(currentNs), enabled: enabled('apirules'),          refetchInterval: REFETCH_INTERVAL });
  const { data: raData,  isLoading: loadingRa,  refetch: refetchRa  } = useQuery({ queryKey: ['istio-ra',  currentNs], queryFn: () => api.istioRa(currentNs),      enabled: enabled('requestauth'),       refetchInterval: REFETCH_INTERVAL });
  const { data: scData,  isLoading: loadingSc,  refetch: refetchSc  } = useQuery({ queryKey: ['istio-sc',  currentNs], queryFn: () => api.istioSidecar(currentNs), enabled: enabled('sidecars'),          refetchInterval: REFETCH_INTERVAL });

  const dataMap: Record<TabKey, any> = { virtualservices: vsData, gateways: gwData, destinationrules: drData, peerauth: paData, authzpolicies: apData, serviceentries: seData, apirules: arData, requestauth: raData, sidecars: scData };
  const loadingMap: Record<TabKey, boolean> = { virtualservices: loadingVs, gateways: loadingGw, destinationrules: loadingDr, peerauth: loadingPa, authzpolicies: loadingAp, serviceentries: loadingSe, apirules: loadingAr, requestauth: loadingRa, sidecars: loadingSc };
  const refetchMap: Record<TabKey, () => void> = { virtualservices: refetchVs, gateways: refetchGw, destinationrules: refetchDr, peerauth: refetchPa, authzpolicies: refetchAp, serviceentries: refetchSe, apirules: refetchAr, requestauth: refetchRa, sidecars: refetchSc };

  const currentData = dataMap[tab];
  const isLoading   = loadingMap[tab];
  const notFound    = currentData?.not_found;
  const items = (currentData?.items || []).filter((d: any) => !filter || d.name?.toLowerCase().includes(filter.toLowerCase()));

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'virtualservices',  label: 'Virtual Services',      icon: <Network size={13} /> },
    { key: 'gateways',         label: 'Gateways',               icon: <Globe size={13} /> },
    { key: 'destinationrules', label: 'Destination Rules',      icon: <GitBranch size={13} /> },
    { key: 'peerauth',         label: 'Peer Auth (mTLS)',       icon: <Lock size={13} /> },
    { key: 'authzpolicies',    label: 'Authz Policies',         icon: <Shield size={13} /> },
    { key: 'serviceentries',   label: 'Service Entries',        icon: <Layers size={13} /> },
    { key: 'requestauth',      label: 'Request Authentications',icon: <Lock size={13} className="text-cyan-400" /> },
    { key: 'sidecars',         label: 'Sidecars',               icon: <Network size={13} className="text-purple-400" /> },
    { key: 'apirules',         label: 'API Rules',              icon: <Globe size={13} className="text-amber-400" /> },
  ];

  const setTab = (t: TabKey) => {
    setYamlItem(null);
    setFilter('');
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', t); return n; });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Istio</h1>
          <span className="text-xs text-slate-500 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Service Mesh</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetchMap[tab]()} className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-400 flex items-center gap-1">
            <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <select
            className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
            value={currentNs}
            onChange={e => { setNs(e.target.value); setYamlItem(null); }}
          >
            <option value="">All Namespaces</option>
            {(nsData?.items || []).map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[rgba(99,102,241,0.15)] overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors',
              tab === t.key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {notFound ? (
        <div className="k-card text-center py-8 text-slate-500">
          <p className="text-sm">CRDs not found. The module may not be installed.</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
              placeholder={`Filter ${tab}...`}
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />)}</div>
          ) : (
            <div className="k-card p-0 overflow-hidden">
              <table className="k-table">
                <thead>
                  <tr>
                    <th className="pl-4">Name</th>
                    <th>Namespace</th>
                    {tab === 'virtualservices'  && <><th>Hosts</th><th>Gateways</th></>}
                    {tab === 'gateways'         && <><th>Selector</th><th>Ports</th></>}
                    {tab === 'destinationrules' && <><th>Host</th><th>Traffic Policy</th></>}
                    {tab === 'peerauth'         && <th>mTLS Mode</th>}
                    {tab === 'authzpolicies'    && <><th>Action</th><th>Rules</th></>}
                    {tab === 'serviceentries'   && <th>Hosts</th>}
                    {tab === 'requestauth'      && <><th>Issuer</th><th>JWT Rules</th></>}
                    {tab === 'sidecars'         && <><th>Workload Selector</th><th>Egress</th><th>Ingress</th></>}
                    {tab === 'apirules'         && <><th>Status</th><th>Exposed Host</th></>}
                    <th>Age</th>
                    <th className="pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d: any) => (
                    <tr key={`${d.name}/${d.namespace}`}
                      className="cursor-pointer hover:bg-white/[0.03] group"
                      onClick={() => setYamlItem(yamlItem?.name === d.name && yamlItem?.namespace === d.namespace ? null : { name: d.name, namespace: d.namespace || currentNs })}>
                      <td className="pl-4 font-mono text-xs text-indigo-400 hover:text-indigo-300">{d.name}</td>
                      <td className="text-xs text-slate-500">{d.namespace || '-'}</td>

                      {tab === 'virtualservices' && (
                        <>
                          <td className="text-xs text-slate-400 max-w-[180px] truncate">{(d.hosts || []).join(', ') || '-'}</td>
                          <td className="text-xs text-slate-500 max-w-[160px] truncate">{(d.gateways || []).join(', ') || '-'}</td>
                        </>
                      )}
                      {tab === 'gateways' && (
                        <>
                          <td className="text-xs text-slate-400 font-mono">{d.selector || '-'}</td>
                          <td className="text-xs text-slate-500">{d.ports || '-'}</td>
                        </>
                      )}
                      {tab === 'destinationrules' && (
                        <>
                          <td className="text-xs text-slate-400 font-mono truncate max-w-[200px]">{d.host || '-'}</td>
                          <td className="text-xs"><span className={cn('kyma-badge text-[10px]', d.trafficPolicy === 'configured' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-slate-500/15 text-slate-500 border border-slate-500/20')}>{d.trafficPolicy || 'none'}</span></td>
                        </>
                      )}
                      {tab === 'peerauth' && (
                        <td><span className={cn('kyma-badge text-[10px]', d.mtlsMode === 'STRICT' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : d.mtlsMode === 'PERMISSIVE' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'bg-slate-500/15 text-slate-400 border border-slate-500/20')}>{d.mtlsMode || 'STRICT'}</span></td>
                      )}
                      {tab === 'authzpolicies' && (
                        <>
                          <td><span className={cn('kyma-badge text-[10px]', d.action === 'DENY' ? 'bg-red-500/15 text-red-400 border border-red-500/25' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25')}>{d.action || 'ALLOW'}</span></td>
                          <td className="text-xs text-slate-500">{d.rules ?? 0} rule(s)</td>
                        </>
                      )}
                      {tab === 'serviceentries' && (
                        <td className="text-xs text-slate-400 max-w-[200px] truncate">{(d.hosts || []).join(', ') || '-'}</td>
                      )}
                      {tab === 'requestauth' && (
                        <>
                          <td className="text-xs text-slate-400 font-mono truncate max-w-[200px]">{d.issuer || '-'}</td>
                          <td className="text-xs text-slate-500">{d.rules ?? 0} rule(s)</td>
                        </>
                      )}
                      {tab === 'sidecars' && (
                        <>
                          <td className="text-xs text-slate-400 font-mono truncate max-w-[160px]">{d.workloadSelector || '{}'}</td>
                          <td className="text-xs text-slate-500">{d.egress ?? 0}</td>
                          <td className="text-xs text-slate-500">{d.ingress ?? 0}</td>
                        </>
                      )}
                      {tab === 'apirules' && (
                        <>
                          <td><span className={cn('kyma-badge text-[10px]', d.status === 'Ready' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-amber-500/15 text-amber-400 border border-amber-500/25')}>{d.status || '-'}</span></td>
                          <td className="text-xs text-slate-400 font-mono truncate max-w-[220px]">{(d.hosts || []).join(', ') || '-'}</td>
                        </>
                      )}
                      <td className="text-xs text-slate-500 whitespace-nowrap">{formatAge(d.created)}</td>
                      <td className="pr-4 text-right">
                        <span className="opacity-0 group-hover:opacity-100 text-xs text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded transition-all">
                          {yamlItem?.name === d.name ? 'Close' : 'View YAML'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-slate-500 py-8">No {tab} found in {currentNs}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* YAML Panel */}
          {yamlItem && (
            <ResourceYamlPanel
              kind={TAB_KIND[tab]}
              name={yamlItem.name}
              namespace={yamlItem.namespace}
              onClose={() => setYamlItem(null)}
              onSaved={() => refetchMap[tab]()}
            />
          )}
        </>
      )}
    </div>
  );
}
