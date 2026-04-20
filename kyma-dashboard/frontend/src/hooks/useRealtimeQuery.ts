import { useQuery, keepPreviousData, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

// Safe read of page visibility — guards against SSR / early mount
const isVisible = () => typeof document !== 'undefined' ? !document.hidden : true;

/**
 * useRealtimeQuery — polls with configurable interval, auto-pauses when:
 *  - the browser tab is hidden (Page Visibility API)
 *  - the component is unmounted
 *  - `enabled` is false
 */
export function useRealtimeQuery<T>(
  opts: UseQueryOptions<T> & {
    /** Polling interval in ms. Default 1000 (1s). */
    pollInterval?: number;
  },
) {
  const { pollInterval = 1_000, ...queryOpts } = opts;
  const [visible, setVisible] = useState(isVisible);
  const intervalRef = useRef(pollInterval);
  intervalRef.current = pollInterval;

  useEffect(() => {
    const handler = () => setVisible(isVisible());
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []); // empty deps — one listener per hook instance, properly cleaned up

  return useQuery<T>({
    ...queryOpts,
    refetchInterval: visible ? intervalRef.current : false,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
}

/**
 * useVisibility — returns whether the page is currently visible.
 */
export function useVisibility(): boolean {
  const [visible, setVisible] = useState(isVisible);
  useEffect(() => {
    const h = () => setVisible(isVisible());
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  return visible;
}
