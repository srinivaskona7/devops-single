import { Badge } from '@/components/ui/badge';

type StatusVariant = 'success' | 'warning' | 'danger' | 'muted';

function getVariant(status: string): StatusVariant {
  const s = status?.toLowerCase() || '';
  if (['running', 'active', 'ready', 'bound', 'available', 'succeeded', 'complete', 'deployed', 'true'].some(k => s.includes(k)))
    return 'success';
  if (['pending', 'waiting', 'creating', 'terminating', 'progressing'].some(k => s.includes(k)))
    return 'warning';
  if (['failed', 'error', 'crashloopbackoff', 'imagepullbackoff', 'evicted', 'false'].some(k => s.includes(k)))
    return 'danger';
  return 'muted';
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={getVariant(status)}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}
