import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-20 w-full rounded-[3px] border border-paper-line bg-white/60 px-3 py-2 text-[0.85rem] leading-relaxed text-paper-ink',
      'placeholder:text-paper-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-flash-red',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
