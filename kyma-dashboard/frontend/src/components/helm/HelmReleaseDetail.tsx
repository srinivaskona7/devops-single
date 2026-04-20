import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Copy, Check, ExternalLink, ChevronRight, ChevronDown,
  Box, Container, Globe, FileText, Lock, Database, Monitor,
  Package, Settings, History, Layers, Ship,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HelmRelease } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────
interface HelmDetailData {
  values: string | null;
  manifest: string | null;
  resources: ResourceItem[];
  notes: string | null;
  history: HistoryEntry[];
}

interface ResourceItem {
  kind: string;
  name: string;
  namespace: string;
}

interface HistoryEntry {
  revision: number;
  updated: string;
  status: string;
  chart: string;
  description: string;
}

interface Props {
  release: HelmRelease;
  onClose: () => void;
}

type DetailTab = 'overview' | 'resources' | 'values' | 'manifest';

// ── Helpers ──────────────────────────────────────────────────────────────────
function statusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case 'deployed':         return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'failed':           return 'bg-red-500/20 text-red-400 border border-red-500/30';
    case 'pending':
    case 'pending-install':
    case 'pending-upgrade':
    case 'pending-rollback': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case 'uninstalling':     return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    default:                 return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
  }
}

const KIND_ICON: Record<string, typeof Box> = {
  Pod: Box,
  Deployment: Container,
  Service: Globe,
  ConfigMap: FileText,
  Secret: Lock,
  StatefulSet: Database,
  DaemonSet: Monitor,
};

const KIND_ROUTE: Record<string, string> = {
  Deployment: 'deployments',
  Pod: 'pods',
  Service: 'services',
  ConfigMap: 'configmaps',
  Secret: 'secrets',
  ServiceAccount: 'serviceaccounts',
  PersistentVolumeClaim: 'pvcs',
  Ingress: 'ingresses',
  StatefulSet: 'statefulsets',
  DaemonSet: 'daemonsets',
  ReplicaSet: 'replicasets',
  Job: 'jobs',
  CronJob: 'cronjobs',
};

const KIND_EMOJI: Record<string, string> = {
  Deployment: '\u{1F4E6}',
  Pod: '\u{1F7E2}',
  Service: '\u{1F535}',
  ConfigMap: '\u{2699}\uFE0F',
  Secret: '\u{1F512}',
  StatefulSet: '\u{1F4BE}',
  DaemonSet: '\u{1F4DF}',
  ReplicaSet: '\u{1F504}',
  ServiceAccount: '\u{1F464}',
  PersistentVolumeClaim: '\u{1F4BF}',
  Ingress: '\u{1F310}',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 p-1.5 rounded bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-200 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
}

// ── Resource Tree ────────────────────────────────────────────────────────────
function ResourceGroup({ kind, items }: { kind: string; items: ResourceItem[] }) {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const Icon = KIND_ICON[kind] || Package;
  const emoji = KIND_EMOJI[kind] || '\u{1F4CB}';
  const route = KIND_ROUTE[kind];

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.03] rounded transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} className="text-indigo-400" />
        <span>{emoji} {kind} ({items.length})</span>
      </button>
      {open && (
        <div className="ml-2">
          {items.map((r, i) => (
            <div
              key={`${r.name}-${i}`}
              className="flex items-center gap-2 pl-6 py-1 text-xs text-slate-400 hover:bg-white/[0.02] rounded transition-colors"
            >
              <span className="font-mono">{r.name}</span>
              <span className="text-slate-600 text-[10px]">{r.namespace}</span>
              {route && (
                <button
                  onClick={() => navigate(`/namespaces/${r.namespace}/${route}`)}
                  className="ml-auto p-0.5 text-indigo-400/60 hover:text-indigo-300 transition-colors"
                  title={`Go to ${kind}`}
                >
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Manifest Section ─────────────────────────────────────────────────────────
function ManifestSection({ doc }: { doc: string }) {
  const [open, setOpen] = useState(false);
  const kindMatch = doc.match(/^kind:\s*(.+)$/m);
  const nameMatch = doc.match(/^\s+name:\s*(.+)$/m);
  const kind = kindMatch?.[1]?.trim() || 'Unknown';
  const name = nameMatch?.[1]?.trim() || 'unnamed';

  return (
    <div className="border border-[rgba(99,102,241,0.1)] rounded mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.03] transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="font-medium text-indigo-400">{kind}</span>
        <span className="text-slate-500">/</span>
        <span className="font-mono text-slate-400">{name}</span>
      </button>
      {open && (
        <div className="relative border-t border-[rgba(99,102,241,0.1)]">
          <CopyButton text={doc} />
          <pre className="font-mono text-xs text-green-300 bg-[#030a18] p-4 rounded-b overflow-auto max-h-[400px]">
            {doc}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function HelmReleaseDetail({ release, onClose }: Props) {
  const [tab, setTab] = useState<DetailTab>('resources');
  const [detail, setDetail] = useState<HelmDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDetail(null);
    setTab('resources');

    fetch(`/api/helm-detail?release=${encodeURIComponent(release.name)}&namespace=${encodeURIComponent(release.namespace)}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        return res.json();
      })
      .then(data => { setDetail(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [release.name, release.namespace]);

  const TABS: { key: DetailTab; label: string; Icon: typeof Box }[] = [
    { key: 'overview', label: 'Overview', Icon: Layers },
    { key: 'resources', label: 'Resources', Icon: Package },
    { key: 'values', label: 'Values', Icon: Settings },
    { key: 'manifest', label: 'Manifest', Icon: FileText },
  ];

  // Group resources by kind
  const resourcesByKind: Record<string, ResourceItem[]> = {};
  if (detail?.resources) {
    for (const r of detail.resources) {
      (resourcesByKind[r.kind] ??= []).push(r);
    }
  }

  const manifestDocs = (detail?.manifest || '')
    .split(/\n---\n/)
    .map(d => d.trim())
    .filter(Boolean);

  const latestHistory = detail?.history?.[0];

  return (
    <div className="mt-4 bg-[#0d1b2e] border border-[rgba(99,102,241,0.15)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(99,102,241,0.15)]">
        <div className="flex items-center gap-3">
          <Ship className="text-indigo-400" size={18} />
          <div>
            <h3 className="text-sm font-semibold text-slate-200">{release.name}</h3>
            <p className="text-[10px] text-slate-500">{release.namespace} &middot; {release.chart}</p>
          </div>
          <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', statusBadgeClass(release.status))}>
            {release.status}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/[0.05] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[rgba(99,102,241,0.1)]">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors',
              tab === t.key
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border border-transparent',
            )}
          >
            <t.Icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 min-h-[200px]">
        {loading && (
          <div className="flex items-center justify-center py-12 text-slate-500 text-xs">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent mr-3" />
            Loading release details...
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400 text-xs">
            Failed to load: {error}
          </div>
        )}

        {!loading && !error && detail && (
          <>
            {/* Overview Tab */}
            {tab === 'overview' && (
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <div className="text-xs">
                  <span className="text-slate-500">Status</span>
                  <div className="mt-1">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', statusBadgeClass(release.status))}>
                      {release.status}
                    </span>
                  </div>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500">Chart</span>
                  <div className="mt-1 text-slate-300 font-mono">{release.chart}</div>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500">Version</span>
                  <div className="mt-1 text-slate-300 font-mono">{release.version}</div>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500">Namespace</span>
                  <div className="mt-1 text-slate-300 font-mono">{release.namespace}</div>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500">Revision</span>
                  <div className="mt-1 text-slate-300 font-mono">{latestHistory?.revision ?? '-'}</div>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500">Last Deployed</span>
                  <div className="mt-1 text-slate-300">{release.updated || latestHistory?.updated || '-'}</div>
                </div>
                {detail.notes && (
                  <div className="col-span-2 text-xs">
                    <span className="text-slate-500">Notes</span>
                    <pre className="mt-1 font-mono text-[11px] text-slate-400 bg-[#030a18] p-3 rounded overflow-auto max-h-[200px] whitespace-pre-wrap">
                      {detail.notes}
                    </pre>
                  </div>
                )}
                {detail.history && detail.history.length > 0 && (
                  <div className="col-span-2 text-xs mt-2">
                    <span className="text-slate-500 flex items-center gap-1 mb-2"><History size={12} /> Revision History</span>
                    <div className="space-y-1">
                      {detail.history.slice(0, 10).map(h => (
                        <div key={h.revision} className="flex items-center gap-3 text-[11px] px-2 py-1 rounded bg-white/[0.02]">
                          <span className="text-indigo-400 font-mono w-6">#{h.revision}</span>
                          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-medium', statusBadgeClass(h.status))}>{h.status}</span>
                          <span className="text-slate-400 font-mono">{h.chart}</span>
                          <span className="text-slate-600 ml-auto">{h.updated}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resources Tab */}
            {tab === 'resources' && (
              <div>
                {Object.keys(resourcesByKind).length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">No resources found</div>
                ) : (
                  Object.entries(resourcesByKind).map(([kind, items]) => (
                    <ResourceGroup key={kind} kind={kind} items={items} />
                  ))
                )}
              </div>
            )}

            {/* Values Tab */}
            {tab === 'values' && (
              <div className="relative">
                {detail.values ? (
                  <>
                    <CopyButton text={detail.values} />
                    <pre className="font-mono text-xs text-green-300 bg-[#030a18] p-4 rounded overflow-auto max-h-[500px]">
                      {detail.values}
                    </pre>
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs">No custom values</div>
                )}
              </div>
            )}

            {/* Manifest Tab */}
            {tab === 'manifest' && (
              <div>
                {manifestDocs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">No manifest data</div>
                ) : (
                  manifestDocs.map((doc, i) => <ManifestSection key={i} doc={doc} />)
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
