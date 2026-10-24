-- =====================================================================================
-- Notificaciones sin ruido: agrupadas por solicitud / cuenta de cobro y sin avisar al equipo
-- administrativo de lo que hace el propio equipo
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- Requiere 20261010 (auditoría), 20261024 (columna entidad_id) y 20261025 (current_rol_base).
--
-- Antes: cada cambio de estado de una solicitud le llegaba a TODO el equipo administrativo
-- (Administrador, Coordinadora, Gerente Financiero), aunque lo hiciera otro del equipo, y cada
-- cambio sumaba una notificación nueva (p. ej. Aprobado → Pendiente → Aprobado → Pagado = 4).
-- Ahora:
--   • El equipo administrativo solo recibe lo que hacen los demás (crear, reenviar…).
--   • Una sola notificación SIN LEER por solicitud / cuenta de cobro y persona: el cambio
--     nuevo actualiza la existente (mensaje y hora). Ya leída, el próximo cambio crea otra.
--   • Limpieza: de las sin leer de hoy hacia atrás, queda solo la más reciente de cada registro.
-- La auditoría no cambia (sigue registrando todo, con el rol real).
-- =====================================================================================

begin;

create or replace function public.notificar_agrupada(
  p_destinatario anyelement, p_tipo text, p_mensaje text, p_enlace text, p_auditoria_id bigint, p_entidad text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_destinatario is null then return; end if;
  update public.notificaciones
     set mensaje = p_mensaje, enlace = p_enlace, auditoria_id = p_auditoria_id, created_at = now()
   where destinatario_id::text = p_destinatario::text and tipo = p_tipo and entidad_id = p_entidad and not leida;
  if not found then
    insert into public.notificaciones (destinatario_id, tipo, mensaje, enlace, auditoria_id, entidad_id)
    values (p_destinatario, p_tipo, p_mensaje, p_enlace, p_auditoria_id, p_entidad);
  end if;
end;
$$;
revoke all on function public.notificar_agrupada(anyelement, text, text, text, bigint, text) from public, anon, authenticated;

create or replace function public.auditar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_fila jsonb := coalesce(v_new, v_old);
  v_antes jsonb;
  v_despues jsonb;
  v_accion text;
  v_modulo text;
  v_usuario_id text := public.current_usuario_id()::text;
  v_usuario_nombre text;
  v_rol text := public.current_rol_base();  -- rol real (Gerente Financiero, no el de permisos)
  v_equipo boolean := coalesce(public.current_rol(), '') in ('Administrador', 'Coordinadora Administrativa');
  v_registro text;
  v_auditoria_id bigint;
  v_estado_old text := v_old ->> 'estado';
  v_estado_new text := v_new ->> 'estado';
  v_duenio text;
  v_duenio_nombre text;
  v_mensaje text;
  v_enlace text;
  v_tipo text;
  r record;
begin
  -- Edición: solo los campos que cambiaron (sin marcas de tiempo). Sin cambios reales → nada.
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      into v_antes, v_despues
    from jsonb_object_keys(v_new) k
    where k not in ('updated_at', 'actualizado_at') and (v_old -> k) is distinct from (v_new -> k);
    if v_antes is null then return new; end if;
    v_accion := case when v_estado_old is distinct from v_estado_new then 'Cambio de estado' else 'Edición' end;
  elsif tg_op = 'INSERT' then
    v_accion := 'Creación'; v_despues := jsonb_strip_nulls(v_new);
  else
    v_accion := 'Eliminación'; v_antes := jsonb_strip_nulls(v_old);
  end if;

  v_modulo := case tg_table_name
    when 'solicitudes' then 'Solicitudes'
    when 'cuentas_cobro' then 'Cuentas de Cobro'
    when 'gastos' then 'Finanzas'
    when 'ingresos' then 'Finanzas'
    when 'terceros' then 'Terceros'
    when 'usuarios' then 'Colaboradores'
    when 'empresas' then 'Configuración'
    when 'cecos' then 'Configuración'
    when 'soportes' then 'Soportes'
    when 'config_bancaria_empresa' then 'Datos Bancarios'
    when 'lotes_pago_banco' then 'Pagos PAB'
    else 'Presupuesto'
  end;

  v_registro := left(coalesce(
    nullif(v_fila ->> 'nombre', ''), nullif(v_fila ->> 'detalle', ''), nullif(v_fila ->> 'nombre_original', ''),
    nullif(v_fila ->> 'codigo', ''), case when v_fila ? 'numero' then '#' || (v_fila ->> 'numero') end
  ), 200);
  if v_usuario_id is not null then
    select nombre into v_usuario_nombre from public.usuarios where id::text = v_usuario_id;
  end if;

  insert into public.auditoria (usuario_id, usuario_nombre, rol, modulo, accion, tabla, registro_id, registro, antes, despues)
  values (public.current_usuario_id(), coalesce(v_usuario_nombre, 'Sistema'), v_rol, v_modulo, v_accion,
          tg_table_name, v_fila ->> 'id', v_registro, v_antes, v_despues)
  returning id into v_auditoria_id;

  -- Notificaciones: solo Solicitudes y Cuentas de Cobro, al crear o cambiar de estado. Si algo
  -- falla aquí NO se bloquea la acción del usuario (la auditoría ya quedó escrita).
  begin
  if tg_table_name in ('solicitudes', 'cuentas_cobro') and v_accion in ('Creación', 'Cambio de estado') then
    v_duenio := v_fila ->> 'responsable_id';
    select nombre into v_duenio_nombre from public.usuarios where id::text = v_duenio;
    if tg_table_name = 'solicitudes' then
      v_tipo := 'solicitud'; v_enlace := 'solicitudes';
      v_mensaje := 'Solicitud de ' || coalesce(v_fila ->> 'tipo', '') ||
        coalesce(' — ' || nullif(left(v_fila ->> 'detalle', 80), ''), '');
    else
      v_tipo := 'cuenta_cobro'; v_enlace := 'cuentasCobro';
      v_mensaje := 'Cuenta de cobro' || coalesce(' #' || (v_fila ->> 'numero'), '') ||
        coalesce(' (' || (v_fila ->> 'mes') || '/' || (v_fila ->> 'anio') || ')', '');
    end if;
    v_mensaje := v_mensaje || case when v_accion = 'Creación'
      then ': creada' || coalesce(' por ' || v_usuario_nombre, '')
      else ': ' || coalesce(v_estado_old, '—') || ' → ' || coalesce(v_estado_new, '—') || coalesce(' por ' || v_usuario_nombre, '') end;
    if v_estado_new = 'Devuelto' and v_accion = 'Cambio de estado' then
      v_mensaje := v_mensaje || coalesce('. Motivo: ' || nullif(v_fila ->> 'motivo_devolucion', ''), '');
    end if;

    -- Al dueño, si no fue él quien hizo la acción. Una sola notificación sin leer por registro
    -- (se actualiza con el último cambio en vez de sumar otra).
    if v_duenio is not null and v_duenio is distinct from v_usuario_id then
      perform public.notificar_agrupada((select id from public.usuarios where id::text = v_duenio), v_tipo, 'Tu ' || lower(left(v_mensaje, 1)) || substr(v_mensaje, 2), v_enlace, v_auditoria_id, v_fila ->> 'id');
    end if;
    -- Al equipo administrativo (Administrador / Coordinadora / Gerente Financiero), solo cuando
    -- actúa alguien de fuera del equipo (crear, reenviar…): lo que hace el propio equipo queda
    -- en Auditoría y no se le notifica a los demás.
    if not v_equipo then
      for r in select id from public.usuarios
               where rol in ('Administrador', 'Coordinadora Administrativa', 'Gerente Financiero')
                 and id::text is distinct from v_usuario_id and id::text is distinct from v_duenio loop
        perform public.notificar_agrupada(r.id, v_tipo,
          v_mensaje || case when v_duenio is distinct from v_usuario_id then coalesce(' · ' || v_duenio_nombre, '') else '' end, v_enlace, v_auditoria_id, v_fila ->> 'id');
      end loop;
    end if;
  end if;

  -- Perfil completado → sus recordatorios pendientes quedan leídos.
  -- (if anidado: plpgsql no garantiza cortocircuito y faltantes_perfil solo acepta usuarios)
  if tg_table_name = 'usuarios' and tg_op = 'UPDATE' then
    if cardinality(public.faltantes_perfil(new)) = 0 then
      update public.notificaciones set leida = true
      where destinatario_id = new.id and tipo = 'perfil' and not leida;
    end if;
  end if;
  exception when others then
    raise warning 'auditar_cambio: no se pudieron generar notificaciones: %', sqlerrm;
  end;

  return coalesce(new, old);
end;
$$;

-- Limpieza de lo acumulado ---------------------------------------------------------------------
-- a) Las notificaciones viejas de solicitudes / cuentas de cobro no traían a qué registro se
--    referían: se toma de su fila de auditoría.
update public.notificaciones n set entidad_id = a.registro_id
from public.auditoria a
where n.auditoria_id = a.id and n.entidad_id is null and n.tipo in ('solicitud', 'cuenta_cobro');

-- b) Sin leer: queda solo la más reciente por persona y registro.
update public.notificaciones n set leida = true
where not n.leida and n.tipo in ('solicitud', 'cuenta_cobro') and n.entidad_id is not null
  and exists (select 1 from public.notificaciones m
              where m.destinatario_id = n.destinatario_id and m.tipo = n.tipo and m.entidad_id = n.entidad_id
                and not m.leida and (m.created_at, m.id) > (n.created_at, n.id));

-- c) Sin leer del equipo administrativo sobre cambios que hizo otro del mismo equipo.
update public.notificaciones n set leida = true
from public.auditoria a, public.usuarios u
where not n.leida and n.auditoria_id = a.id and u.id = n.destinatario_id
  and n.tipo in ('solicitud', 'cuenta_cobro')
  and u.rol in ('Administrador', 'Coordinadora Administrativa', 'Gerente Financiero')
  and a.rol in ('Administrador', 'Coordinadora Administrativa', 'Gerente Financiero')
  and n.mensaje not like 'Tu %';

commit;

-- Verificación (solo lectura): notificaciones sin leer por persona.
select u.nombre, u.rol, count(*) filter (where not n.leida) as sin_leer
from public.usuarios u left join public.notificaciones n on n.destinatario_id = u.id
group by u.nombre, u.rol having count(*) filter (where not n.leida) > 0
order by sin_leer desc;
