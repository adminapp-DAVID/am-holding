-- =====================================================================================
-- Finanzas: Administrador, Coordinadora Administrativa y Gerente ven TODOS los soportes de
-- las solicitudes y de los movimientos (gastos / ingresos)
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Idempotente y solo AGREGA permisos de lectura (no quita ninguno existente).
--
-- En Finanzas, al ver los soportes de un movimiento generado desde una Solicitud pagada, la app
-- muestra también los soportes de la solicitud original. Esto asegura que esos roles puedan
-- leer las filas de public.soportes y descargar/ver los archivos del bucket "soportes".
-- =====================================================================================

begin;

drop policy if exists "soportes: finanzas ven solicitudes y movimientos" on public.soportes;
create policy "soportes: finanzas ven solicitudes y movimientos" on public.soportes
  for select to authenticated
  using (
    public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente')
    and entidad_tipo in ('solicitud', 'gasto', 'ingreso')
  );

drop policy if exists "storage soportes: finanzas ven solicitudes y movimientos" on storage.objects;
create policy "storage soportes: finanzas ven solicitudes y movimientos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'soportes'
    and public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente')
    and exists (
      select 1 from public.soportes s
      where s.bucket_path = storage.objects.name
        and s.entidad_tipo in ('solicitud', 'gasto', 'ingreso')
    )
  );

commit;

-- Verificación (solo lectura): deben salir las 2 políticas.
select schemaname, tablename, policyname from pg_policies
where policyname in ('soportes: finanzas ven solicitudes y movimientos', 'storage soportes: finanzas ven solicitudes y movimientos');
