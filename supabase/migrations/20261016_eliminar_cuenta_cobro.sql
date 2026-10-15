-- =====================================================================================
-- Cuentas de Cobro: eliminar de verdad (y para todos)
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Idempotente; no toca datos.
--
-- Antes la app hacía un delete directo: si RLS lo bloqueaba, devolvía "sin error" con 0 filas,
-- la cuenta desaparecía solo en la pantalla de quien la borró y el colaborador la seguía viendo.
-- Ahora todo pasa por esta función, que valida el permiso y borra la cuenta y sus soportes en
-- una sola transacción:
--   • Administrador / Coordinadora Administrativa: cualquier cuenta de cobro.
--   • El dueño (Colaborador, Responsable, Gerente): solo las suyas y solo en estado Pendiente.
-- Devuelve las rutas de Storage que ya no usa ninguna otra entidad, para que la app borre los
-- archivos (un mismo archivo puede estar compartido con otras entidades).
-- =====================================================================================

begin;

create or replace function public.eliminar_cuenta_cobro(p_id text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_responsable text;
  v_estado text;
  v_rutas text[];
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

  -- Archivos que solo usa esta cuenta de cobro (los compartidos con otra entidad se conservan).
  select coalesce(array_agg(distinct s.bucket_path), '{}') into v_rutas
  from public.soportes s
  where s.entidad_tipo = 'cuenta_cobro' and s.entidad_id::text = p_id
    and not exists (
      select 1 from public.soportes o
      where o.bucket_path = s.bucket_path
        and not (o.entidad_tipo = 'cuenta_cobro' and o.entidad_id::text = p_id)
    );

  delete from public.soportes where entidad_tipo = 'cuenta_cobro' and entidad_id::text = p_id;
  delete from public.cuentas_cobro where id::text = p_id;
  return v_rutas;
end;
$$;

revoke all on function public.eliminar_cuenta_cobro(text) from public;
grant execute on function public.eliminar_cuenta_cobro(text) to authenticated;

commit;

-- Verificación (solo lectura): debe salir la función.
select proname from pg_proc where proname = 'eliminar_cuenta_cobro';
