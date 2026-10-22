-- =====================================================================================
-- Soportes: Administrador y Coordinadora Administrativa pueden REEMPLAZAR un soporte ya subido
-- por su versión girada (fotos o páginas de PDF que quedaron volteadas).
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Idempotente; solo AGREGA un permiso (no quita ninguno).
--
-- La app sube el archivo girado como uno nuevo en la misma carpeta y actualiza bucket_path /
-- nombre_original / tamano_kb de las filas de public.soportes que apuntaban al anterior (ver
-- src/girarSoportes.js). Subir y borrar archivos ya lo pueden hacer esos roles.
-- =====================================================================================

begin;

drop policy if exists "soportes: admin y coordinadora reemplazan (girar)" on public.soportes;
create policy "soportes: admin y coordinadora reemplazan (girar)" on public.soportes
  for update to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'))
  with check (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));

grant update (bucket_path, nombre_original, tamano_kb) on public.soportes to authenticated;

commit;

-- Verificación (solo lectura): debe salir la política.
select policyname, cmd from pg_policies
where tablename = 'soportes' and policyname = 'soportes: admin y coordinadora reemplazan (girar)';
