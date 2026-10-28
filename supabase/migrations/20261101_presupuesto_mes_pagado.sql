-- =====================================================================================
-- Presupuesto: un pendiente de un mes anterior marcado pagado con una fecha posterior queda
-- Pagado en SU mes (la fecha real del pago se conserva en Finanzas).
--
-- Idempotente. La columna ya existe en producción (se volvió a crear vacía el 28/10); esto
-- solo la asegura. No cambia datos. Solo la llenan "Marcar pagado" (modal / lote) y Pagos PAB.
-- =====================================================================================
alter table public.gastos add column if not exists periodo text;

-- Verificación (solo lectura): debe salir la columna.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'gastos' and column_name = 'periodo';
