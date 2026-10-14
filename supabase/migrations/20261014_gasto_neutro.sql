-- =====================================================================================
-- Gasto Neutro: registros de Finanzas que quedan registrados (con soportes y en COP) pero NO
-- suman como gasto de la empresa (Dashboard Financiero, Informe, Ejecución por CECO).
-- Caso de uso: Pagos a Tercero en USD de FOR SEVEN MEDIA SAS con CECO-012-PUB que se pagan en COP.
-- Correr en Supabase → SQL Editor ANTES del merge. Idempotente; no cambia registros existentes.
-- =====================================================================================
alter table public.gastos add column if not exists neutro boolean not null default false;

-- Verificación (solo lectura): candidatos existentes para marcar como neutros desde Finanzas (✏️).
select g.fecha, g.detalle, g.valor, g.moneda_pago, e.nombre as empresa, c.codigo as ceco, g.neutro
from public.gastos g
left join public.empresas e on e.id = g.empresa_id
left join public.cecos c on c.id = g.ceco_id
where c.codigo = 'CECO-012-PUB' and e.nombre ilike '%for seven%'
order by g.fecha desc;
