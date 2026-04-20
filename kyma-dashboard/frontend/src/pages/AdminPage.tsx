import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Shield, Upload, Server, CheckCircle2, AlertCircle, FileKey, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';

interface KubeconfigFile {
  path: string;
  label: string;
  exists: boolean;
  size_bytes: number;
  contexts: string[];
  current_context: string | null;
  clusters: string[];
  auth_type: string | null;
  active: boolean;
}

export default function AdminPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch current kubeconfig info
  const { data: kcInfo, isLoading, isError, error, refetch } = useQuery<{
    files: KubeconfigFile[];
    active_kubeconfig: string | null;
  }>({
    queryKey: ['kubeconfig-info'],
    queryFn: () => api.kubeconfigInfo(),
    refetchInterval: 10_000,
  });

  // Fetch cluster info
  const { data: clusterInfo } = useQuery<{
    name: string | null;
    apiServer: string | null;
    path: string | null;
  }>({
    queryKey: ['cluster-info'],
    queryFn: () => fetch('/api/cluster-info').then(r => r.json()),
    refetchInterval: 10_000,
  });

  // Handle file upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const content = await file.text();
      const res = await fetch('/api/save-kubeconfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, name: file.name, set_active: true }),
      }).then(r => r.json());
      if (res.success) {
        setMessage({ type: 'success', text: `Kubeconfig "${file.name}" uploaded and activated!` });
        qc.invalidateQueries({ queryKey: ['kubeconfig-info'] });
        qc.invalidateQueries({ queryKey: ['cluster-info'] });
        qc.invalidateQueries({ queryKey: ['cluster-status'] });
        qc.invalidateQueries({ queryKey: ['namespaces'] });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to upload kubeconfig' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Switch active kubeconfig
  const handleSwitch = async (path: string) => {
    setSwitching(path);
    setMessage(null);
    try {
      const res = await fetch('/api/set-kubeconfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      }).then(r => r.json());
      if (res.success) {
        setMessage({ type: 'success', text: 'Switched active kubeconfig!' });
        qc.invalidateQueries({ queryKey: ['kubeconfig-info'] });
        qc.invalidateQueries({ queryKey: ['cluster-info'] });
        qc.invalidateQueries({ queryKey: ['cluster-status'] });
        qc.invalidateQueries({ queryKey: ['namespaces'] });
      } else {
        setMessage({ type: 'error', text: res.error || 'Switch failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSwitching(null);
    }
  };

  if (isLoading) return <div className="p-6"><LoadingState resource="Kubeconfig" /></div>;
  if (isError) return <div className="p-6"><ErrorState title="Failed to load kubeconfig info" error={error} onRetry={() => refetch()} /></div>;

  const activeFile = kcInfo?.files?.find(f => f.active);
  const availableFiles = kcInfo?.files?.filter(f => f.exists) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-kyma-text">Admin — Cluster Configuration</h1>
          <p className="text-xs text-kyma-muted">Manage kubeconfig files and cluster connections</p>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Active Cluster Card */}
      <div className="rounded-xl border border-kyma-border bg-kyma-bg-secondary p-6 space-y-4">
        <h2 className="text-sm font-semibold text-kyma-text flex items-center gap-2">
          <Server className="h-4 w-4 text-accent" />
          Active Cluster
        </h2>
        {clusterInfo?.name ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-kyma-muted mb-1">Context</p>
              <p className="text-sm font-medium text-kyma-text font-mono">{clusterInfo.name}</p>
            </div>
            <div>
              <p className="text-xs text-kyma-muted mb-1">API Server</p>
              <p className="text-sm font-medium text-kyma-text font-mono truncate">{clusterInfo.apiServer || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-kyma-muted mb-1">Auth Type</p>
              <p className="text-sm font-medium text-kyma-text">{activeFile?.auth_type || '—'}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-4 text-kyma-muted">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <span className="text-sm">No cluster connected. Upload a kubeconfig file below to get started.</span>
          </div>
        )}
      </div>

      {/* Upload Section */}
      <div className="rounded-xl border border-kyma-border bg-kyma-bg-secondary p-6 space-y-4">
        <h2 className="text-sm font-semibold text-kyma-text flex items-center gap-2">
          <Upload className="h-4 w-4 text-accent" />
          Upload Kubeconfig
        </h2>
        <p className="text-xs text-kyma-muted">
          Upload a kubeconfig YAML file to connect to a Kubernetes cluster. The file will be saved securely on the server and activated immediately.
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml,.conf,*"
            onChange={handleUpload}
            className="hidden"
            id="kubeconfig-upload"
          />
          <label
            htmlFor="kubeconfig-upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
                       bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Choose Kubeconfig File'}
          </label>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm
                       bg-white/5 hover:bg-white/10 text-kyma-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Available Kubeconfigs */}
      {availableFiles.length > 0 && (
        <div className="rounded-xl border border-kyma-border bg-kyma-bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-kyma-border">
            <h2 className="text-sm font-semibold text-kyma-text flex items-center gap-2">
              <FileKey className="h-4 w-4 text-accent" />
              Available Kubeconfig Files ({availableFiles.length})
            </h2>
          </div>
          <div className="divide-y divide-kyma-border">
            {availableFiles.map((f) => (
              <div
                key={f.path}
                className={`flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors ${
                  f.active ? 'bg-accent/5 border-l-2 border-l-accent' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {f.active && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                    <span className="text-sm font-medium text-kyma-text truncate font-mono">
                      {f.label}
                    </span>
                    {f.auth_type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-kyma-muted shrink-0">
                        {f.auth_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-kyma-muted truncate mt-0.5">{f.path}</p>
                  {f.current_context && (
                    <p className="text-xs text-kyma-muted mt-0.5">
                      Context: <span className="text-kyma-text">{f.current_context}</span>
                      {f.clusters.length > 0 && ` · ${f.clusters.length} cluster(s)`}
                    </p>
                  )}
                </div>
                {!f.active && (
                  <button
                    onClick={() => handleSwitch(f.path)}
                    disabled={switching === f.path}
                    className="shrink-0 ml-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                               bg-accent/10 text-accent border border-accent/20
                               hover:bg-accent/20 transition-colors disabled:opacity-50"
                  >
                    {switching === f.path ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Activate
                  </button>
                )}
                {f.active && (
                  <span className="shrink-0 ml-4 text-xs text-emerald-400 font-medium">Active</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}