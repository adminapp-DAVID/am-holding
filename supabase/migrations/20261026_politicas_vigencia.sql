-- =====================================================================================
-- Políticas Financieras: fecha de vigencia ("Vigente desde")
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Los reembolsos creados ANTES de que la política entrara en vigencia no se marcan como
-- extemporáneos ni se les estima el pago (lo define Administración, como antes), aunque se
-- aprueben o editen después. Lo mismo para la marca "requiere confirmación de gerencia".
-- Por defecto rige desde el 23/10/2026 00:00 (hora Colombia); se cambia en el Gestor.
-- =====================================================================================

begin;

alter table public.politicas_financieras add column if not exists vigente_desde timestamptz not null default '2026-10-23 00:00:00-05';
grant update (vigente_desde) on public.politicas_financieras to authenticated;

create or replace function public.politicas_solicitud_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pf public.politicas_financieras := public.politica();
  v_creada timestamptz;
  v_sistema boolean := coalesce(current_setting('app.politicas_sistema', true), '') = 'on';
begin
  if pf is null then return new; end if;
  if tg_op = 'INSERT' then
    v_creada := coalesce(new.created_at, now());
    new.devuelta_limite := null; new.devuelta_vencida := false; new.legalizar_antes := null;
  else
    v_creada := coalesce(old.created_at, now());
    -- Lo calculado no lo cambia la app (solo la base, o la revisión automática).
    if not v_sistema then
      new.devuelta_limite := old.devuelta_limite; new.devuelta_vencida := old.devuelta_vencida;
      new.legalizar_antes := old.legalizar_antes; new.fecha_pago_estimada := old.fecha_pago_estimada;
      new.extemporanea := old.extemporanea;
    end if;
  end if;

  -- Reembolso: día de pago según la hora de envío y el corte. Los creados antes de que la
  -- política entrara en vigencia (vigente_desde) no se marcan ni se les estima el pago.
  if new.tipo = 'Reembolso' then
    if v_creada < pf.vigente_desde then
      new.fecha_pago_estimada := null; new.extemporanea := false;
    elsif new.fecha_pago_estimada is null then
      new.fecha_pago_estimada := public.fecha_pago_reembolso(v_creada);
      new.extemporanea := public.hora_local(v_creada) > public.corte_semana(v_creada);
    end if;
  elsif not v_sistema then
    new.fecha_pago_estimada := null; new.extemporanea := false;
  end if;

  -- Anticipo: anticipación mínima frente a la fecha en que se necesita el recurso.
  new.requiere_confirmacion_gerencia := new.tipo = 'Anticipo' and new.fecha_requerida is not null
    and v_creada >= pf.vigente_desde
    and (new.fecha_requerida - public.hora_local(v_creada)::date) * 24 < pf.anticipo_min_horas;

  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if new.estado = 'Devuelto' then
      new.devuelta_limite := now() + make_interval(hours => pf.devolucion_horas);
      new.devuelta_vencida := false;
    elsif old.estado = 'Devuelto' then
      new.devuelta_limite := null;
    end if;
    if new.estado = 'Pagado' and new.tipo = 'Anticipo' then
      new.legalizar_antes := public.limite_legalizacion(coalesce(new.tipo_anticipo, 'General'), public.hora_local(now())::date);
    end if;
  end if;
  return new;
end;
$$;

-- Corrige lo ya calculado para solicitudes anteriores a la vigencia (y cierra sus avisos).
select set_config('app.politicas_sistema', 'on', true);
with viejas as (
  update public.solicitudes s set fecha_pago_estimada = null, extemporanea = false, requiere_confirmacion_gerencia = false
  from public.politicas_financieras pf
  where pf.id = 1 and s.created_at < pf.vigente_desde
    and (s.fecha_pago_estimada is not null or s.extemporanea or s.requiere_confirmacion_gerencia)
  returning s.id
)
update public.notificaciones n set leida = true
from viejas v
where n.entidad_id = v.id::text and not n.leida
  and n.tipo in ('politica_reembolso_extemporaneo', 'politica_anticipo_fuera_plazo');

commit;

-- Verificación (solo lectura): reembolsos en curso con su cálculo.
select u.nombre, to_char(s.created_at at time zone 'America/Bogota', 'Dy DD/MM HH12:MI am') as registrada,
       s.fecha_pago_estimada, s.extemporanea, s.estado
from public.solicitudes s join public.usuarios u on u.id = s.responsable_id
where s.tipo = 'Reembolso' and s.estado in ('Pendiente', 'Aprobado', 'Devuelto')
order by s.created_at desc;
