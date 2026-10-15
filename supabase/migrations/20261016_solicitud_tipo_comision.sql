-- =====================================================================================
-- Solicitudes: nuevo tipo "Comisión"
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Idempotente. Si la tabla tiene una restricción CHECK con la lista de tipos permitidos, la
-- reemplaza por la misma lista + 'Comisión'. Si no tiene ninguna, no cambia nada.
-- =====================================================================================

begin;

do $$
declare c record; v_habia boolean := false;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.solicitudes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
      and pg_get_constraintdef(oid) ilike '%Anticipo%'
      and pg_get_constraintdef(oid) ilike '%Reembolso%'
  loop
    execute format('alter table public.solicitudes drop constraint %I', c.conname);
    v_habia := true;
  end loop;
  if v_habia then
    alter table public.solicitudes add constraint solicitudes_tipo_check
      check (tipo in ('Anticipo', 'Legalización', 'Reembolso', 'Pago a Tercero', 'Legalización T. Pro', 'Comisión'));
  end if;
end $$;

commit;

-- Verificación (solo lectura): restricciones CHECK de solicitudes (si sale vacío, no había
-- ninguna sobre el tipo y 'Comisión' ya se podía guardar).
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.solicitudes'::regclass and contype = 'c';
