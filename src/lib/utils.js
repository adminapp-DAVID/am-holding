import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utilidad estándar de shadcn/ui: combina clases de Tailwind resolviendo conflictos.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
