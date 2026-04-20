import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap gap-1',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent/15 text-accent-hover',
        success: 'bg-kyma-green/10 text-[#4ade80] border-kyma-green/25',
        warning: 'bg-kyma-amber/10 text-[#fbbf24] border-kyma-amber/25',
        danger: 'bg-kyma-red/10 text-[#f87171] border-kyma-red/25',
        muted: 'bg-kyma-subtle/20 text-kyma-muted border-kyma-subtle/30',
        outline: 'text-kyma-text border-white/[0.08]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
