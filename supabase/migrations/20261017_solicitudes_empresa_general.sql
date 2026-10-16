-- =====================================================================================
-- Solicitudes "General": se crean sin empresa; Administrador / Coordinadora Administrativa
-- definen la empresa (y la cuenta) que pagó al marcarlas Pagado.
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Idempotente; no modifica datos (las solicitudes viejas conservan su empresa).
-- =====================================================================================

begin;

-- 1) empresa_id puede quedar vacío mientras la solicitud no se ha pagado.
alter table public.solicitudes alter column empresa_id drop not null;

-- 2) La moneda la elige quien solicita (antes solo Pago a Tercero la guardaba). Las viejas sin
--    moneda siguen usando la de su empresa (la app lo resuelve). La columna ya existe; esto solo
--    la crea si faltara.
alter table public.solicitudes add column if not exists moneda_pago text;

commit;

-- Verificación (solo lectura):
-- a) empresa_id debe salir is_nullable = YES.
select column_name, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'solicitudes' and column_name in ('empresa_id', 'moneda_pago');

-- b) Políticas de solicitudes: revisa que ninguna exija empresa_id al CREAR (insert) — si alguna
--    lo hace (p. ej. "empresa_id = empresa del usuario"), avísame antes de probar.
select policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'solicitudes' order by cmd, policyname;
