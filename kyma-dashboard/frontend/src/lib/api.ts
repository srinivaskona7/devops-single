/* ─── resilient fetch helpers ─── */
class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const TIMEOUT_MS = 15_000;

import { useAppStore } from '@/store/useAppStore';

async function f<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const token = useAppStore.getState().token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      signal: controller.signal
    });
    if (!res.ok) {
      let body: unknown;
      try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
      throw new ApiError(
        (body as Record<string, unknown>)?.error as string || `Request failed (${res.status})`,
        res.status,
        body,
      );
    }
    return res.json() as Promise<T>;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError('Request timed out', 408);
    if (err instanceof ApiError) throw err;
    throw new ApiError(err instanceof Error ? err.message : 'Network error', 0);
  } finally {
    clearTimeout(timer);
  }
}

function post<T = unknown>(url: string, body?: unknown): Promise<T> {
  return f<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

/* ─── API surface ─── */
export const api = {
  /* cluster */
  clusterStatus: () => f('/api/cluster-status'),
  namespaceOverview: (ns: string) => f(`/api/namespace-overview?namespace=${ns}`),
  namespaces: () => f('/api/namespaces'),
  nodes: () => f('/api/nodes'),
  nodeDetail: (name: string) => f(`/api/node-detail?name=${encodeURIComponent(name)}`),

  /* workloads */
  pods: (ns: string) => f(`/api/pods?namespace=${ns}`),
  deployments: (ns: string) => f(`/api/deployments?namespace=${ns}`),
  deploymentDetail: (ns: string, name: string) => f(`/api/deployment-detail?namespace=${ns}&name=${encodeURIComponent(name)}`),
  statefulsets: (ns: string) => f(`/api/statefulsets?namespace=${ns}`),
  daemonsets: (ns: string) => f(`/api/daemonsets?namespace=${ns}`),
  replicasets: (ns: string) => f(`/api/replicasets?namespace=${ns}`),
  jobs: (ns: string) => f(`/api/jobs?namespace=${ns}`),
  cronjobs: (ns: string) => f(`/api/cronjobs?namespace=${ns}`),

  /* network */
  services: (ns: string) => f(`/api/services?namespace=${ns}`),
  serviceDetail: (ns: string, name: string) => f(`/api/service-detail?namespace=${ns}&name=${encodeURIComponent(name)}`),
  ingresses: (ns: string) => f(`/api/ingresses?namespace=${ns}`),
  networkpolicies: (ns: string) => f(`/api/networkpolicies?namespace=${ns}`),

  /* config */
  configmaps: (ns: string) => f(`/api/configmaps?namespace=${ns}`),
  configmapDetail: (ns: string, name: string) => f(`/api/configmap-detail?namespace=${ns}&name=${encodeURIComponent(name)}`),
  secrets: (ns: string) => f(`/api/secrets?namespace=${ns}`),
  secretDetail: (ns: string, name: string) => f(`/api/secret-detail?namespace=${ns}&name=${encodeURIComponent(name)}`),
  serviceaccounts: (ns: string) => f(`/api/serviceaccounts?namespace=${ns}`),
  resourcequotas: (ns: string) => f(`/api/resourcequotas?namespace=${ns}`),
  limitranges: (ns: string) => f(`/api/limitranges?namespace=${ns}`),
  hpa: (ns: string) => f(`/api/horizontalpodautoscalers?namespace=${ns}`),

  /* storage */
  pvcs: (ns: string) => f(`/api/pvcs?namespace=${ns}`),
  pvs: () => f('/api/pvs'),
  storageclasses: () => f('/api/storageclasses'),

  /* RBAC */
  clusterroles: () => f('/api/clusterroles'),
  clusterrolebindings: () => f('/api/clusterrolebindings'),
  roles: (ns: string) => f(`/api/roles?namespace=${ns}`),
  rolebindings: (ns: string) => f(`/api/rolebindings?namespace=${ns}`),

  /* pods detail */
  podLogs: (ns: string, pod: string, container?: string, lines = 200) =>
    f(`/api/pod-logs?namespace=${ns}&pod=${pod}&container=${container || ''}&lines=${lines}`),
  podLogsStream: (ns: string, pod: string, container?: string, lines = 100) =>
    `/api/pod-logs-stream?namespace=${ns}&pod=${pod}&container=${container || ''}&lines=${lines}`,
  podDetail: (ns: string, pod: string) => f(`/api/pod-detail?namespace=${ns}&pod=${encodeURIComponent(pod)}`),

  /* events */
  events: (ns: string) => f(`/api/events?namespace=${ns}`),

  /* helm */
  helmCharts: () => f('/api/helm-charts'),
  helmReleases: (ns: string) => f(`/api/helm-releases?namespace=${ns}`),
  helmRepoList: () => f('/api/helm-repo/list'),
  helmRepoAdd: (name: string, url: string) => post('/api/helm-repo/add', { name, url }),
  helmRepoRemove: (name: string) => post('/api/helm-repo/remove', { name }),
  helmRepoUpdate: () => post('/api/helm-repo/update'),
  helmSearch: (query: string, repo?: string) =>
    f(`/api/helm-search?query=${encodeURIComponent(query)}${repo ? '&repo=' + repo : ''}`),
  helmChartVersions: (chart: string) =>
    f(`/api/helm-chart-versions?chart=${encodeURIComponent(chart)}`),

  /* istio */
  istioVs: (ns: string) => f(`/api/istio-virtualservices?namespace=${ns}`),
  istioGw: (ns: string) => f(`/api/istio-gateways?namespace=${ns}`),
  istioDr: (ns: string) => f(`/api/istio-destinationrules?namespace=${ns}`),
  istioPa: (ns: string) => f(`/api/istio-peerauthentications?namespace=${ns}`),
  istioAp: (ns: string) => f(`/api/istio-authorizationpolicies?namespace=${ns}`),
  istioSe: (ns: string) => f(`/api/istio-serviceentries?namespace=${ns}`),
  istioRa: (ns: string) => f(`/api/istio-requestauthentications?namespace=${ns}`),
  istioSidecar: (ns: string) => f(`/api/istio-sidecars?namespace=${ns}`),

  /* kyma */
  kymaApiRules: (ns: string) => f(`/api/kyma-apirules?namespace=${ns}`),
  kymaSubscriptions: (ns: string) => f(`/api/kyma-subscriptions?namespace=${ns}`),
  kymaFunctions: (ns: string) => f(`/api/kyma-functions?namespace=${ns}`),

  /* kubeconfig */
  clusterInfo: () => f('/api/cluster-info'),
  saveKubeconfig: (content: string, name?: string) =>
    post('/api/save-kubeconfig', { content, name, set_active: true }),
  setKubeconfig: (path: string) => post('/api/set-kubeconfig', { path }),
  listKubeconfigs: () => f('/api/list-kubeconfigs'),

  /* system */
  kubeconfigInfo: () => f('/api/kubeconfig-info'),
  authStatus: () => f('/auth/status'),
  health: () => f('/health'),

  /* mutations */
  execute: (command: string) => post('/api/execute', { command }),
  execPod: (namespace: string, pod: string, container: string, command: string) =>
    post('/api/exec-pod', { namespace, pod, container, command }),
  login: (username: string, password: string) =>
    post('/auth/login', { username, password }),
  applyManifest: (yaml: string, namespace?: string) =>
    post('/api/apply-manifest', { yaml, namespace }),
};

export type { ApiError };
