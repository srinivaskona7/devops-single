import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { api } from '@/lib/api';
import { useClusterStatus } from '@/hooks/useClusterData';
import { cn, formatAge } from '@/lib/utils';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { PieChart, Pie, Cell } from 'recharts';
import {
  RefreshCw, Wifi, Clock, Upload, LogOut, Layers
} from 'lucide-react';
import type { ClusterStatus, NamespaceOverview, KEvent } from '@/types';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function DonutChart({ value, color, label, rawValue }: { value: number; color: string; label: string; rawValue?: string }) {
  const data = [{ v: value }, { v: Math.max(0, 100 - value) }];
  return (
    <div className="k-card flex flex-col items-center gap-1 py-3 px-4">
      <div className="relative w-28 h-28 flex items-center justify-center">
        <PieChart width={112} height={112}>
          <Pie data={data} cx={56} cy={56} innerRadius={40} outerRadius={52} startAngle={90} endAngle={-270} dataKey="v" strokeWidth={0}>
            <Cell fill={color} />
            <Cell fill="rgba(255,255,255,0.06)" />
          </Pie>
        </PieChart>
        <div className="absolute text-center">
          <div className="text-lg font-black text-white font-mono">{value}%</div>
          <div className="text-[9px] text-slate-500 uppercase">{label}</div>
        </div>
      </div>
      {rawValue && (
        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{rawValue}</div>
      )}
      <div className="text-[10px] text-slate-400 uppercase font-bold">{label} Usage</div>
    </div>
  );
}

function KymaStatCard({
  title,
  total,
  stats,
  learnMorePath,
  navigate,
}: {
  title: string;
  total: number | string;
  stats: { label: string; value: number | string; color?: string }[];
  learnMorePath?: string;
  navigate?: ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="k-card py-4 px-4 flex flex-col gap-3 min-w-[130px]">
      <div>
        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{title}</div>
        <div className="text-3xl font-black text-white font-mono">{total}</div>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {stats.map(s => (
          <div key={s.label} className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500">{s.label}</span>
            <span className={cn('text-[11px] font-mono font-bold', s.color || 'text-slate-300')}>{s.value}</span>
          </div>
        ))}
      </div>
      {learnMorePath && navigate && (
        <button
          onClick={() => navigate(learnMorePath)}
          className="text-[10px] text-indigo-400 hover:text-indigo-300 text-left transition-colors mt-auto"
        >
          Learn More
        </button>
      )}
    </div>
  );
}

function ModulesOverviewCard() {
  const moduleStats = [
    { label: 'Community Modules', value: 0, color: 'text-slate-400' },
    { label: 'Ready', value: 8, color: 'text-emerald-400' },
    { label: 'Warning', value: 1, color: 'text-amber-400' },
    { label: 'Processing', value: 0, color: 'text-blue-400' },
    { label: 'Error', value: 0, color: 'text-red-400' },
  ];
  return (
    <div className="k-card flex flex-col gap-4">
      <h3 className="section-title">Modules Overview</h3>
      <div className="flex items-start gap-6">
        <div className="flex flex-col items-center">
          <div className="text-5xl font-black text-white font-mono leading-none">9</div>
          <div className="text-[10px] text-slate-500 uppercase mt-1">Total Installed</div>
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          {moduleStats.map(s => (
            <div key={s.label} className="flex justify-between items-center py-0.5 border-b border-white/[0.03]">
              <span className="text-[11px] text-slate-500">{s.label}</span>
              <span className={cn('text-[11px] font-mono font-bold', s.color)}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="self-start h-7 px-3 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded text-[11px] text-indigo-300 flex items-center gap-1.5 transition-colors">
        <Layers size={11} /> Modify Modules
      </button>
    </div>
  );
}

function ClusterMetadataCard({ status }: { status: ClusterStatus }) {
  const rows: [string, string | React.ReactNode][] = [
    ['Kubernetes Version', status.kubectl_server_version || '-'],
    ['Storage Type', (
      <span className="flex items-center gap-1">
        {status.plan || 'Local Storage'}
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-600 text-slate-500 text-[9px] font-bold cursor-help" title="Storage type used for persistent volumes">i</span>
      </span>
    )],
    ['API Server Address', status.api_server || '-'],
    ['Provider', status.region ? `aws / ${status.region}` : 'SAP BTP / Kyma'],
    ['Global Account ID', 'eeba145c-d8f4-4c66-b2d3-...'],
    ['Subaccount ID', '999e6462-3b1c-4e5a-8f2d-...'],
    ['Ingress Gateway', (status as any).ingress_hostname ? (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 max-w-[220px] truncate">
        {(status as any).ingress_hostname}
      </span>
    ) : '-'],
    ['NAT Gateway IPs', (() => {
      const ips: string[] = (status as any).nat_gateway_ips || [];
      if (ips.length === 0) return <span className="text-slate-500 text-xs">Resolving…</span>;
      return (
        <span className="flex flex-wrap gap-1 justify-end">
          {ips.map(ip => (
            <span key={ip} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{ip}</span>
          ))}
        </span>
      );
    })()],
  ];
  return (
    <div className="k-card">
      <h3 className="section-title">Cluster Metadata</h3>
      <div className="grid grid-cols-1 gap-y-0">
        {rows.map(([k, v]) => (
          <div key={String(k)} className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
            <span className="text-slate-500 text-xs shrink-0 mr-4">{k}</span>
            <span className="text-slate-300 font-mono text-xs text-right truncate max-w-[220px]">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeTable({ nodes }: { nodes: ClusterStatus['node_resources'] }) {
  return (
    <div className="k-card">
      <h3 className="section-title">Nodes</h3>
      <div className="overflow-x-auto">
        <table className="k-table">
          <thead>
            <tr>
              <th>Name</th>
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
              <tr key={node.name}>
                <td className="font-mono text-xs text-indigo-300 whitespace-nowrap">{node.name}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', node.cpu_percent > 80 ? 'bg-red-500' : node.cpu_percent > 60 ? 'bg-amber-500' : 'bg-cyan-400')}
                        style={{ width: `${node.cpu_percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 font-mono w-10">{node.cpu_percent}%</span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', node.memory_percent > 80 ? 'bg-red-500' : node.memory_percent > 60 ? 'bg-amber-500' : 'bg-purple-400')}
                        style={{ width: `${node.memory_percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 font-mono w-10">{node.memory_percent}%</span>
                  </div>
                </td>
                <td className="text-xs text-slate-500 whitespace-nowrap">-</td>
                <td>
                  <span className="kyma-badge badge-ok text-[10px]">Ready</span>
                </td>
                <td className="text-xs text-slate-500">-</td>
                <td className="text-xs text-slate-500">-</td>
                <td className="text-xs text-slate-500">-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventsTable({ events }: { events: KEvent[] }) {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const filtered = events.filter(e => {
    if (typeFilter !== 'all' && e.type?.toLowerCase() !== typeFilter) return false;
    if (filter && !e.message?.toLowerCase().includes(filter.toLowerCase()) && !e.reason?.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  }).slice(0, 50);

  return (
    <div className="k-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title mb-0">Events</h3>
        <span className="text-[10px] text-slate-500">{filtered.length} events</span>
      </div>
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40"
          placeholder="Filter events..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
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
      <div className="max-h-72 overflow-auto">
        <table className="k-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Message</th>
              <th>Name</th>
              <th>Namespace</th>
              <th>Involved Object</th>
              <th>Source</th>
              <th>Count</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={i}>
                <td>
                  <span className={cn('kyma-badge text-[10px]', e.type === 'Warning' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20')}>
                    {e.type}
                  </span>
                </td>
                <td className="text-xs max-w-xs truncate text-slate-400">{e.message}</td>
                <td className="text-xs font-mono text-indigo-400">{e.involvedObject}</td>
                <td className="text-xs text-slate-500">-</td>
                <td className="text-xs font-mono text-slate-400">{e.involvedObject}</td>
                <td className="text-xs text-slate-500">{e.source || '-'}</td>
                <td className="text-xs text-slate-400 font-mono">{e.count || 1}</td>
                <td className="text-xs text-slate-500">{e.lastTimestamp ? formatAge(e.lastTimestamp) : '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-slate-500 py-4">No events found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ClusterOverview() {
  const navigate = useNavigate();
  const { data: status, isLoading, refetch } = useClusterStatus();
  const { data: overview } = useQuery<NamespaceOverview>({
    queryKey: ['namespace-overview-all'],
    queryFn: () => api.namespaceOverview('-all-'),
    refetchInterval: REFETCH_INTERVAL,
  });
  const { data: eventsData } = useQuery<{ items: KEvent[] }>({
    queryKey: ['events-all'],
    queryFn: () => api.events(''),
    refetchInterval: REFETCH_INTERVAL,
  });

  if (isLoading) {
    return (
      <div className="p-6"><LoadingState resource="Cluster Status" /></div>
    );
  }

  if (!status) {
    return <div className="text-slate-500 text-center py-12">Unable to load cluster status</div>;
  }

  const ov = overview || {} as NamespaceOverview;
  const failedPods = (ov.pods ?? 0) - (ov.running_pods ?? 0) - (ov.pending_pods ?? 0);
  const healthyDeployments = ov.deployments ?? 0;
  const healthyDaemonSets = ov.daemonsets ?? 0;
  const healthyStatefulSets = ov.statefulsets ?? 0;
  const lbServices = ov.loadbalancers ?? 0;
  const otherServices = (ov.services ?? 0) - lbServices;

  return (
    <div className="space-y-6 k-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white tracking-tight">{status.cluster_name || 'Cluster Overview'}</h2>
          <span className={cn('kyma-badge', status.connection_alive ? 'badge-ok' : 'badge-err')}>
            {status.connection_alive
              ? <><span className="status-dot-live" style={{ width: 6, height: 6, display: 'inline-block' }} />Connected</>
              : <><Wifi size={10} />Disconnected</>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Clock size={10} />Updated {status.last_checked ? formatAge(status.last_checked) : 'now'} ago
          </span>
          <button className="h-7 px-3 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] rounded-md text-xs text-slate-300 flex items-center gap-1.5 transition-all hover:border-white/20">
            <LogOut size={12} /> Disconnect
          </button>
          <button className="btn-primary-cta h-7">
            <Upload size={12} /> Apply YAML
          </button>
          <button onClick={() => refetch()} className="h-7 px-3 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] rounded-md text-xs text-slate-300 flex items-center gap-1.5 transition-all hover:border-white/20">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Metadata + Modules Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClusterMetadataCard status={status} />
        <ModulesOverviewCard />
      </div>

      {/* Monitoring and Health */}
      <div>
        <h2 className="section-title">Monitoring and Health</h2>
        <div className="flex flex-wrap gap-4 items-start">
          {/* Donut charts */}
          <DonutChart
            value={status.avg_cpu_percent}
            color="#06b6d4"
            label="CPU"
            rawValue={`${Math.round(status.avg_cpu_percent * 39.2)}m / 3920m`}
          />
          <DonutChart
            value={status.avg_memory_percent}
            color="#8b5cf6"
            label="Memory"
            rawValue={`${(status.avg_memory_percent * 0.143).toFixed(1)}Gi / 14.3Gi`}
          />

          {/* Stat cards */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <KymaStatCard
              title="Nodes"
              total={status.node_count}
              stats={[
                { label: 'Ready', value: status.node_count, color: 'text-emerald-400' },
                { label: 'Not Ready', value: 0, color: 'text-red-400' },
              ]}
            />
            <KymaStatCard
              title="Pods Overview"
              total={ov.pods ?? 0}
              stats={[
                { label: 'Healthy', value: ov.running_pods ?? 0, color: 'text-emerald-400' },
                { label: 'Pending', value: ov.pending_pods ?? 0, color: 'text-amber-400' },
                { label: 'Failing', value: Math.max(0, failedPods), color: 'text-red-400' },
              ]}
              learnMorePath="/pods"
              navigate={navigate}
            />
            <KymaStatCard
              title="Deployments"
              total={ov.deployments ?? 0}
              stats={[
                { label: 'Healthy', value: healthyDeployments, color: 'text-emerald-400' },
                { label: 'Failing', value: 0, color: 'text-red-400' },
              ]}
              learnMorePath="/deployments"
              navigate={navigate}
            />
            <KymaStatCard
              title="DaemonSets"
              total={ov.daemonsets ?? 0}
              stats={[
                { label: 'Healthy', value: healthyDaemonSets, color: 'text-emerald-400' },
                { label: 'Unhealthy', value: 0, color: 'text-red-400' },
              ]}
              learnMorePath="/daemonsets"
              navigate={navigate}
            />
            <KymaStatCard
              title="StatefulSets"
              total={ov.statefulsets ?? 0}
              stats={[
                { label: 'Healthy', value: healthyStatefulSets, color: 'text-emerald-400' },
                { label: 'Unhealthy', value: 0, color: 'text-red-400' },
              ]}
              learnMorePath="/statefulsets"
              navigate={navigate}
            />
            <KymaStatCard
              title="Services"
              total={ov.services ?? 0}
              stats={[
                { label: 'LoadBalancers', value: lbServices, color: 'text-cyan-400' },
                { label: 'Others', value: Math.max(0, otherServices), color: 'text-slate-400' },
              ]}
              learnMorePath="/services"
              navigate={navigate}
            />
            <KymaStatCard
              title="Persistent Volumes"
              total={ov.persistentvolumes ?? 0}
              stats={[
                { label: 'Capacity', value: ov.pv_capacity || '-', color: 'text-purple-400' },
              ]}
              learnMorePath="/pvs"
              navigate={navigate}
            />
            <KymaStatCard
              title="Namespaces"
              total={status.namespaces?.length ?? 0}
              stats={[
                { label: 'Active', value: status.namespaces?.length ?? 0, color: 'text-emerald-400' },
              ]}
              learnMorePath="/namespaces"
              navigate={navigate}
            />
          </div>
        </div>
      </div>

      {/* Nodes Table */}
      {status.node_resources?.length > 0 && <NodeTable nodes={status.node_resources} />}

      {/* Events */}
      {eventsData?.items && <EventsTable events={eventsData.items} />}
    </div>
  );
}
