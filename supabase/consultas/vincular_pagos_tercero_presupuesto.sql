-- PASO 1 (solo lectura): candidatos para ligar a su concepto de Presupuesto los pagos viejos a un tercero
-- que se registraron sueltos (Pago a Tercero por Solicitud, o Gasto a mano / importado).
-- · motivo 'mismo tercero': Pago a Tercero al mismo tercero y empresa del concepto.
-- · motivo 'mismo concepto': Gasto de la misma empresa y CECO cuyo detalle contiene la primera palabra del concepto.
-- · ya_pagado_ese_mes = true: ese mes ya tiene un gasto ligado al concepto (NO se liga, sería doble).
select pi.nombre as concepto, g.id as gasto_id, g.fecha, g.tipo, g.detalle, g.valor,
       case when g.tipo = 'Pago a Tercero' then 'mismo tercero' else 'mismo concepto' end as motivo,
       exists (select 1 from public.gastos x where x.presupuesto_item_id::text = pi.id::text
               and to_char(x.fecha, 'YYYY-MM') = to_char(g.fecha, 'YYYY-MM')) as ya_pagado_ese_mes
from public.presupuesto_items pi
join public.gastos g on g.presupuesto_item_id is null and g.empresa_id::text = pi.empresa_id::text
 and ( (g.tipo = 'Pago a Tercero' and g.tercero_id::text = pi.tercero_id::text)
    or (g.tipo = 'Gasto' and g.ceco_id::text = pi.ceco_id::text and g.detalle ilike '%' || split_part(trim(pi.nombre), ' ', 1) || '%') )
where pi.tercero_id is not null
order by pi.nombre, g.fecha;
