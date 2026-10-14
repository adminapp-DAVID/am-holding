import * as React from 'react';
import { cn } from '@/lib/utils';

// Tabla con scroll horizontal propio (en celular no desborda la página).
const Table = ({ className, ...props }) => (
  <div data-slot="table-container" className="relative w-full overflow-x-auto rounded-lg border border-solid border-border bg-card">
    <table data-slot="table" className={cn('w-full border-collapse text-sm', className)} {...props} />
  </div>
);
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
