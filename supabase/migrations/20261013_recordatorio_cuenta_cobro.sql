-- =====================================================================================
-- Recordatorio mensual de Cuenta de Cobro (día 14, 8:00 a. m. hora Colombia)
--
-- Correr COMPLETO en Supabase → SQL Editor. Es idempotente. Requiere 20261010_auditoria_notificaciones.sql.
-- • A quién: usuarios con Tipo de Vinculación "Prestación de Servicios".
-- • Se salta a quien ya creó su cuenta de cobro de ese mes y año.
-- • Al crear la cuenta de cobro, el recordatorio pendiente se marca leído solo.
-- =====================================================================================

begin;

create or replace function public.notificar_cuentas_cobro_pendientes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_mes int := extract(month from v_hoy);
  v_anio int := extract(year from v_hoy);
  v_nombre_mes text := (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from v_hoy)::int];
  v_mensaje text;
  v_total integer := 0;
  u record;
begin
  v_mensaje := 'Recuerda crear tu cuenta de cobro de ' || v_nombre_mes || ' ' || v_anio ||
               ' en 💳 Cuentas de Cobro antes del 16.';
  for u in
    select us.id from public.usuarios us
    where translate(lower(coalesce(us.tipo_vinculacion, '')), 'áéíóú', 'aeiou') like 'prestacion de servicio%'
      and not exists (
        select 1 from public.cuentas_cobro c
        where c.responsable_id = us.id and c.mes = v_mes and c.anio = v_anio
      )
  loop
    -- Un solo recordatorio pendiente por persona: si ya tiene uno sin leer, se actualiza.
    update public.notificaciones set mensaje = v_mensaje, created_at = now()
    where destinatario_id = u.id and tipo = 'cuenta_cobro_recordatorio' and not leida;
    if not found then
      perform public.notificar(u.id, 'cuenta_cobro_recordatorio', v_mensaje, 'cuentasCobro', null::bigint);
    end if;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.notificar_cuentas_cobro_pendientes() from public, anon, authenticated;

-- Al crear la cuenta de cobro, su recordatorio pendiente queda leído.
create or replace function public.cerrar_recordatorio_cuenta_cobro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.notificaciones set leida = true
  where destinatario_id = new.responsable_id and tipo = 'cuenta_cobro_recordatorio' and not leida;
  return new;
end;
$$;
drop trigger if exists cerrar_recordatorio_cuenta_cobro on public.cuentas_cobro;
create trigger cerrar_recordatorio_cuenta_cobro after insert on public.cuentas_cobro
  for each row execute function public.cerrar_recordatorio_cuenta_cobro();

commit;

-- Día 14 de cada mes, 8:00 a. m. Colombia (13:00 UTC).
select cron.schedule('recordatorio-cuenta-cobro-dia-14', '0 13 14 * *', 'select public.notificar_cuentas_cobro_pendientes()');

-- Verificación (solo lectura): a quiénes les llegaría HOY el recordatorio.
select us.nombre, us.tipo_vinculacion
from public.usuarios us
where translate(lower(coalesce(us.tipo_vinculacion, '')), 'áéíóú', 'aeiou') like 'prestacion de servicio%'
  and not exists (
    select 1 from public.cuentas_cobro c
    where c.responsable_id = us.id
      and c.mes = extract(month from (now() at time zone 'America/Bogota'))
      and c.anio = extract(year from (now() at time zone 'America/Bogota'))
  )
order by us.nombre;
