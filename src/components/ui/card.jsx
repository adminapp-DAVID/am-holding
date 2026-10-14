import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = ({ className, ...props }) => (
  <div data-slot="card" className={cn('flex flex-col gap-4 rounded-xl border border-solid border-border bg-card py-5 text-card-foreground shadow-sm', className)} {...props} />
);
const CardHeader = ({ className, ...props }) => (
  <div data-slot="card-header" className={cn('flex flex-col gap-1 px-5', className)} {...props} />
);
const CardTitle = ({ className, ...props }) => (
  <h3 data-slot="card-title" className={cn('m-0 text-base font-bold leading-tight', className)} {...props} />
);
const CardDescription = ({ className, ...props }) => (
  <p data-slot="card-description" className={cn('m-0 text-sm text-muted-foreground', className)} {...props} />
);
const CardContent = ({ className, ...props }) => (
  <div data-slot="card-content" className={cn('px-5', className)} {...props} />
);
const CardFooter = ({ className, ...props }) => (
  <div data-slot="card-footer" className={cn('flex items-center gap-2 px-5', className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
