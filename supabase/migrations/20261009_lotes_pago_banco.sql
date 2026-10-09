-- =====================================================================================
-- Lotes de pago masivo PAB (Bancolombia) — PR 3 de 3 (exportador)
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR.
-- Es idempotente: se puede correr más de una vez. No toca datos existentes.
--
-- Cada archivo exportado = un lote (cuenta origen + tipo de pago). Cada pago del archivo queda
-- como ítem del lote con una "clave" del registro de la app. Un índice único sobre las claves de
-- ítems ACTIVOS impide que un mismo registro quede en dos lotes vigentes (pago duplicado), aunque
-- dos personas exporten al mismo tiempo. Anular un lote libera sus registros.
-- =====================================================================================

begin;

do $$
declare tipo_empresa text; tipo_usuario text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_empresa
  from pg_attribute a where a.attrelid = 'public.empresas'::regclass and a.attname = 'id';
  select format_type(a.atttypid, a.atttypmod) into tipo_usuario
  from pg_attribute a where a.attrelid = 'public.usuarios'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.lotes_pago_banco (
      id uuid primary key default gen_random_uuid(),
      numero bigint generated always as identity unique,
      empresa_id %1$s not null references public.empresas(id),
      config_bancaria_id uuid not null references public.config_bancaria_empresa(id),
      tipo_pago smallint not null check (tipo_pago in (220, 225, 238, 239, 240, 250, 320, 325, 820, 920)),
      secuencia text not null check (secuencia ~ '^[A-Z][1-9]$'),
      fecha_aplicacion date not null,
      cantidad integer not null check (cantidad > 0),
      total numeric(18, 2) not null check (total > 0),
      encabezado jsonb not null,
      estado text not null default 'Generado' check (estado in ('Generado', 'Pagado', 'Anulado')),
      creado_por %2$s,
      created_at timestamptz not null default now(),
      cerrado_por %2$s,
      cerrado_at timestamptz,
      motivo_anulacion text
    )$f$, tipo_empresa, tipo_usuario);
end $$;

create table if not exists public.lotes_pago_banco_items (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes_pago_banco(id) on delete cascade,
  orden integer not null,                                         -- fila del archivo (1 = fila 4)
  entidad_clave text not null,                                    -- 'solicitud:<id>' | 'presupuesto:<id>:<año>-<mes>'
  entidad_tipo text not null check (entidad_tipo in ('solicitud', 'presupuesto')),
  entidad_id text not null,
  anio smallint,
  mes smallint,
  valor numeric(18, 2) not null check (valor > 0),
  datos jsonb not null,                                           -- la fila tal cual se escribió en el Excel
  activo boolean not null default true
);

create unique index if not exists lotes_pago_banco_items_activo_uq
  on public.lotes_pago_banco_items (entidad_clave) where activo;
create index if not exists lotes_pago_banco_items_lote_idx on public.lotes_pago_banco_items (lote_id);

alter table public.lotes_pago_banco enable row level security;
alter table public.lotes_pago_banco_items enable row level security;

-- Permisos de tabla: solo lectura e inserción directas; anular / marcar pagado van por las
-- funciones de abajo (que validan el rol).
grant select, insert on public.lotes_pago_banco to authenticated;
grant select, insert on public.lotes_pago_banco_items to authenticated;

drop policy if exists lotes_pago_banco_select on public.lotes_pago_banco;
create policy lotes_pago_banco_select on public.lotes_pago_banco
  for select to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Contadora'));

drop policy if exists lotes_pago_banco_insert on public.lotes_pago_banco;
create policy lotes_pago_banco_insert on public.lotes_pago_banco
  for insert to authenticated
  with check (public.current_rol() in ('Administrador', 'Coordinadora Administrativa') and creado_por = public.current_usuario_id());

drop policy if exists lotes_pago_banco_items_select on public.lotes_pago_banco_items;
create policy lotes_pago_banco_items_select on public.lotes_pago_banco_items
  for select to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Contadora'));

drop policy if exists lotes_pago_banco_items_insert on public.lotes_pago_banco_items;
create policy lotes_pago_banco_items_insert on public.lotes_pago_banco_items
  for insert to authenticated
  with check (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));

-- Crea un lote con sus ítems en UNA transacción. Calcula la secuencia de envío (A1, A2… por
-- cuenta y fecha de aplicación) y falla si algún registro ya está en otro lote activo.
create or replace function public.crear_lote_pago_banco(
  p_config_id uuid, p_tipo_pago integer, p_fecha date, p_encabezado jsonb, p_items jsonb
) returns table (lote_id uuid, numero bigint, secuencia text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_n integer;
  v_secuencia text;
  v_lote public.lotes_pago_banco%rowtype;
begin
  if public.current_rol() not in ('Administrador', 'Coordinadora Administrativa') then
    raise exception 'Solo Administrador o Coordinadora Administrativa pueden generar lotes de pago';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El lote no tiene pagos';
  end if;

  -- Serializa la generación por cuenta + fecha para no repetir secuencia.
  perform pg_advisory_xact_lock(hashtext(p_config_id::text || p_fecha::text));
  select count(*) into v_n from public.lotes_pago_banco l
   where l.config_bancaria_id = p_config_id and l.fecha_aplicacion = p_fecha;
  if v_n >= 234 then raise exception 'Se alcanzó el máximo de envíos del día para esta cuenta'; end if;
  v_secuencia := chr(65 + v_n / 9) || ((v_n % 9) + 1)::text;

  insert into public.lotes_pago_banco
    (empresa_id, config_bancaria_id, tipo_pago, secuencia, fecha_aplicacion, cantidad, total, encabezado, creado_por)
  select c.empresa_id, p_config_id, p_tipo_pago, v_secuencia, p_fecha,
         jsonb_array_length(p_items),
         (select sum((x->>'valor')::numeric) from jsonb_array_elements(p_items) x),
         p_encabezado || jsonb_build_object('secuencia', v_secuencia),
         public.current_usuario_id()
  from public.config_bancaria_empresa c
  where c.id = p_config_id and c.activo
  returning * into v_lote;

  if v_lote.id is null then raise exception 'La cuenta origen no existe o está inactiva'; end if;

  begin
    insert into public.lotes_pago_banco_items (lote_id, orden, entidad_clave, entidad_tipo, entidad_id, anio, mes, valor, datos)
    select v_lote.id, (x->>'orden')::int, x->>'entidad_clave', x->>'entidad_tipo', x->>'entidad_id',
           nullif(x->>'anio', '')::smallint, nullif(x->>'mes', '')::smallint, (x->>'valor')::numeric, x->'datos'
    from jsonb_array_elements(p_items) x;
  exception when unique_violation then
    raise exception 'Uno o más pagos ya están en otro lote vigente. Recarga la pantalla: no se generó nada.';
  end;

  return query select v_lote.id, v_lote.numero, v_lote.secuencia;
end;
$$;

-- Marcar pagado (Administrador o Coordinadora) o anular (solo Administrador). Anular libera los
-- registros para volver a exportarlos.
create or replace function public.cerrar_lote_pago_banco(p_lote_id uuid, p_estado text, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_estado text;
begin
  select estado into v_estado from public.lotes_pago_banco where id = p_lote_id for update;
  if v_estado is null then raise exception 'Lote no encontrado'; end if;
  if v_estado <> 'Generado' then raise exception 'El lote ya está %', v_estado; end if;

  if p_estado = 'Pagado' then
    if public.current_rol() not in ('Administrador', 'Coordinadora Administrativa') then
      raise exception 'Sin permiso para marcar lotes como pagados';
    end if;
    update public.lotes_pago_banco
       set estado = 'Pagado', cerrado_por = public.current_usuario_id(), cerrado_at = now()
     where id = p_lote_id;
  elsif p_estado = 'Anulado' then
    if public.current_rol() <> 'Administrador' then
      raise exception 'Solo el Administrador puede anular lotes';
    end if;
    if coalesce(trim(p_motivo), '') = '' then raise exception 'Indica el motivo de la anulación'; end if;
    update public.lotes_pago_banco
       set estado = 'Anulado', cerrado_por = public.current_usuario_id(), cerrado_at = now(), motivo_anulacion = trim(p_motivo)
     where id = p_lote_id;
    update public.lotes_pago_banco_items set activo = false where lote_id = p_lote_id;
  else
    raise exception 'Estado no válido: %', p_estado;
  end if;
end;
$$;

revoke all on function public.crear_lote_pago_banco(uuid, integer, date, jsonb, jsonb) from public;
grant execute on function public.crear_lote_pago_banco(uuid, integer, date, jsonb, jsonb) to authenticated;
revoke all on function public.cerrar_lote_pago_banco(uuid, text, text) from public;
grant execute on function public.cerrar_lote_pago_banco(uuid, text, text) to authenticated;

commit;

-- Verificación (solo lectura): deben salir las 2 tablas con RLS activo.
select relname as tabla, relrowsecurity as rls_activo
from pg_class
where oid in ('public.lotes_pago_banco'::regclass, 'public.lotes_pago_banco_items'::regclass);
