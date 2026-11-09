-- =====================================================================================
-- Rol "Coordinador Administrativo" = mismos permisos que "Coordinadora Administrativa"
-- (igual que "Gerente Financiero", ver 20261025_rol_gerente_financiero.sql).
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Al final cambia el rol de Jonathan (debe salir 1 fila).
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
    execute format('alter type %s add value if not exists %L', v_tipo::regtype, 'Coordinador Administrativo');
  end if;

  for c in select conname, pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = 'public.usuarios'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%Coordinadora Administrativa%'
             and pg_get_constraintdef(oid) not like '%Coordinador Administrativo%' loop
    v_def := replace(replace(c.def,
      '''Coordinadora Administrativa''::text', '''Coordinadora Administrativa''::text, ''Coordinador Administrativo''::text'),
      '''Coordinadora Administrativa''::character varying', '''Coordinadora Administrativa''::character varying, ''Coordinador Administrativo''::character varying');
    if v_def = c.def then
      raise exception 'No pude ampliar la restricción % (%). Envíasela a Claude.', c.conname, c.def;
    end if;
    execute format('alter table public.usuarios drop constraint %I', c.conname);
    execute format('alter table public.usuarios add constraint %I %s', c.conname, v_def);
  end loop;
end $$;

-- 2) current_rol(): rol de PERMISOS (current_rol_base() = rol guardado, ya existe).
do $$
declare v_tipo text := format_type((select prorettype from pg_proc where oid = 'public.current_rol()'::regprocedure), null);
begin
  if to_regprocedure('public.current_rol_base()') is null then
    raise exception 'Falta current_rol_base(): corre primero 20261025_rol_gerente_financiero.sql';
  end if;
  execute format($f$
    create or replace function public.current_rol() returns %1$s
    language sql stable security definer set search_path = public as $b$
      select (case when r::text in ('Gerente Financiero', 'Coordinador Administrativo') then 'Coordinadora Administrativa' else r::text end)::%1$s
      from (select public.current_rol_base() as r) x
    $b$ $f$, v_tipo);
end $$;
grant execute on function public.current_rol() to authenticated;

-- 3) Notificaciones "a Administrador / Coordinadora" (consultan usuarios.rol directamente).
do $$
declare f text; v_def text;
begin
  foreach f in array array['public.auditar_cambio()', 'public.notificar_perfiles_incompletos()',
                           'public.notificar_politica_admins(text, text, text, boolean, boolean)'] loop
    if to_regprocedure(f) is null then continue; end if;
    v_def := pg_get_functiondef(f::regprocedure);
    if v_def like '%Coordinador Administrativo%' then continue; end if;
    v_def := replace(v_def, '''Gerente Financiero'')', '''Gerente Financiero'', ''Coordinador Administrativo'')');
    execute v_def;
  end loop;
end $$;

commit;

-- 4) Jonathan → Coordinador Administrativo. Debe salir 1 fila.
update public.usuarios set rol = 'Coordinador Administrativo'
where nombre ilike '%jonathan%'
returning nombre, email, rol;

-- 5) Verificación (solo lectura). Si devuelve filas, envíamelas: son permisos que comparan el
--    rol sin current_rol() y no cubren al rol nuevo.
select 'política' as tipo, tablename as nombre, policyname as detalle from pg_policies
where (coalesce(qual, '') || coalesce(with_check, '')) like '%Coordinadora Administrativa%'
  and (coalesce(qual, '') || coalesce(with_check, '')) not like '%current_rol%'
union all
select 'función', p.proname, left(p.prosrc, 120) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc like '%Gerente Financiero%' and p.prosrc not like '%Coordinador Administrativo%'
  and p.proname not in ('current_rol', 'current_rol_base');
