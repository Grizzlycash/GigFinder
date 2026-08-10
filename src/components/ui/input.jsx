import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-9 w-full rounded-[3px] border border-paper-line bg-white/60 px-3 py-1 text-[0.85rem] text-paper-ink',
      'placeholder:text-paper-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-flash-red',
      'disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-paper-shade read-only:text-paper-muted',
      'file:mr-3 file:border-0 file:bg-transparent file:text-[0.8rem] file:font-display file:uppercase file:tracking-wide',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
