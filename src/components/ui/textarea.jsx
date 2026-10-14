import * as React from 'react';
import { cn } from '@/lib/utils';
import { campoBase } from './input';

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} data-slot="textarea" className={cn(campoBase, 'min-h-16 py-2 resize-y', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export { Textarea };
