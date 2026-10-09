-- =====================================================================================
-- Auditoría + Notificaciones (centro de notificaciones) — PR 1 de 2 (el PR 2 agrega correos)
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR.
-- Es idempotente: se puede correr más de una vez. No modifica datos existentes.
--
-- • auditoria: registro INMUTABLE de toda acción (crear / editar / cambiar estado / eliminar)
--   en las tablas de la app, con usuario, rol, módulo, registro y valor anterior → nuevo. La
--   escriben triggers de la base de datos (no la app), así que nada se escapa aunque se cambie
--   desde otra pantalla o desde el SQL Editor. Nadie puede editarla ni borrarla.
-- • notificaciones: lo que ve cada persona en la campana 🔔. Las genera el mismo trigger,
--   justo después de escribir la auditoría:
--     - Solicitudes y Cuentas de Cobro (creación y cambio de estado): al dueño (si no fue él
--       quien hizo la acción) y a Administrador / Coordinadora Administrativa.
--     - Perfil incompleto: recordatorio propio cada lunes, y a Admin/Coordinadora la lista de
--       quién falta (pg_cron). Se marca leída sola cuando la persona completa el perfil.
-- =====================================================================================

begin;

-- 1) Tablas ------------------------------------------------------------------------------
do $$
declare tipo_usuario text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_usuario
  from pg_attribute a where a.attrelid = 'public.usuarios'::regclass and a.attname = 'id';

  -- usuario_id sin FK a propósito: la auditoría se conserva aunque el usuario se elimine
  -- (por eso también se guarda el nombre y el rol de ese momento).
  execute format($f$
    create table if not exists public.auditoria (
      id bigint generated always as identity primary key,
      fecha timestamptz not null default now(),
      usuario_id %1$s,
      usuario_nombre text not null default 'Sistema',
      rol text,
      modulo text not null,
      accion text not null check (accion in ('Creación', 'Edición', 'Cambio de estado', 'Eliminación')),
      tabla text not null,
      registro_id text,
      registro text,               -- descripción legible (nombre / detalle / número)
      antes jsonb,                 -- en Edición: solo los campos que cambiaron
      despues jsonb
    )$f$, tipo_usuario);

  execute format($f$
    create table if not exists public.notificaciones (
      id bigint generated always as identity primary key,
      destinatario_id %1$s not null references public.usuarios(id) on delete cascade,
      tipo text not null,          -- solicitud | cuenta_cobro | perfil | perfil_resumen
      mensaje text not null,
      enlace text,                 -- vista de la app a la que lleva el clic
      leida boolean not null default false,
      created_at timestamptz not null default now(),
      auditoria_id bigint references public.auditoria(id)
    )$f$, tipo_usuario);
end $$;

create index if not exists auditoria_fecha_idx on public.auditoria (fecha desc);
create index if not exists auditoria_modulo_idx on public.auditoria (modulo, fecha desc);
create index if not exists auditoria_usuario_idx on public.auditoria (usuario_id, fecha desc);
create index if not exists notificaciones_destinatario_idx on public.notificaciones (destinatario_id, leida, created_at desc);

-- 2) Permisos ------------------------------------------------------------------------------
alter table public.auditoria enable row level security;
alter table public.notificaciones enable row level security;

-- Auditoría: solo lectura, y solo Administrador / Coordinadora. Nadie inserta directo (lo hace
-- el trigger), nadie edita ni borra.
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;
drop policy if exists auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria
  for select to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));

-- Inmutable de verdad: ni siquiera el SQL Editor (rol postgres) puede editar o borrar filas.
create or replace function public.auditoria_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'La auditoría es inmutable: no se puede editar ni borrar';
end;
$$;
drop trigger if exists auditoria_inmutable on public.auditoria;
create trigger auditoria_inmutable before update or delete on public.auditoria
  for each row execute function public.auditoria_inmutable();
drop trigger if exists auditoria_inmutable_truncate on public.auditoria;
create trigger auditoria_inmutable_truncate before truncate on public.auditoria
  for each statement execute function public.auditoria_inmutable();

-- Notificaciones: cada quien ve y marca como leídas SOLO las suyas (solo la columna "leida").
revoke all on public.notificaciones from anon, authenticated;
grant select on public.notificaciones to authenticated;
grant update (leida) on public.notificaciones to authenticated;
drop policy if exists notificaciones_select on public.notificaciones;
create policy notificaciones_select on public.notificaciones
  for select to authenticated
  using (destinatario_id = public.current_usuario_id());
drop policy if exists notificaciones_update on public.notificaciones;
create policy notificaciones_update on public.notificaciones
  for update to authenticated
  using (destinatario_id = public.current_usuario_id())
  with check (destinatario_id = public.current_usuario_id());

-- 3) Helpers ----------------------------------------------------------------------------------
-- Perfil incompleto: los datos que exige el pago PAB (documento + datos bancarios). Debe
-- coincidir con faltantesPerfil() de src/auditoria.js.
create or replace function public.faltantes_perfil(u public.usuarios) returns text[]
language sql stable as $$
  select array_remove(array[
    case when u.tipo_documento is null then 'tipo de documento' end,
    case when coalesce(trim(u.cedula), '') = '' then 'número de documento' end,
    case when coalesce(trim(u.codigo_banco), '') = '' then 'banco' end,
    case when coalesce(trim(u.tipo_cuenta_bancaria), '') = '' then 'tipo de cuenta' end,
    case when coalesce(trim(u.numero_cuenta), '') = '' then 'número de cuenta' end
  ], null)
$$;

create or replace function public.notificar(
  p_destinatario anyelement, p_tipo text, p_mensaje text, p_enlace text, p_auditoria_id bigint
) returns void
language sql security definer set search_path = public as $$
  insert into public.notificaciones (destinatario_id, tipo, mensaje, enlace, auditoria_id)
  values (p_destinatario, p_tipo, p_mensaje, p_enlace, p_auditoria_id)
$$;

-- 4) Trigger genérico: auditoría + notificaciones ---------------------------------------------
create or replace function public.auditar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_fila jsonb := coalesce(v_new, v_old);
  v_antes jsonb;
  v_despues jsonb;
  v_accion text;
  v_modulo text;
  v_usuario_id text := public.current_usuario_id()::text;
  v_usuario_nombre text;
  v_rol text := public.current_rol();
  v_registro text;
  v_auditoria_id bigint;
  v_estado_old text := v_old ->> 'estado';
  v_estado_new text := v_new ->> 'estado';
  v_duenio text;
  v_duenio_nombre text;
  v_mensaje text;
  v_enlace text;
  v_tipo text;
  r record;
begin
  -- Edición: solo los campos que cambiaron (sin marcas de tiempo). Sin cambios reales → nada.
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      into v_antes, v_despues
    from jsonb_object_keys(v_new) k
    where k not in ('updated_at', 'actualizado_at') and (v_old -> k) is distinct from (v_new -> k);
    if v_antes is null then return new; end if;
    v_accion := case when v_estado_old is distinct from v_estado_new then 'Cambio de estado' else 'Edición' end;
  elsif tg_op = 'INSERT' then
    v_accion := 'Creación'; v_despues := jsonb_strip_nulls(v_new);
  else
    v_accion := 'Eliminación'; v_antes := jsonb_strip_nulls(v_old);
  end if;

  v_modulo := case tg_table_name
    when 'solicitudes' then 'Solicitudes'
    when 'cuentas_cobro' then 'Cuentas de Cobro'
    when 'gastos' then 'Finanzas'
    when 'ingresos' then 'Finanzas'
    when 'terceros' then 'Terceros'
    when 'usuarios' then 'Colaboradores'
    when 'empresas' then 'Configuración'
    when 'cecos' then 'Configuración'
    when 'soportes' then 'Soportes'
    when 'config_bancaria_empresa' then 'Datos Bancarios'
    when 'lotes_pago_banco' then 'Pagos PAB'
    else 'Presupuesto'
  end;

  v_registro := left(coalesce(
    nullif(v_fila ->> 'nombre', ''), nullif(v_fila ->> 'detalle', ''), nullif(v_fila ->> 'nombre_original', ''),
    nullif(v_fila ->> 'codigo', ''), case when v_fila ? 'numero' then '#' || (v_fila ->> 'numero') end
  ), 200);
  if v_usuario_id is not null then
    select nombre into v_usuario_nombre from public.usuarios where id::text = v_usuario_id;
  end if;

  insert into public.auditoria (usuario_id, usuario_nombre, rol, modulo, accion, tabla, registro_id, registro, antes, despues)
  values (public.current_usuario_id(), coalesce(v_usuario_nombre, 'Sistema'), v_rol, v_modulo, v_accion,
          tg_table_name, v_fila ->> 'id', v_registro, v_antes, v_despues)
  returning id into v_auditoria_id;

  -- Notificaciones: solo Solicitudes y Cuentas de Cobro, al crear o cambiar de estado. Si algo
  -- falla aquí NO se bloquea la acción del usuario (la auditoría ya quedó escrita).
  begin
  if tg_table_name in ('solicitudes', 'cuentas_cobro') and v_accion in ('Creación', 'Cambio de estado') then
    v_duenio := v_fila ->> 'responsable_id';
    select nombre into v_duenio_nombre from public.usuarios where id::text = v_duenio;
    if tg_table_name = 'solicitudes' then
      v_tipo := 'solicitud'; v_enlace := 'solicitudes';
      v_mensaje := 'Solicitud de ' || coalesce(v_fila ->> 'tipo', '') ||
        coalesce(' — ' || nullif(left(v_fila ->> 'detalle', 80), ''), '');
    else
      v_tipo := 'cuenta_cobro'; v_enlace := 'cuentasCobro';
      v_mensaje := 'Cuenta de cobro' || coalesce(' #' || (v_fila ->> 'numero'), '') ||
        coalesce(' (' || (v_fila ->> 'mes') || '/' || (v_fila ->> 'anio') || ')', '');
    end if;
    v_mensaje := v_mensaje || case when v_accion = 'Creación'
      then ': creada' || coalesce(' por ' || v_usuario_nombre, '')
      else ': ' || coalesce(v_estado_old, '—') || ' → ' || coalesce(v_estado_new, '—') || coalesce(' por ' || v_usuario_nombre, '') end;
    if v_estado_new = 'Devuelto' and v_accion = 'Cambio de estado' then
      v_mensaje := v_mensaje || coalesce('. Motivo: ' || nullif(v_fila ->> 'motivo_devolucion', ''), '');
    end if;

    -- Al dueño, si no fue él quien hizo la acción.
    if v_duenio is not null and v_duenio is distinct from v_usuario_id then
      perform public.notificar((select id from public.usuarios where id::text = v_duenio), v_tipo, 'Tu ' || lower(left(v_mensaje, 1)) || substr(v_mensaje, 2), v_enlace, v_auditoria_id);
    end if;
    -- A Administrador / Coordinadora (menos a quien hizo la acción y al dueño, que ya recibió la suya).
    for r in select id from public.usuarios
             where rol in ('Administrador', 'Coordinadora Administrativa')
               and id::text is distinct from v_usuario_id and id::text is distinct from v_duenio loop
      perform public.notificar(r.id, v_tipo,
        v_mensaje || case when v_duenio is distinct from v_usuario_id then coalesce(' · ' || v_duenio_nombre, '') else '' end, v_enlace, v_auditoria_id);
    end loop;
  end if;

  -- Perfil completado → sus recordatorios pendientes quedan leídos.
  -- (if anidado: plpgsql no garantiza cortocircuito y faltantes_perfil solo acepta usuarios)
  if tg_table_name = 'usuarios' and tg_op = 'UPDATE' then
    if cardinality(public.faltantes_perfil(new)) = 0 then
      update public.notificaciones set leida = true
      where destinatario_id = new.id and tipo = 'perfil' and not leida;
    end if;
  end if;
  exception when others then
    raise warning 'auditar_cambio: no se pudieron generar notificaciones: %', sqlerrm;
  end;

  return coalesce(new, old);
end;
$$;

-- Tablas auditadas (las que no existan en este proyecto se saltan).
do $$
declare t text;
begin
  foreach t in array array[
    'solicitudes', 'cuentas_cobro', 'gastos', 'ingresos', 'terceros', 'usuarios', 'empresas', 'cecos',
    'presupuesto_items', 'presupuesto_anual', 'presupuesto_overrides', 'presupuesto_aprobaciones', 'deducciones',
    'soportes', 'config_bancaria_empresa', 'lotes_pago_banco'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists auditar_cambio on public.%I', t);
      execute format('create trigger auditar_cambio after insert or update or delete on public.%I for each row execute function public.auditar_cambio()', t);
    end if;
  end loop;
end $$;

-- 5) Perfil incompleto (lo corre pg_cron cada lunes) -------------------------------------------
-- Una sola notificación pendiente por persona: si ya tiene una sin leer, se actualiza (fecha y
-- mensaje) en vez de apilar otra.
create or replace function public.notificar_perfiles_incompletos() returns integer
language plpgsql security definer set search_path = public as $$
declare
  u public.usuarios;
  a record;
  v_faltan text[];
  v_nombres text[] := '{}';
  v_mensaje text;
begin
  for u in select * from public.usuarios order by nombre loop
    v_faltan := public.faltantes_perfil(u);
    if cardinality(v_faltan) = 0 then continue; end if;
    v_nombres := v_nombres || u.nombre;
    v_mensaje := 'Completa tu perfil en 🙋 Mi Perfil. Falta: ' || array_to_string(v_faltan, ', ') || '.';
    update public.notificaciones set mensaje = v_mensaje, created_at = now()
    where destinatario_id = u.id and tipo = 'perfil' and not leida;
    if not found then
      perform public.notificar(u.id, 'perfil', v_mensaje, 'mi-perfil', null::bigint);
    end if;
  end loop;

  if cardinality(v_nombres) > 0 then
    v_mensaje := cardinality(v_nombres) || ' colaborador(es) con perfil incompleto: ' || array_to_string(v_nombres, ', ') || '.';
    for a in select id from public.usuarios where rol in ('Administrador', 'Coordinadora Administrativa') loop
      update public.notificaciones set mensaje = v_mensaje, created_at = now()
      where destinatario_id = a.id and tipo = 'perfil_resumen' and not leida;
      if not found then
        perform public.notificar(a.id, 'perfil_resumen', v_mensaje, 'auditoria', null::bigint);
      end if;
    end loop;
  end if;
  return cardinality(v_nombres);
end;
$$;
revoke all on function public.notificar_perfiles_incompletos() from public, anon, authenticated;
revoke all on function public.notificar(anyelement, text, text, text, bigint) from public, anon, authenticated;

-- 6) Tiempo real para la campana ----------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones') then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;

commit;

-- 7) Recordatorio semanal: lunes 8:00 a. m. hora Colombia (13:00 UTC) ---------------------------
create extension if not exists pg_cron;
select cron.schedule('perfil-incompleto-lunes', '0 13 * * 1', 'select public.notificar_perfiles_incompletos()');

-- Primer aviso ya (no esperar al lunes) y verificación: devuelve cuántos perfiles están incompletos.
select public.notificar_perfiles_incompletos() as perfiles_incompletos;
