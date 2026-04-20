import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge } from '@/lib/utils';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, Upload, Trash2, RefreshCw, Info, Terminal, X } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { PodTerminal } from '@/components/shared/PodTerminal';
import type { NamespaceOverview, KEvent, Namespace, LimitRange, ResourceQuota } from '@/types';

// ── Small donut chart ────────────────────────────────────────────────────────
function SmallDonut({ value, color }: { value: number; color: string }) {
  const data = [{ v: value }, { v: Math.max(0, 100 - value) }];
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <PieChart width={96} height={96}>
        <Pie
          data={data}
          cx={48}
          cy={48}
          innerRadius={34}
          outerRadius={44}
          startAngle={90}
          endAngle={-270}
          dataKey="v"
          strokeWidth={0}
        >
          <Cell fill={color} />
          <Cell fill="rgba(255,255,255,0.06)" />
        </Pie>
      </PieChart>
      <div className="absolute text-center">
        <div className="text-base font-black text-white font-mono">{value}%</div>
      </div>
    </div>
  );
}

// ── Kyma-style stat card (Pods, Deployments, …) ──────────────────────────────
function NsStatCard({
  title,
  total,
  stats,
  href,
}: {
  title: string;
  total: number | string;
  stats: { label: string; value: number | string; color?: string }[];
  href?: string;
}) {
  return (
    <div className="k-card py-4 px-4 flex flex-col gap-2 min-w-[120px]">
      <div>
        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{title}</div>
        <div className="text-3xl font-black text-white font-mono">{total}</div>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {stats.map(s => (
          <div key={s.label} className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500">{s.label}</span>
            <span className={cn('text-[11px] font-mono font-bold', s.color ?? 'text-slate-300')}>{s.value}</span>
          </div>
        ))}
      </div>
      {href && (
        <a
          href={href}
          className="text-[10px] text-indigo-400 hover:text-indigo-300 mt-auto transition-colors"
        >
          Learn More →
        </a>
      )}
    </div>
  );
}

// ── Pods section with exec ────────────────────────────────────────────────────
function PodsSection({ ns }: { ns: string }) {
  const [execPod, setExecPod] = useState<{ pod: string; container?: string } | null>(null);
  const [filter, setFilter] = useState('');

  const { data, isLoading, refetch } = useQuery<{ items: any[] }>({
    queryKey: ['pods', ns],
    queryFn: () => fetch(`/api/pods?namespace=${ns}`).then(r => r.json()),
    refetchInterval: 15_000,
    enabled: !!ns,
  });

  const pods = (data?.items || []).filter((p: any) =>
    !filter || p.name?.toLowerCase().includes(filter.toLowerCase())
  );

  const phaseColor = (phase: string) => {
    const p = phase?.toLowerCase();
    if (p === 'running')   return 'text-emerald-400';
    if (p === 'pending')   return 'text-amber-400';
    if (p === 'succeeded') return 'text-slate-400';
    return 'text-red-400';
  };

  return (
    <div className="k-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="section-title mb-0">Pods</h3>
        <div className="flex items-center gap-2">
          <input
            className="h-7 w-48 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40"
            placeholder="Filter pods..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <button onClick={() => refetch()} className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-400 flex items-center gap-1">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-slate-500 text-sm"><RefreshCw size={13} className="animate-spin" /> Loading pods…</div>
      ) : (
        <table className="k-table">
          <thead>
            <tr>
              <th className="pl-2">Name</th>
              <th>Status</th>
              <th>Ready</th>
              <th>Restarts</th>
              <th>Node</th>
              <th>Age</th>
              <th className="pr-2 text-right">Exec</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((p: any) => (
              <tr key={p.name} className="hover:bg-white/[0.02]">
                <td className="pl-2 font-mono text-xs text-indigo-400 max-w-[200px] truncate">{p.name}</td>
                <td>
                  <span className={`text-xs font-semibold ${phaseColor(p.status)}`}>{p.status || '-'}</span>
                </td>
                <td className="text-xs text-slate-400 font-mono">{p.ready || '-'}</td>
                <td className="text-xs text-slate-400 font-mono">{p.restarts ?? '-'}</td>
                <td className="text-xs text-slate-500 font-mono truncate max-w-[120px]">{p.node || '-'}</td>
                <td className="text-xs text-slate-500">{p.age || '-'}</td>
                <td className="pr-2 text-right">
                  <button
                    onClick={() => setExecPod(execPod?.pod === p.name ? null : { pod: p.name, container: p.containers?.[0] })}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ml-auto',
                      execPod?.pod === p.name
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20'
                    )}
                  >
                    <Terminal size={11} />
                    {execPod?.pod === p.name ? 'Close' : 'Exec'}
                  </button>
                </td>
              </tr>
            ))}
            {pods.length === 0 && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-6 text-sm">No pods found in {ns}</td></tr>
            )}
          </tbody>
        </table>
      )}

      {execPod && (
        <div className="mt-2 rounded-xl overflow-hidden border border-emerald-500/20">
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border-b border-emerald-500/15">
            <Terminal size={13} className="text-emerald-400" />
            <span className="text-xs text-emerald-300 font-mono flex-1">{execPod.pod}</span>
            <button onClick={() => setExecPod(null)} className="text-slate-500 hover:text-white"><X size={13} /></button>
          </div>
          <PodTerminal namespace={ns} pod={execPod.pod} container={execPod.container} onClose={() => setExecPod(null)} />
        </div>
      )}
    </div>
  );
}

// ── Limit Ranges sub-section ─────────────────────────────────────────────────
function LimitRangesSection({ ns }: { ns: string }) {
  const { data } = useQuery<{ items: LimitRange[] }>({
    queryKey: ['limitranges', ns],
    queryFn: () => api.limitranges(ns),
    refetchInterval: 60_000,
    enabled: !!ns,
  });
  const items = data?.items ?? [];
  return (
    <div className="k-card">
      <h3 className="section-title">Limit Ranges</h3>
      <table className="k-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map(lr => (
            <tr key={lr.name}>
              <td className="font-mono text-xs text-indigo-400">{lr.name}</td>
              <td className="text-xs text-slate-500">{lr.created ? formatAge(lr.created) : '-'}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={2} className="text-center text-slate-500 py-4">
                No limit ranges
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Resource Quotas sub-section ──────────────────────────────────────────────
function ResourceQuotasSection({ ns }: { ns: string }) {
  const { data } = useQuery<{ items: ResourceQuota[] }>({
    queryKey: ['resourcequotas', ns],
    queryFn: () => api.resourcequotas(ns),
    refetchInterval: 60_000,
    enabled: !!ns,
  });
  const items = data?.items ?? [];
  return (
    <div className="k-card">
      <h3 className="section-title">Resource Quotas</h3>
      <table className="k-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Created</th>
            <th>CPU Limits</th>
            <th>Memory Limits</th>
            <th>CPU Requests</th>
            <th>Memory Requests</th>
          </tr>
        </thead>
        <tbody>
          {items.map(q => (
            <tr key={q.name}>
              <td className="font-mono text-xs text-indigo-400">{q.name}</td>
              <td className="text-xs text-slate-500">{q.created ? formatAge(q.created) : '-'}</td>
              <td className="text-xs text-slate-400">{q.hard?.['limits.cpu'] ?? '-'}</td>
              <td className="text-xs text-slate-400">{q.hard?.['limits.memory'] ?? '-'}</td>
              <td className="text-xs text-slate-400">{q.hard?.['requests.cpu'] ?? '-'}</td>
              <td className="text-xs text-slate-400">{q.hard?.['requests.memory'] ?? '-'}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-slate-500 py-4">
                No resource quotas
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── YAML Editor component ─────────────────────────────────────────────────────
function YamlEditor({ namespace, onApplied }: { namespace: string; onApplied: () => void }) {
  const [yaml, setYaml] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch(`/api/manifest?kind=namespace&name=${namespace}`)
      .then(r => r.json())
      .then(d => { if (d.yaml) setYaml(d.yaml); });
  }, [namespace]);

  const apply = async () => {
    setSaving(true);
    try {
      const data = await api.applyManifest(yaml);
      setResult({ ok: data.success, msg: data.output || data.error || 'Done' });
      if (data.success) setTimeout(onApplied, 1500);
    } catch {
      setResult({ ok: false, msg: 'Apply failed' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <textarea
        className="w-full h-96 font-mono text-xs p-3 rounded-lg resize-none focus:outline-none focus:border-indigo-500/40"
        style={{ background: '#060d1f', border: '1px solid rgba(99,102,241,0.15)', color: '#cbd5e1' }}
        value={yaml}
        onChange={e => setYaml(e.target.value)}
        spellCheck={false}
      />
      {result && (
        <div className={cn('p-3 rounded text-xs font-mono whitespace-pre-wrap break-all', result.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
          {result.msg}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onApplied}
          className="px-3 py-1.5 text-xs rounded border border-[rgba(99,102,241,0.2)] text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={apply}
          disabled={saving || !yaml}
          className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50 transition-colors"
        >
          {saving ? 'Applying...' : 'Apply Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function NamespaceDetailPage() {
  const { namespace } = useParams<{ namespace: string }>();
  const navigate = useNavigate();
  const ns = namespace ?? 'default';

  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');
  const [eventFilter, setEventFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Namespace metadata (labels, creationTimestamp)
  const { data: namespacesData } = useQuery<{ items: Namespace[] }>({
    queryKey: ['namespaces-list'],
    queryFn: api.namespaces,
    refetchInterval: 60_000,
  });
  const nsInfo = namespacesData?.items?.find(n => n.name === ns);
  const labels = nsInfo?.labels ?? {};
  const labelEntries = Object.entries(labels);

  // Namespace workload overview
  const { data: overview, isLoading: loadingOv, isError: ovError, error: ovErrorObj, refetch } = useQuery<NamespaceOverview>({
    queryKey: ['namespace-overview', ns],
    queryFn: () => api.namespaceOverview(ns),
    refetchInterval: REFETCH_INTERVAL,
    enabled: !!ns,
  });

  // Events
  const { data: eventsData } = useQuery<{ items: KEvent[]; events?: KEvent[] }>({
    queryKey: ['events', ns],
    queryFn: () => api.events(ns),
    refetchInterval: REFETCH_INTERVAL,
    enabled: !!ns,
  });

  const ov = overview ?? ({} as NamespaceOverview);
  const failedPods = ov.failed_pods ?? Math.max(0, (ov.pods ?? 0) - (ov.running_pods ?? 0) - (ov.pending_pods ?? 0));
  const lbServices = ov.loadbalancers ?? 0;

  const allEvents: KEvent[] = eventsData?.items ?? eventsData?.events ?? [];
  const events = allEvents.filter(e => {
    if (typeFilter !== 'all' && e.type?.toLowerCase() !== typeFilter) return false;
    if (eventFilter && !e.message?.toLowerCase().includes(eventFilter.toLowerCase()) &&
        !e.reason?.toLowerCase().includes(eventFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/namespaces')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={14} />
            Namespaces
          </button>
          <span className="text-slate-600">/</span>
          <h2 className="text-lg font-bold text-white font-mono">{ns}</h2>
          <span className={cn('kyma-badge text-[10px]', nsInfo?.status === 'Active' || !nsInfo?.status ? 'badge-ok' : 'bg-amber-500/15 text-amber-400 border border-amber-500/25')}>
            {nsInfo?.status ?? 'Active'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300 flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button className="h-7 px-2 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white flex items-center gap-1 transition-colors">
            <Upload size={12} /> Upload YAML
          </button>
          <button className="h-7 px-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-1 transition-colors">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      {/* ── View / Edit tabs ── */}
      <div className="flex gap-0 border-b border-[rgba(99,102,241,0.15)]">
        {(['view', 'edit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'text-indigo-400 border-indigo-500'
                : 'text-slate-500 border-transparent hover:text-slate-300',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Edit tab ── */}
      {activeTab === 'edit' && (
        <div className="k-card">
          <h3 className="section-title mb-3">YAML Editor</h3>
          <YamlEditor
            namespace={ns}
            onApplied={() => { refetch(); setActiveTab('view'); }}
          />
        </div>
      )}

      {/* ── View tab ── */}
      {activeTab === 'view' && (
        <>
          {/* ── Namespace Overview ── */}
          <div>
            <h2 className="section-title">Namespace Overview</h2>
            <div className="k-card">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Metadata</h3>
              <div className="space-y-0 text-sm divide-y divide-white/[0.03]">
                {/* Resource Type */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Resource Type</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-300 font-mono text-xs">Namespace</span>
                    <Info size={11} className="text-slate-600" />
                  </div>
                </div>
                {/* Age */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Age</span>
                  <span className="text-slate-300 font-mono text-xs">
                    {nsInfo?.created ? formatAge(nsInfo.created) : '-'}
                  </span>
                </div>
                {/* Last Update */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Last Update</span>
                  <span className="text-slate-300 font-mono text-xs">
                    {nsInfo?.created ? formatAge(nsInfo.created) : '-'}
                  </span>
                </div>
                {/* Status */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Status</span>
                  <span className="kyma-badge badge-ok text-[10px]">
                    {nsInfo?.status ?? 'Active'}
                  </span>
                </div>
                {/* Labels */}
                <div className="flex justify-between items-start py-2">
                  <span className="text-slate-500">Labels</span>
                  <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                    {labelEntries.length > 0 ? (
                      labelEntries.map(([k, v]) => (
                        <span
                          key={k}
                          className="kyma-badge bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]"
                        >
                          {k}={v}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 text-xs">-</span>
                    )}
                  </div>
                </div>
                {/* Annotations */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Annotations</span>
                  <span className="text-slate-500 text-xs">-</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Monitoring and Health ── */}
          <div>
            <h2 className="section-title">Monitoring and Health</h2>
            {loadingOv ? (
              <div className="p-6"><LoadingState resource="Namespace Details" /></div>
            ) : ovError ? (
              <div className="p-6"><ErrorState title="Failed to load" error={ovErrorObj} onRetry={() => refetch()} /></div>
            ) : (
              <div className="flex flex-wrap gap-4 items-start">
                {/* CPU + Memory donuts */}
                <div className="flex gap-4">
                  <div className="k-card flex flex-col items-center gap-1 py-3 px-3">
                    <SmallDonut value={0} color="#06b6d4" />
                    <div className="text-[10px] text-slate-500 uppercase font-bold">CPU Usage</div>
                  </div>
                  <div className="k-card flex flex-col items-center gap-1 py-3 px-3">
                    <SmallDonut value={0} color="#8b5cf6" />
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Memory Usage</div>
                  </div>
                </div>

                {/* Stat cards */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                  <NsStatCard
                    title="Pods Overview"
                    total={ov.pods ?? 0}
                    stats={[
                      { label: 'Healthy',  value: ov.running_pods ?? 0, color: 'text-emerald-400' },
                      { label: 'Pending',  value: ov.pending_pods ?? 0, color: 'text-amber-400'   },
                      { label: 'Failing',  value: failedPods,           color: 'text-red-400'     },
                    ]}
                    href={`/pods?namespace=${ns}`}
                  />
                  <NsStatCard
                    title="Deployments"
                    total={ov.deployments ?? 0}
                    stats={[
                      { label: 'Healthy', value: ov.deployments ?? 0, color: 'text-emerald-400' },
                      { label: 'Failing', value: 0,                   color: 'text-red-400'     },
                    ]}
                    href={`/deployments?namespace=${ns}`}
                  />
                  <NsStatCard
                    title="DaemonSets"
                    total={ov.daemonsets ?? 0}
                    stats={[
                      { label: 'Healthy',   value: ov.daemonsets ?? 0, color: 'text-emerald-400' },
                      { label: 'Unhealthy', value: 0,                  color: 'text-red-400'     },
                    ]}
                    href={`/daemonsets?namespace=${ns}`}
                  />
                  <NsStatCard
                    title="StatefulSets"
                    total={ov.statefulsets ?? 0}
                    stats={[
                      { label: 'Healthy',   value: ov.statefulsets ?? 0, color: 'text-emerald-400' },
                      { label: 'Unhealthy', value: 0,                    color: 'text-red-400'     },
                    ]}
                    href={`/statefulsets?namespace=${ns}`}
                  />
                  <NsStatCard
                    title="Services"
                    total={ov.services ?? 0}
                    stats={[
                      { label: 'LoadBalancers', value: lbServices,                                    color: 'text-cyan-400'   },
                      { label: 'Others',        value: Math.max(0, (ov.services ?? 0) - lbServices), color: 'text-slate-400'  },
                    ]}
                    href={`/services?namespace=${ns}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Limit Ranges ── */}
          <LimitRangesSection ns={ns} />

          {/* ── Pods with Exec ── */}
          <PodsSection ns={ns} />

          {/* ── Resource Quotas ── */}
          <ResourceQuotasSection ns={ns} />

          {/* ── Events ── */}
          <div className="k-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title mb-0">Events</h3>
              <span className="text-[10px] text-slate-500">{events.length} events</span>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40"
                placeholder="Filter events..."
                value={eventFilter}
                onChange={e => setEventFilter(e.target.value)}
              />
              <select
                className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="normal">Normal</option>
                <option value="warning">Warning</option>
              </select>
            </div>
            <div className="max-h-64 overflow-auto">
              <table className="k-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Message</th>
                    <th>Name</th>
                    <th>Involved Object</th>
                    <th>Source</th>
                    <th>Count</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 50).map((e, i) => (
                    <tr key={i}>
                      <td>
                        <span
                          className={cn(
                            'kyma-badge text-[10px]',
                            e.type === 'Warning'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                          )}
                        >
                          {e.type}
                        </span>
                      </td>
                      <td className="text-xs max-w-xs truncate text-slate-400">{e.message}</td>
                      <td className="text-xs font-mono text-indigo-400">{e.reason || '-'}</td>
                      <td className="text-xs font-mono text-slate-400">{e.involvedObject}</td>
                      <td className="text-xs text-slate-500">{e.source || '-'}</td>
                      <td className="text-xs text-slate-400 font-mono">{e.count ?? 1}</td>
                      <td className="text-xs text-slate-500">
                        {e.lastTimestamp ? formatAge(e.lastTimestamp) : '-'}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-500 py-4">
                        No events
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
