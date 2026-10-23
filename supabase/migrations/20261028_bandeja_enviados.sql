-- =====================================================================================
-- Mi Bandeja de Soportes: los recibos usados en una solicitud no se pierden
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Solo AGREGA permisos (no quita ninguno).
--
-- • Cada persona ve, edita (incluido reemplazar el archivo) y elimina SUS recibos de la bandeja,
--   también los ya enviados en una solicitud (para verlos con sus archivos).
-- • Si se elimina una solicitud, sus recibos vuelven solos a la bandeja (disponibles para
--   presentarlos otra vez) en vez de quedar perdidos.
-- • Recupera los recibos que quedaron "usados" de solicitudes que ya se eliminaron.
-- =====================================================================================

begin;

-- 1) Permisos del dueño sobre sus recibos ----------------------------------------------------
alter table public.soportes_pendientes enable row level security;
grant select, insert, update, delete on public.soportes_pendientes to authenticated;

drop policy if exists "bandeja: dueño ve sus recibos" on public.soportes_pendientes;
create policy "bandeja: dueño ve sus recibos" on public.soportes_pendientes
  for select to authenticated using (usuario_id::text = public.current_usuario_id()::text);

drop policy if exists "bandeja: dueño edita sus recibos" on public.soportes_pendientes;
create policy "bandeja: dueño edita sus recibos" on public.soportes_pendientes
  for update to authenticated
  using (usuario_id::text = public.current_usuario_id()::text)
  with check (usuario_id::text = public.current_usuario_id()::text);

drop policy if exists "bandeja: dueño elimina sus recibos" on public.soportes_pendientes;
create policy "bandeja: dueño elimina sus recibos" on public.soportes_pendientes
  for delete to authenticated using (usuario_id::text = public.current_usuario_id()::text and not usado);

-- 2) Archivos de la bandeja (carpeta pendiente/<id del usuario>/) ------------------------------
drop policy if exists "storage bandeja: dueño ve sus archivos" on storage.objects;
create policy "storage bandeja: dueño ve sus archivos" on storage.objects
  for select to authenticated
  using (bucket_id = 'soportes' and name like 'pendiente/' || public.current_usuario_id()::text || '/%');

drop policy if exists "storage bandeja: dueño sube sus archivos" on storage.objects;
create policy "storage bandeja: dueño sube sus archivos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'soportes' and name like 'pendiente/' || public.current_usuario_id()::text || '/%');

drop policy if exists "storage bandeja: dueño borra sus archivos" on storage.objects;
create policy "storage bandeja: dueño borra sus archivos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'soportes' and name like 'pendiente/' || public.current_usuario_id()::text || '/%');

-- 3) Al eliminar una solicitud, sus recibos vuelven a la bandeja --------------------------------
create or replace function public.devolver_recibos_a_bandeja() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.soportes_pendientes set usado = false, solicitud_id = null
  where solicitud_id::text = old.id::text;
  return old;
end;
$$;
drop trigger if exists devolver_recibos_a_bandeja on public.solicitudes;
create trigger devolver_recibos_a_bandeja before delete on public.solicitudes
  for each row execute function public.devolver_recibos_a_bandeja();

-- 4) Recupera los recibos de solicitudes que ya no existen -------------------------------------
update public.soportes_pendientes p set usado = false, solicitud_id = null
where p.usado and p.solicitud_id is not null
  and not exists (select 1 from public.solicitudes s where s.id::text = p.solicitud_id::text);

commit;

-- Verificación (solo lectura): recibos por estado en la bandeja.
select case when not usado then 'Disponibles' else 'Enviados en una solicitud' end as estado, count(*)
from public.soportes_pendientes group by 1;
