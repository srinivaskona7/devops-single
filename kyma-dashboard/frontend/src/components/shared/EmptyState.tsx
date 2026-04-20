import { InboxIcon, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  title = 'No data',
  subtitle = '',
  icon: Icon = InboxIcon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <p className="text-sm font-medium text-kyma-text">{title}</p>
      {subtitle && <p className="text-xs text-kyma-muted mt-1">{subtitle}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-accent/10 text-accent border border-accent/20
                     hover:bg-accent/20 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
