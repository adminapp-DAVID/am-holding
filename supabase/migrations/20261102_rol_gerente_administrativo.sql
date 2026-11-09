-- =====================================================================================
-- Rol "Gerente Administrativo" = mismos permisos que "Administrador"
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Requiere 20261025_rol_gerente_financiero.sql (current_rol_base() ya existe).
--
-- Igual que con Gerente Financiero: current_rol() devuelve 'Administrador' cuando el rol
-- guardado es 'Gerente Administrativo', así todas las políticas (RLS) lo cubren sin reescribirlas.
-- La auditoría sigue registrando el rol real y la app hace lo mismo (src/roles.js).
-- =====================================================================================

begin;

-- 1) Permitir el valor nuevo en usuarios.rol (si la columna tiene CHECK o es un enum).
do $$
declare c record; v_def text; v_tipo oid; v_typtype char;
begin
  select a.atttypid, t.typtype into v_tipo, v_typtype
  from pg_attribute a join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.usuarios'::regclass and a.attname = 'rol';
  if v_typtype = 'e' then
    execute format('alter type %s add value if not exists %L', v_tipo::regtype, 'Gerente Administrativo');
  end if;

  for c in select conname, pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = 'public.usuarios'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%Administrador%'
             and pg_get_constraintdef(oid) not like '%Gerente Administrativo%' loop
    v_def := replace(replace(c.def,
      '''Administrador''::text', '''Administrador''::text, ''Gerente Administrativo''::text'),
      '''Administrador''::character varying', '''Administrador''::character varying, ''Gerente Administrativo''::character varying');
    if v_def = c.def then
      raise exception 'No pude ampliar la restricción % (%). Envíasela a Claude.', c.conname, c.def;
    end if;
    execute format('alter table public.usuarios drop constraint %I', c.conname);
    execute format('alter table public.usuarios add constraint %I %s', c.conname, v_def);
  end loop;
end $$;

-- 2) current_rol(): rol de PERMISOS (mismo tipo de retorno; no cambia su OID).
do $$
declare v_tipo text := format_type((select prorettype from pg_proc where oid = 'public.current_rol()'::regprocedure), null);
begin
  if to_regprocedure('public.current_rol_base()') is null then
    raise exception 'Falta current_rol_base(): corre primero 20261025_rol_gerente_financiero.sql';
  end if;
  execute format($f$
    create or replace function public.current_rol() returns %1$s
    language sql stable security definer set search_path = public as $b$
      select (case r::text
                when 'Gerente Financiero' then 'Coordinadora Administrativa'
                when 'Gerente Administrativo' then 'Administrador'
                else r::text end)::%1$s
      from (select public.current_rol_base() as r) x
    $b$ $f$, v_tipo);
end $$;
grant execute on function public.current_rol() to authenticated;

-- 3) Funciones que listan al equipo administrativo consultando usuarios.rol directamente
--    (notificaciones): se agrega 'Gerente Administrativo' a esas listas.
do $$
declare f record; v_def text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosrc like '%''Gerente Financiero'')%'
             and p.prosrc not like '%Gerente Administrativo%' loop
    v_def := pg_get_functiondef(f.oid);
    v_def := replace(v_def, '''Gerente Financiero'')', '''Gerente Financiero'', ''Gerente Administrativo'')');
    execute v_def;
  end loop;
end $$;

commit;

-- 4) Timoteo Salazar → Gerente Administrativo. Debe salir 1 fila.
update public.usuarios set rol = 'Gerente Administrativo'
where nombre ilike '%timoteo%salazar%'
returning nombre, rol;

-- 5) Verificación (solo lectura). Si devuelve filas, envíamelas: son permisos que comparan
--    'Administrador' SIN usar current_rol() y no cubren al rol nuevo.
select 'política' as tipo, tablename as nombre, policyname as detalle from pg_policies
where (coalesce(qual, '') || coalesce(with_check, '')) like '%Administrador%'
  and (coalesce(qual, '') || coalesce(with_check, '')) not like '%current_rol%'
union all
select 'función', p.proname, left(p.prosrc, 120) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc like '%''Administrador''%' and p.prosrc not like '%Gerente Administrativo%'
  and p.prosrc not like '%current_rol()%'
  and p.proname not in ('current_rol', 'current_rol_base');
