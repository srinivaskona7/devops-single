import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 gap-1.5',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent-hover shadow-sm',
        destructive: 'bg-kyma-red/10 text-kyma-red border border-kyma-red/25 hover:bg-kyma-red/20',
        outline: 'border border-white/[0.08] bg-white/[0.04] text-kyma-muted hover:bg-white/[0.09] hover:text-kyma-text',
        secondary: 'bg-white/[0.05] text-kyma-muted border border-white/[0.08] hover:bg-white/[0.09] hover:text-kyma-text',
        ghost: 'text-kyma-muted hover:bg-accent/10 hover:text-accent-hover',
        link: 'text-accent underline-offset-4 hover:underline',
        success: 'bg-kyma-green/10 text-kyma-green border border-kyma-green/25 hover:bg-kyma-green/20',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
