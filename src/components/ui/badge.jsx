import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Etiquetas de estado. `estadoBadge` traduce los estados de la app a una variante.
const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-solid px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-foreground',
        success: 'border-transparent bg-success/15 text-success',
        warning: 'border-transparent bg-warning/20 text-[#8A6A0C]',
        destructive: 'border-transparent bg-destructive/15 text-destructive',
        info: 'border-transparent bg-chart-3/15 text-chart-3',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const VARIANTE_POR_ESTADO = {
  Pendiente: 'warning',
  Aprobado: 'info',
  Pagado: 'success',
  Legalizado: 'success',
  Devuelto: 'destructive',
  Rechazado: 'destructive',
};

const estadoBadge = (estado) => VARIANTE_POR_ESTADO[estado] || 'muted';

const Badge = ({ className, variant, ...props }) => (
  <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
);

export { Badge, badgeVariants, estadoBadge };
