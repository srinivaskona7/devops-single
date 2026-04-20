import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatAge(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function statusColor(status: string): string {
  const s = status?.toLowerCase() || '';
  if (['running', 'active', 'ready', 'bound', 'available', 'succeeded', 'complete'].some(k => s.includes(k)))
    return 'text-kyma-green';
  if (['pending', 'waiting', 'creating', 'terminating'].some(k => s.includes(k)))
    return 'text-kyma-amber';
  if (['failed', 'error', 'crashloopbackoff', 'imagepullbackoff', 'evicted'].some(k => s.includes(k)))
    return 'text-kyma-red';
  return 'text-kyma-muted';
}

export function statusBg(status: string): string {
  const s = status?.toLowerCase() || '';
  if (['running', 'active', 'ready', 'bound', 'available', 'succeeded', 'complete'].some(k => s.includes(k)))
    return 'bg-kyma-green/10 text-kyma-green border border-kyma-green/25';
  if (['pending', 'waiting', 'creating', 'terminating'].some(k => s.includes(k)))
    return 'bg-kyma-amber/10 text-kyma-amber border border-kyma-amber/25';
  if (['failed', 'error', 'crashloopbackoff', 'imagepullbackoff', 'evicted'].some(k => s.includes(k)))
    return 'bg-kyma-red/10 text-kyma-red border border-kyma-red/25';
  return 'bg-kyma-subtle/20 text-kyma-muted border border-kyma-subtle/30';
}
