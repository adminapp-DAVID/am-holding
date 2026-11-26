-- La Contadora también presenta SUS solicitudes (sigue como auditora del resto: no aprueba, no paga).
-- Lo demás ya lo permitían las políticas existentes (ver todas, corregir propias Pendiente/Devuelto, borrar
-- propias Pendiente, bandeja de soportes y archivos propios). Faltaba crear. Idempotente.

drop policy if exists "solicitudes: contadora crea las suyas" on public.solicitudes;
create policy "solicitudes: contadora crea las suyas" on public.solicitudes for insert to authenticated
  with check (current_rol() = 'Contadora' and responsable_id = current_usuario_id());

-- Roles con rol base Contadora que guardaron Solicitudes en 'ver' (o sin valor): pasan a 'editar' para poder presentar.
update public.roles
set permisos = jsonb_set(coalesce(permisos, '{}'::jsonb), '{solicitudes}', '"editar"')
where rol_base = 'Contadora' and coalesce(permisos ->> 'solicitudes', 'ver') = 'ver';

-- Verificación
select codigo, nombre, permisos ->> 'solicitudes' as solicitudes from public.roles where rol_base = 'Contadora';
