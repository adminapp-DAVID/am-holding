-- =====================================================================================
-- Aprobación mensual de conceptos de Presupuesto (para el exportador PAB) — PR 2 de 3
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR.
-- Es idempotente: se puede correr más de una vez sin duplicar nada. No toca datos existentes.
-- =====================================================================================

begin;

-- presupuesto_item_id / aprobado_por se crean con el mismo tipo que presupuesto_items.id /
-- usuarios.id (sea uuid o entero).
do $$
declare tipo_item text; tipo_usuario text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_item
  from pg_attribute a
  where a.attrelid = 'public.presupuesto_items'::regclass and a.attname = 'id';
  select format_type(a.atttypid, a.atttypmod) into tipo_usuario
  from pg_attribute a
  where a.attrelid = 'public.usuarios'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.presupuesto_aprobaciones (
      id uuid primary key default gen_random_uuid(),
      presupuesto_item_id %s not null references public.presupuesto_items(id) on delete cascade,
      anio smallint not null check (anio between 2000 and 2100),
      mes smallint not null check (mes between 1 and 12),
      valor_neto numeric(18, 2) not null check (valor_neto > 0),   -- neto a pagar aprobado
      aprobado_por %s,
      aprobado_at timestamptz not null default now(),
      unique (presupuesto_item_id, anio, mes)
    )$f$, tipo_item, tipo_usuario);
end $$;

alter table public.presupuesto_aprobaciones enable row level security;

-- Permiso de tabla para los usuarios de la app; quién puede qué lo deciden las políticas.
grant select, insert, update, delete on public.presupuesto_aprobaciones to authenticated;

-- Ver: los mismos roles que ven Presupuesto.
drop policy if exists presupuesto_aprobaciones_select on public.presupuesto_aprobaciones;
create policy presupuesto_aprobaciones_select on public.presupuesto_aprobaciones
  for select to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente', 'Contadora'));

-- Aprobar / reaprobar / quitar: solo Administrador y Coordinadora Administrativa, y siempre a
-- nombre propio (no se puede registrar una aprobación como si la hubiera hecho otra persona).
drop policy if exists presupuesto_aprobaciones_escribir on public.presupuesto_aprobaciones;
create policy presupuesto_aprobaciones_escribir on public.presupuesto_aprobaciones
  for all to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'))
  with check (
    public.current_rol() in ('Administrador', 'Coordinadora Administrativa')
    and aprobado_por = public.current_usuario_id()
  );

commit;

-- Verificación (solo lectura): debe devolver 1 fila con la tabla y RLS activo.
select relname as tabla, relrowsecurity as rls_activo
from pg_class
where oid = 'public.presupuesto_aprobaciones'::regclass;
