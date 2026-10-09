-- =====================================================================================
-- Concepto obligatorio en Solicitudes (y nunca vacío en Finanzas)
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Es idempotente.
-- 1) Bloquea en la base de datos crear una Solicitud sin Concepto (detalle) o borrárselo al
--    editarla. Las solicitudes viejas sin Concepto se pueden seguir aprobando/pagando: el
--    bloqueo solo actúa cuando se crea o cuando se cambia el Concepto.
-- 2) Completa el detalle de los registros de Finanzas que vinieron de una Solicitud y quedaron
--    vacíos: toma el Concepto de la Solicitud o, si tampoco tiene, "Tipo — Colaborador".
-- =====================================================================================

begin;

create or replace function public.validar_concepto_solicitud() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' or new.detalle is distinct from old.detalle)
     and coalesce(trim(new.detalle), '') = '' then
    raise exception 'El Concepto de la solicitud es obligatorio';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_concepto_solicitud on public.solicitudes;
create trigger validar_concepto_solicitud before insert or update on public.solicitudes
  for each row execute function public.validar_concepto_solicitud();

-- Finanzas: gastos/ingresos generados desde una Solicitud con el detalle vacío.
update public.gastos g
set detalle = coalesce(nullif(trim(s.detalle), ''), s.tipo || ' — ' || coalesce(u.nombre, 'sin colaborador'))
from public.solicitudes s
left join public.usuarios u on u.id = s.responsable_id
where g.solicitud_origen_id = s.id
  and coalesce(trim(g.detalle), '') = '';

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ingresos' and column_name = 'solicitud_origen_id') then
    execute $q$
      update public.ingresos i
      set detalle = coalesce(nullif(trim(s.detalle), ''), s.tipo || ' — ' || coalesce(u.nombre, 'sin colaborador'))
      from public.solicitudes s
      left join public.usuarios u on u.id = s.responsable_id
      where i.solicitud_origen_id = s.id
        and coalesce(trim(i.detalle), '') = ''
    $q$;
  end if;
end $$;

commit;

-- Verificación (solo lectura): lo que sigue sin detalle.
select 'solicitudes sin concepto (viejas)' as que, count(*) as cantidad
from public.solicitudes where coalesce(trim(detalle), '') = ''
union all
select 'finanzas desde solicitud sin detalle', count(*)
from public.gastos where solicitud_origen_id is not null and coalesce(trim(detalle), '') = ''
union all
select 'finanzas manuales sin detalle', count(*)
from public.gastos where solicitud_origen_id is null and coalesce(trim(detalle), '') = '';
