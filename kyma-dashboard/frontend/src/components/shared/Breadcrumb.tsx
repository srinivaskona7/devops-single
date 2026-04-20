import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const LABEL_MAP: Record<string, string> = {
  cluster: 'Cluster',
  overview: 'Overview',
  pods: 'Pods',
  deployments: 'Deployments',
  services: 'Services',
  ingresses: 'Ingresses',
  configmaps: 'ConfigMaps',
  secrets: 'Secrets',
  namespaces: 'Namespaces',
  nodes: 'Nodes',
  events: 'Events',
  jobs: 'Jobs',
  cronjobs: 'CronJobs',
  daemonsets: 'DaemonSets',
  statefulsets: 'StatefulSets',
  replicasets: 'ReplicaSets',
  persistentvolumes: 'Persistent Volumes',
  persistentvolumeclaims: 'PVCs',
  storageclasses: 'Storage Classes',
  networkpolicies: 'Network Policies',
  serviceaccounts: 'Service Accounts',
  roles: 'Roles',
  rolebindings: 'Role Bindings',
  clusterroles: 'Cluster Roles',
  clusterrolebindings: 'Cluster Role Bindings',
  hpa: 'HPA',
  'resource-quotas': 'Resource Quotas',
  'limit-ranges': 'Limit Ranges',
  crds: 'CRDs',
  'api-services': 'API Services',
  helm: 'Helm Releases',
  logs: 'Logs',
  terminal: 'Terminal',
};

function humanize(segment: string): string {
  return LABEL_MAP[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

export function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: humanize(seg),
    path: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm mb-4 px-1"
      style={{ color: 'var(--text-muted)' }}
    >
      <Link
        to="/"
        className="hover:text-[var(--accent)] transition-colors duration-150 flex items-center gap-1"
        style={{ color: 'var(--text-muted)' }}
      >
        <Home size={14} />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
          {crumb.isLast ? (
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-[var(--accent)] transition-colors duration-150"
              style={{ color: 'var(--text-muted)' }}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}