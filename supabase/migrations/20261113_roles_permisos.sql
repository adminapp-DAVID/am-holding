-- =====================================================================================
-- Roles y permisos configurables (Administrativo → Roles y permisos)
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Requiere 20261025_rol_gerente_financiero.sql (current_rol_base).
--
-- • public.roles: cada rol con su NOMBRE visible (editable), su ROL BASE (uno de los 5 con los
--   que la base decide la seguridad), orden, descripción, si presenta solicitudes propias y la
--   matriz de permisos por módulo (permisos jsonb; vacío = el máximo del rol base).
-- • usuarios.rol guarda el CÓDIGO del rol (no cambia para nadie, salvo Jonathan, ver abajo).
-- • Nombres nuevos: "Responsable" se muestra como "Colaborador" (unificados) y "Coordinadora
--   Administrativa" como "Coordinación Administrativa". Las políticas (RLS) no cambian.
-- • current_rol() ahora toma el rol base de public.roles (con respaldo a la regla anterior).
-- • Solo el Administrador crea o edita roles; todos pueden leerlos (para mostrar el nombre).
-- =====================================================================================

begin;

create table if not exists public.roles (
  codigo text primary key,
  nombre text not null unique,
  rol_base text not null check (rol_base in ('Administrador', 'Coordinadora Administrativa', 'Gerente', 'Contadora', 'Responsable')),
  descripcion text,
  orden integer not null default 99,
  activo boolean not null default true,
  presenta_solicitudes boolean not null default false,
  permisos jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.roles (codigo, nombre, rol_base, descripcion, orden, presenta_solicitudes) values
  ('Administrador', 'Administrador', 'Administrador', 'Acceso total. Único que cambia roles y edita perfiles sensibles.', 1, false),
  ('Coordinadora Administrativa', 'Coordinación Administrativa', 'Coordinadora Administrativa', 'Gestiona todo el flujo: aprueba y paga solicitudes, Finanzas, Presupuesto, PAB, Liquidaciones, Colaboradores.', 2, false),
  ('Gerente Financiero', 'Gerente Financiero', 'Coordinadora Administrativa', 'Permisos de Coordinación y además presenta sus propias solicitudes (Mi Bandeja).', 3, true),
  ('Gerente', 'Gerente', 'Gerente', 'Ve Finanzas, Presupuesto, Dashboard financiero y Asistente; gestiona sus propias solicitudes.', 4, false),
  ('Contadora', 'Contadora', 'Contadora', 'Solo lectura: solicitudes aprobadas/pagadas, Contabilidad y soportes.', 5, false),
  ('Responsable', 'Colaborador', 'Responsable', 'Crea y sigue sus solicitudes, cuentas de cobro y Mi Bandeja; ve sus liquidaciones.', 6, true),
  ('Coordinador Administrativo', 'Coordinador Administrativo (antiguo)', 'Coordinadora Administrativa', 'Reemplazado por Coordinación Administrativa.', 90, false),
  ('Colaborador', 'Colaborador (antiguo)', 'Responsable', 'Reemplazado por Colaborador (unificado).', 91, true)
on conflict (codigo) do nothing;

-- Cualquier otro rol que ya tengan usuarios (por si acaso) queda registrado tal cual.
insert into public.roles (codigo, nombre, rol_base, orden)
select distinct u.rol::text, u.rol::text,
  case when u.rol::text in ('Administrador', 'Coordinadora Administrativa', 'Gerente', 'Contadora', 'Responsable') then u.rol::text else 'Responsable' end, 95
from public.usuarios u
where u.rol is not null and not exists (select 1 from public.roles r where r.codigo = u.rol::text)
on conflict do nothing;

-- Jonathan (y quien tuviera el alias) pasa a Coordinación Administrativa; los alias viejos quedan inactivos.
alter table public.usuarios disable trigger user;
update public.usuarios set rol = 'Coordinadora Administrativa' where rol::text = 'Coordinador Administrativo';
update public.usuarios set rol = 'Responsable' where rol::text = 'Colaborador';
alter table public.usuarios enable trigger user;
update public.roles set activo = false where codigo in ('Coordinador Administrativo', 'Colaborador');

-- usuarios.rol: en vez de la lista fija (CHECK), apunta a public.roles para aceptar roles nuevos.
do $$
declare c record; v_typtype char;
begin
  select t.typtype into v_typtype from pg_attribute a join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.usuarios'::regclass and a.attname = 'rol';
  if v_typtype = 'e' then
    raise notice 'usuarios.rol es un ENUM: los roles nuevos de la app necesitarán agregarse al tipo. Avísale a Claude.';
    return;
  end if;
  for c in select conname from pg_constraint
           where conrelid = 'public.usuarios'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%Administrador%' loop
    execute format('alter table public.usuarios drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.usuarios'::regclass and conname = 'usuarios_rol_fk') then
    alter table public.usuarios add constraint usuarios_rol_fk foreign key (rol) references public.roles(codigo) on update cascade;
  end if;
end $$;

-- current_rol(): rol base desde public.roles (respaldo: la regla anterior).
do $$
declare v_tipo text := format_type((select prorettype from pg_proc where oid = 'public.current_rol()'::regprocedure), null);
begin
  if to_regprocedure('public.current_rol_base()') is null then
    raise exception 'Falta current_rol_base(): corre primero 20261025_rol_gerente_financiero.sql';
  end if;
  execute format($f$
    create or replace function public.current_rol() returns %1$s
    language sql stable security definer set search_path = public as $b$
      select coalesce(
        (select r.rol_base from public.roles r where r.codigo = x.r::text),
        case when x.r::text in ('Gerente Financiero', 'Coordinador Administrativo') then 'Coordinadora Administrativa' else x.r::text end
      )::%1$s
      from (select public.current_rol_base() as r) x
    $b$ $f$, v_tipo);
end $$;
grant execute on function public.current_rol() to authenticated;

-- Permisos de la tabla --------------------------------------------------------------------------
create or replace function public.roles_actualizado() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists roles_actualizado on public.roles;
create trigger roles_actualizado before update on public.roles for each row execute function public.roles_actualizado();

alter table public.roles enable row level security;
grant select, insert, update, delete on public.roles to authenticated;
drop policy if exists roles_leer on public.roles;
create policy roles_leer on public.roles for select to authenticated using (true);
drop policy if exists roles_admin on public.roles;
create policy roles_admin on public.roles for all to authenticated
  using (public.current_rol() = 'Administrador') with check (public.current_rol() = 'Administrador');

do $$
begin
  if to_regprocedure('public.auditar_cambio()') is not null then
    execute 'drop trigger if exists auditar_cambio on public.roles';
    execute 'create trigger auditar_cambio after insert or update or delete on public.roles for each row execute function public.auditar_cambio()';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

-- Verificación (solo lectura): roles con sus usuarios.
select r.orden, r.nombre, r.codigo, r.rol_base, r.activo, count(u.id) as usuarios
from public.roles r left join public.usuarios u on u.rol::text = r.codigo
group by r.orden, r.nombre, r.codigo, r.rol_base, r.activo
order by r.orden;
