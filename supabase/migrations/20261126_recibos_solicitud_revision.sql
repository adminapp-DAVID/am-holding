-- =====================================================================================
-- Revisión de solicitudes: ver cada recibo junto a su concepto
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Solo AGREGA permisos de LECTURA (no quita ninguno).
--
-- Administrador, Coordinadora Administrativa y Gerente pueden ver los recibos de la bandeja que
-- ya se enviaron en una solicitud (fecha, pagado a, concepto, valor y su archivo), para revisar
-- la solicitud recibo por recibo ("🧾 Recibos" en Solicitudes). Los recibos que siguen en la
-- bandeja (sin solicitud) siguen siendo solo de su dueño.
-- =====================================================================================

begin;

drop policy if exists "bandeja: gestión ve recibos enviados" on public.soportes_pendientes;
create policy "bandeja: gestión ve recibos enviados" on public.soportes_pendientes
  for select to authenticated
  using (
    solicitud_id is not null
    and public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente')
  );

drop policy if exists "storage bandeja: gestión ve recibos enviados" on storage.objects;
create policy "storage bandeja: gestión ve recibos enviados" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'soportes'
    and name like 'pendiente/%'
    and public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente')
    and exists (
      select 1 from public.soportes_pendientes p
      where p.bucket_path = storage.objects.name and p.solicitud_id is not null
    )
  );

commit;

-- Verificación (solo lectura): deben salir las dos políticas nuevas.
select tablename, policyname from pg_policies
where policyname in ('bandeja: gestión ve recibos enviados', 'storage bandeja: gestión ve recibos enviados');
