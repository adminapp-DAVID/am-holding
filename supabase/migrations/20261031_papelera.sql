-- =====================================================================================
-- Papelera: lo eliminado en Finanzas (gastos, ingresos, traslados, pagos a tercero),
-- Solicitudes y Cuentas de cobro se puede RESTAURAR durante 90 días
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Requiere 20261025_rol_gerente_financiero.sql (current_rol_base).
--
-- • Antes de borrar un registro, un trigger guarda una copia completa en public.papelera: sus
--   datos, la lista de sus soportes, quién lo eliminó y cuándo. Los soportes (filas y archivos)
--   ya NO se borran al eliminar: se conservan para poder restaurar.
-- • restaurar_papelera(id): vuelve a crear el registro tal cual, con sus soportes. Si venía de
--   una solicitud, la solicitud vuelve al estado que tenía; una solicitud restaurada vuelve a
--   tomar los recibos de la bandeja que tenía (si siguen libres).
-- • eliminar_definitivo_papelera(id): borra sus soportes y devuelve los archivos que ya no usa
--   nadie para que la app los borre de Storage. La app lo hace sola con lo que lleve más de 90
--   días en la papelera.
-- • Solo Administrador, Coordinadora Administrativa y Gerente Financiero ven la papelera.
-- =====================================================================================

begin;

create table if not exists public.papelera (
  id bigint generated always as identity primary key,
  tabla text not null,                 -- gastos | ingresos | solicitudes | cuentas_cobro
  entidad_tipo text not null,          -- gasto | ingreso | solicitud | cuenta_cobro (como en soportes)
  registro_id text not null,
  datos jsonb not null,                -- la fila completa
  soportes jsonb not null default '[]'::jsonb,
  extra jsonb not null default '{}'::jsonb,  -- estado de la solicitud de origen, recibos de la bandeja…
  descripcion text,
  fecha date,
  valor numeric,
  empresa text,
  responsable text,
  eliminado_at timestamptz not null default now(),
  eliminado_por text,
  eliminado_por_nombre text,
  eliminado_rol text,
  estado text not null default 'En papelera' check (estado in ('En papelera', 'Restaurado', 'Eliminado')),
  resuelto_at timestamptz,
  resuelto_por_nombre text
);
create index if not exists papelera_estado_idx on public.papelera (estado, eliminado_at desc);

alter table public.papelera enable row level security;
revoke all on public.papelera from anon, authenticated;
grant select on public.papelera to authenticated;
drop policy if exists papelera_select on public.papelera;
create policy papelera_select on public.papelera for select to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));

-- 1) Guardar en la papelera antes de borrar ------------------------------------------------------
-- (El nombre empieza por "a_" para correr ANTES que devolver_recibos_a_bandeja y así alcanzar a
-- anotar qué recibos de la bandeja tenía la solicitud.)
create or replace function public.a_papelera_guardar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tipo text := case tg_table_name when 'gastos' then 'gasto' when 'ingresos' then 'ingreso'
                   when 'solicitudes' then 'solicitud' else 'cuenta_cobro' end;
  v_fila jsonb := to_jsonb(old);
  v_soportes jsonb;
  v_extra jsonb := '{}'::jsonb;
  v_empresa text;
  v_responsable text;
  v_nombre text;
  v_desc text;
  v_valor numeric;
begin
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_soportes
  from public.soportes s where s.entidad_tipo = v_tipo and s.entidad_id::text = old.id::text;

  if v_fila ? 'empresa_id' then
    select nombre into v_empresa from public.empresas where id::text = v_fila ->> 'empresa_id';
  end if;
  if v_fila ? 'responsable_id' then
    select nombre into v_responsable from public.usuarios where id::text = v_fila ->> 'responsable_id';
  end if;
  select nombre into v_nombre from public.usuarios where id::text = public.current_usuario_id()::text;

  if tg_table_name in ('gastos', 'ingresos') then
    v_desc := coalesce(v_fila ->> 'tipo', initcap(v_tipo)) || coalesce(' — ' || nullif(v_fila ->> 'detalle', ''), '');
    v_valor := (v_fila ->> 'valor')::numeric;
    if nullif(v_fila ->> 'solicitud_origen_id', '') is not null then
      select jsonb_build_object('solicitud_id', s.id::text, 'solicitud_estado', s.estado, 'lote_pago_id', s.lote_pago_id)
        into v_extra from public.solicitudes s where s.id::text = v_fila ->> 'solicitud_origen_id';
      v_extra := coalesce(v_extra, '{}'::jsonb);
    end if;
  elsif tg_table_name = 'solicitudes' then
    v_desc := coalesce(v_fila ->> 'tipo', 'Solicitud') || coalesce(' — ' || nullif(v_fila ->> 'detalle', ''), '');
    v_valor := coalesce(nullif((v_fila ->> 'total_calculado')::numeric, 0), (v_fila ->> 'valor')::numeric);
    select jsonb_build_object('recibos', coalesce(jsonb_agg(p.id::text), '[]'::jsonb)) into v_extra
    from public.soportes_pendientes p where p.solicitud_id::text = old.id::text;
  else
    v_desc := 'Cuenta de cobro' || coalesce(' N° ' || (v_fila ->> 'numero'), '') ||
              coalesce(' (' || (v_fila ->> 'mes') || '/' || (v_fila ->> 'anio') || ')', '');
    v_valor := (v_fila ->> 'monto')::numeric;
  end if;

  insert into public.papelera (tabla, entidad_tipo, registro_id, datos, soportes, extra, descripcion, fecha, valor,
                               empresa, responsable, eliminado_por, eliminado_por_nombre, eliminado_rol)
  values (tg_table_name, v_tipo, old.id::text, v_fila, v_soportes, v_extra, left(v_desc, 300),
          (v_fila ->> 'fecha')::date, v_valor, v_empresa, v_responsable,
          public.current_usuario_id()::text, coalesce(v_nombre, 'Sistema'), public.current_rol_base());
  return old;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['gastos', 'ingresos', 'solicitudes', 'cuentas_cobro'] loop
    execute format('drop trigger if exists a_papelera_guardar on public.%I', t);
    execute format('create trigger a_papelera_guardar before delete on public.%I for each row execute function public.a_papelera_guardar()', t);
  end loop;
end $$;

-- 2) Cuentas de cobro: la función de eliminar ya no borra los soportes (quedan para restaurar) --
create or replace function public.eliminar_cuenta_cobro(p_id text)
returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_responsable text;
  v_estado text;
begin
  select responsable_id::text, estado into v_responsable, v_estado
  from public.cuentas_cobro where id::text = p_id for update;
  if not found then raise exception 'La cuenta de cobro ya no existe'; end if;

  if public.current_rol() not in ('Administrador', 'Coordinadora Administrativa') then
    if v_responsable is distinct from public.current_usuario_id()::text then
      raise exception 'Solo puedes eliminar tus propias cuentas de cobro';
    end if;
    if v_estado <> 'Pendiente' then
      raise exception 'Solo se puede eliminar mientras está Pendiente (está %)', v_estado;
    end if;
  end if;

  delete from public.cuentas_cobro where id::text = p_id;  -- pasa a la papelera (trigger)
  return '{}'::text[];
end;
$$;
revoke all on function public.eliminar_cuenta_cobro(text) from public;
grant execute on function public.eliminar_cuenta_cobro(text) to authenticated;

-- 3) Restaurar ------------------------------------------------------------------------------------
create or replace function public.restaurar_papelera(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  p public.papelera;
  v_existe boolean;
  v_nombre text;
  v_sol text;
begin
  if public.current_rol() not in ('Administrador', 'Coordinadora Administrativa') then
    raise exception 'Solo Administración puede restaurar desde la papelera';
  end if;
  select * into p from public.papelera where id = p_id for update;
  if not found then raise exception 'Ese registro ya no está en la papelera'; end if;
  if p.estado <> 'En papelera' then raise exception 'Ese registro ya fue %', lower(p.estado); end if;

  execute format('select exists (select 1 from public.%I where id::text = $1)', p.tabla) into v_existe using p.registro_id;
  if v_existe then raise exception 'Ya existe un registro con ese id en %', p.tabla; end if;

  execute format('insert into public.%1$I overriding system value select * from jsonb_populate_record(null::public.%1$I, $1)', p.tabla)
    using p.datos;

  -- Soportes: vuelven las filas que falten (normalmente siguen ahí).
  insert into public.soportes (bucket_path, nombre_original, tamano_kb, entidad_tipo, entidad_id, subido_por)
  select x.bucket_path, x.nombre_original, x.tamano_kb, x.entidad_tipo, x.entidad_id, x.subido_por
  from jsonb_populate_recordset(null::public.soportes, p.soportes) x
  where not exists (select 1 from public.soportes s
                    where s.entidad_tipo = x.entidad_tipo and s.entidad_id::text = x.entidad_id::text and s.bucket_path = x.bucket_path);

  -- Gasto / ingreso generado por una solicitud: la solicitud vuelve a su estado (si sigue libre).
  v_sol := p.extra ->> 'solicitud_id';
  if v_sol is not null and p.tabla in ('gastos', 'ingresos') then
    -- (los valores pasan por jsonb_populate_record para tomar el tipo real de cada columna)
    execute format('update public.solicitudes s set estado = $1, %1$I = (select id from public.%2$I where id::text = $2), '
                   'lote_pago_id = (jsonb_populate_record(null::public.solicitudes, $3)).lote_pago_id '
                   'where s.id::text = $4 and s.%1$I is null',
                   case when p.tabla = 'gastos' then 'gasto_generado_id' else 'ingreso_generado_id' end, p.tabla)
      using p.extra ->> 'solicitud_estado', p.registro_id, jsonb_build_object('lote_pago_id', p.extra -> 'lote_pago_id'), v_sol;
  end if;

  -- Solicitud: vuelve a tomar los recibos de la bandeja que tenía (si nadie los usó).
  if p.tabla = 'solicitudes' and jsonb_array_length(coalesce(p.extra -> 'recibos', '[]'::jsonb)) > 0 then
    update public.soportes_pendientes set usado = true, solicitud_id = (select id from public.solicitudes where id::text = p.registro_id)
    where id::text in (select jsonb_array_elements_text(p.extra -> 'recibos')) and not usado;
  end if;

  select nombre into v_nombre from public.usuarios where id::text = public.current_usuario_id()::text;
  update public.papelera set estado = 'Restaurado', resuelto_at = now(), resuelto_por_nombre = coalesce(v_nombre, 'Sistema')
  where id = p_id;
  return p.descripcion;
end;
$$;

-- 4) Eliminar definitivamente ---------------------------------------------------------------------
-- Devuelve los archivos de Storage que ya no usa ninguna otra entidad (la app los borra).
create or replace function public.eliminar_definitivo_papelera(p_id bigint) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  p public.papelera;
  v_rutas text[];
  v_nombre text;
begin
  if public.current_rol() not in ('Administrador', 'Coordinadora Administrativa') then
    raise exception 'Solo Administración puede eliminar definitivamente';
  end if;
  select * into p from public.papelera where id = p_id for update;
  if not found or p.estado <> 'En papelera' then return '{}'::text[]; end if;


  select coalesce(array_agg(distinct s.bucket_path), '{}') into v_rutas
  from public.soportes s
  where s.entidad_tipo = p.entidad_tipo and s.entidad_id::text = p.registro_id
    and not exists (select 1 from public.soportes o
                    where o.bucket_path = s.bucket_path
                      and not (o.entidad_tipo = p.entidad_tipo and o.entidad_id::text = p.registro_id));
  delete from public.soportes where entidad_tipo = p.entidad_tipo and entidad_id::text = p.registro_id;

  select nombre into v_nombre from public.usuarios where id::text = public.current_usuario_id()::text;
  update public.papelera set estado = 'Eliminado', resuelto_at = now(), resuelto_por_nombre = coalesce(v_nombre, 'Sistema')
  where id = p_id;
  return v_rutas;
end;
$$;

revoke all on function public.a_papelera_guardar() from public, anon, authenticated;
revoke all on function public.restaurar_papelera(bigint) from public, anon;
revoke all on function public.eliminar_definitivo_papelera(bigint) from public, anon;
grant execute on function public.restaurar_papelera(bigint) to authenticated;
grant execute on function public.eliminar_definitivo_papelera(bigint) to authenticated;

commit;

-- Verificación (solo lectura): los 4 triggers y las funciones.
select event_object_table as tabla, trigger_name from information_schema.triggers
where trigger_name = 'a_papelera_guardar' order by 1;
