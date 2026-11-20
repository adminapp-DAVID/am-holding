-- Pagos recurrentes a un tercero (p. ej. el Diezmo a COMUNIDAD MDE): quedan SIEMPRE como "Pago a Tercero",
-- se paguen por Solicitud o desde Presupuesto (Marcar pagado, lote PAB, liquidación).
-- · Trigger en gastos: si el gasto se liga a un concepto de Presupuesto que tiene tercero (beneficiario), pasa a
--   tipo 'Pago a Tercero' con tercero_id y tercero_info (datos bancarios) del tercero.
-- · Arregla los gastos ya ligados a conceptos con tercero.
-- (Ligar al concepto los Pagos a Tercero viejos que se hicieron por Solicitud va en una consulta aparte, revisada antes.)
-- Idempotente.

create or replace function public.gasto_pago_tercero_presupuesto() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record;
begin
  if new.presupuesto_item_id is null or new.tipo not in ('Gasto', 'Pago a Tercero') then return new; end if;
  select te.* into t
  from public.presupuesto_items pi join public.terceros te on te.id::text = pi.tercero_id::text
  where pi.id::text = new.presupuesto_item_id::text;
  if not found then return new; end if;
  new.tipo := 'Pago a Tercero';
  if new.tercero_id is null then new.tercero_id := t.id; end if;
  if new.tercero_info is null then
    new.tercero_info := jsonb_strip_nulls(jsonb_build_object(
      'nombre', t.nombre, 'dni', t.dni, 'tipoDocumento', t.tipo_documento, 'paisOrigen', t.pais_origen,
      'banco', t.banco, 'codigoBanco', t.codigo_banco, 'tipoCuenta', t.tipo_cuenta, 'numeroCuenta', t.numero_cuenta));
  end if;
  return new;
end $$;

drop trigger if exists gasto_pago_tercero_presupuesto on public.gastos;
create trigger gasto_pago_tercero_presupuesto before insert or update of presupuesto_item_id on public.gastos
  for each row execute function public.gasto_pago_tercero_presupuesto();

-- Gastos ya ligados a un concepto con tercero (el trigger hace el cambio al "tocar" presupuesto_item_id).
update public.gastos g set presupuesto_item_id = g.presupuesto_item_id
from public.presupuesto_items pi
where pi.id::text = g.presupuesto_item_id::text and pi.tercero_id is not null
  and (g.tipo = 'Gasto' or g.tercero_info is null);

-- Verificación: gastos ligados a un concepto con tercero que NO quedaron como Pago a Tercero (debe dar 0 filas).
select g.id, g.fecha, g.tipo, g.detalle
from public.gastos g join public.presupuesto_items pi on pi.id::text = g.presupuesto_item_id::text
where pi.tercero_id is not null and g.tipo <> 'Pago a Tercero';
