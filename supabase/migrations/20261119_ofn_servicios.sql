-- Operación Financiera Noss, etapa 4: el gasto de un jugador se liga a un servicio de su plan de acompañamiento en
-- Noss (Nutrición, Indumentaria…), para comparar planeado vs. real por servicio. noss_catalogo guarda los servicios
-- (tipo 'servicio') y, en `extra`, los servicios del plan de cada jugador ({"servicios": [ids]}).
-- Idempotente.

alter table public.noss_catalogo add column if not exists extra jsonb;
alter table public.noss_catalogo drop constraint if exists noss_catalogo_tipo_check;
alter table public.noss_catalogo add constraint noss_catalogo_tipo_check check (tipo in ('proceso', 'jugador', 'club', 'evento', 'servicio'));

-- Verificación: debe mostrar la restricción con 'servicio' y la columna extra.
select pg_get_constraintdef(oid) as restriccion,
       exists (select 1 from information_schema.columns where table_name = 'noss_catalogo' and column_name = 'extra') as columna_extra
from pg_constraint where conname = 'noss_catalogo_tipo_check';
