-- =====================================================================================
-- Historial REAL de deducciones (préstamos, seguridad social, otros descuentos).
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente: se puede
-- correr más de una vez (el backfill solo llena los gastos que aún no tienen historial).
--
-- • public.deduccion_aplicaciones: un registro por cada descuento realmente hecho.
--   - 'Cuota': la crea SOLA un trigger cuando se registra en Finanzas un Gasto con
--     presupuesto_item_id y deduccion_aplicada > 0 (Presupuesto, lotes PAB, Liquidaciones o a mano).
--     Si el gasto se borra (va a la papelera) su cuota desaparece; si se restaura, vuelve.
--   - 'Abono extra' / 'Condonación' / 'Ajuste': las registra Administrador o Coordinadora desde
--     Presupuesto → Deducciones → Historial.
-- • Saldo real del préstamo = saldo_total − suma de sus aplicaciones.
-- • Backfill: reparte la deduccion_aplicada de los gastos ya existentes entre las deducciones del
--   concepto, en orden cronológico. Las retenciones de facturas de terceros (gastos SIN
--   presupuesto_item_id) NO entran.
-- • Leen: Administrador, Coordinadora (incluye Gerente Financiero), Gerente, Contadora.
-- =====================================================================================

begin;

do $$
declare tipo_deduccion text; tipo_gasto text; tipo_usuario text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_deduccion
  from pg_attribute a where a.attrelid = 'public.deducciones'::regclass and a.attname = 'id';
  select format_type(a.atttypid, a.atttypmod) into tipo_gasto
  from pg_attribute a where a.attrelid = 'public.gastos'::regclass and a.attname = 'id';
  select format_type(a.atttypid, a.atttypmod) into tipo_usuario
  from pg_attribute a where a.attrelid = 'public.usuarios'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.deduccion_aplicaciones (
      id uuid primary key default gen_random_uuid(),
      deduccion_id %1$s not null references public.deducciones(id) on delete cascade,
      anio smallint not null,
      mes smallint not null check (mes between 1 and 12),
      valor numeric(18, 2) not null check (valor > 0),
      tipo text not null default 'Cuota' check (tipo in ('Cuota', 'Abono extra', 'Condonación', 'Ajuste')),
      gasto_id %2$s references public.gastos(id) on delete cascade,
      fecha date not null default current_date,
      observaciones text,
      creado_por %3$s,
      created_at timestamptz not null default now()
    )$f$, tipo_deduccion, tipo_gasto, tipo_usuario);
end $$;

create index if not exists deduccion_aplicaciones_ded_idx on public.deduccion_aplicaciones (deduccion_id, anio, mes);
create index if not exists deduccion_aplicaciones_gasto_idx on public.deduccion_aplicaciones (gasto_id);

-- Reparte la deducción de UN gasto entre las deducciones de su concepto ------------------------------
-- Orden: fecha_inicio, id. Cada una toma lo que le falta ese mes (préstamo: sin pasar del saldo real);
-- si sobra, lo toma la primera que aún tenga capacidad (préstamo con saldo, o recurrente).
create or replace function public.aplicar_deduccion_gasto(p_gasto_id text, p_incluir_inactivas boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  g record;
  d record;
  v_anio int; v_mes int; v_fin_mes date;
  v_restante numeric; v_toma numeric; v_cap numeric; v_ya_mes numeric; v_ya_total numeric;
begin
  delete from public.deduccion_aplicaciones where gasto_id::text = p_gasto_id;

  select id, fecha, tipo, presupuesto_item_id, deduccion_aplicada into g
  from public.gastos where id::text = p_gasto_id;
  if not found or g.tipo is distinct from 'Gasto' or g.presupuesto_item_id is null
     or coalesce(g.deduccion_aplicada, 0) <= 0 or g.fecha is null then
    return;
  end if;

  v_anio := extract(year from g.fecha);
  v_mes := extract(month from g.fecha);
  v_fin_mes := (date_trunc('month', g.fecha) + interval '1 month - 1 day')::date;
  v_restante := round(g.deduccion_aplicada::numeric, 2);

  -- Pasada 1: la cuota del mes de cada deducción.
  for d in
    select id, tipo, valor_cuota, saldo_total from public.deducciones
    where presupuesto_item_id::text = g.presupuesto_item_id::text
      and (p_incluir_inactivas or activo is not false)
      and (fecha_inicio is null or fecha_inicio <= v_fin_mes)
    order by fecha_inicio nulls first, id::text
  loop
    exit when v_restante <= 0;
    select coalesce(sum(valor) filter (where anio = v_anio and mes = v_mes and tipo = 'Cuota'), 0),
           coalesce(sum(valor), 0)
      into v_ya_mes, v_ya_total
      from public.deduccion_aplicaciones where deduccion_id = d.id;
    v_cap := greatest(coalesce(d.valor_cuota, 0) - v_ya_mes, 0);
    if d.tipo = 'Préstamo' then
      v_cap := least(v_cap, greatest(coalesce(d.saldo_total, 0) - v_ya_total, 0));
    end if;
    v_toma := least(v_cap, v_restante);
    if v_toma > 0 then
      insert into public.deduccion_aplicaciones (deduccion_id, anio, mes, valor, tipo, gasto_id, fecha)
      values (d.id, v_anio, v_mes, v_toma, 'Cuota', g.id, g.fecha);
      v_restante := v_restante - v_toma;
    end if;
  end loop;

  -- Pasada 2: lo que sobre (se descontó más que la cuota) va a la primera con capacidad.
  if v_restante > 0 then
    for d in
      select id, tipo, saldo_total from public.deducciones
      where presupuesto_item_id::text = g.presupuesto_item_id::text
        and (p_incluir_inactivas or activo is not false)
        and (fecha_inicio is null or fecha_inicio <= v_fin_mes)
      order by fecha_inicio nulls first, id::text
    loop
      exit when v_restante <= 0;
      if d.tipo = 'Préstamo' then
        select greatest(coalesce(d.saldo_total, 0) - coalesce(sum(valor), 0), 0) into v_cap
          from public.deduccion_aplicaciones where deduccion_id = d.id;
      else
        v_cap := v_restante;
      end if;
      v_toma := least(v_cap, v_restante);
      if v_toma > 0 then
        insert into public.deduccion_aplicaciones (deduccion_id, anio, mes, valor, tipo, gasto_id, fecha, observaciones)
        values (d.id, v_anio, v_mes, v_toma, 'Cuota', g.id, g.fecha, 'Descontado de más ese mes');
        v_restante := v_restante - v_toma;
      end if;
    end loop;
  end if;
end;
$$;
revoke all on function public.aplicar_deduccion_gasto(text, boolean) from public, anon, authenticated;

-- Trigger en gastos: nunca bloquea el registro del gasto (si algo falla, solo avisa).
create or replace function public.gastos_deduccion_aplicaciones() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.deduccion_aplicada is not distinct from old.deduccion_aplicada
     and new.presupuesto_item_id is not distinct from old.presupuesto_item_id
     and new.fecha is not distinct from old.fecha
     and new.tipo is not distinct from old.tipo then
    return new;
  end if;
  begin
    perform public.aplicar_deduccion_gasto(new.id::text);
  exception when others then
    raise warning 'gastos_deduccion_aplicaciones: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists gastos_deduccion_aplicaciones on public.gastos;
create trigger gastos_deduccion_aplicaciones after insert or update on public.gastos
  for each row execute function public.gastos_deduccion_aplicaciones();

-- Backfill: gastos existentes con deducción y concepto de presupuesto, del más antiguo al más nuevo.
do $$
declare r record; n int := 0;
begin
  for r in
    select g.id from public.gastos g
    where g.tipo = 'Gasto' and g.presupuesto_item_id is not null and coalesce(g.deduccion_aplicada, 0) > 0
      and not exists (select 1 from public.deduccion_aplicaciones a where a.gasto_id::text = g.id::text)
    order by g.fecha, g.created_at, g.id::text
  loop
    perform public.aplicar_deduccion_gasto(r.id::text, true);
    n := n + 1;
  end loop;
  raise notice 'Backfill deducciones: % gastos procesados', n;
end $$;

-- Permisos ------------------------------------------------------------------------------------
alter table public.deduccion_aplicaciones enable row level security;
grant select, insert, update, delete on public.deduccion_aplicaciones to authenticated;

drop policy if exists deduccion_aplicaciones_select on public.deduccion_aplicaciones;
create policy deduccion_aplicaciones_select on public.deduccion_aplicaciones for select to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente', 'Contadora'));
-- Las manuales (abono / condonación / ajuste) las gestiona Admin o Coordinadora; las cuotas solo el trigger.
drop policy if exists deduccion_aplicaciones_escribir on public.deduccion_aplicaciones;
create policy deduccion_aplicaciones_escribir on public.deduccion_aplicaciones for all to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa') and tipo <> 'Cuota')
  with check (public.current_rol() in ('Administrador', 'Coordinadora Administrativa') and tipo <> 'Cuota');

do $$
begin
  if to_regprocedure('public.auditar_cambio()') is not null then
    execute 'drop trigger if exists auditar_cambio on public.deduccion_aplicaciones';
    execute 'create trigger auditar_cambio after insert or update or delete on public.deduccion_aplicaciones for each row execute function public.auditar_cambio()';
  end if;
end $$;

-- Tiempo real (la app recarga el historial al instante).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deduccion_aplicaciones') then
    alter publication supabase_realtime add table public.deduccion_aplicaciones;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

-- Verificación (solo lectura): cuotas reconstruidas por tipo de deducción.
select d.tipo, count(*) as aplicaciones, sum(a.valor) as total_descontado
from public.deduccion_aplicaciones a join public.deducciones d on d.id = a.deduccion_id
group by d.tipo order by d.tipo;
