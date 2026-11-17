-- Operación Financiera Noss: el gasto generado al pagar una solicitud con OFN siempre hereda su `ofn`, aunque el pago
-- se haga desde una versión vieja de la app (p. ej. una URL de prueba de Vercel) que no la copiaba. Sin esto el gasto
-- no llega a Noss (tableros y Gasto real del evento). Incluye el arreglo de los gastos ya creados sin `ofn`.
-- Idempotente.

create or replace function public.gastos_ofn_desde_solicitud() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ofn is null and new.solicitud_origen_id is not null then
    select s.ofn into new.ofn from public.solicitudes s where s.id::text = new.solicitud_origen_id::text;
  end if;
  return new;
end $$;

drop trigger if exists gastos_ofn_desde_solicitud on public.gastos;
create trigger gastos_ofn_desde_solicitud before insert or update of solicitud_origen_id on public.gastos
  for each row execute function public.gastos_ofn_desde_solicitud();

-- Gastos ya generados sin la OFN de su solicitud.
update public.gastos g set ofn = s.ofn
from public.solicitudes s
where s.id::text = g.solicitud_origen_id::text and g.ofn is null and s.ofn is not null;

-- Verificación: debe devolver 0 filas.
select g.id as gasto_sin_ofn
from public.gastos g join public.solicitudes s on s.id::text = g.solicitud_origen_id::text
where s.ofn is not null and g.ofn is null;
