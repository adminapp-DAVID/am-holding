import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { campoBase } from './input';

// Select nativo con estilo shadcn: conserva el comportamiento de <select> (teclado, celular,
// value/onChange) para poder reemplazar los selects actuales sin cambiar la lógica.
const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      data-slot="select"
      className={cn(campoBase, 'h-9 appearance-none pr-8 cursor-pointer', className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
  </div>
));
Select.displayName = 'Select';

export { Select };
