/**
 * Centralized query-key factory.
 * Every key is a stable array so TanStack Query can match, prefetch, and invalidate efficiently.
 */
export const qk = {
  /* cluster */
  clusterStatus:  ()              => ['cluster-status'] as const,
  namespaces:     ()              => ['namespaces'] as const,
  namespaceOverview: (ns: string) => ['namespace-overview', ns] as const,
  nodes:          ()              => ['nodes'] as const,
  nodeDetail:     (name: string)  => ['node-detail', name] as const,
  events:         (ns: string)    => ['events', ns] as const,

  /* workloads */
  pods:           (ns: string)    => ['pods', ns] as const,
  podDetail:      (ns: string, pod: string) => ['pod-detail', ns, pod] as const,
  deployments:    (ns: string)    => ['deployments', ns] as const,
  deploymentDetail: (ns: string, name: string) => ['deployment-detail', ns, name] as const,
  statefulsets:   (ns: string)    => ['statefulsets', ns] as const,
  daemonsets:     (ns: string)    => ['daemonsets', ns] as const,
  replicasets:    (ns: string)    => ['replicasets', ns] as const,
  jobs:           (ns: string)    => ['jobs', ns] as const,
  cronjobs:       (ns: string)    => ['cronjobs', ns] as const,

  /* network */
  services:       (ns: string)    => ['services', ns] as const,
  serviceDetail:  (ns: string, name: string) => ['service-detail', ns, name] as const,
  ingresses:      (ns: string)    => ['ingresses', ns] as const,
  networkpolicies:(ns: string)    => ['networkpolicies', ns] as const,

  /* config */
  configmaps:     (ns: string)    => ['configmaps', ns] as const,
  secrets:        (ns: string)    => ['secrets', ns] as const,
  serviceaccounts:(ns: string)    => ['serviceaccounts', ns] as const,
  resourcequotas: (ns: string)    => ['resourcequotas', ns] as const,
  limitranges:    (ns: string)    => ['limitranges', ns] as const,

  /* storage */
  pvcs:           (ns: string)    => ['pvcs', ns] as const,
  pvs:            ()              => ['pvs'] as const,
  storageclasses: ()              => ['storageclasses'] as const,

  /* RBAC */
  clusterroles:       ()          => ['clusterroles'] as const,
  clusterrolebindings:()          => ['clusterrolebindings'] as const,

  /* helm */
  helmReleases:   (ns: string)    => ['helm-releases', ns] as const,
  helmRepoList:   ()              => ['helm-repo-list'] as const,
  helmSearch:     (q: string)     => ['helm-search', q] as const,

  /* istio */
  istioVs:        (ns: string)    => ['istio-vs', ns] as const,
  istioDr:        (ns: string)    => ['istio-dr', ns] as const,

  /* kyma */
  kymaApiRules:   (ns: string)    => ['kyma-apirules', ns] as const,
  kymaFunctions:  (ns: string)    => ['kyma-functions', ns] as const,

  /* system */
  clusterInfo:    ()              => ['cluster-info'] as const,
  kubeconfigInfo: ()              => ['kubeconfig-info'] as const,
  authStatus:     ()              => ['auth-status'] as const,
} as const;
