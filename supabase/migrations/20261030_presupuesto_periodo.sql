-- =====================================================================================
-- Presupuesto: periodo de cada pago y conceptos "mes vencido"
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- No cambia ningún valor ni fecha: solo agrega dos columnas.
--
-- • gastos.periodo ('AAAA-MM'): mes al que CORRESPONDE el pago en Presupuesto. La fecha sigue
--   siendo la real del pago (Finanzas, bancos y Dashboard no cambian). Si está vacío, el pago
--   cuenta en el mes de su fecha (como hasta hoy).
-- • presupuesto_items.mes_vencido: el concepto se paga a comienzos del mes siguiente (ej.
--   seguridad social): sus pagos toman como periodo el mes anterior a la fecha de pago.
-- • Los pagos ya vinculados a Presupuesto quedan con periodo = mes de su fecha (nada cambia
--   de entrada). Al marcar un concepto como "mes vencido" en Gestión de Conceptos, la app
--   ofrece correr sus pagos ya registrados al mes anterior.
-- =====================================================================================

begin;

alter table public.gastos add column if not exists periodo text
  check (periodo is null or periodo ~ '^\d{4}-(0[1-9]|1[0-2])$');
alter table public.presupuesto_items add column if not exists mes_vencido boolean not null default false;

update public.gastos set periodo = to_char(fecha, 'YYYY-MM')
where presupuesto_item_id is not null and periodo is null and fecha is not null;

commit;

-- Verificación (solo lectura): pagos vinculados a Presupuesto por concepto y periodo (últimos 3 meses).
select pi.nombre as concepto, pi.mes_vencido, g.periodo, to_char(g.fecha, 'DD/MM/YYYY') as fecha_pago, g.valor
from public.gastos g join public.presupuesto_items pi on pi.id = g.presupuesto_item_id
where g.fecha >= (current_date - interval '3 months')
order by pi.nombre, g.fecha desc
limit 60;
