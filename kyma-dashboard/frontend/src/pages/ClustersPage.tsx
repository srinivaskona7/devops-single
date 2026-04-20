import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server, Plus, ExternalLink, Upload, Download, Pencil, Trash2,
  Check, X, Info, ArrowUpDown, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface SavedCluster {
  name: string;
  apiServer: string;
  kubeconfig: string;
  storageType: 'local' | 'session';
  description?: string;
  addedAt: string;
}

const STORAGE_KEY = 'sk-clusters';
const ACTIVE_KEY = 'sk-active-cluster';

function readClusters(): SavedCluster[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function writeClusters(clusters: SavedCluster[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clusters));
}

/* ─── Wizard ─────────────────────────────────────────────────────────────── */

interface WizardProps {
  onClose: () => void;
  onConnected: (clusters: SavedCluster[]) => void;
  editCluster?: SavedCluster | null;
}

function ConnectClusterWizard({ onClose, onConnected, editCluster }: WizardProps) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [kubeconfigText, setKubeconfigText] = useState(editCluster?.kubeconfig ?? '');
  const [parsedName, setParsedName] = useState(editCluster?.name ?? '');
  const [parsedServer, setParsedServer] = useState(editCluster?.apiServer ?? '');
  const [storageType, setStorageType] = useState<'local' | 'session'>(editCluster?.storageType ?? 'local');
  const [description, setDescription] = useState(editCluster?.description ?? '');
  const [connecting, setConnecting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const parseKubeconfig = useCallback((text: string) => {
    setKubeconfigText(text);
    try {
      const ctxMatch = text.match(/current-context:\s*(\S+)/);
      const srvMatch = text.match(/server:\s*(https?:\/\/\S+)/);
      if (ctxMatch) setParsedName(ctxMatch[1]);
      if (srvMatch) setParsedServer(srvMatch[1]);
    } catch {}
  }, []);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => parseKubeconfig(e.target?.result as string ?? '');
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const connectCluster = async () => {
    if (!kubeconfigText || !parsedName) return;
    setConnecting(true);
    try {
      const newCluster: SavedCluster = {
        name: parsedName,
        apiServer: parsedServer,
        kubeconfig: kubeconfigText,
        storageType,
        description: description || undefined,
        addedAt: new Date().toISOString(),
      };
      const existing = readClusters();
      const updated = [...existing.filter(c => c.name !== parsedName), newCluster];
      writeClusters(updated);
      if (storageType === 'session') sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem(ACTIVE_KEY, parsedName);

      await fetch('/api/switch-cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kubeconfig: kubeconfigText, clusterName: parsedName }),
      });

      onConnected(updated);
      if (!editCluster) navigate('/cluster');
    } finally {
      setConnecting(false);
    }
  };

  const steps = ['Configuration', 'Privacy', 'Review'];
  const canNext = step === 1 ? !!kubeconfigText.trim() && !!parsedName : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-base, #060d1f)', border: '1px solid var(--border, rgba(99,102,241,0.2))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border, rgba(99,102,241,0.15))' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary, #e2e8f0)' }}>
            {editCluster ? 'Edit Cluster' : 'Connect Cluster'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-5 pb-2">
          {steps.map((label, idx) => {
            const num = idx + 1;
            const active = step === num;
            const done = step > num;
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 min-w-[52px]">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    done ? 'bg-indigo-600 border-indigo-600 text-white' :
                    active ? 'bg-transparent border-indigo-500 text-indigo-400' :
                    'bg-transparent border-slate-700 text-slate-600'
                  )}>
                    {done ? <Check size={12} /> : num}
                  </div>
                  <span className={cn('text-[10px] font-medium whitespace-nowrap',
                    active ? 'text-indigo-400' : done ? 'text-slate-400' : 'text-slate-600'
                  )}>{label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-px mx-1 mb-4"
                    style={{ background: step > num ? 'rgb(99 102 241)' : 'rgba(255,255,255,0.08)' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="px-6 py-4 min-h-[280px] overflow-y-auto">

          {/* ── Step 1: Configuration ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-muted, #64748b)' }}>
                Provide Kubeconfig — upload a file or paste the YAML content.
              </p>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'hover:border-indigo-500/50'
                )}
                style={{ borderColor: dragOver ? undefined : 'var(--border, rgba(99,102,241,0.25))', background: dragOver ? undefined : 'var(--bg-card, #0d1b2e)' }}
              >
                <Upload size={22} className="mx-auto mb-2" style={{ color: 'var(--text-muted, #64748b)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted, #64748b)' }}>
                  Drop a <code className="font-mono">.kubeconfig</code> file or{' '}
                  <span className="text-indigo-400 underline">click to upload</span>
                </p>
                <input
                  ref={fileRef} type="file" className="hidden"
                  accept=".yaml,.yml,.kubeconfig,.conf"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                />
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  className="w-full h-44 font-mono text-xs p-3 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  style={{
                    background: 'var(--bg-card, #0d1b2e)',
                    border: '1px solid var(--border, rgba(99,102,241,0.2))',
                    color: 'var(--text-primary, #e2e8f0)',
                  }}
                  placeholder="Paste .kubeconfig YAML here..."
                  value={kubeconfigText}
                  onChange={e => parseKubeconfig(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {/* Parsed preview */}
              {parsedName && (
                <div className="rounded-lg px-3 py-2 text-xs space-y-1"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20">Context:</span>
                    <span className="font-mono text-indigo-300">{parsedName}</span>
                  </div>
                  {parsedServer && (
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-20">API Server:</span>
                      <span className="font-mono text-slate-400 truncate">{parsedServer}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Optional description */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted, #64748b)' }}>
                  Description (optional)
                </label>
                <input
                  className="w-full h-8 px-3 text-xs rounded focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  style={{
                    background: 'var(--bg-card, #0d1b2e)',
                    border: '1px solid var(--border, rgba(99,102,241,0.2))',
                    color: 'var(--text-primary, #e2e8f0)',
                  }}
                  placeholder="e.g. Production Kyma cluster"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Privacy ── */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted, #64748b)' }}>
                Storage type configuration — choose where the kubeconfig is stored in your browser.
              </p>
              {(['local', 'session'] as const).map(type => (
                <label
                  key={type}
                  className="flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all"
                  style={{
                    border: `2px solid ${storageType === type ? 'rgb(99 102 241)' : 'var(--border, rgba(99,102,241,0.2))'}`,
                    background: storageType === type ? 'rgba(99,102,241,0.08)' : 'var(--bg-card, #0d1b2e)',
                  }}
                >
                  <input
                    type="radio" name="storage" value={type}
                    checked={storageType === type}
                    onChange={() => setStorageType(type)}
                    className="mt-0.5 accent-indigo-500"
                  />
                  <div>
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary, #e2e8f0)' }}>
                      {type === 'local' ? 'Local Storage' : 'Session Storage'}
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted, #64748b)' }}>
                      {type === 'local'
                        ? 'Cluster data is persisted between browser reloads. Best for everyday use.'
                        : 'Cluster data is cleared when the page session ends. Best for shared or temporary environments.'}
                    </div>
                  </div>
                  {storageType === type && (
                    <Check size={14} className="ml-auto mt-0.5 text-indigo-400 shrink-0" />
                  )}
                </label>
              ))}
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: 'var(--text-muted, #64748b)' }}>
                Review your configuration before connecting.
              </p>
              <div className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--border, rgba(99,102,241,0.2))' }}>
                {[
                  { label: 'Cluster', value: parsedName },
                  { label: 'API Server', value: parsedServer || '—' },
                  { label: 'Authentication', value: 'Token / Kubeconfig' },
                  { label: 'Storage preference', value: storageType === 'local' ? 'Local Storage' : 'Session Storage' },
                  ...(description ? [{ label: 'Description', value: description }] : []),
                ].map(({ label, value }, idx, arr) => (
                  <div
                    key={label}
                    className={cn('flex justify-between items-center px-4 py-3 text-xs', idx < arr.length - 1 && 'border-b')}
                    style={{ borderColor: 'var(--border, rgba(99,102,241,0.15))', background: 'var(--bg-card, #0d1b2e)' }}
                  >
                    <span style={{ color: 'var(--text-muted, #64748b)' }}>{label}</span>
                    <span className="font-mono max-w-[240px] truncate text-right" style={{ color: 'var(--text-primary, #e2e8f0)' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: 'var(--border, rgba(99,102,241,0.15))' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg transition-colors"
            style={{ color: 'var(--text-muted, #64748b)', border: '1px solid var(--border, rgba(99,102,241,0.2))' }}
          >
            Cancel
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary, #94a3b8)', border: '1px solid var(--border, rgba(99,102,241,0.2))' }}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next step
              </button>
            ) : (
              <button
                onClick={connectCluster}
                disabled={connecting}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {connecting && <span className="animate-spin text-xs">⟳</span>}
                {editCluster ? 'Save changes' : 'Connect'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function ClustersPage() {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState<SavedCluster[]>(readClusters);
  const [showConnect, setShowConnect] = useState(false);
  const [editCluster, setEditCluster] = useState<SavedCluster | null>(null);
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [infoTooltip, setInfoTooltip] = useState<string | null>(null);
  const activeClusterName = localStorage.getItem(ACTIVE_KEY);

  const filtered = clusters
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.apiServer.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortAsc
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name));

  const activateCluster = async (cluster: SavedCluster) => {
    localStorage.setItem(ACTIVE_KEY, cluster.name);
    try {
      await fetch('/api/switch-cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kubeconfig: cluster.kubeconfig, clusterName: cluster.name }),
      });
    } catch {}
    navigate('/cluster');
  };

  const deleteCluster = (name: string) => {
    const updated = clusters.filter(c => c.name !== name);
    setClusters(updated);
    writeClusters(updated);
    if (localStorage.getItem(ACTIVE_KEY) === name) localStorage.removeItem(ACTIVE_KEY);
  };

  const downloadKubeconfig = (cluster: SavedCluster) => {
    const blob = new Blob([cluster.kubeconfig], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kubeconfig-${cluster.name}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConnected = (updated: SavedCluster[]) => {
    setClusters(updated);
    setShowConnect(false);
    setEditCluster(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary, #e2e8f0)' }}>
          Clusters
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted, #64748b)' }}>
          Manage Kubernetes cluster connections for this dashboard.
        </p>
      </div>

      {clusters.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.1)' }}>
            <Server size={40} className="text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary, #e2e8f0)' }}>
            There are no clusters yet
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted, #64748b)' }}>
            Connect one to use the Srinivas-kyma dashboard.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConnect(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <Plus size={14} /> Connect
            </button>
            <a
              href="https://kyma-project.io/docs/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors hover:bg-white/5"
              style={{ border: '1px solid var(--border, rgba(99,102,241,0.2))', color: 'var(--text-secondary, #94a3b8)' }}
            >
              Learn More <ExternalLink size={12} />
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* ── Toolbar ── */}
          <div className="flex items-center gap-3 mb-4">
            {/* Search */}
            <div className="flex items-center gap-2 h-8 px-3 rounded-lg flex-1 max-w-72"
              style={{ background: 'var(--bg-card, #0d1b2e)', border: '1px solid var(--border, rgba(99,102,241,0.2))' }}>
              <Search size={13} style={{ color: 'var(--text-muted, #64748b)' }} />
              <input
                className="flex-1 bg-transparent text-xs focus:outline-none"
                style={{ color: 'var(--text-primary, #e2e8f0)' }}
                placeholder="Search clusters..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* Sort */}
              <button
                onClick={() => setSortAsc(v => !v)}
                className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg transition-colors hover:bg-white/5"
                style={{
                  border: '1px solid var(--border, rgba(99,102,241,0.2))',
                  color: 'var(--text-secondary, #94a3b8)',
                }}
                title={sortAsc ? 'Sort Z → A' : 'Sort A → Z'}
              >
                <ArrowUpDown size={12} />
                Sort
              </button>

              {/* Connect cluster */}
              <button
                onClick={() => setShowConnect(true)}
                className="flex items-center gap-1.5 h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                <Plus size={13} />
                Connect Cluster
              </button>
            </div>
          </div>

          {/* ── Clusters table ── */}
          <div className="rounded-xl overflow-hidden flex-1"
            style={{ border: '1px solid var(--border, rgba(99,102,241,0.15))' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-card, #0d1b2e)', borderBottom: '1px solid var(--border, rgba(99,102,241,0.15))' }}>
                  {['Name', 'API Server Address', 'Storage Type', 'Description', 'Actions'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted, #64748b)', fontSize: '10px' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((cluster, idx) => {
                  const isActive = cluster.name === activeClusterName;
                  return (
                    <tr
                      key={cluster.name}
                      className="hover:bg-white/[0.025] transition-colors"
                      style={{
                        borderBottom: idx < filtered.length - 1
                          ? '1px solid var(--border, rgba(99,102,241,0.08))'
                          : 'none',
                        background: 'var(--bg-base, #060d1f)',
                      }}
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => activateCluster(cluster)}
                          className="flex items-center gap-2 hover:text-indigo-400 transition-colors font-medium group"
                          style={{ color: 'var(--text-primary, #e2e8f0)' }}
                        >
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0 transition-all',
                            isActive ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-700 group-hover:bg-indigo-400'
                          )} />
                          <span className="font-mono">{cluster.name}</span>
                          {isActive && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                              style={{ background: 'rgba(52,211,153,0.15)', color: 'rgb(52,211,153)' }}>
                              active
                            </span>
                          )}
                        </button>
                      </td>

                      {/* API Server */}
                      <td className="px-4 py-3">
                        <span
                          className="font-mono truncate block max-w-[220px]"
                          style={{ color: 'var(--text-secondary, #94a3b8)' }}
                          title={cluster.apiServer}
                        >
                          {cluster.apiServer || '—'}
                        </span>
                      </td>

                      {/* Storage type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 relative">
                          <span style={{ color: 'var(--text-primary, #e2e8f0)' }}>
                            {cluster.storageType === 'local' ? 'Local Storage' : 'Session Storage'}
                          </span>
                          <button
                            onMouseEnter={() => setInfoTooltip(cluster.name)}
                            onMouseLeave={() => setInfoTooltip(null)}
                            className="opacity-50 hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--text-muted, #64748b)' }}
                          >
                            <Info size={12} />
                          </button>
                          {infoTooltip === cluster.name && (
                            <div
                              className="absolute left-0 top-6 z-50 px-3 py-2 rounded-lg text-[11px] w-52 shadow-xl pointer-events-none"
                              style={{
                                background: 'var(--bg-card, #0d1b2e)',
                                border: '1px solid var(--border, rgba(99,102,241,0.2))',
                                color: 'var(--text-secondary, #94a3b8)',
                              }}
                            >
                              {cluster.storageType === 'local'
                                ? 'Cluster data is persisted between browser reloads.'
                                : 'Cluster data is cleared when the page session ends.'}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3" style={{ color: 'var(--text-muted, #64748b)' }}>
                        {cluster.description || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditCluster(cluster); setShowConnect(true); }}
                            title="Edit"
                            className="p-1.5 rounded transition-colors hover:bg-white/10"
                            style={{ color: 'var(--text-muted, #64748b)' }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => downloadKubeconfig(cluster)}
                            title="Download Kubeconfig"
                            className="p-1.5 rounded transition-colors hover:bg-white/10"
                            style={{ color: 'var(--text-muted, #64748b)' }}
                          >
                            <Download size={13} />
                          </button>
                          <button
                            onClick={() => deleteCluster(cluster.name)}
                            title="Delete"
                            className="p-1.5 rounded transition-colors hover:bg-red-500/15 hover:text-red-400"
                            style={{ color: 'var(--text-muted, #64748b)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* No results state */}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2"
                style={{ color: 'var(--text-muted, #64748b)' }}>
                <Search size={24} className="opacity-40" />
                <p className="text-sm">No clusters match "{search}"</p>
                <button onClick={() => setSearch('')} className="text-indigo-400 text-xs hover:underline">
                  Clear search
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Wizard modal */}
      {(showConnect || editCluster) && (
        <ConnectClusterWizard
          onClose={() => { setShowConnect(false); setEditCluster(null); }}
          onConnected={handleConnected}
          editCluster={editCluster}
        />
      )}
    </div>
  );
}

// Also export the type and key for Navbar usage
export { STORAGE_KEY, ACTIVE_KEY };
