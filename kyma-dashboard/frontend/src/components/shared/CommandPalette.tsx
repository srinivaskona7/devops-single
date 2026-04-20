import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';

interface PaletteItem {
  label: string;
  path: string;
  category: string;
  keywords?: string[];
}

const PALETTE_ITEMS: PaletteItem[] = [
  { label: 'Cluster Overview', path: '/cluster/overview', category: 'Navigation', keywords: ['home', 'dashboard'] },
  { label: 'Pods', path: '/cluster/pods', category: 'Workloads', keywords: ['containers', 'running'] },
  { label: 'Deployments', path: '/cluster/deployments', category: 'Workloads' },
  { label: 'StatefulSets', path: '/cluster/statefulsets', category: 'Workloads' },
  { label: 'DaemonSets', path: '/cluster/daemonsets', category: 'Workloads' },
  { label: 'ReplicaSets', path: '/cluster/replicasets', category: 'Workloads' },
  { label: 'Jobs', path: '/cluster/jobs', category: 'Workloads' },
  { label: 'CronJobs', path: '/cluster/cronjobs', category: 'Workloads' },
  { label: 'Services', path: '/cluster/services', category: 'Networking' },
  { label: 'Ingresses', path: '/cluster/ingresses', category: 'Networking' },
  { label: 'Network Policies', path: '/cluster/networkpolicies', category: 'Networking' },
  { label: 'ConfigMaps', path: '/cluster/configmaps', category: 'Configuration' },
  { label: 'Secrets', path: '/cluster/secrets', category: 'Configuration' },
  { label: 'HPA', path: '/cluster/hpa', category: 'Configuration' },
  { label: 'Resource Quotas', path: '/cluster/resource-quotas', category: 'Configuration' },
  { label: 'Limit Ranges', path: '/cluster/limit-ranges', category: 'Configuration' },
  { label: 'Namespaces', path: '/cluster/namespaces', category: 'Cluster' },
  { label: 'Nodes', path: '/cluster/nodes', category: 'Cluster' },
  { label: 'Events', path: '/cluster/events', category: 'Cluster' },
  { label: 'Persistent Volumes', path: '/cluster/persistentvolumes', category: 'Storage' },
  { label: 'PVCs', path: '/cluster/persistentvolumeclaims', category: 'Storage' },
  { label: 'Storage Classes', path: '/cluster/storageclasses', category: 'Storage' },
  { label: 'Service Accounts', path: '/cluster/serviceaccounts', category: 'Access Control' },
  { label: 'Roles', path: '/cluster/roles', category: 'Access Control' },
  { label: 'Role Bindings', path: '/cluster/rolebindings', category: 'Access Control' },
  { label: 'Cluster Roles', path: '/cluster/clusterroles', category: 'Access Control' },
  { label: 'Cluster Role Bindings', path: '/cluster/clusterrolebindings', category: 'Access Control' },
  { label: 'CRDs', path: '/cluster/crds', category: 'Extensions' },
  { label: 'API Services', path: '/cluster/api-services', category: 'Extensions' },
  { label: 'Helm Releases', path: '/cluster/helm', category: 'Extensions' },
  { label: 'Logs', path: '/cluster/logs', category: 'Observability' },
  { label: 'Terminal', path: '/cluster/terminal', category: 'Observability' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filtered = query.trim()
    ? PALETTE_ITEMS.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q) ||
          item.keywords?.some((k) => k.includes(q))
        );
      })
    : PALETTE_ITEMS;

  const grouped = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  const flatFiltered = Object.values(grouped).flat();

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      navigate(item.path);
      setOpen(false);
      setQuery('');
    },
    [navigate],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatFiltered[selectedIndex]) {
      handleSelect(flatFiltered[selectedIndex]);
    }
  };

  if (!open) return null;

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setOpen(false); setQuery(''); }} />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border, #d9d9d9)',
          boxShadow: '0 0 0.125rem rgba(34,53,72,0.10), 0 1rem 3rem rgba(34,53,72,0.20)',
        }}
        onKeyDown={handleKeyNav}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border, #d9d9d9)' }}>
          <Search size={18} style={{ color: 'var(--text-muted, #89919a)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources, pages, actions..."
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: 'var(--text-primary, #32363a)', fontFamily: 'inherit' }}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--bg-base, #f5f6f7)', color: 'var(--text-muted, #89919a)', border: '1px solid var(--border, #d9d9d9)' }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {Object.keys(grouped).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted, #89919a)' }}>
                  {category}
                </div>
                {items.map((item) => {
                  itemIndex++;
                  const isActive = itemIndex === selectedIndex;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleSelect(item)}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors duration-100"
                      style={{
                        background: isActive ? 'var(--nav-active-bg, #e7f0f7)' : 'transparent',
                        color: isActive ? 'var(--accent, #0070f2)' : 'var(--text-primary, #32363a)',
                      }}
                    >
                      <span>{item.label}</span>
                      {isActive && <ArrowRight size={14} style={{ color: 'var(--accent, #0070f2)' }} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 text-xs" style={{ borderTop: '1px solid var(--border, #d9d9d9)', color: 'var(--text-muted, #89919a)' }}>
          <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
          <span><kbd className="font-mono">↵</kbd> Open</span>
          <span><kbd className="font-mono">ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}