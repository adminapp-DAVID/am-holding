-- =====================================================================================
-- Gerente: ver (solo lectura) las solicitudes ya Pagadas / Legalizadas
--
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente; solo AGREGA lectura.
--
-- En Finanzas, "🔗 Generado desde Solicitudes" abre la solicitud original (concepto, soportes,
-- Ver Excel). El Gerente solo podía leer SUS propias solicitudes, así que en pagos de otras
-- personas la app no la encontraba. Esto le da lectura de las que ya se pagaron/legalizaron
-- (las que tienen movimiento en Finanzas). En el módulo Solicitudes la app le sigue mostrando
-- solo las suyas.
-- =====================================================================================

begin;

drop policy if exists "solicitudes: gerente ve las pagadas (finanzas)" on public.solicitudes;
create policy "solicitudes: gerente ve las pagadas (finanzas)" on public.solicitudes
  for select to authenticated
  using (public.current_rol() = 'Gerente' and estado in ('Pagado', 'Legalizado'));

commit;

-- Verificación (solo lectura): debe salir la política.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'solicitudes' and policyname = 'solicitudes: gerente ve las pagadas (finanzas)';
