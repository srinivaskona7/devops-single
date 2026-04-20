import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge, statusBg } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Container, Search, Database, Monitor, GitBranch, Workflow, Timer } from 'lucide-react';
import type { Deployment, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob } from '@/types';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';

type TabKey = 'deployments' | 'statefulsets' | 'daemonsets' | 'replicasets' | 'jobs' | 'cronjobs';

const tabs: { key: TabKey; label: string; icon: typeof Container }[] = [
  { key: 'deployments', label: 'Deployments', icon: Container },
  { key: 'statefulsets', label: 'StatefulSets', icon: Database },
  { key: 'daemonsets', label: 'DaemonSets', icon: Monitor },
  { key: 'replicasets', label: 'ReplicaSets', icon: GitBranch },
  { key: 'jobs', label: 'Jobs', icon: Workflow },
  { key: 'cronjobs', label: 'CronJobs', icon: Timer },
];

function DeploymentsTable({ ns }: { ns: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery<{ items: Deployment[] }>({
    queryKey: ['deployments', ns], queryFn: () => api.deployments(ns), enabled: !!ns, refetchInterval: REFETCH_INTERVAL,
  });
  const [filter, setFilter] = useState('');
  if (isLoading) return <div className="animate-pulse text-slate-500 text-sm py-4"><LoadingState resource="Deployments" /></div>;
  if (isError) return <div className="py-4"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>;
  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <>
      <FilterInput value={filter} onChange={setFilter} placeholder="Filter deployments..." />
      <table className="k-table">
        <thead><tr><th>Name</th><th>Ready</th><th>Available</th><th>Image</th><th>Age</th></tr></thead>
        <tbody>
          {items.map(d => (
            <tr key={d.name}>
              <td className="font-mono text-xs text-indigo-400">{d.name}</td>
              <td className="text-xs font-mono">{d.readyReplicas ?? 0}/{d.replicas}</td>
              <td className="text-xs"><span className={cn('kyma-badge text-[10px]', (d.availableReplicas ?? 0) === d.replicas ? 'badge-ok' : 'badge-warn')}>{d.availableReplicas ?? 0}</span></td>
              <td className="text-xs text-slate-500 max-w-xs truncate">{d.image}</td>
              <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-4">No deployments</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function StatefulSetsTable({ ns }: { ns: string }) {
  const { data, isLoading } = useQuery<{ items: StatefulSet[] }>({
    queryKey: ['statefulsets', ns], queryFn: () => api.statefulsets(ns), enabled: !!ns, refetchInterval: 30_000,
  });
  const [filter, setFilter] = useState('');
  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  if (isLoading) return <div className="animate-pulse text-slate-500 text-sm py-4">Loading...</div>;
  return (
    <>
      <FilterInput value={filter} onChange={setFilter} placeholder="Filter statefulsets..." />
      <table className="k-table">
        <thead><tr><th>Name</th><th>Ready</th><th>Replicas</th><th>Age</th></tr></thead>
        <tbody>
          {items.map(d => (
            <tr key={d.name}>
              <td className="font-mono text-xs text-indigo-400">{d.name}</td>
              <td className="text-xs font-mono">{d.readyReplicas ?? 0}/{d.replicas}</td>
              <td className="text-xs">{d.replicas}</td>
              <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500 py-4">No statefulsets</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function DaemonSetsTable({ ns }: { ns: string }) {
  const { data, isLoading } = useQuery<{ items: DaemonSet[] }>({
    queryKey: ['daemonsets', ns], queryFn: () => api.daemonsets(ns), enabled: !!ns, refetchInterval: 30_000,
  });
  const [filter, setFilter] = useState('');
  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  if (isLoading) return <div className="animate-pulse text-slate-500 text-sm py-4">Loading...</div>;
  return (
    <>
      <FilterInput value={filter} onChange={setFilter} placeholder="Filter daemonsets..." />
      <table className="k-table">
        <thead><tr><th>Name</th><th>Desired</th><th>Ready</th><th>Age</th></tr></thead>
        <tbody>
          {items.map(d => (
            <tr key={d.name}>
              <td className="font-mono text-xs text-indigo-400">{d.name}</td>
              <td className="text-xs">{d.desired}</td>
              <td className="text-xs font-mono">{d.ready}/{d.desired}</td>
              <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500 py-4">No daemonsets</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function ReplicaSetsTable({ ns }: { ns: string }) {
  const { data, isLoading } = useQuery<{ items: ReplicaSet[] }>({
    queryKey: ['replicasets', ns], queryFn: () => api.replicasets(ns), enabled: !!ns, refetchInterval: 30_000,
  });
  const [filter, setFilter] = useState('');
  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  if (isLoading) return <div className="animate-pulse text-slate-500 text-sm py-4">Loading...</div>;
  return (
    <>
      <FilterInput value={filter} onChange={setFilter} placeholder="Filter replicasets..." />
      <table className="k-table">
        <thead><tr><th>Name</th><th>Ready</th><th>Replicas</th><th>Age</th></tr></thead>
        <tbody>
          {items.map(d => (
            <tr key={d.name}>
              <td className="font-mono text-xs text-indigo-400">{d.name}</td>
              <td className="text-xs font-mono">{d.readyReplicas ?? 0}/{d.replicas}</td>
              <td className="text-xs">{d.replicas}</td>
              <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="text-center text-slate-500 py-4">No replicasets</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function JobsTable({ ns }: { ns: string }) {
  const { data, isLoading } = useQuery<{ items: Job[] }>({
    queryKey: ['jobs', ns], queryFn: () => api.jobs(ns), enabled: !!ns, refetchInterval: 30_000,
  });
  const [filter, setFilter] = useState('');
  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  if (isLoading) return <div className="animate-pulse text-slate-500 text-sm py-4">Loading...</div>;
  return (
    <>
      <FilterInput value={filter} onChange={setFilter} placeholder="Filter jobs..." />
      <table className="k-table">
        <thead><tr><th>Name</th><th>Completions</th><th>Succeeded</th><th>Failed</th><th>Status</th><th>Age</th></tr></thead>
        <tbody>
          {items.map(d => (
            <tr key={d.name}>
              <td className="font-mono text-xs text-indigo-400">{d.name}</td>
              <td className="text-xs">{d.completions}</td>
              <td className="text-xs text-emerald-400">{d.succeeded}</td>
              <td className="text-xs text-red-400">{d.failed}</td>
              <td><span className={cn('kyma-badge text-[10px]', statusBg(d.status))}>{d.status}</span></td>
              <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-4">No jobs</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function CronJobsTable({ ns }: { ns: string }) {
  const { data, isLoading } = useQuery<{ items: CronJob[] }>({
    queryKey: ['cronjobs', ns], queryFn: () => api.cronjobs(ns), enabled: !!ns, refetchInterval: 30_000,
  });
  const [filter, setFilter] = useState('');
  const items = (data?.items || []).filter(d => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));
  if (isLoading) return <div className="animate-pulse text-slate-500 text-sm py-4">Loading...</div>;
  return (
    <>
      <FilterInput value={filter} onChange={setFilter} placeholder="Filter cronjobs..." />
      <table className="k-table">
        <thead><tr><th>Name</th><th>Schedule</th><th>Last Schedule</th><th>Active</th><th>Age</th></tr></thead>
        <tbody>
          {items.map(d => (
            <tr key={d.name}>
              <td className="font-mono text-xs text-indigo-400">{d.name}</td>
              <td className="text-xs font-mono text-slate-400">{d.schedule}</td>
              <td className="text-xs text-slate-500">{d.lastSchedule || '-'}</td>
              <td className="text-xs">{d.active}</td>
              <td className="text-xs text-slate-500">{d.created ? formatAge(d.created) : '-'}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-4">No cronjobs</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-3">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        className="w-full h-8 pl-9 pr-3 text-sm bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

export default function WorkloadsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') || 'deployments') as TabKey;
  const { data: nsData } = useNamespaces();
  const [ns, setNs] = useState('');

  const currentNs = ns || (nsData?.items?.[0]?.name ?? '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Container size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Workloads</h1>
        </div>
        <select
          className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
          value={currentNs}
          onChange={e => setNs(e.target.value)}
        >
          <option value="">Select namespace</option>
          {(nsData?.items || []).map(n => (
            <option key={n.name} value={n.name}>{n.name}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[rgba(99,102,241,0.15)]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSearchParams({ tab: t.key })}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="k-card">
        {tab === 'deployments' && <DeploymentsTable ns={currentNs} />}
        {tab === 'statefulsets' && <StatefulSetsTable ns={currentNs} />}
        {tab === 'daemonsets' && <DaemonSetsTable ns={currentNs} />}
        {tab === 'replicasets' && <ReplicaSetsTable ns={currentNs} />}
        {tab === 'jobs' && <JobsTable ns={currentNs} />}
        {tab === 'cronjobs' && <CronJobsTable ns={currentNs} />}
      </div>
    </div>
  );
}
