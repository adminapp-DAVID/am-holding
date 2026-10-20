-- =====================================================================================
-- Contabilidad: la Contadora también VE (y descarga) los soportes de Finanzas
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Idempotente. Solo amplía las dos políticas de LECTURA de 20261016_soportes_finanzas_ver.sql
-- (soportes de solicitudes, gastos e ingresos) para incluir a la Contadora. Borrar sigue siendo
-- solo de Administrador, Coordinadora Administrativa y Gerente.
-- =====================================================================================

begin;

drop policy if exists "soportes: finanzas ven solicitudes y movimientos" on public.soportes;
create policy "soportes: finanzas ven solicitudes y movimientos" on public.soportes
  for select to authenticated
  using (
    public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente', 'Contadora')
    and entidad_tipo in ('solicitud', 'gasto', 'ingreso')
  );

drop policy if exists "storage soportes: finanzas ven solicitudes y movimientos" on storage.objects;
create policy "storage soportes: finanzas ven solicitudes y movimientos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'soportes'
    and public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente', 'Contadora')
    and exists (
      select 1 from public.soportes s
      where s.bucket_path = storage.objects.name
        and s.entidad_tipo in ('solicitud', 'gasto', 'ingreso')
    )
  );

commit;

-- Verificación (solo lectura): las dos políticas deben incluir 'Contadora'.
select policyname, qual from pg_policies
where policyname in ('soportes: finanzas ven solicitudes y movimientos', 'storage soportes: finanzas ven solicitudes y movimientos');
