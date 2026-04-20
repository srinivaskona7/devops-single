export const API_BASE = '';

export const SIDEBAR_SECTIONS = {
  CLUSTER: 'Cluster',
  WORKLOADS: 'Workloads',
  NETWORK: 'Discovery & Network',
  ISTIO: 'Istio',
  STORAGE: 'Storage',
  APPS: 'Apps',
  CONFIGURATION: 'Configuration',
  KYMA: 'Kyma',
  TERRAFORM: 'Terraform',
  LIFECYCLE: 'Lifecycle',
  OBSERVE: 'Observe',
} as const;

/* ─── Polling tiers ─── */
export const POLL = {
  REALTIME: 1_000,      // pods, containers, events — 1s
  FAST: 5_000,          // deployments, services — 5s
  NORMAL: 15_000,       // namespaces, nodes — 15s
  SLOW: 30_000,         // RBAC, storage classes — 30s
  BACKGROUND: 60_000,   // helm repos, cluster health — 60s
} as const;

/** Backward compat alias */
export const REFETCH_INTERVAL = POLL.SLOW;

/* ─── Stale-time tiers (how long data is "fresh" before refetch) ─── */
export const STALE = {
  INSTANT: 0,
  SHORT: 5_000,
  NORMAL: 20_000,
  LONG: 60_000,
  FOREVER: Infinity,
} as const;

/* ─── Prefetch adjacency map ─── */
export const PREFETCH_MAP: Record<string, string[]> = {
  '/cluster':      ['/cluster/nodes', '/cluster/namespaces', '/cluster/events'],
  '/workloads':    ['/workloads/pods', '/workloads/deployments', '/workloads/statefulsets'],
  '/network':      ['/network/services', '/network/ingresses'],
  '/configuration':['/configuration/configmaps', '/configuration/secrets'],
  '/storage':      ['/storage/pvcs', '/storage/pvs', '/storage/storageclasses'],
  '/kyma':         ['/kyma'],
  '/istio':        ['/istio'],
  '/helm':         ['/helm'],
};
