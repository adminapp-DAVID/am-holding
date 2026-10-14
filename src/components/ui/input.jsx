import * as React from 'react';
import { cn } from '@/lib/utils';

export const campoBase =
  'w-full min-w-0 rounded-md border border-solid border-input bg-card px-3 py-1 font-[inherit] text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20';

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} data-slot="input" className={cn(campoBase, 'h-9', className)} {...props} />
));
Input.displayName = 'Input';

export { Input };
