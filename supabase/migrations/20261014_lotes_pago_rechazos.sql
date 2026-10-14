-- =====================================================================================
-- Lotes PAB: pagos rechazados por el banco y cierre parcial
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Es idempotente y compatible con la versión actual de la app (solo agrega columnas/estados).
--
-- • Cada ítem guarda el resultado que reportó el banco (Pagado / Rechazado) y el motivo.
-- • Un ítem rechazado queda inactivo: su solicitud / concepto vuelve a quedar libre para
--   exportarse en otro lote.
-- • Al cerrar: si hubo rechazos el lote queda "Pagado parcial"; si TODOS se rechazaron, "Rechazado".
-- =====================================================================================

begin;

alter table public.lotes_pago_banco_items add column if not exists resultado text;
alter table public.lotes_pago_banco_items add column if not exists motivo_rechazo text;
alter table public.lotes_pago_banco_items drop constraint if exists lotes_pago_banco_items_resultado_check;
alter table public.lotes_pago_banco_items add constraint lotes_pago_banco_items_resultado_check
  check (resultado is null or resultado in ('Pagado', 'Rechazado'));

alter table public.lotes_pago_banco drop constraint if exists lotes_pago_banco_estado_check;
alter table public.lotes_pago_banco add constraint lotes_pago_banco_estado_check
  check (estado in ('Generado', 'Pagado', 'Pagado parcial', 'Rechazado', 'Anulado'));

-- Marca como rechazados por el banco algunos pagos de un lote todavía "Generado".
-- p_items: [{ "entidad_clave": "...", "motivo": "..." }]
create or replace function public.rechazar_items_lote_pago_banco(p_lote_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_estado text; v_n integer;
begin
  if public.current_rol() not in ('Administrador', 'Coordinadora Administrativa') then
    raise exception 'Sin permiso para registrar rechazos del banco';
  end if;
  select estado into v_estado from public.lotes_pago_banco where id = p_lote_id for update;
  if v_estado is null then raise exception 'Lote no encontrado'; end if;
  if v_estado <> 'Generado' then raise exception 'El lote ya está %', v_estado; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Formato de rechazos no válido'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) x where coalesce(trim(x->>'motivo'), '') = '') then
    raise exception 'Indica el motivo de cada pago rechazado';
  end if;

  update public.lotes_pago_banco_items i
     set activo = false, resultado = 'Rechazado', motivo_rechazo = trim(x->>'motivo')
    from jsonb_array_elements(p_items) x
   where i.lote_id = p_lote_id and i.activo and i.entidad_clave = x->>'entidad_clave';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Marcar pagado (Administrador o Coordinadora) o anular (solo Administrador). Anular libera los
-- registros para volver a exportarlos. Al marcar pagado, el estado final depende de los rechazos.
create or replace function public.cerrar_lote_pago_banco(p_lote_id uuid, p_estado text, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_estado text; v_activos integer; v_rechazados integer;
begin
  select estado into v_estado from public.lotes_pago_banco where id = p_lote_id for update;
  if v_estado is null then raise exception 'Lote no encontrado'; end if;
  if v_estado <> 'Generado' then raise exception 'El lote ya está %', v_estado; end if;

  if p_estado = 'Pagado' then
    if public.current_rol() not in ('Administrador', 'Coordinadora Administrativa') then
      raise exception 'Sin permiso para marcar lotes como pagados';
    end if;
    select count(*) filter (where activo), count(*) filter (where resultado = 'Rechazado')
      into v_activos, v_rechazados
      from public.lotes_pago_banco_items where lote_id = p_lote_id;
    update public.lotes_pago_banco_items set resultado = 'Pagado' where lote_id = p_lote_id and activo;
    update public.lotes_pago_banco
       set estado = case when v_activos = 0 then 'Rechazado' when v_rechazados > 0 then 'Pagado parcial' else 'Pagado' end,
           cerrado_por = public.current_usuario_id(), cerrado_at = now()
     where id = p_lote_id;
  elsif p_estado = 'Anulado' then
    if public.current_rol() <> 'Administrador' then
      raise exception 'Solo el Administrador puede anular lotes';
    end if;
    if coalesce(trim(p_motivo), '') = '' then raise exception 'Indica el motivo de la anulación'; end if;
    update public.lotes_pago_banco
       set estado = 'Anulado', cerrado_por = public.current_usuario_id(), cerrado_at = now(), motivo_anulacion = trim(p_motivo)
     where id = p_lote_id;
    update public.lotes_pago_banco_items set activo = false where lote_id = p_lote_id;
  else
    raise exception 'Estado no válido: %', p_estado;
  end if;
end;
$$;

revoke all on function public.rechazar_items_lote_pago_banco(uuid, jsonb) from public;
grant execute on function public.rechazar_items_lote_pago_banco(uuid, jsonb) to authenticated;
revoke all on function public.cerrar_lote_pago_banco(uuid, text, text) from public;
grant execute on function public.cerrar_lote_pago_banco(uuid, text, text) to authenticated;

commit;

-- Verificación (solo lectura): deben salir las 2 columnas nuevas.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'lotes_pago_banco_items' and column_name in ('resultado', 'motivo_rechazo');
