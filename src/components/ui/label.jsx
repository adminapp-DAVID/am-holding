import * as React from 'react';
import { cn } from '@/lib/utils';

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    data-slot="label"
    className={cn('flex items-center gap-1 text-xs font-semibold text-muted-foreground select-none', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
