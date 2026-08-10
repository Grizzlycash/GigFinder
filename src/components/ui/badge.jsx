import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 border px-2 py-0.5 font-display uppercase tracking-[0.1em] text-[0.65rem] rounded-[2px]',
  {
    variants: {
      variant: {
        default: 'border-paper-line bg-paper-shade text-paper-muted',
        ink: 'border-ink-line-strong bg-ink-raised text-bone-muted',
        red: 'border-flash-red/55 bg-flash-red/12 text-flash-red',
        green: 'border-flash-green/55 bg-flash-green/12 text-flash-green',
        solid: 'border-flash-red bg-flash-red text-[#fbf7ec]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
