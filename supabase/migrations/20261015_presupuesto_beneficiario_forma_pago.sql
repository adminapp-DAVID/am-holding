-- =====================================================================================
-- Presupuesto → PAB: beneficiario (tercero) y forma de pago de cada concepto
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Es idempotente y no toca datos existentes.
--
-- • tercero_id: a quién se le paga cuando NO es un colaborador (EPM, administración, proveedor…).
-- • forma_pago: PAB / Convenio / PSE / Débito automático / Tarjeta de crédito / Otro. Solo los de
--   "PAB" (o Nómina / Prestación de Servicio sin definir) entran al archivo del banco.
-- =====================================================================================

begin;

do $$
declare tipo_tercero text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_tercero
  from pg_attribute a where a.attrelid = 'public.terceros'::regclass and a.attname = 'id';
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'presupuesto_items' and column_name = 'tercero_id') then
    execute format('alter table public.presupuesto_items add column tercero_id %s references public.terceros(id)', tipo_tercero);
  end if;
end $$;

alter table public.presupuesto_items add column if not exists forma_pago text;
alter table public.presupuesto_items drop constraint if exists presupuesto_items_forma_pago_check;
alter table public.presupuesto_items add constraint presupuesto_items_forma_pago_check
  check (forma_pago is null or forma_pago in ('PAB', 'Convenio / PSE', 'Débito automático', 'Tarjeta de crédito', 'Otro'));

commit;

-- Verificación (solo lectura): deben salir las 2 columnas.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'presupuesto_items' and column_name in ('tercero_id', 'forma_pago');
