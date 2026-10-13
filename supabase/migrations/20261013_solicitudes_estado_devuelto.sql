-- Agrega 'Devuelto' a la regla de estados de solicitudes (ya corrido en Supabase el 2026-10-13).
-- La regla original se creó antes de "Devolver Solicitud" y rechazaba ese estado.
do $$
declare v_estados text;
begin
  select string_agg(quote_literal(e), ', ' order by e) into v_estados
  from (
    select unnest(array['Pendiente','Aprobado','Devuelto','Pagado','Legalizado']) as e
    union
    select distinct estado from public.solicitudes where estado is not null
  ) x;
  alter table public.solicitudes drop constraint if exists solicitudes_estado_check;
  execute format('alter table public.solicitudes add constraint solicitudes_estado_check check (estado in (%s))', v_estados);
end $$;
