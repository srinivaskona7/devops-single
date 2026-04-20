import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { PREFETCH_MAP, STALE } from '@/lib/constants';

type PrefetchFn = () => void;

/**
 * usePrefetchOnHover — returns an onMouseEnter handler that triggers prefetch.
 * Debounced: only fires if hover persists >150ms.
 */
export function usePrefetchOnHover(prefetchFn: PrefetchFn) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onMouseEnter = useCallback(() => {
    timer.current = setTimeout(prefetchFn, 150);
  }, [prefetchFn]);
  const onMouseLeave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { onMouseEnter, onMouseLeave };
}

/**
 * useAdjacentPrefetch — when the user lands on a page, prefetch sibling pages
 * in the background using the PREFETCH_MAP.
 */
export function useAdjacentPrefetch() {
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const prefetched = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Find the section key that matches current path
    const section = Object.keys(PREFETCH_MAP).find(key => pathname.startsWith(key));
    if (!section || prefetched.current.has(section)) return;
    prefetched.current.add(section);

    // Prefetch adjacent data in idle time
    const prefetchInIdle = () => {
      // Warm the namespace list (needed by most pages)
      qc.prefetchQuery({ queryKey: qk.namespaces(), queryFn: api.namespaces, staleTime: STALE.LONG });

      // If on workloads, prefetch common workload lists for the active namespace
      if (section === '/workloads' || section === '/cluster') {
        qc.prefetchQuery({ queryKey: qk.nodes(), queryFn: api.nodes, staleTime: STALE.LONG });
        qc.prefetchQuery({ queryKey: qk.clusterStatus(), queryFn: api.clusterStatus, staleTime: STALE.NORMAL });
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetchInIdle, { timeout: 2000 });
    } else {
      setTimeout(prefetchInIdle, 300);
    }
  }, [pathname, qc]);
}

/**
 * useWarmCache — prefetch common data that most pages need on first mount.
 * Call once in AppLayout.
 */
export function useWarmCache() {
  const qc = useQueryClient();
  const warmed = useRef(false);

  useEffect(() => {
    if (warmed.current) return;
    warmed.current = true;

    // Warm essentials after initial render
    const warm = () => {
      qc.prefetchQuery({ queryKey: qk.clusterStatus(), queryFn: api.clusterStatus, staleTime: STALE.LONG });
      qc.prefetchQuery({ queryKey: qk.namespaces(), queryFn: api.namespaces, staleTime: STALE.LONG });
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(warm, { timeout: 1500 });
    } else {
      setTimeout(warm, 500);
    }
  }, [qc]);
}
