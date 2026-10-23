-- =====================================================================================
-- Políticas Financieras: EXCEPCIÓN aprobada por Administración
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Administrador / Coordinadora Administrativa (y Gerente Financiero, que tiene sus permisos)
-- pueden aplicar una excepción a una solicitud con aviso de la política:
--   • Reembolso extemporáneo o devuelta fuera de plazo → se paga el PRÓXIMO día de pago
--     (hoy, si hoy es día de pago) y deja de ser extemporáneo.
--   • Anticipo fuera de plazo → queda confirmado (sin "requiere confirmación de gerencia").
-- Queda guardado quién, cuándo y por qué; se avisa al colaborador y se cierran los avisos
-- anteriores de esa solicitud. La app no puede marcarla por su cuenta (solo esta función).
-- =====================================================================================

begin;

alter table public.solicitudes add column if not exists excepcion_politica boolean not null default false;
alter table public.solicitudes add column if not exists excepcion_motivo text;
alter table public.solicitudes add column if not exists excepcion_por text;
alter table public.solicitudes add column if not exists excepcion_at timestamptz;

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
    new.excepcion_politica := false; new.excepcion_motivo := null; new.excepcion_por := null; new.excepcion_at := null;
  else
    v_creada := coalesce(old.created_at, now());
    -- Lo calculado no lo cambia la app (solo la base, o la revisión automática).
    if not v_sistema then
      new.devuelta_limite := old.devuelta_limite; new.devuelta_vencida := old.devuelta_vencida;
      new.legalizar_antes := old.legalizar_antes; new.fecha_pago_estimada := old.fecha_pago_estimada;
      new.extemporanea := old.extemporanea;
      new.excepcion_politica := old.excepcion_politica; new.excepcion_motivo := old.excepcion_motivo;
      new.excepcion_por := old.excepcion_por; new.excepcion_at := old.excepcion_at;
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
    and v_creada >= pf.vigente_desde and not coalesce(new.excepcion_politica, false)
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


create or replace function public.aplicar_excepcion_politica(p_solicitud text, p_motivo text) returns date
language plpgsql security definer set search_path = public as $$
declare
  s public.solicitudes;
  v_hoy date := public.hora_local(now())::date;
  v_pago date;
  v_por text;
begin
  if public.current_rol() not in ('Administrador', 'Coordinadora Administrativa') then
    raise exception 'Solo Administración puede aplicar excepciones a la política';
  end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe el motivo de la excepción'; end if;
  select * into s from public.solicitudes where id::text = p_solicitud;
  if not found then raise exception 'La solicitud no existe'; end if;

  v_pago := public.dia_pago_semana(date_trunc('week', v_hoy)::date);
  if v_pago < v_hoy then v_pago := public.dia_pago_semana(date_trunc('week', v_hoy)::date + 7); end if;
  select nombre into v_por from public.usuarios where id::text = public.current_usuario_id()::text;

  perform set_config('app.politicas_sistema', 'on', true);
  update public.solicitudes set
    excepcion_politica = true, excepcion_motivo = trim(p_motivo), excepcion_por = v_por, excepcion_at = now(),
    extemporanea = false, devuelta_vencida = false, requiere_confirmacion_gerencia = false,
    fecha_pago_estimada = case when tipo = 'Reembolso' then v_pago else fecha_pago_estimada end
  where id = s.id;

  update public.notificaciones set leida = true
  where entidad_id = s.id::text and not leida
    and tipo in ('politica_reembolso_extemporaneo', 'politica_anticipo_fuera_plazo', 'politica_devuelta_vencida');
  perform public.notificar_politica(s.responsable_id, 'politica_excepcion',
    'Administración aprobó una excepción para tu ' || lower(s.tipo) || coalesce(' (' || nullif(left(s.detalle, 60), '') || ')', '') ||
    case when s.tipo = 'Reembolso' then ': se paga el ' || public.texto_fecha(v_pago) else '' end || '.', s.id::text);
  return case when s.tipo = 'Reembolso' then v_pago end;
end;
$$;
revoke all on function public.aplicar_excepcion_politica(text, text) from public, anon;
grant execute on function public.aplicar_excepcion_politica(text, text) to authenticated;

commit;

-- Verificación (solo lectura): debe salir la función.
select proname from pg_proc where proname = 'aplicar_excepcion_politica';
