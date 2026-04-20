import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { Zap, Search, RefreshCw, Package, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';

type TabKey = 'modules' | 'apirules' | 'functions' | 'subscriptions';

const KNOWN_TABS: TabKey[] = ['modules', 'apirules', 'functions', 'subscriptions'];

// ── Modules Tab ───────────────────────────────────────────────────────────────
function ModulesTab() {
  const [toggling, setToggling] = useState<string | null>(null);
  const [results, setResults]   = useState<Record<string, { ok: boolean; msg: string }>>({});

  const { data, isLoading, refetch } = useQuery<{ items: any[]; kymaFound: boolean; error: string | null }>({
    queryKey: ['kyma-modules'],
    queryFn: () => fetch('/api/kyma-modules').then(r => r.json()),
    refetchInterval: 30_000,
  });

  const toggle = async (name: string, enabled: boolean, channel = 'regular') => {
    setToggling(name);
    try {
      const res = await fetch('/api/toggle-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: name, action: enabled ? 'disable' : 'enable', channel }),
      }).then(r => r.json());
      setResults(prev => ({ ...prev, [name]: { ok: !res.error, msg: res.error || (enabled ? 'Disabled' : 'Enabled') } }));
      refetch();
    } catch (e: any) {
      setResults(prev => ({ ...prev, [name]: { ok: false, msg: e.message } }));
    }
    setToggling(null);
  };

  const stateColor = (state: string) => {
    const s = state?.toLowerCase();
    if (s === 'ready')                           return 'text-emerald-400';
    if (s === 'processing' || s === 'deleting')  return 'text-amber-400';
    if (s === 'error' || s === 'warning')        return 'text-red-400';
    return 'text-slate-500';
  };

  const items    = data?.items || [];
  const enabled  = items.filter(m => m.enabled);
  const available = items.filter(m => !m.enabled);

  if (isLoading) return <div className="py-8"><LoadingState resource="Kyma Modules" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{enabled.length} enabled · {available.length} available to install</p>
        <button onClick={() => refetch()} className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-400 flex items-center gap-1">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {!data?.kymaFound && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
          Kyma CR not found — showing module catalog only. Install Kyma first or verify <code className="font-mono">kubectl get kyma default -n kyma-system</code>.
        </div>
      )}

      {enabled.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Installed Modules</h3>
          <div className="k-card p-0 overflow-hidden">
            <table className="k-table">
              <thead>
                <tr>
                  <th className="pl-4">Module</th>
                  <th>Description</th>
                  <th>Channel</th>
                  <th>State</th>
                  <th className="pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {enabled.map((m: any) => (
                  <tr key={m.name} className="hover:bg-white/[0.02]">
                    <td className="pl-4 font-mono text-xs text-indigo-300 font-semibold">{m.name}</td>
                    <td className="text-xs text-slate-500 max-w-xs truncate">{m.description}</td>
                    <td><span className="text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/25 bg-indigo-500/10 text-indigo-300">{m.channel || 'regular'}</span></td>
                    <td><span className={cn('text-xs font-medium', stateColor(m.state))}>{m.state || 'Configured'}</span></td>
                    <td className="pr-4 text-right">
                      {results[m.name] && <span className={cn('text-[10px] mr-2', results[m.name].ok ? 'text-emerald-400' : 'text-red-400')}>{results[m.name].msg}</span>}
                      <button onClick={() => toggle(m.name, true, m.channel)} disabled={toggling === m.name}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors disabled:opacity-40">
                        {toggling === m.name ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />} Disable
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Available to Install</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {available.map((m: any) => (
              <div key={m.name} className="flex items-start justify-between rounded-lg border px-4 py-3 gap-3"
                style={{ background: 'var(--bg-card,#0d1b2e)', borderColor: 'rgba(99,102,241,0.15)' }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Package size={13} className="text-indigo-400 shrink-0" />
                    <span className="text-xs font-mono font-semibold text-slate-200">{m.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{m.description}</p>
                  {results[m.name] && <p className={cn('text-[10px] mt-1', results[m.name].ok ? 'text-emerald-400' : 'text-red-400')}>{results[m.name].msg}</p>}
                </div>
                <button onClick={() => toggle(m.name, false)} disabled={toggling === m.name || !data?.kymaFound}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-[11px] bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 rounded transition-colors disabled:opacity-40">
                  {toggling === m.name ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />} Enable
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KymaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') || 'apirules';
  const tab = (KNOWN_TABS.includes(rawTab as TabKey) ? rawTab : 'apirules') as TabKey;
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [ns, setNs] = useState('');
  const currentNs = ns || (nsData?.items?.[0]?.name ?? '');

  const { data: arData, isLoading: loadingAr, isError: errorAr, error: errorArMsg, refetch: refetchAr } = useQuery<{ items: any[]; not_found?: boolean }>({
    queryKey: ['kyma-apirules', currentNs], queryFn: () => api.kymaApiRules(currentNs), enabled: !!currentNs && tab === 'apirules', refetchInterval: REFETCH_INTERVAL,
  });
  const { data: fnData, isLoading: loadingFn } = useQuery<{ items: any[]; not_found?: boolean }>({
    queryKey: ['kyma-functions', currentNs], queryFn: () => api.kymaFunctions(currentNs), enabled: !!currentNs && tab === 'functions', refetchInterval: REFETCH_INTERVAL,
  });
  const { data: subData, isLoading: loadingSub } = useQuery<{ items: any[]; not_found?: boolean }>({
    queryKey: ['kyma-subscriptions', currentNs], queryFn: () => api.kymaSubscriptions(currentNs), enabled: !!currentNs && tab === 'subscriptions', refetchInterval: REFETCH_INTERVAL,
  });

  const currentData = tab === 'apirules' ? arData : tab === 'functions' ? fnData : subData;
  const isLoading = tab === 'apirules' ? loadingAr : tab === 'functions' ? loadingFn : loadingSub;
  const isError = errorAr;
  const error = errorArMsg;
  const refetch = refetchAr;
  const items = (currentData?.items || []).filter((d: any) => !filter || d.name?.toLowerCase().includes(filter.toLowerCase()));
  const notFound = currentData?.not_found;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'modules',       label: 'Modules' },
    { key: 'apirules',      label: 'API Rules' },
    { key: 'functions',     label: 'Functions' },
    { key: 'subscriptions', label: 'Subscriptions' },
  ];

  return (
    <div className="space-y-4">
      {isLoading && <div className="p-6"><LoadingState resource="Kyma Resources" /></div>}
      {isError && <div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>}
      {!isLoading && !isError && (
        <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Kyma</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
            value={currentNs}
            onChange={e => setNs(e.target.value)}
          >
            <option value="">Select namespace</option>
            {(nsData?.items || []).map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
          </select>
          <button onClick={() => refetch()} className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[rgba(99,102,241,0.15)]">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setSearchParams({ tab: t.key })}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {notFound ? (
        <div className="k-card text-center py-8 text-slate-500">
          <p className="text-sm">Kyma CRDs not found in this cluster.</p>
          <p className="text-xs mt-1">Kyma modules may not be installed.</p>
        </div>
      ) : tab === 'modules' ? (
        <ModulesTab />
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
                    <th className="pl-4">Name</th><th>Namespace</th>
                    {tab === 'apirules' && <th>Host</th>}
                    {tab === 'functions' && <th>Runtime</th>}
                    {tab === 'subscriptions' && <th>Source</th>}
                    <th>Status</th><th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d: any) => (
                    <tr key={d.name}>
                      <td className="pl-4 font-mono text-xs text-indigo-400">{d.name}</td>
                      <td className="text-xs text-slate-500">{d.namespace}</td>
                      {tab === 'apirules' && <td className="text-xs text-slate-400">{d.host || '-'}</td>}
                      {tab === 'functions' && <td className="text-xs text-slate-400">{d.runtime || '-'}</td>}
                      {tab === 'subscriptions' && <td className="text-xs text-slate-400">{d.source || '-'}</td>}
                      <td>
                        <span className={cn('kyma-badge text-[10px]',
                          d.status === 'Ready' ? 'badge-ok' : d.status?.includes?.('Error') ? 'badge-err' : 'badge-warn'
                        )}>{d.status || 'Unknown'}</span>
                      </td>
                      <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-8">No {tab} found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )}
</div>
  );
}

function formatAge(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
