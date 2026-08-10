import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-display uppercase tracking-[0.08em] rounded-[3px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-flash-red text-[#fbf7ec] hover:bg-flash-red-deep active:translate-y-px',
        secondary: 'bg-ink-raised text-bone border border-ink-line-strong hover:bg-ink-hover',
        outline: 'border border-paper-line bg-transparent text-paper-ink hover:bg-paper-shade',
        ghost: 'text-bone-muted hover:bg-ink-hover hover:text-bone',
        'ghost-paper': 'text-paper-muted hover:bg-paper-shade hover:text-paper-ink',
        paper: 'bg-paper-shade text-paper-ink border border-paper-line hover:bg-paper',
        green: 'bg-flash-green text-[#f1f6f2] hover:bg-flash-green-deep active:translate-y-px',
        destructive: 'bg-transparent text-flash-red border border-flash-red/45 hover:bg-flash-red/12',
        link: 'text-flash-red underline-offset-4 hover:underline tracking-normal normal-case font-sans',
      },
      size: {
        default: 'h-9 px-4 text-[0.8rem]',
        sm: 'h-8 px-3 text-[0.72rem]',
        lg: 'h-11 px-6 text-[0.95rem]',
        icon: 'h-9 w-9 px-0',
        'icon-sm': 'h-8 w-8 px-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
