-- =====================================================================================
-- Políticas Financieras + gestor de plazos y notificaciones automáticas
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Idempotente. Requiere 20261010_auditoria_notificaciones.sql (notificaciones + pg_cron).
-- No modifica datos existentes: solo agrega una tabla, columnas nuevas (vacías) y funciones.
--
-- • politicas_financieras (una sola fila): texto de las políticas y los valores del gestor
--   (día de pago, corte, plazos). La leen todos; la editan Administrador y Coordinadora.
-- • solicitudes: columnas nuevas que calcula la BASE (trigger), no la app:
--     tipo_anticipo / fecha_requerida (las llena quien pide el anticipo),
--     requiere_confirmacion_gerencia, fecha_pago_estimada, extemporanea,
--     devuelta_limite, devuelta_vencida, legalizar_antes.
-- • Notificaciones (campana 🔔):
--     - Reembolso enviado después del corte → "entra a revisión la semana siguiente".
--     - Anticipo pedido con menos anticipación de la exigida → colaborador, Gerente, Admin y
--       Coordinadora ("requiere confirmación de gerencia").
--     - Solicitud devuelta → "tienes N horas para corregirla"; si vence sin reenviar → pasa a la
--       semana siguiente (aviso al colaborador, Admin y Coordinadora). Revisión cada 15 min.
--     - Anticipo pagado → fecha límite de legalización; recordatorio N días antes, el día del
--       vencimiento y al vencer (también a Admin y Coordinadora). Revisión diaria 8:00 a. m.
-- • Días hábiles: lunes a viernes sin festivos de Colombia (calculados, Ley Emiliani incluida).
-- =====================================================================================

begin;

-- 1) Valores del gestor ----------------------------------------------------------------------
create table if not exists public.politicas_financieras (
  id int primary key default 1 check (id = 1),
  contenido text not null default '',
  pago_dia_semana int not null default 5 check (pago_dia_semana between 1 and 7),     -- 1 = lunes … 5 = viernes
  corte_dia_semana int not null default 4 check (corte_dia_semana between 1 and 7),   -- 4 = jueves
  corte_hora time not null default '11:00',
  dia_mes_corrido int not null default 15 check (dia_mes_corrido between 0 and 31),   -- 0 = no aplica
  devolucion_horas int not null default 5 check (devolucion_horas > 0),
  legal_general_dias int not null default 10 check (legal_general_dias > 0),
  legal_general_habiles boolean not null default true,
  legal_nacional_dias int not null default 15 check (legal_nacional_dias > 0),
  legal_nacional_habiles boolean not null default true,
  legal_internacional_dia int not null default 30 check (legal_internacional_dia between 1 and 31),
  legal_recordar_dias_antes int not null default 2 check (legal_recordar_dias_antes >= 0),
  anticipo_min_horas int not null default 48 check (anticipo_min_horas >= 0),
  notificaciones_activas boolean not null default true,
  vigente_desde timestamptz not null default '2026-10-23 00:00:00-05',  -- desde cuándo aplica a lo que se registra
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.politicas_financieras (id, contenido) values (1, $txt$# Pagos de reembolsos
(AM Holding: Pronova Capital, Pro Investments Global SAS, AM Sports Group SAS, For 7 Media SAS; así como CUBO y NOSSO)
- Los reembolsos se efectuarán los **viernes de cada semana**.
- En los meses donde el viernes coincida con el día **15**, el pago se realizará el **lunes siguiente**, debido a posibles fallas operativas bancarias.
- Si el día de pago es festivo, el pago se realiza el siguiente día hábil.
- Los reembolsos deben ser enviados para ser tenidos en cuenta hasta el **jueves de esa semana a las 11:00 am** y así tener disponibilidad de revisión. Los que lleguen después de esta hora quedarán para la semana siguiente.
- Las solicitudes **devueltas** deben corregirse dentro de las **5 horas** siguientes; si no, pasan a revisión la semana siguiente.

# Pagos de anticipos
- Los anticipos deberán solicitarse como mínimo **48 horas** antes de necesitar el recurso.
- Solicitudes fuera de este rango deberán ser confirmadas directamente con **gerencia** y quedarán sujetas a la disponibilidad presupuestaria.

# Legalización de anticipos
- General: hasta **10 días hábiles** después del pago.
- Viaje nacional: hasta **15 días** después del pago.
- Viaje internacional: hasta el **día 30 del mes** en que se pagó.

# Excepciones
En casos urgentes (llegada de jugadores, cuerpo técnico, etc.), el solicitante deberá informar a su líder de equipo, quien se comunicará directamente para confirmar la novedad.$txt$)
on conflict (id) do nothing;

alter table public.politicas_financieras enable row level security;
revoke all on public.politicas_financieras from anon, authenticated;
grant select on public.politicas_financieras to authenticated;
grant update (contenido, pago_dia_semana, corte_dia_semana, corte_hora, dia_mes_corrido, devolucion_horas,
  legal_general_dias, legal_general_habiles, legal_nacional_dias, legal_nacional_habiles, legal_internacional_dia,
  legal_recordar_dias_antes, anticipo_min_horas, notificaciones_activas, vigente_desde, updated_at, updated_by)
  on public.politicas_financieras to authenticated;
drop policy if exists politicas_select on public.politicas_financieras;
create policy politicas_select on public.politicas_financieras for select to authenticated using (true);
drop policy if exists politicas_update on public.politicas_financieras;
create policy politicas_update on public.politicas_financieras for update to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'))
  with check (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));

-- Tabla ya creada sin esta columna (ver 20261026_politicas_vigencia.sql).
alter table public.politicas_financieras add column if not exists vigente_desde timestamptz not null default '2026-10-23 00:00:00-05';

-- 2) Columnas nuevas ---------------------------------------------------------------------------
alter table public.solicitudes add column if not exists tipo_anticipo text;           -- General | Viaje nacional | Viaje internacional
alter table public.solicitudes add column if not exists fecha_requerida date;         -- cuándo necesita el recurso (Anticipo)
alter table public.solicitudes add column if not exists requiere_confirmacion_gerencia boolean not null default false;
alter table public.solicitudes add column if not exists fecha_pago_estimada date;     -- Reembolso
alter table public.solicitudes add column if not exists extemporanea boolean not null default false;
alter table public.solicitudes add column if not exists devuelta_limite timestamptz;
alter table public.solicitudes add column if not exists devuelta_vencida boolean not null default false;
alter table public.solicitudes add column if not exists legalizar_antes date;         -- Anticipo pagado
-- Excepción a la política aprobada por Administración (ver 20261027_politicas_excepcion.sql).
alter table public.solicitudes add column if not exists excepcion_politica boolean not null default false;
alter table public.solicitudes add column if not exists excepcion_motivo text;
alter table public.solicitudes add column if not exists excepcion_por text;
alter table public.solicitudes add column if not exists excepcion_at timestamptz;

-- Para no repetir un mismo recordatorio (a qué solicitud se refiere la notificación).
alter table public.notificaciones add column if not exists entidad_id text;

-- 3) Calendario: festivos de Colombia y días hábiles -------------------------------------------
create or replace function public.festivos_colombia(p_anio int) returns setof date
language plpgsql immutable as $$
declare
  a int := p_anio % 19; b int := p_anio / 100; c int := p_anio % 100;
  d int := b / 4; e int := b % 4; f int := (b + 8) / 25; g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30; i int := c / 4; k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7; m int := (a + 11 * h + 22 * l) / 451;
  pascua date := make_date(p_anio, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
  x date;
begin
  -- Fijos
  return next make_date(p_anio, 1, 1);  return next make_date(p_anio, 5, 1);
  return next make_date(p_anio, 7, 20); return next make_date(p_anio, 8, 7);
  return next make_date(p_anio, 12, 8); return next make_date(p_anio, 12, 25);
  -- Ley Emiliani: se corren al lunes siguiente
  foreach x in array array[make_date(p_anio, 1, 6), make_date(p_anio, 3, 19), make_date(p_anio, 6, 29),
                           make_date(p_anio, 8, 15), make_date(p_anio, 10, 12), make_date(p_anio, 11, 1),
                           make_date(p_anio, 11, 11)] loop
    return next case when extract(isodow from x) = 1 then x else x + (8 - extract(isodow from x)::int) end;
  end loop;
  -- Según la Pascua
  return next pascua - 3; return next pascua - 2;                       -- Jueves y Viernes Santo
  return next pascua + 43; return next pascua + 64; return next pascua + 71; -- Ascensión, Corpus, Sagrado Corazón (lunes)
end;
$$;

create or replace function public.es_dia_habil(p date) returns boolean
language sql immutable as $$
  select extract(isodow from p) < 6 and p not in (select public.festivos_colombia(extract(year from p)::int))
$$;

create or replace function public.siguiente_dia_habil(p date) returns date
language plpgsql immutable as $$
declare d date := p;
begin
  while not public.es_dia_habil(d) loop d := d + 1; end loop;
  return d;
end;
$$;

create or replace function public.sumar_dias_habiles(p date, n int) returns date
language plpgsql immutable as $$
declare d date := p; faltan int := n;
begin
  while faltan > 0 loop
    d := d + 1;
    if public.es_dia_habil(d) then faltan := faltan - 1; end if;
  end loop;
  return d;
end;
$$;

-- 4) Reglas ---------------------------------------------------------------------------------
create or replace function public.politica() returns public.politicas_financieras
language sql stable security definer set search_path = public as $$
  select * from public.politicas_financieras where id = 1
$$;

create or replace function public.hora_local(p timestamptz) returns timestamp
language sql stable as $$ select p at time zone 'America/Bogota' $$;

-- Día de pago de la semana que empieza el lunes p_lunes: el día configurado; si cae en el día
-- del mes "corrido" (15) pasa al lunes siguiente; y si es festivo, al siguiente día hábil.
create or replace function public.dia_pago_semana(p_lunes date) returns date
language plpgsql stable as $$
declare pf public.politicas_financieras := public.politica(); d date;
begin
  d := p_lunes + (pf.pago_dia_semana - 1);
  if pf.dia_mes_corrido > 0 and extract(day from d) = pf.dia_mes_corrido then
    d := d + (8 - extract(isodow from d)::int);
  end if;
  return public.siguiente_dia_habil(d);
end;
$$;

create or replace function public.corte_semana(p timestamptz) returns timestamp
language sql stable as $$
  select date_trunc('week', public.hora_local(p))::date + (pf.corte_dia_semana - 1) + pf.corte_hora
  from public.politica() pf
$$;

-- Reembolso enviado en p: se paga esta semana si llegó antes del corte; si no, la siguiente.
create or replace function public.fecha_pago_reembolso(p timestamptz) returns date
language sql stable as $$
  select public.dia_pago_semana(date_trunc('week', public.hora_local(p))::date
    + case when public.hora_local(p) <= public.corte_semana(p) then 0 else 7 end)
$$;

create or replace function public.limite_legalizacion(p_tipo text, p_pago date) returns date
language plpgsql stable as $$
declare pf public.politicas_financieras := public.politica(); x date; mes date;
begin
  if p_tipo = 'Viaje internacional' then
    mes := date_trunc('month', p_pago)::date;
    x := least(mes + (pf.legal_internacional_dia - 1), (mes + interval '1 month - 1 day')::date);
    if x <= p_pago then  -- pagado ya en (o después de) ese día: el del mes siguiente
      mes := (mes + interval '1 month')::date;
      x := least(mes + (pf.legal_internacional_dia - 1), (mes + interval '1 month - 1 day')::date);
    end if;
    return x;
  elsif p_tipo = 'Viaje nacional' then
    return case when pf.legal_nacional_habiles then public.sumar_dias_habiles(p_pago, pf.legal_nacional_dias) else p_pago + pf.legal_nacional_dias end;
  end if;
  return case when pf.legal_general_habiles then public.sumar_dias_habiles(p_pago, pf.legal_general_dias) else p_pago + pf.legal_general_dias end;
end;
$$;

-- Textos ("viernes 30 de octubre", "3:45 p. m.") sin depender del idioma del servidor.
create or replace function public.texto_fecha(p date) returns text
language sql immutable as $$
  select (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[extract(isodow from p)::int] || ' ' ||
         extract(day from p)::int || ' de ' ||
         (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from p)::int]
$$;
create or replace function public.texto_hora(p timestamptz) returns text
language sql stable as $$
  select to_char(public.hora_local(p), 'FMHH12:MI') || case when extract(hour from public.hora_local(p)) < 12 then ' a. m.' else ' p. m.' end
$$;

-- 5) Trigger ANTES de guardar: calcula las columnas de la política ---------------------------
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
drop trigger if exists politicas_solicitud_antes on public.solicitudes;
create trigger politicas_solicitud_antes before insert or update on public.solicitudes
  for each row execute function public.politicas_solicitud_antes();

-- 6) Notificaciones ---------------------------------------------------------------------------
-- p_unica: no repetir si esa persona ya recibió ese tipo para esa solicitud.
create or replace function public.notificar_politica(p_dest anyelement, p_tipo text, p_mensaje text, p_entidad text, p_unica boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_dest is null then return; end if;
  if p_unica and exists (select 1 from public.notificaciones
                         where destinatario_id::text = p_dest::text and tipo = p_tipo and entidad_id = p_entidad) then
    return;
  end if;
  insert into public.notificaciones (destinatario_id, tipo, mensaje, enlace, entidad_id)
  values (p_dest, p_tipo, p_mensaje, 'solicitudes', p_entidad);
end;
$$;

-- A Administrador / Coordinadora (y Gerente si p_gerente).
create or replace function public.notificar_politica_admins(p_tipo text, p_mensaje text, p_entidad text, p_gerente boolean default false, p_unica boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.usuarios
           where rol in ('Administrador', 'Coordinadora Administrativa', 'Gerente Financiero') or (p_gerente and rol = 'Gerente') loop
    perform public.notificar_politica(r.id, p_tipo, p_mensaje, p_entidad, p_unica);
  end loop;
end;
$$;

create or replace function public.anticipo_legalizado(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.solicitudes l
                 where l.tipo = 'Legalización'
                   and (l.anticipo_id::text = p_id or p_id = any(coalesce(l.anticipo_ids::text[], '{}'))))
$$;

create or replace function public.politicas_solicitud_despues() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pf public.politicas_financieras := public.politica();
  v_id text := new.id::text;
  v_nombre text;
  v_desc text;
begin
  if pf is null or not pf.notificaciones_activas then return new; end if;
  begin
    select nombre into v_nombre from public.usuarios where id::text = new.responsable_id::text;
    v_desc := coalesce(new.tipo, 'Solicitud') || coalesce(' — ' || nullif(left(new.detalle, 60), ''), '');

    if tg_op = 'INSERT' then
      if new.tipo = 'Reembolso' and new.extemporanea then
        perform public.notificar_politica(new.responsable_id, 'politica_reembolso_extemporaneo',
          'Tu reembolso (' || coalesce(nullif(left(new.detalle, 60), ''), 'sin concepto') || ') llegó después del corte del ' ||
          (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[pf.corte_dia_semana] || ' a las ' ||
          public.texto_hora(public.corte_semana(now()) at time zone 'America/Bogota') ||
          ': por ser extemporáneo entra a revisión y aprobación la semana siguiente. Pago estimado: ' ||
          public.texto_fecha(new.fecha_pago_estimada) || '.', v_id);
      end if;
      if new.requiere_confirmacion_gerencia then
        perform public.notificar_politica(new.responsable_id, 'politica_anticipo_fuera_plazo',
          'Tu anticipo se pidió con menos de ' || pf.anticipo_min_horas || ' horas de anticipación (lo necesitas el ' ||
          public.texto_fecha(new.fecha_requerida) || '): queda sujeto a confirmación de gerencia y a la disponibilidad presupuestaria.', v_id);
        perform public.notificar_politica_admins('politica_anticipo_fuera_plazo',
          'Anticipo fuera de plazo de ' || coalesce(v_nombre, 'un colaborador') || ' (lo necesita el ' || public.texto_fecha(new.fecha_requerida) ||
          '): requiere confirmación de gerencia. ' || v_desc, v_id, true);
      end if;
      -- Legalización presentada → se cierran los recordatorios de sus anticipos.
      if new.tipo = 'Legalización' then
        update public.notificaciones set leida = true
        where not leida and tipo like 'politica_legalizacion%'
          and (entidad_id = new.anticipo_id::text or entidad_id = any(coalesce(new.anticipo_ids::text[], '{}')));
      end if;
      return new;
    end if;

    if new.estado is distinct from old.estado then
      if new.estado = 'Devuelto' and new.devuelta_limite is not null then
        perform public.notificar_politica(new.responsable_id, 'politica_devuelta_plazo',
          'Tu solicitud devuelta (' || v_desc || ') tiene ' || pf.devolucion_horas || ' horas para corregirse: hasta las ' ||
          public.texto_hora(new.devuelta_limite) || ' del ' || public.texto_fecha(public.hora_local(new.devuelta_limite)::date) ||
          '. Si no, pasa a revisión la semana siguiente.', v_id);
      elsif old.estado = 'Devuelto' then
        update public.notificaciones set leida = true
        where not leida and entidad_id = v_id and tipo in ('politica_devuelta_plazo', 'politica_devuelta_vencida');
      end if;
      if new.estado = 'Pagado' and new.tipo = 'Anticipo' and new.legalizar_antes is not null then
        perform public.notificar_politica(new.responsable_id, 'politica_legalizacion_plazo',
          'Tu anticipo (' || coalesce(nullif(left(new.detalle, 60), ''), 'sin concepto') || ') fue pagado. Debes presentar la legalización a más tardar el ' ||
          public.texto_fecha(new.legalizar_antes) || '.', v_id);
      end if;
    end if;
  exception when others then
    raise warning 'politicas_solicitud_despues: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists politicas_solicitud_despues on public.solicitudes;
create trigger politicas_solicitud_despues after insert or update on public.solicitudes
  for each row execute function public.politicas_solicitud_despues();

-- 7) Revisiones automáticas (pg_cron) ----------------------------------------------------------
-- Devueltas sin corregir a tiempo → pasan a la semana siguiente (cada 15 min).
create or replace function public.politicas_revisar_devueltas() returns integer
language plpgsql security definer set search_path = public as $$
declare
  pf public.politicas_financieras := public.politica();
  s record; v_total int := 0; v_nueva date; v_nombre text;
begin
  perform set_config('app.politicas_sistema', 'on', true);
  for s in select * from public.solicitudes
           where estado = 'Devuelto' and devuelta_limite < now() and not devuelta_vencida loop
    v_nueva := case when s.tipo = 'Reembolso' then greatest(
        public.fecha_pago_reembolso(now()),
        public.dia_pago_semana(date_trunc('week', coalesce(s.fecha_pago_estimada, public.hora_local(now())::date))::date + 7))
      else s.fecha_pago_estimada end;
    update public.solicitudes set devuelta_vencida = true, fecha_pago_estimada = v_nueva where id = s.id;
    v_total := v_total + 1;
    if pf.notificaciones_activas then
      select nombre into v_nombre from public.usuarios where id::text = s.responsable_id::text;
      perform public.notificar_politica(s.responsable_id, 'politica_devuelta_vencida',
        'Venció el plazo de ' || pf.devolucion_horas || ' horas para corregir tu solicitud devuelta (' || s.tipo ||
        coalesce(' — ' || nullif(left(s.detalle, 60), ''), '') || '): pasa a revisión la semana siguiente' ||
        coalesce('. Pago estimado: ' || public.texto_fecha(v_nueva), '') || '.', s.id::text, true);
      perform public.notificar_politica_admins('politica_devuelta_vencida',
        'Devuelta sin corregir a tiempo: ' || s.tipo || coalesce(' — ' || nullif(left(s.detalle, 60), ''), '') ||
        ' · ' || coalesce(v_nombre, '') || '. Pasa a la semana siguiente.', s.id::text, false, true);
    end if;
  end loop;
  return v_total;
end;
$$;

-- Legalizaciones de anticipos: recordatorio, día del vencimiento y vencidas (diario 8:00 a. m.).
create or replace function public.politicas_recordar_legalizaciones() returns integer
language plpgsql security definer set search_path = public as $$
declare
  pf public.politicas_financieras := public.politica();
  hoy date := public.hora_local(now())::date;
  a record; v_total int := 0; v_nombre text; v_desc text;
begin
  if not pf.notificaciones_activas then return 0; end if;
  for a in select * from public.solicitudes
           where tipo = 'Anticipo' and estado = 'Pagado' and legalizar_antes is not null
             and not public.anticipo_legalizado(id::text) loop
    v_desc := coalesce(nullif(left(a.detalle, 60), ''), 'sin concepto');
    if hoy > a.legalizar_antes then
      select nombre into v_nombre from public.usuarios where id::text = a.responsable_id::text;
      perform public.notificar_politica(a.responsable_id, 'politica_legalizacion_vencida',
        'Venció el plazo para legalizar tu anticipo (' || v_desc || '): era el ' || public.texto_fecha(a.legalizar_antes) ||
        '. Preséntala lo antes posible.', a.id::text, true);
      perform public.notificar_politica_admins('politica_legalizacion_vencida',
        'Anticipo sin legalizar (venció el ' || public.texto_fecha(a.legalizar_antes) || '): ' || v_desc || ' · ' || coalesce(v_nombre, ''),
        a.id::text, false, true);
    elsif hoy = a.legalizar_antes then
      perform public.notificar_politica(a.responsable_id, 'politica_legalizacion_hoy',
        'Hoy vence el plazo para legalizar tu anticipo (' || v_desc || ').', a.id::text, true);
    elsif hoy >= a.legalizar_antes - pf.legal_recordar_dias_antes then
      perform public.notificar_politica(a.responsable_id, 'politica_legalizacion_recordatorio',
        'Recuerda presentar la legalización de tu anticipo (' || v_desc || ') a más tardar el ' ||
        public.texto_fecha(a.legalizar_antes) || '.', a.id::text, true);
    else
      continue;
    end if;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.politicas_revisar_devueltas() from public, anon, authenticated;
revoke all on function public.politicas_recordar_legalizaciones() from public, anon, authenticated;
revoke all on function public.notificar_politica(anyelement, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.notificar_politica_admins(text, text, text, boolean, boolean) from public, anon, authenticated;

commit;

-- 8) Programación (hora Colombia = UTC − 5) -------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname in ('politicas-devueltas', 'politicas-legalizaciones');
select cron.schedule('politicas-devueltas', '*/15 * * * *', 'select public.politicas_revisar_devueltas()');
select cron.schedule('politicas-legalizaciones', '0 13 * * *', 'select public.politicas_recordar_legalizaciones()');

-- Verificación (solo lectura):
-- a) Próximo día de pago de un reembolso enviado ahora y festivos del año.
select public.fecha_pago_reembolso(now()) as pago_reembolso_enviado_ahora,
       (select array_agg(f order by f) from public.festivos_colombia(extract(year from now())::int) f) as festivos_este_anio;
-- b) Las dos tareas programadas.
select jobname, schedule from cron.job where jobname like 'politicas-%';
