import { type UseQueryResult } from '@tanstack/react-query';
import { LoadingState, TableSkeleton, DashboardSkeleton } from './LoadingState';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { useRef, useEffect, useState } from 'react';

type SkeletonVariant = 'table' | 'dashboard' | 'default';

interface QueryGuardProps<T> {
  query: UseQueryResult<T>;
  resourceName?: string;
  skeletonRows?: number;
  skeleton?: SkeletonVariant;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  children: (data: T) => React.ReactNode;
}

/**
 * QueryGuard — renders loading → error → empty → children with smooth transitions.
 * Keeps page chrome visible while only replacing the data area.
 * Uses CSS fade-in for seamless data population.
 */
export function QueryGuard<T>({
  query,
  resourceName,
  skeletonRows = 5,
  skeleton = 'default',
  isEmpty,
  emptyTitle,
  emptySubtitle,
  children,
}: QueryGuardProps<T>) {
  const { data, isLoading, isFetching, isError, error, refetch } = query;
  const [hasEverLoaded, setHasEverLoaded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track if we've ever successfully loaded data
  useEffect(() => {
    if (data !== undefined && data !== null) setHasEverLoaded(true);
  }, [data]);

  // First load — show skeleton
  if (isLoading && !hasEverLoaded) {
    if (skeleton === 'dashboard') return <DashboardSkeleton />;
    if (skeleton === 'table') return <TableSkeleton rows={skeletonRows} />;
    return <LoadingState resource={resourceName} rows={skeletonRows} />;
  }

  if (isError && !hasEverLoaded) {
    return (
      <ErrorState
        title={`Failed to load${resourceName ? ` ${resourceName}` : ''}`}
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  if (!hasEverLoaded && (data === undefined || data === null || (isEmpty && isEmpty(data)))) {
    return (
      <EmptyState
        title={emptyTitle || `No ${resourceName?.toLowerCase() || 'data'} found`}
        subtitle={emptySubtitle || 'Try changing filters or selecting a different namespace.'}
      />
    );
  }

  // Data loaded — render with fade-in, show subtle refetch indicator
  return (
    <div ref={contentRef} className="relative">
      {/* Subtle refetch indicator — thin bar at top */}
      {isFetching && hasEverLoaded && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent/30 overflow-hidden z-10 rounded-full">
          <div className="h-full w-1/3 bg-accent rounded-full animate-[slideRight_1s_ease-in-out_infinite]"
            style={{ animation: 'slideRight 1s ease-in-out infinite' }}
          />
        </div>
      )}
      <div className="fade-in">
        {data !== undefined && data !== null ? children(data) : null}
      </div>
    </div>
  );
}
