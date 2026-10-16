-- =====================================================================================
-- Diagnóstico (SOLO LECTURA): valores que pudieron guardarse mal por escribir "50.000"
-- (el sistema lo tomaba como 50). No modifica nada.
--
-- Criterio: valores en COP menores a 1.000 (ARKO es USD y queda fuera), y documentos de
-- solicitudes cuyo valor quedó guardado como texto con puntos ("50.000").
-- Revisa la lista; los que de verdad estén mal se corrigen después, uno a uno.
-- =====================================================================================

select 'gasto' as origen, g.id::text, g.fecha::text, e.nombre as empresa, g.detalle, g.valor
from public.gastos g left join public.empresas e on e.id = g.empresa_id
where g.valor > 0 and g.valor < 1000 and coalesce(e.nombre, '') <> 'ARKO'
union all
select 'ingreso', i.id::text, i.fecha::text, e.nombre, i.detalle, i.valor
from public.ingresos i left join public.empresas e on e.id = i.empresa_id
where i.valor > 0 and i.valor < 1000 and coalesce(e.nombre, '') <> 'ARKO'
union all
select 'solicitud', s.id::text, s.fecha::text, e.nombre, s.tipo || ' · ' || coalesce(s.detalle, ''),
       greatest(coalesce(s.valor, 0), coalesce(s.total_calculado, 0))
from public.solicitudes s left join public.empresas e on e.id = s.empresa_id
where coalesce(e.nombre, '') <> 'ARKO'
  and ((s.valor > 0 and s.valor < 1000) or (s.total_calculado > 0 and s.total_calculado < 1000)
       or exists (select 1 from jsonb_array_elements(coalesce(s.documentos, '[]'::jsonb)) d
                  where jsonb_typeof(d->'valor') = 'string' and d->>'valor' ~ '^\d{1,3}(\.\d{3})+$'))
union all
select 'cuenta_cobro', c.id::text, c.fecha::text, null, c.numero::text, c.monto
from public.cuentas_cobro c
where c.monto > 0 and c.monto < 1000
union all
select 'soporte_pendiente', p.id::text, p.fecha::text, null, p.descripcion, p.valor
from public.soportes_pendientes p
where p.valor > 0 and p.valor < 1000
union all
select 'presupuesto', pi.id::text, null, e.nombre, pi.nombre, pi.valor_mensual
from public.presupuesto_items pi left join public.empresas e on e.id = pi.empresa_id
where pi.valor_mensual > 0 and pi.valor_mensual < 1000 and coalesce(e.nombre, '') <> 'ARKO'
order by 1, 3 desc nulls last;
