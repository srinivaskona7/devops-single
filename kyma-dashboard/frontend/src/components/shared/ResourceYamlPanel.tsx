/**
 * ResourceYamlPanel — shared view/edit/save YAML drawer
 * Used by: DeploymentsPage, PodsPage, ServicesPage, ConfigMapsPage,
 *           SecretsPage, StatefulSetsPage, DaemonSetsPage, IngressesPage, etc.
 */
import { useState, useEffect } from 'react';
import { X, Edit3, Save, CheckCircle, AlertCircle, RefreshCw, Copy, Check } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { cn } from '@/lib/utils';

export interface ResourceYamlPanelProps {
  /** k8s resource kind e.g. "deployment", "pod", "service" */
  kind: string;
  /** Resource name */
  name: string;
  /** Namespace (omit for cluster-scoped) */
  namespace?: string;
  /** True for cluster-scoped resources (ClusterRole, CRD, Node, etc.) */
  cluster?: boolean;
  /** Called when panel is closed */
  onClose: () => void;
  /** Called after a successful save */
  onSaved?: () => void;
}

export function ResourceYamlPanel({ kind, name, namespace, cluster, onClose, onSaved }: ResourceYamlPanelProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [yaml, setYaml] = useState('');
  const [edited, setEdited] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchYaml = () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const params = new URLSearchParams({ kind, name });
    if (namespace) params.set('namespace', namespace);
    if (cluster) params.set('cluster', 'true');
    fetch(`/api/resource-yaml?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); }
        else { setYaml(d.yaml || ''); setEdited(d.yaml || ''); }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { fetchYaml(); }, [kind, name, namespace, cluster]);

  const save = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/resource-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: edited }),
      });
      const d = await res.json();
      setResult({ ok: !!d.success, msg: d.output || d.error || (d.success ? 'Saved successfully' : 'Save failed') });
      if (d.success) {
        setYaml(edited);
        setMode('view');
        onSaved?.();
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
    }
    setSaving(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(mode === 'edit' ? edited : yaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="rounded-xl border border-[rgba(99,102,241,0.2)] overflow-hidden" style={{ background: 'var(--bg-card)' }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(99,102,241,0.12)] bg-white/[0.02]">
        <span className="text-xs text-slate-500 uppercase tracking-wide shrink-0">{kind}</span>
        <span className="font-mono text-sm font-semibold text-white truncate flex-1">{name}</span>
        {namespace && <span className="text-xs text-slate-600 shrink-0">{namespace}</span>}

        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 ml-2">
          <button
            onClick={() => { setMode('view'); setEdited(yaml); setResult(null); }}
            className={cn('px-2.5 py-1 text-xs rounded transition-colors',
              mode === 'view' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300')}
          >View</button>
          <button
            onClick={() => { setMode('edit'); setResult(null); }}
            className={cn('flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors',
              mode === 'edit' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300')}
          ><Edit3 size={11} />Edit</button>
        </div>

        {/* Copy */}
        <button onClick={copy} title="Copy YAML" className="p-1 text-slate-500 hover:text-white transition-colors">
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
        {/* Refresh */}
        <button onClick={fetchYaml} title="Refresh" className="p-1 text-slate-500 hover:text-white transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
        {/* Close */}
        <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* ── Save result banner ── */}
      {result && (
        <div className={cn('flex items-start gap-2 px-4 py-2 text-xs border-b',
          result.ok
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400')}>
          {result.ok ? <CheckCircle size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
          <pre className="font-mono whitespace-pre-wrap break-all flex-1">{result.msg}</pre>
        </div>
      )}

      {/* ── Body ── */}
      <div>
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-sm">Loading YAML…</span>
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center gap-2 p-4 text-red-400 text-sm">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}
        {!loading && !error && mode === 'view' && (
          <pre className="text-xs font-mono text-slate-300 p-4 overflow-auto leading-relaxed max-h-[55vh]">{yaml}</pre>
        )}
        {!loading && !error && mode === 'edit' && (
          <div className="h-[55vh]">
            <Editor
              height="100%"
              defaultLanguage="yaml"
              value={edited}
              onChange={v => setEdited(v || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                fontFamily: 'JetBrains Mono, monospace',
                tabSize: 2,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Footer (only in edit mode) ── */}
      {mode === 'edit' && !loading && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[rgba(99,102,241,0.12)]">
          <span className="text-xs text-slate-600">Edit and click Save to apply changes to the cluster</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMode('view'); setEdited(yaml); setResult(null); }}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >Cancel</button>
            <button
              onClick={save}
              disabled={saving || edited === yaml}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs text-white transition-colors"
            >
              <Save size={12} className={saving ? 'animate-spin' : ''} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
