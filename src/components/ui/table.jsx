import * as React from 'react';
import { cn } from '@/lib/utils';

// Tabla con scroll horizontal propio (en celular no desborda la página).
// `fija`: para listas largas (Historial de Finanzas, Solicitudes). La tabla se desplaza dentro de
// su propio recuadro (alto máximo de la pantalla), el encabezado queda fijo arriba al bajar y hay
// una barra de desplazamiento horizontal también ARRIBA, sincronizada con la de abajo, para ver
// las columnas que no caben sin tener que ir al final de la lista.
const Table = ({ className, fija = false, ...props }) => {
  const arriba = React.useRef(null);
  const contenedor = React.useRef(null);
  const tabla = React.useRef(null);
  const [ancho, setAncho] = React.useState(0);
  const [desborda, setDesborda] = React.useState(false);

  React.useEffect(() => {
    if (!fija || !contenedor.current || !tabla.current) return undefined;
    const medir = () => {
      setAncho(tabla.current.scrollWidth);
      setDesborda(tabla.current.scrollWidth > contenedor.current.clientWidth + 1);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(tabla.current);
    observador.observe(contenedor.current);
    return () => observador.disconnect();
  }, [fija]);

  const sincronizar = (origen, destino) => () => {
    if (destino.current && destino.current.scrollLeft !== origen.current.scrollLeft) destino.current.scrollLeft = origen.current.scrollLeft;
  };

  if (!fija) {
    return (
      <div data-slot="table-container" className="relative w-full overflow-x-auto rounded-lg border border-solid border-border bg-card">
        <table data-slot="table" className={cn('w-full border-collapse text-sm', className)} {...props} />
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-1">
      {desborda && (
        <div ref={arriba} onScroll={sincronizar(arriba, contenedor)} className="barra-visible w-full overflow-x-auto overflow-y-hidden" aria-hidden="true">
          <div style={{ width: ancho, height: 10 }} />
        </div>
      )}
      <div
        ref={contenedor}
        onScroll={sincronizar(contenedor, arriba)}
        data-slot="table-container"
        className="barra-visible relative max-h-[75vh] w-full overflow-auto rounded-lg border border-solid border-border bg-card [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-muted [&_thead_th]:shadow-[inset_0_-1px_0_var(--border)]"
      >
        <table ref={tabla} data-slot="table" className={cn('w-full border-collapse text-sm', className)} {...props} />
      </div>
    </div>
  );
};
const TableHeader = ({ className, ...props }) => (
  <thead data-slot="table-header" className={cn('bg-muted', className)} {...props} />
);
const TableBody = ({ className, ...props }) => (
  <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);
const TableFooter = ({ className, ...props }) => (
  <tfoot data-slot="table-footer" className={cn('bg-muted/60 font-semibold', className)} {...props} />
);
const TableRow = ({ className, ...props }) => (
  <tr data-slot="table-row" className={cn('border-0 border-b border-solid border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-secondary', className)} {...props} />
);
const TableHead = ({ className, ...props }) => (
  <th data-slot="table-head" className={cn('h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap', className)} {...props} />
);
const TableCell = ({ className, ...props }) => (
  <td data-slot="table-cell" className={cn('px-3 py-2.5 align-middle', className)} {...props} />
);
const TableCaption = ({ className, ...props }) => (
  <caption data-slot="table-caption" className={cn('caption-bottom py-3 text-xs text-muted-foreground', className)} {...props} />
);

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption };
