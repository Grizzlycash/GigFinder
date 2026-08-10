import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer size-4 shrink-0 rounded-[2px] border border-paper-line bg-white/60',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flash-red disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-flash-red data-[state=checked]:border-flash-red data-[state=checked]:text-[#fbf7ec]',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="size-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
