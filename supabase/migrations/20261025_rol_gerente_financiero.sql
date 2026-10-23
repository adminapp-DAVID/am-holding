-- =====================================================================================
-- Rol "Gerente Financiero" = mismos permisos que "Coordinadora Administrativa"
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
--
-- Cómo funciona: todas las políticas (RLS) y funciones de permisos usan public.current_rol().
-- En vez de reescribir cada política, current_rol() devuelve 'Coordinadora Administrativa'
-- cuando el rol guardado es 'Gerente Financiero'. La función original se conserva intacta como
-- public.current_rol_base() (el rol tal cual está en usuarios), y la auditoría sigue
-- registrando el rol real. La app hace lo mismo (src/roles.js).
-- Las notificaciones que van "a Administrador y Coordinadora" también le llegan.
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
    execute format('alter type %s add value if not exists %L', v_tipo::regtype, 'Gerente Financiero');
  end if;

  for c in select conname, pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = 'public.usuarios'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%Coordinadora Administrativa%'
             and pg_get_constraintdef(oid) not like '%Gerente Financiero%' loop
    v_def := replace(replace(c.def,
      '''Coordinadora Administrativa''::text', '''Coordinadora Administrativa''::text, ''Gerente Financiero''::text'),
      '''Coordinadora Administrativa''::character varying', '''Coordinadora Administrativa''::character varying, ''Gerente Financiero''::character varying');
    if v_def = c.def then
      raise exception 'No pude ampliar la restricción % (%). Envíasela a Claude.', c.conname, c.def;
    end if;
    execute format('alter table public.usuarios drop constraint %I', c.conname);
    execute format('alter table public.usuarios add constraint %I %s', c.conname, v_def);
  end loop;
end $$;

-- 2) current_rol_base() = copia exacta de la current_rol() original (solo la primera vez).
do $$
declare v_def text;
begin
  if to_regprocedure('public.current_rol_base()') is null then
    v_def := pg_get_functiondef('public.current_rol()'::regprocedure);
    v_def := replace(v_def, 'FUNCTION public.current_rol()', 'FUNCTION public.current_rol_base()');
    execute v_def;
  end if;
end $$;
grant execute on function public.current_rol_base() to authenticated;

-- 3) current_rol(): rol de PERMISOS. Mismo tipo de retorno que la original (no cambia su OID,
--    así que todas las políticas que ya la usan quedan cubiertas).
do $$
declare v_tipo text := format_type((select prorettype from pg_proc where oid = 'public.current_rol()'::regprocedure), null);
begin
  execute format($f$
    create or replace function public.current_rol() returns %1$s
    language sql stable security definer set search_path = public as $b$
      select (case when r::text = 'Gerente Financiero' then 'Coordinadora Administrativa' else r::text end)::%1$s
      from (select public.current_rol_base() as r) x
    $b$ $f$, v_tipo);
end $$;
grant execute on function public.current_rol() to authenticated;

-- 4) Notificaciones "a Administrador / Coordinadora" (consultan usuarios.rol directamente) y
--    auditoría con el rol real.
do $$
declare f text; v_def text;
begin
  foreach f in array array['public.auditar_cambio()', 'public.notificar_perfiles_incompletos()',
                           'public.notificar_politica_admins(text, text, text, boolean, boolean)'] loop
    if to_regprocedure(f) is null then continue; end if;
    v_def := pg_get_functiondef(f::regprocedure);
    if v_def like '%Gerente Financiero%' then continue; end if;
    v_def := replace(v_def, '''Coordinadora Administrativa'')', '''Coordinadora Administrativa'', ''Gerente Financiero'')');
    v_def := replace(v_def, 'v_rol text := public.current_rol();', 'v_rol text := public.current_rol_base();');
    execute v_def;
  end loop;
end $$;

commit;

-- 5) Santiago Espinosa: Gerente → Gerente Financiero. Debe salir 1 fila.
update public.usuarios set rol = 'Gerente Financiero'
where nombre ilike '%santiago%espinosa%' and rol in ('Gerente', 'Gerente Financiero')
returning nombre, rol;

-- 6) Verificación (solo lectura). Si alguna de estas dos consultas devuelve filas, envíamelas:
--    son permisos que comparan el rol SIN usar current_rol() y no cubren al rol nuevo.
select 'política' as tipo, tablename as nombre, policyname as detalle from pg_policies
where (coalesce(qual, '') || coalesce(with_check, '')) like '%Coordinadora Administrativa%'
  and (coalesce(qual, '') || coalesce(with_check, '')) not like '%current_rol%'
union all
select 'función', p.proname, left(p.prosrc, 120) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc like '%Coordinadora Administrativa%' and p.prosrc not like '%Gerente Financiero%'
  and p.proname not in ('current_rol', 'current_rol_base');
