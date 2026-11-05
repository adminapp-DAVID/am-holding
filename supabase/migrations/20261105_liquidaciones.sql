-- =====================================================================================
-- Liquidaciones por colaborador: reembolsos, legalizaciones, anticipos, comisiones y honorarios /
-- nómina del mes, menos préstamos y descuentos = NETO A PAGAR, con estados y soportes.
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente: se puede
-- correr más de una vez y no toca datos existentes.
--
-- • Una liquidación = un colaborador + la empresa que paga + un mes.
-- • Estados: Borrador → En revisión → Aprobada → Pagada (o Anulada).
-- • Cada concepto queda como ítem con una "clave" del registro de la app (la misma de los lotes PAB:
--   'solicitud:<id>', 'presupuesto:<id>:<año>-<mes>', 'ajuste:<uuid>'). Un índice único sobre las
--   claves de ítems ACTIVOS impide que un mismo registro quede en dos liquidaciones vigentes.
--   Anular una liquidación libera sus ítems (trigger).
-- • Gestionan Administrador y Coordinadora (incluye Gerente Financiero). Gerente y Contadora leen.
--   El colaborador ve las suyas desde "En revisión" (no los borradores).
-- • Al pagarla, la app registra en Finanzas un movimiento por concepto con la lógica de siempre.
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
    create table if not exists public.liquidaciones (
      id uuid primary key default gen_random_uuid(),
      numero bigint generated always as identity unique,
      responsable_id %2$s not null references public.usuarios(id),
      empresa_id %1$s not null references public.empresas(id),
      anio smallint not null,
      mes smallint not null check (mes between 1 and 12),
      estado text not null default 'Borrador' check (estado in ('Borrador', 'En revisión', 'Aprobada', 'Pagada', 'Anulada')),
      total_a_favor numeric(18, 2) not null default 0,
      total_descuentos numeric(18, 2) not null default 0,
      neto numeric(18, 2) not null default 0,
      observaciones text,
      cuenta text,
      fecha_pago date,
      comprobante_path text,
      motivo_anulacion text,
      creado_por %2$s,
      created_at timestamptz not null default now(),
      aprobado_por %2$s,
      aprobado_at timestamptz,
      pagado_por %2$s,
      pagado_at timestamptz,
      updated_at timestamptz not null default now()
    )$f$, tipo_empresa, tipo_usuario);
end $$;

create table if not exists public.liquidacion_items (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null references public.liquidaciones(id) on delete cascade,
  orden integer not null default 0,
  entidad_clave text not null,                 -- 'solicitud:<id>' | 'presupuesto:<id>:<año>-<mes>' | 'ajuste:<uuid>'
  entidad_tipo text not null check (entidad_tipo in ('solicitud', 'presupuesto', 'ajuste')),
  entidad_id text,
  concepto text not null,
  signo smallint not null check (signo in (1, -1)),   -- 1 = a favor del colaborador, -1 = descuento
  valor numeric(18, 2) not null check (valor >= 0),    -- neto del concepto (presupuesto: bruto − deducciones)
  valor_bruto numeric(18, 2),                          -- presupuesto: valor del mes antes de deducciones
  deducciones numeric(18, 2),                          -- presupuesto: préstamos / descuentos del mes
  ceco text,
  datos jsonb not null default '{}'::jsonb,            -- detalle (tipo de solicitud, cuotas de préstamo, anio/mes…)
  activo boolean not null default true,
  pagado boolean not null default false,               -- ya quedó registrado en Finanzas
  error text                                           -- último error al pagarlo (si hubo)
);

create unique index if not exists liquidacion_items_activo_uq on public.liquidacion_items (entidad_clave) where activo;
create index if not exists liquidacion_items_liq_idx on public.liquidacion_items (liquidacion_id);
create index if not exists liquidaciones_responsable_idx on public.liquidaciones (responsable_id, anio, mes);

-- Anular libera los ítems (pueden entrar en otra liquidación); reactivar no se permite.
create or replace function public.liquidacion_estado_items() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'Anulada' and old.estado <> 'Anulada' then
    update public.liquidacion_items set activo = false where liquidacion_id = new.id and not pagado;
  elsif old.estado = 'Anulada' and new.estado <> 'Anulada' then
    raise exception 'Una liquidación anulada no se puede reactivar: crea una nueva.';
  elsif old.estado = 'Pagada' and new.estado <> 'Pagada' then
    raise exception 'Una liquidación pagada no cambia de estado.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists liquidacion_estado_items on public.liquidaciones;
create trigger liquidacion_estado_items before update on public.liquidaciones
  for each row execute function public.liquidacion_estado_items();

-- Permisos ------------------------------------------------------------------------------------
alter table public.liquidaciones enable row level security;
alter table public.liquidacion_items enable row level security;
grant select, insert, update on public.liquidaciones to authenticated;
grant select, insert, update, delete on public.liquidacion_items to authenticated;

drop policy if exists liquidaciones_select on public.liquidaciones;
create policy liquidaciones_select on public.liquidaciones for select to authenticated
  using (
    public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente', 'Contadora')
    or (responsable_id::text = public.current_usuario_id()::text and estado <> 'Borrador')
  );
drop policy if exists liquidaciones_insert on public.liquidaciones;
create policy liquidaciones_insert on public.liquidaciones for insert to authenticated
  with check (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));
drop policy if exists liquidaciones_update on public.liquidaciones;
create policy liquidaciones_update on public.liquidaciones for update to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'))
  with check (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));

drop policy if exists liquidacion_items_select on public.liquidacion_items;
create policy liquidacion_items_select on public.liquidacion_items for select to authenticated
  using (exists (select 1 from public.liquidaciones l where l.id = liquidacion_id));
drop policy if exists liquidacion_items_escribir on public.liquidacion_items;
create policy liquidacion_items_escribir on public.liquidacion_items for all to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'))
  with check (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));

-- Auditoría (misma función que el resto de tablas) -----------------------------------------------
do $$
begin
  if to_regprocedure('public.auditar_cambio()') is not null then
    execute 'drop trigger if exists auditar_cambio on public.liquidaciones';
    execute 'create trigger auditar_cambio after insert or update or delete on public.liquidaciones for each row execute function public.auditar_cambio()';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

-- Verificación (solo lectura): deben salir las 2 tablas.
select table_name from information_schema.tables where table_schema = 'public' and table_name in ('liquidaciones', 'liquidacion_items');
