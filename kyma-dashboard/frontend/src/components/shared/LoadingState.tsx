import { Loader2 } from 'lucide-react';

/* ─── Shimmer keyframe (injected once) ─── */
const shimmerCSS = `
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.shimmer {
  background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.06) 50%, transparent 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeIn 0.3s ease-out forwards; }
.fade-in-stagger > * { opacity: 0; animation: fadeIn 0.3s ease-out forwards; }
`;

let injected = false;
function injectCSS() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = shimmerCSS;
  document.head.appendChild(style);
}

/* ─── Skeleton primitives ─── */
function ShimmerBar({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-kyma-border/40 shimmer ${className}`} />;
}

/* ─── Table skeleton ─── */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  injectCSS();
  return (
    <div className="rounded-xl border border-kyma-border bg-kyma-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-kyma-border bg-kyma-bg/50">
        {Array.from({ length: cols }).map((_, i) => (
          <ShimmerBar key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-kyma-border last:border-0"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <ShimmerBar
              key={j}
              className={`h-3 ${j === 0 ? 'w-1/4' : j === cols - 1 ? 'w-16' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Stat card skeleton ─── */
export function CardSkeleton({ count = 4 }: { count?: number }) {
  injectCSS();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-kyma-border bg-kyma-bg-secondary p-4 space-y-3"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <ShimmerBar className="h-3 w-20" />
          <ShimmerBar className="h-8 w-16" />
          <ShimmerBar className="h-2 w-24" />
        </div>
      ))}
    </div>
  );
}

/* ─── Donut chart skeleton ─── */
export function ChartSkeleton() {
  injectCSS();
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-32 h-32 rounded-full border-8 border-kyma-border/30 shimmer" />
    </div>
  );
}

/* ─── Full page loading (header + table) ─── */
export function LoadingState({ resource, rows = 5 }: { resource?: string; rows?: number }) {
  injectCSS();
  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center gap-3 px-1">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        <span className="text-sm text-kyma-muted animate-pulse">
          Loading{resource ? ` ${resource}` : ''}…
        </span>
      </div>
      <TableSkeleton rows={rows} />
    </div>
  );
}

/* ─── Inline compact spinner ─── */
export function InlineSpinner({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-kyma-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text && <span className="text-xs">{text}</span>}
    </div>
  );
}

/* ─── Dashboard skeleton (cards + chart + table) ─── */
export function DashboardSkeleton() {
  injectCSS();
  return (
    <div className="space-y-6 fade-in">
      <CardSkeleton count={4} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-kyma-border bg-kyma-bg-secondary p-4">
          <ShimmerBar className="h-3 w-24 mb-4" />
          <ChartSkeleton />
        </div>
        <div className="rounded-xl border border-kyma-border bg-kyma-bg-secondary p-4">
          <ShimmerBar className="h-3 w-24 mb-4" />
          <ChartSkeleton />
        </div>
      </div>
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}

/* ─── Detail panel skeleton ─── */
export function DetailSkeleton() {
  injectCSS();
  return (
    <div className="space-y-4 p-4 fade-in">
      <ShimmerBar className="h-5 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <ShimmerBar className="h-3 w-24" />
            <ShimmerBar className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
