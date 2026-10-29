-- =====================================================================================
-- Mi Bandeja de Soportes: cualquier persona puede SUBIR sus propios recibos
-- (necesario para que el Gerente Financiero, con permisos de Coordinadora, use su bandeja).
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Solo AGREGA un permiso (no quita ninguno): insertar filas propias (usuario_id = uno mismo).
-- Los permisos de ver/editar/eliminar y de Storage ya están en 20261028_bandeja_enviados.sql.
-- =====================================================================================

begin;

drop policy if exists "bandeja: dueño sube sus recibos" on public.soportes_pendientes;
create policy "bandeja: dueño sube sus recibos" on public.soportes_pendientes
  for insert to authenticated
  with check (usuario_id::text = public.current_usuario_id()::text);

commit;

-- Verificación (solo lectura): políticas de la bandeja.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'soportes_pendientes' order by cmd, policyname;
