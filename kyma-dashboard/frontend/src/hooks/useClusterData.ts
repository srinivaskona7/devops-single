import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ClusterStatus, Namespace } from '@/types';

export function useClusterStatus() {
  return useQuery<ClusterStatus>({
    queryKey: ['cluster-status'],
    queryFn: api.clusterStatus,
    refetchInterval: 30_000,
  });
}

export function useNamespaces() {
  return useQuery<{ items: Namespace[] }>({
    queryKey: ['namespaces'],
    queryFn: api.namespaces,
    refetchInterval: 60_000,
  });
}
