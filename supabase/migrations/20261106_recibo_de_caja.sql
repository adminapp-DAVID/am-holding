-- =====================================================================================
-- Tipo de soporte: "Recibo/Entradas" pasa a llamarse "Recibo de Caja" en todo el sistema.
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente: si ya se
-- corrió, no cambia nada.
--
-- Solo renombra el texto guardado en:
--   • Mi Bandeja de Soportes (soportes_pendientes.tipo_soporte)
--   • Los ítems de las solicitudes (solicitudes.documentos → tipoSoporte)
--   • Lo que está en la Papelera (para que al restaurar ya venga con el nombre nuevo)
-- En solicitudes se apagan sus triggers SOLO durante este cambio, para que las políticas
-- (fechas de pago, extemporánea, devoluciones…) y la auditoría no recalculen nada: es solo un nombre.
-- =====================================================================================

begin;

update public.soportes_pendientes set tipo_soporte = 'Recibo de Caja' where tipo_soporte = 'Recibo/Entradas';

do $$
declare tipo_col text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_col
  from pg_attribute a where a.attrelid = 'public.solicitudes'::regclass and a.attname = 'documentos';
  execute 'alter table public.solicitudes disable trigger user';
  execute format(
    'update public.solicitudes set documentos = replace(documentos::text, %L, %L)::%s where documentos::text like %L',
    '"Recibo/Entradas"', '"Recibo de Caja"', tipo_col, '%"Recibo/Entradas"%');
  execute 'alter table public.solicitudes enable trigger user';

  if to_regclass('public.papelera') is not null then
    update public.papelera set datos = replace(datos::text, '"Recibo/Entradas"', '"Recibo de Caja"')::jsonb
    where datos::text like '%"Recibo/Entradas"%';
  end if;
end $$;

commit;

-- Verificación (solo lectura): todo debe dar 0.
select
  (select count(*) from public.soportes_pendientes where tipo_soporte = 'Recibo/Entradas') as bandeja_con_nombre_viejo,
  (select count(*) from public.solicitudes where documentos::text like '%"Recibo/Entradas"%') as solicitudes_con_nombre_viejo;
