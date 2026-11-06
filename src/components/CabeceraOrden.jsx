import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Encabezado de tabla que ordena al pulsarlo (Historial de Finanzas): muestra la flecha de la
// dirección activa y, en las demás columnas, una flecha tenue que indica que se puede ordenar.
export default function CabeceraOrdenUI({ campo, orden, onOrdenar, className, alinear = 'start', children }) {
  const activa = orden?.campo === campo;
  const Icono = !activa ? ArrowUpDown : orden.direccion === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={activa ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onOrdenar(campo)} title={activa ? (orden.direccion === 'asc' ? 'Ascendente (clic para cambiar)' : 'Descendente (clic para cambiar)') : 'Ordenar por esta columna'}
        className={cn('inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-[length:inherit] uppercase text-inherit hover:text-foreground',
          alinear === 'end' && 'w-full justify-end', alinear === 'center' && 'w-full justify-center', activa && 'text-foreground')}>
        {children}
        <Icono size={12} className={cn('shrink-0', !activa && 'opacity-40')} />
      </button>
    </TableHead>
  );
}
