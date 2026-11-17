-- Operación Financiera Noss, etapa 3: el catálogo de Noss trae también eventos (Proyectos, Viajes y Competencias)
-- para ligar el gasto a uno; al pagarse, Noss lo suma al Gasto real de ese evento (integracion-noss → sincronizar).
-- Idempotente.

alter table public.noss_catalogo drop constraint if exists noss_catalogo_tipo_check;
alter table public.noss_catalogo add constraint noss_catalogo_tipo_check check (tipo in ('proceso', 'jugador', 'club', 'evento'));

-- Verificación: debe mostrar la restricción con 'evento'.
select pg_get_constraintdef(oid) as restriccion from pg_constraint where conname = 'noss_catalogo_tipo_check';
