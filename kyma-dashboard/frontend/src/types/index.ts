export interface ClusterStatus {
  cluster_name: string;
  cluster_state: string;
  cluster_active: boolean;
  api_server: string;
  plan: string;
  region: string;
  created_date: string;
  age_days: number;
  expiry_msg: string;
  days_left: number;
  expiry_datetime: string;
  kubeconfig_available: boolean;
  kubeconfig_type: string;
  connection_alive: boolean;
  connection_latency_ms: number;
  kubectl_server_version: string;
  namespaces: string[];
  node_count: number;
  node_resources: NodeResource[];
  avg_cpu_percent: number;
  avg_memory_percent: number;
  last_checked: string;
}

export interface NodeResource {
  name: string;
  cpu_cores: string;
  cpu_percent: number;
  memory_bytes: string;
  memory_percent: number;
}

export interface Namespace {
  name: string;
  status: string;
  labels: Record<string, string>;
  created: string;
}

export interface Pod {
  name: string;
  namespace: string;
  phase: string;
  ready: string;
  restarts: number;
  nodeName: string;
  podIP: string;
  created: string;
  containers: { name: string; image: string }[];
  ownerKind: string;
  ownerName: string;
}

export interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  image: string;
  created: string;
}

export interface StatefulSet {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  created: string;
}

export interface DaemonSet {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  created: string;
}

export interface ReplicaSet {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  created: string;
}

export interface Job {
  name: string;
  namespace: string;
  completions: string;
  succeeded: number;
  failed: number;
  created: string;
  status: string;
}

export interface CronJob {
  name: string;
  namespace: string;
  schedule: string;
  lastSchedule: string;
  active: number;
  created: string;
}

export interface Service {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string;
  ports: string;
  created: string;
}

export interface Ingress {
  name: string;
  namespace: string;
  hosts: string;
  address: string;
  ports: string;
  created: string;
}

export interface NetworkPolicy {
  name: string;
  namespace: string;
  podSelector: string;
  policyTypes: string[];
  created: string;
}

export interface PVC {
  name: string;
  namespace: string;
  status: string;
  volume: string;
  capacity: string;
  accessModes: string[];
  storageClass: string;
  created: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PV {
  name: string;
  capacity: string;
  accessModes: string[];
  reclaimPolicy: string;
  status: string;
  claim: string;
  storageClass: string;
  created: string;
}

export interface StorageClass {
  name: string;
  provisioner: string;
  reclaimPolicy: string;
  volumeBindingMode: string;
  allowVolumeExpansion: boolean;
  created: string;
}

export interface ConfigMap {
  name: string;
  namespace: string;
  dataKeys: string[];
  created: string;
}

export interface ConfigMapDetail {
  name: string;
  namespace: string;
  creationTimestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  data: Record<string, string>;
  binaryData: string[];
}

export interface Secret {
  name: string;
  namespace: string;
  type: string;
  dataKeys: string[];
  created: string;
}

export interface SecretDetail {
  name: string;
  namespace: string;
  creationTimestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  type: string;
  dataKeys: string[];
  data: Record<string, string>;
}

export interface ServiceAccount {
  name: string;
  namespace: string;
  secrets: number;
  created: string;
}

export interface ResourceQuota {
  name: string;
  namespace: string;
  hard: Record<string, string>;
  used: Record<string, string>;
  created: string;
}

export interface LimitRange {
  name: string;
  namespace: string;
  limits: { type: string; max?: Record<string, string>; min?: Record<string, string>; default?: Record<string, string> }[];
  created: string;
}

export interface ClusterRole {
  name: string;
  rules: number;
  created: string;
  creationTimestamp?: string;
}

export interface ClusterRoleBinding {
  name: string;
  roleRef: string;
  roleRefName?: string;
  roleRefKind?: string;
  subjects: string | { kind: string; name: string; namespace?: string }[];
  created: string;
}

export interface HelmRelease {
  name: string;
  namespace: string;
  chart: string;
  version: string;
  status: string;
  updated: string;
}

export interface HelmChart {
  id: string;
  name: string;
  description: string;
  namespace: string;
  repo?: string;
  chart?: string;
}

export interface KEvent {
  type: string;
  reason: string;
  message: string;
  involvedObject: string;
  involvedObjectKind?: string;
  involvedObjectName?: string;
  source: string;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  namespace?: string;
  name?: string;
}

export interface NodeDetail {
  name: string;
  creationTimestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  taints: { key: string; effect: string; value?: string }[];
  conditions: { type: string; status: string; reason: string; message: string }[];
  capacity: Record<string, string>;
  allocatable: Record<string, string>;
  nodeInfo: Record<string, string>;
  addresses: { type: string; address: string }[];
}

export interface NamespaceOverview {
  pods: number;
  running_pods: number;
  pending_pods: number;
  failed_pods: number;
  deployments: number;
  services: number;
  loadbalancers: number;
  statefulsets: number;
  daemonsets: number;
  replicasets: number;
  configmaps: number;
  secrets: number;
  serviceaccounts: number;
  persistentvolumes: number;
  pv_capacity: string;
}

export interface ServiceDetailPort {
  name: string;
  port: number;
  targetPort: string | number;
  protocol: string;
  nodePort?: number;
}

export interface ServiceDetailEndpoint {
  addresses: string[];
  ports: string[];
}

export interface ServiceDetail {
  name: string;
  namespace: string;
  creationTimestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  type: string;
  clusterIP: string;
  externalIPs: string[];
  loadBalancerIP: string;
  selector: Record<string, string>;
  ports: ServiceDetailPort[];
  endpoints: ServiceDetailEndpoint[];
}

export interface HPA {
  name: string;
  namespace: string;
  reference: string;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
  metrics: string;
  created: string;
}

export interface HelmRepo {
  name: string;
  url: string;
}

export interface HelmSearchResult {
  name: string;       // e.g. "bitnami/nginx"
  version: string;
  appVersion: string;
  description: string;
  repo: string;       // e.g. "bitnami"
  chart: string;      // e.g. "nginx"
}
