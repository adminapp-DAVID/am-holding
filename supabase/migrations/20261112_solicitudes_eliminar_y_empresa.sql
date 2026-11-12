-- =====================================================================================
-- 1) Eliminar solicitudes: el colaborador solo puede borrar las SUYAS y solo en "Pendiente".
--    Administrador y Coordinadora Administrativa (incluye Gerente Financiero y Coordinador
--    Administrativo) pueden borrar cualquiera; todo lo borrado queda 90 días en la Papelera.
-- 2) Empresa de la solicitud: solo se asigna al PAGARLA (modal de pago / lote / PAB /
--    liquidación). Las solicitudes abiertas (Pendiente, Devuelto, Aprobado) que aún tenían
--    empresa quedan como "General"; su moneda se conserva en moneda_pago.
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- =====================================================================================

begin;

-- 1) Borrado de solicitudes ----------------------------------------------------------------------
-- Política RESTRICTIVA: se suma (AND) a las que ya existan, así ninguna política anterior puede
-- dejar a un colaborador borrar una solicitud que no esté Pendiente. Las dos permisivas garantizan
-- que gestión y dueño (en Pendiente) sí puedan.
drop policy if exists solicitudes_eliminar_restriccion on public.solicitudes;
create policy solicitudes_eliminar_restriccion on public.solicitudes as restrictive for delete to authenticated
  using (
    public.current_rol() in ('Administrador', 'Coordinadora Administrativa')
    or (responsable_id::text = public.current_usuario_id()::text and estado = 'Pendiente')
  );

drop policy if exists solicitudes_eliminar_gestion on public.solicitudes;
create policy solicitudes_eliminar_gestion on public.solicitudes for delete to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));

drop policy if exists solicitudes_eliminar_propias_pendientes on public.solicitudes;
create policy solicitudes_eliminar_propias_pendientes on public.solicitudes for delete to authenticated
  using (responsable_id::text = public.current_usuario_id()::text and estado = 'Pendiente');

-- 2) Empresa solo al pagar: limpiar la de las solicitudes abiertas ---------------------------------
-- (Solo cambia datos: se apagan los triggers de usuario para no recalcular políticas ni notificar.)
alter table public.solicitudes disable trigger user;

update public.solicitudes s
set moneda_pago = coalesce(s.moneda_pago, case when e.nombre = 'ARKO' then 'USD' else 'COP' end),
    empresa_id = null
from public.empresas e
where e.id = s.empresa_id
  and s.estado in ('Pendiente', 'Devuelto', 'Aprobado');

alter table public.solicitudes enable trigger user;

commit;

-- Verificación (solo lectura) ---------------------------------------------------------------------
-- a) Debe salir 0: solicitudes abiertas que todavía tienen empresa.
select count(*) as abiertas_con_empresa from public.solicitudes
where estado in ('Pendiente', 'Devuelto', 'Aprobado') and empresa_id is not null;
-- b) Políticas de borrado vigentes (deben estar las 3 nuevas).
select policyname, cmd, qual from pg_policies
where schemaname = 'public' and tablename = 'solicitudes' and cmd in ('DELETE', 'ALL');
