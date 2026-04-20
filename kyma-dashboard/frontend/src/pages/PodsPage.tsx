import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatAge, statusBg } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';
import { useNamespace } from '@/hooks/useNamespace';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { Box, Search, RefreshCw, Terminal, FileText, Trash2,
         ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
         ChevronDown, ChevronUp, X, Download, MoreHorizontal } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { PodTerminal } from '@/components/shared/PodTerminal';
import type { Pod } from '@/types';

const PAGE_SIZE = 20;

// ── helpers ──────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 min-h-[20px]">
      <span className="text-slate-500 shrink-0 w-[110px]">{label}</span>
      <span className="text-slate-300 text-right break-all">{value || <span className="text-slate-600">—</span>}</span>
    </div>
  );
}

// ── Streaming Log Panel ───────────────────────────────────────────────────────

interface LogPanelProps {
  namespace: string;
  podName: string;
  containers: { name: string }[];
  initialContainer?: string;
}

function LogPanel({ namespace, podName, containers, initialContainer }: LogPanelProps) {
  const [container, setContainer] = useState(initialContainer || containers[0]?.name || '');
  const [linesCount, setLinesCount] = useState(100);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lines, setLines] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;

  // Sync container when initialContainer changes (e.g. "View Logs" clicked on a specific container)
  useEffect(() => {
    if (initialContainer) setContainer(initialContainer);
  }, [initialContainer]);

  const startStream = (tail: number, cont: string) => {
    if (esRef.current) esRef.current.close();
    setLines([]);
    setStreaming(true);

    const url = api.podLogsStream(namespace, podName, cont, tail);
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      const line = JSON.parse(e.data) as string;
      setLines(prev => [...prev.slice(-2000), line]);
      if (autoScrollRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    es.addEventListener('end', () => { setStreaming(false); es.close(); });
    es.onerror = () => { setStreaming(false); es.close(); };
  };

  useEffect(() => {
    startStream(linesCount, container);
    return () => esRef.current?.close();
  }, [podName, container]);

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: '#060d1f' }}>
      {/* toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(99,102,241,0.15)] flex-wrap shrink-0">
        <span className="text-[11px] text-slate-400 font-semibold">Logs</span>
        {containers.length > 1 && (
          <select
            value={container}
            onChange={e => { setContainer(e.target.value); startStream(linesCount, e.target.value); }}
            className="h-6 px-1.5 text-[11px] bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300"
          >
            {containers.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        )}
        <select
          value={linesCount}
          onChange={e => { setLinesCount(+e.target.value); startStream(+e.target.value, container); }}
          className="h-6 px-1.5 text-[11px] bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded text-slate-300"
        >
          {[50, 100, 500, 1000].map(n => <option key={n} value={n}>{n} lines</option>)}
        </select>
        <div className="flex items-center gap-1">
          <span className={cn('w-2 h-2 rounded-full', streaming ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
          <span className="text-[10px] text-slate-500">{streaming ? 'Live' : 'Stopped'}</span>
        </div>
        <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="w-3 h-3" />
          Auto-scroll
        </label>
        <button
          onClick={() => startStream(linesCount, container)}
          className="ml-auto text-[11px] px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/40 rounded text-indigo-400"
        >
          <RefreshCw size={10} className="inline mr-1" />Restart
        </button>
      </div>
      {/* output */}
      <div className="flex-1 overflow-auto text-[11px] font-mono bg-[#030a18] p-3 leading-relaxed min-h-0">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'whitespace-pre-wrap break-all',
              line.startsWith('[stderr]') ? 'text-amber-400'
              : line.startsWith('[error]') ? 'text-red-400'
              : 'text-green-300'
            )}
          >
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
        {streaming && lines.length === 0 && (
          <div className="text-slate-600 animate-pulse text-[10px]">Waiting for logs...</div>
        )}
      </div>
    </div>
  );
}

// ── Pod Detail Panel ──────────────────────────────────────────────────────────

interface PodDetailPanelProps {
  pod: Pod;
  namespace: string;
  onClose: () => void;
}

function PodDetailPanel({ pod, namespace, onClose }: PodDetailPanelProps) {
  const [tab, setTab] = useState<'view' | 'logs'>('view');
  const [logContainer, setLogContainer] = useState<string>('');
  const [volumesOpen, setVolumesOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pod-detail', namespace, pod.name],
    queryFn: () => api.podDetail(namespace, pod.name),
    staleTime: 15_000,
  });

  const detail = data?.data as any;
  const containers: { name: string }[] = detail?.containers || pod.containers || [];

  const openLogs = (containerName: string) => {
    setLogContainer(containerName);
    setTab('logs');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ── */}
      <div className="flex items-start justify-between px-3 pt-3 pb-2 border-b border-[rgba(99,102,241,0.15)] gap-2 shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white font-mono truncate" title={pod.name}>{pod.name}</div>
          <div className="mt-0.5">
            <StatusBadge status={pod.phase} />
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {tab !== 'logs' && (
            <button
              onClick={() => openLogs(containers[0]?.name || '')}
              className="px-2 py-1 text-[11px] bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded text-indigo-300 flex items-center gap-1"
            >
              <FileText size={10} /> Logs
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-slate-400">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── View / Logs tabs ── */}
      <div className="flex border-b border-[rgba(99,102,241,0.15)] shrink-0">
        <button
          onClick={() => setTab('view')}
          className={cn(
            'px-4 py-2 text-xs font-medium border-b-2 transition-colors',
            tab === 'view'
              ? 'text-indigo-400 border-indigo-500'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          )}
        >
          View
        </button>
        <button
          onClick={() => setTab('logs')}
          className={cn(
            'px-4 py-2 text-xs font-medium border-b-2 transition-colors',
            tab === 'logs'
              ? 'text-indigo-400 border-indigo-500'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          )}
        >
          Logs
        </button>
      </div>

      {/* ── Log view ── */}
      {tab === 'logs' && (
        <div className="flex-1 min-h-0">
          <LogPanel
            namespace={namespace}
            podName={pod.name}
            containers={containers}
            initialContainer={logContainer || containers[0]?.name}
          />
        </div>
      )}

      {/* ── Detail view ── */}
      {tab === 'view' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs min-h-0">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="k-card h-10 animate-pulse bg-white/[0.02]" />
              ))}
            </div>
          )}

          {/* ── Metadata ── */}
          {!isLoading && (
            <section className="k-card space-y-1.5">
              <h4 className="section-title mb-2">Metadata</h4>
              <Row label="Resource Type" value="Pod" />
              <Row label="Namespace" value={detail?.namespace || namespace} />
              <Row
                label="Age"
                value={detail?.creationTimestamp ? `${formatAge(detail.creationTimestamp)} ago` : undefined}
              />
              <Row
                label="Controlled By"
                value={
                  detail?.ownerReferences?.[0] ? (
                    <span className="text-indigo-400 font-mono">
                      {detail.ownerReferences[0].kind}/{detail.ownerReferences[0].name}
                    </span>
                  ) : undefined
                }
              />
              <Row label="Host IP" value={detail?.hostIP} />
              <Row label="Pod IP" value={detail?.podIP} />
              <Row label="QoS Class" value={detail?.qosClass} />
              {detail?.podIPs?.length > 1 && (
                <Row label="All IPs" value={detail.podIPs.join(', ')} />
              )}

              {/* Labels */}
              {Object.keys(detail?.labels || {}).length > 0 && (
                <div className="pt-1">
                  <div className="text-slate-500 mb-1">Labels</div>
                  <div className="flex gap-1 flex-wrap">
                    {Object.entries(detail.labels as Record<string, string>).map(([k, v]) => (
                      <span key={k} className="kyma-badge bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">
                        {k}={v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Annotations */}
              {Object.keys(detail?.annotations || {}).length > 0 && (
                <div className="pt-1">
                  <div className="text-slate-500 mb-1">Annotations</div>
                  <div className="flex gap-1 flex-wrap">
                    {Object.keys(detail.annotations as Record<string, string>).slice(0, 8).map(k => (
                      <span key={k} className="kyma-badge bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px]">
                        {k}
                      </span>
                    ))}
                    {Object.keys(detail.annotations).length > 8 && (
                      <span className="text-slate-600 text-[10px]">
                        +{Object.keys(detail.annotations).length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Conditions ── */}
          {!isLoading && detail?.conditions?.length > 0 && (
            <section className="k-card space-y-1.5">
              <h4 className="section-title mb-2">Conditions</h4>
              {detail.conditions.map((c: any) => (
                <div key={c.type} className="flex items-center justify-between">
                  <span className="text-slate-400">{c.type}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium', c.status === 'True' ? 'text-emerald-400' : 'text-red-400')}>
                      {c.status}
                    </span>
                    {c.lastTransitionTime && (
                      <span className="text-slate-600">{formatAge(c.lastTransitionTime)} ago</span>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ── Volumes (collapsible) ── */}
          {!isLoading && detail?.volumes?.length > 0 && (
            <section className="k-card">
              <button
                onClick={() => setVolumesOpen(v => !v)}
                className="flex items-center justify-between w-full"
              >
                <h4 className="section-title">Volumes ({detail.volumes.length})</h4>
                {volumesOpen
                  ? <ChevronUp size={12} className="text-slate-500" />
                  : <ChevronDown size={12} className="text-slate-500" />
                }
              </button>
              {volumesOpen && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-slate-500 border-b border-white/[0.05]">
                        <th className="text-left py-1 pr-3 font-medium">Volume Name</th>
                        <th className="text-left py-1 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.volumes.map((v: any) => (
                        <tr key={v.name} className="border-b border-white/[0.03]">
                          <td className="py-1 pr-3 font-mono text-indigo-300">{v.name}</td>
                          <td className="py-1 text-slate-400">{v.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ── Containers ── */}
          {!isLoading && detail?.containers?.length > 0 && (
            <section className="k-card">
              <h4 className="section-title mb-2">Containers ({detail.containers.length})</h4>
              <div className="space-y-3">
                {detail.containers.map((c: any) => (
                  <div key={c.name} className="pb-3 border-b border-white/[0.05] last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-white font-mono">{c.name}</span>
                      <button
                        onClick={() => openLogs(c.name)}
                        className="text-[11px] px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded text-indigo-300 flex items-center gap-1"
                      >
                        <FileText size={9} /> View Logs
                      </button>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Status</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-500 shrink-0">Image</span>
                        <span className="text-slate-300 font-mono text-[10px] text-right break-all">{c.image}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pull Policy</span>
                        <span className="text-slate-400">{c.imagePullPolicy}</span>
                      </div>
                      {c.startedAt && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Started</span>
                          <span className="text-slate-400">{formatAge(c.startedAt)} ago</span>
                        </div>
                      )}
                      {c.restartCount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Restarts</span>
                          <span className="text-amber-400 font-mono">{c.restartCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Init Containers ── */}
          {!isLoading && detail?.initContainers?.length > 0 && (
            <section className="k-card">
              <h4 className="section-title mb-2">Init Containers ({detail.initContainers.length})</h4>
              <div className="space-y-3">
                {detail.initContainers.map((c: any) => (
                  <div key={c.name} className="pb-3 border-b border-white/[0.05] last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-white font-mono">{c.name}</span>
                      <button
                        onClick={() => openLogs(c.name)}
                        className="text-[11px] px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded text-indigo-300 flex items-center gap-1"
                      >
                        <FileText size={9} /> View Logs
                      </button>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Status</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-500 shrink-0">Image</span>
                        <span className="text-slate-300 font-mono text-[10px] text-right break-all">{c.image}</span>
                      </div>
                      {c.startedAt && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Finished</span>
                          <span className="text-slate-400">{formatAge(c.startedAt)} ago</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ── Exec Panel ────────────────────────────────────────────────────────────────

function ExecPanel({ pod, namespace, onClose }: { pod: Pod; namespace: string; onClose: () => void }) {
  return (
    <div className="w-[560px] shrink-0 max-h-[calc(100vh-180px)]">
      <PodTerminal
        namespace={namespace}
        pod={pod.name}
        container={pod.containers?.[0]?.name || ''}
        onClose={onClose}
      />
    </div>
  );
}

// ── Main PodsPage ─────────────────────────────────────────────────────────────

export default function PodsPage() {
  const nsFromHook = useNamespace();
  const [, setSearchParams] = useSearchParams();
  const { namespace: nsParam } = useParams<{ namespace?: string }>();
  const navigate = useNavigate();
  const { data: nsData } = useNamespaces();
  const [filter, setFilter] = useState('');
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [execPod, setExecPod] = useState<Pod | null>(null);
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const closeMenu = useCallback(() => setOpenMenuId(null), []);

  const downloadManifest = async (kind: string, ns: string, name: string) => {
    try {
      const res = await fetch(`/api/manifest?kind=${kind}&namespace=${ns}&name=${name}`);
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

  const ns = nsFromHook || (nsData?.items?.[0]?.name ?? '');

  // Reset to page 1 when namespace or filter changes
  useEffect(() => { setPage(1); }, [ns, filter]);

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: Pod[] }>({
    queryKey: ['pods', ns],
    queryFn: () => api.pods(ns),
    enabled: !!ns,
    refetchInterval: REFETCH_INTERVAL,
  });

  const filtered = (data?.items || []).filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (isLoading) return (<div className="p-6"><LoadingState resource="Pods" /></div>);
  if (isError) return (<div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const btnBase =
    'h-6 w-6 flex items-center justify-center rounded text-xs text-slate-400 ' +
    'hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Box size={20} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Pods</h1>
          <span className="text-sm text-slate-500">({filtered.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-7 px-2 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.15)] rounded text-slate-300"
            value={ns}
            onChange={e => {
              if (nsParam) {
                navigate(`/namespaces/${e.target.value}/pods`);
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
          <button onClick={() => refetch()} className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── Search — flatter, SAP-style ── */}
      <div className="relative shrink-0">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border-0 border-b border-[rgba(99,102,241,0.2)] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
          placeholder="Filter pods..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {/* ── List + Detail panel ── */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Pod table */}
        <div className={cn('flex flex-col transition-all min-h-0', selectedPod ? 'flex-1' : 'w-full')}>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="k-card h-12 animate-pulse bg-white/[0.02]" />
              ))}
            </div>
          ) : (
            <div className="k-card p-0 overflow-hidden flex flex-col flex-1">
              <div className="overflow-auto flex-1">
                <table className="k-table">
                  <thead>
                    <tr>
                      <th className="pl-4">Name</th>
                      <th>Created</th>
                      <th>Controlled By</th>
                      <th>Status</th>
                      <th>Restarts</th>
                      <th className="w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(pod => (
                      <tr
                        key={`${pod.namespace}/${pod.name}`}
                        onClick={() => setSelectedPod(pod)}
                        className={cn(
                          'cursor-pointer',
                          selectedPod?.name === pod.name
                            ? 'bg-indigo-500/10 border-l-2 border-indigo-500'
                            : 'hover:bg-white/[0.02]'
                        )}
                      >
                        {/* Name */}
                        <td className="pl-4">
                          <span
                            className="font-mono text-xs text-indigo-400 hover:text-indigo-300 truncate max-w-[260px] block"
                            title={pod.name}
                          >
                            {pod.name}
                          </span>
                        </td>

                        {/* Created */}
                        <td className="text-xs text-slate-400 whitespace-nowrap">
                          {pod.created
                            ? new Date(pod.created).toLocaleString('en-US', {
                                month: 'short', day: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                              })
                            : '—'}
                        </td>

                        {/* Controlled By */}
                        <td>
                          {(pod as any).ownerKind ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-700/60 text-slate-300 border border-slate-600/40">
                              {(pod as any).ownerKind}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span className={cn('kyma-badge text-[10px]', statusBg(pod.phase))}>
                            {pod.phase}
                          </span>
                        </td>

                        {/* Restarts */}
                        <td className={cn(
                          'text-xs font-mono',
                          pod.restarts > 0 ? 'text-amber-400' : 'text-slate-400'
                        )}>
                          {pod.restarts}
                        </td>

                        {/* Actions — SAP-style ... menu */}
                        <td onClick={e => e.stopPropagation()} className="relative">
                          <div className="row-actions flex justify-end pr-2">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === pod.name ? null : pod.name)}
                              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                              title="Actions"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </div>
                          {openMenuId === pod.name && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={closeMenu} />
                              <div className="absolute right-2 top-8 z-50 w-40 rounded-lg shadow-xl overflow-hidden"
                                style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)' }}>
                                <button onClick={() => { setSelectedPod(pod); closeMenu(); }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2">
                                  <FileText size={13} className="text-indigo-400" /> Detail
                                </button>
                                <button onClick={() => { setSelectedPod(null); setExecPod(pod); closeMenu(); }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2">
                                  <Terminal size={13} className="text-cyan-400" /> Exec
                                </button>
                                <button onClick={() => { downloadManifest('pod', pod.namespace || ns, pod.name); closeMenu(); }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2">
                                  <Download size={13} className="text-emerald-400" /> Download YAML
                                </button>
                                <div className="border-t border-white/5 my-0.5" />
                                <button onClick={closeMenu}
                                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {paginated.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-slate-500 py-8">
                          {ns ? 'No pods found' : 'Select a namespace'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(99,102,241,0.15)] shrink-0">
                  <span className="text-xs text-slate-500">{filtered.length} pods</span>
                  <div className="flex items-center gap-1">
                    <button
                      className={btnBase}
                      disabled={safePage === 1}
                      onClick={() => setPage(1)}
                      title="First page"
                    >
                      <ChevronsLeft size={12} />
                    </button>
                    <button
                      className={btnBase}
                      disabled={safePage === 1}
                      onClick={() => setPage(p => p - 1)}
                      title="Previous page"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span className="text-xs text-slate-400 px-2">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      className={btnBase}
                      disabled={safePage === totalPages}
                      onClick={() => setPage(p => p + 1)}
                      title="Next page"
                    >
                      <ChevronRight size={12} />
                    </button>
                    <button
                      className={btnBase}
                      disabled={safePage === totalPages}
                      onClick={() => setPage(totalPages)}
                      title="Last page"
                    >
                      <ChevronsRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Detail side panel ── */}
        {selectedPod && (
          <div className="w-[420px] k-card p-0 flex flex-col min-h-0 overflow-hidden shrink-0 max-h-[calc(100vh-180px)]">
            <PodDetailPanel
              pod={selectedPod}
              namespace={ns}
              onClose={() => setSelectedPod(null)}
            />
          </div>
        )}

        {/* ── Exec panel ── */}
        {execPod && (
          <div className="k-card p-0 flex flex-col min-h-0 overflow-hidden shrink-0 max-h-[calc(100vh-180px)]">
            <ExecPanel
              pod={execPod}
              namespace={ns}
              onClose={() => setExecPod(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
