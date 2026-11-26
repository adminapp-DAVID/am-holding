-- Tipo de soporte "Recibo/Entradas" pasa a llamarse "Recibo de caja" (Solicitudes y Finanzas).
-- Actualiza los soportes ya guardados para que sigan mostrando su tipo. Idempotente.

-- Bandeja de soportes (Legalizaciones / Reembolsos)
update public.soportes_pendientes set tipo_soporte = 'Recibo de caja' where tipo_soporte = 'Recibo/Entradas';

-- Recibos dentro de las solicitudes (documentos jsonb: [{ ..., tipoSoporte }])
update public.solicitudes s
set documentos = (
  select jsonb_agg(case when d ->> 'tipoSoporte' = 'Recibo/Entradas' then jsonb_set(d, '{tipoSoporte}', '"Recibo de caja"') else d end order by n)
  from jsonb_array_elements(s.documentos) with ordinality as x(d, n)
)
where jsonb_typeof(s.documentos) = 'array'
  and exists (select 1 from jsonb_array_elements(s.documentos) d where d ->> 'tipoSoporte' = 'Recibo/Entradas');

-- Verificación: debe dar 0 en las dos columnas.
select (select count(*) from public.soportes_pendientes where tipo_soporte = 'Recibo/Entradas') as bandeja,
       (select count(*) from public.solicitudes s, jsonb_array_elements(case when jsonb_typeof(s.documentos) = 'array' then s.documentos else '[]'::jsonb end) d
         where d ->> 'tipoSoporte' = 'Recibo/Entradas') as solicitudes;
