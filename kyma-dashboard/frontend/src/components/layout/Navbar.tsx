import { useState, useCallback, useMemo, memo } from 'react';
import { Menu, ChevronDown, Search, MessageSquare, HelpCircle, Settings, RefreshCw, Play, Plus, Server, Shield } from 'lucide-react';
import { useClusterStatus } from '@/hooks/useClusterData';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { useNavigate, Link } from 'react-router-dom';
import type { SavedCluster } from '@/pages/ClustersPage';
import { STORAGE_KEY, ACTIVE_KEY } from '@/pages/ClustersPage';

interface NavbarProps {
  /** New canonical prop — toggle sidebar collapsed state */
  onToggleSidebar?: () => void;
  /** @deprecated kept for backward compat — use onToggleSidebar */
  onMenuClick?: () => void;
}

export function Navbar({ onToggleSidebar, onMenuClick }: NavbarProps) {
  const { data: status } = useClusterStatus();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cmd, setCmd] = useState('');
  const [cmdOutput, setCmdOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClusterMenu, setShowClusterMenu] = useState(false);

  const handleToggle = onToggleSidebar ?? onMenuClick;

  // Only read localStorage when dropdown is actually open — avoids parsing JSON on every render
  const { savedClusters, activeClusterName } = useMemo(() => {
    if (!showClusterMenu) return { savedClusters: [] as SavedCluster[], activeClusterName: null as string | null };
    try {
      return {
        savedClusters: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as SavedCluster[],
        activeClusterName: localStorage.getItem(ACTIVE_KEY),
      };
    } catch {
      return { savedClusters: [] as SavedCluster[], activeClusterName: null };
    }
  }, [showClusterMenu]);

  const switchCluster = useCallback(async (cluster: SavedCluster) => {
    localStorage.setItem(ACTIVE_KEY, cluster.name);
    try {
      await fetch('/api/switch-cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kubeconfig: cluster.kubeconfig, clusterName: cluster.name }),
      });
    } catch {}
    setShowClusterMenu(false);
    queryClient.invalidateQueries();
    navigate('/cluster');
  }, [queryClient, navigate]);

  const runCmd = async () => {
    if (!cmd.trim() || running) return;
    setRunning(true);
    setCmdOutput('');
    try {
      const res = await api.execute(cmd);
      setCmdOutput(res.output || res.error || 'Done');
    } catch {
      setCmdOutput('Command failed');
    }
    setRunning(false);
  };

  const cpuPct = status?.avg_cpu_percent ?? 0;
  const memPct = status?.avg_memory_percent ?? 0;
  const connected = status?.connection_alive ?? false;
  const clusterName = status?.cluster_name ?? 'my-kyma-cluster-admin';
  const daysLeft = status?.days_left ?? 0;

  return (
    <>
      {/* ── Kyma-style shell bar ── */}
      <header
        className="h-[56px] flex items-center px-4 gap-3 shrink-0 z-50"
        style={{
          background: 'linear-gradient(90deg, #07112a 0%, #0a1630 60%, #08112a 100%)',
          borderBottom: '1px solid rgba(79,126,255,0.14)',
          boxShadow: '0 1px 24px rgba(0,0,0,0.45)',
        }}
      >

        {/* Left: hamburger */}
        <button
          onClick={handleToggle}
          className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-white/5 transition-colors shrink-0"
          title="Toggle sidebar"
          aria-label="Toggle navigation sidebar"
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        {/* Kubernetes icon + app name */}
        <div
          className="flex items-center gap-2 cursor-pointer shrink-0"
          onClick={() => window.location.href = '/cluster'}
        >
          <svg className="w-7 h-7 shrink-0" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#326CE5"/>
            <path fill="white" d="M16 5.5a1.2 1.2 0 0 0-1.1.75L12.4 12.1l-6.6.55a1.2 1.2 0 0 0-.68 2.1l5 4.4-1.5 6.4a1.2 1.2 0 0 0 1.78 1.3L16 23.4l5.6 3.45a1.2 1.2 0 0 0 1.78-1.3l-1.5-6.4 5-4.4a1.2 1.2 0 0 0-.68-2.1l-6.6-.55-2.5-5.85A1.2 1.2 0 0 0 16 5.5z"/>
          </svg>
          <span className="font-semibold text-white text-base hidden sm:block whitespace-nowrap">Srinivas-kyma</span>
        </div>

        {/* Cluster context selector — dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowClusterMenu(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-sm text-slate-300 transition-colors"
          >
            <span className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              connected ? 'status-dot-live' : 'bg-red-400'
            )} />
            <span className="font-mono text-xs truncate max-w-[160px]">{clusterName}</span>
            <ChevronDown size={12} className={cn('shrink-0 text-slate-500 transition-transform', showClusterMenu && 'rotate-180')} />
          </button>

          {/* Dropdown */}
          {showClusterMenu && (
            <>
              {/* Close on outside click */}
              <div className="fixed inset-0 z-40" onClick={() => setShowClusterMenu(false)} />
              <div
                className="absolute top-9 left-0 z-50 w-64 rounded-lg overflow-hidden shadow-xl"
                style={{ background: 'var(--bg-sidebar, #0a1628)', border: '1px solid var(--border, rgba(99,102,241,0.2))' }}
              >
                {savedClusters.length === 0 ? (
                  <div className="px-3 py-3 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted, #64748b)' }}>
                    <Server size={12} />
                    No saved clusters
                  </div>
                ) : (
                  savedClusters.map(c => (
                    <button
                      key={c.name}
                      onClick={() => switchCluster(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2 transition-colors"
                      style={{ color: 'var(--text-primary, #e2e8f0)' }}
                    >
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        c.name === activeClusterName ? 'bg-emerald-400' : 'bg-slate-600'
                      )} />
                      <span className="font-mono truncate flex-1">{c.name}</span>
                      {c.name === activeClusterName && (
                        <span className="text-[11px] text-emerald-400 font-bold uppercase">active</span>
                      )}
                    </button>
                  ))
                )}
                <div className="border-t" style={{ borderColor: 'var(--border, rgba(99,102,241,0.15))' }} />
                <button
                  onClick={() => { setShowClusterMenu(false); navigate('/clusters'); }}
                  className="w-full text-left px-3 py-2 text-xs text-indigo-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
                >
                  <Plus size={10} />
                  {savedClusters.length === 0 ? 'Connect a cluster' : 'Manage clusters'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Quick navigation search */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <div className="flex items-center h-8 px-3 bg-white/5 border border-white/10 rounded-lg gap-2 cursor-text hover:border-indigo-500/30 transition-colors">
            <Search size={13} className="text-slate-500 shrink-0" />
            <span className="text-xs text-slate-600 flex-1 select-none">Quick navigation</span>
            <kbd className="text-[12px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 font-sans select-none leading-none">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* CPU / MEM metrics — xl+ only */}
        <div className="hidden xl:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-slate-500 uppercase font-bold w-8">CPU</span>
            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  cpuPct > 80 ? 'bg-red-500' : cpuPct > 60 ? 'bg-amber-500' : 'bg-cyan-400'
                )}
                style={{ width: `${cpuPct}%` }}
              />
            </div>
            <span className="text-[11.5px] text-slate-400 font-mono w-8">{cpuPct}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-slate-500 uppercase font-bold w-8">MEM</span>
            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  memPct > 80 ? 'bg-red-500' : memPct > 60 ? 'bg-amber-500' : 'bg-purple-400'
                )}
                style={{ width: `${memPct}%` }}
              />
            </div>
            <span className="text-[11.5px] text-slate-400 font-mono w-8">{memPct}%</span>
          </div>
        </div>

        {/* Expiry badge */}
        {daysLeft > 0 && (
          <span className={cn(
            'kyma-badge text-[11.5px] shrink-0 hidden sm:inline-flex',
            daysLeft <= 3 ? 'bg-red-500/15 text-red-400 border border-red-500/25' :
            daysLeft <= 7 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
            'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
          )}>
            {daysLeft}d left
          </span>
        )}

        {/* Quick kubectl input — 2xl+ only */}
        <div className="hidden 2xl:flex items-center gap-1.5 shrink-0">
          <input
            className="w-52 h-7 px-2 text-xs bg-white/[0.04] border border-white/10 rounded-md text-slate-300 font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all"
            placeholder="kubectl get pods -A"
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runCmd()}
          />
          <button
            onClick={runCmd}
            disabled={running}
            className="btn-primary-cta h-7 disabled:opacity-50"
          >
            <Play size={10} /> {running ? 'Running…' : 'Exec'}
          </button>
        </div>

        {/* Right action icons */}
        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          <button
            onClick={() => queryClient.invalidateQueries()}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-transparent"
            title="Refresh data"
            aria-label="Refresh all data"
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
          <button
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors"
            title="Feedback"
          >
            <MessageSquare size={15} />
          </button>
          <button
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors"
            title="Help"
          >
            <HelpCircle size={15} />
          </button>
          <Link
            to="/admin"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors"
            title="Admin"
          >
            <Shield size={15} />
          </Link>
          <button
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded transition-colors"
            title="Settings"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Settings panel */}
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      {/* Command output bar — shown only when there is output */}
      {cmdOutput && (
        <div className="bg-[#060d1f] border-b border-[rgba(99,102,241,0.15)] px-4 py-2 max-h-32 overflow-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11.5px] text-slate-500 uppercase font-bold">Output</span>
            <button
              onClick={() => setCmdOutput('')}
              className="text-[11.5px] text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          </div>
          <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">{cmdOutput}</pre>
        </div>
      )}
    </>
  );
}
