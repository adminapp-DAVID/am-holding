-- =====================================================================================
-- Operación Financiera Noss (OFN), etapa 2 en AM Holding
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
--
-- • noss_catalogo: copia de las listas de Noss (procesos misionales, jugadores, clubes). La llena la
--   Edge Function integracion-noss (service role); todos la leen.
-- • solicitudes.ofn (jsonb): { proceso, proceso_nombre, jugadores: [{id, nombre, pct}], clubes: [...] }.
--   Una solicitud con OFN es un gasto de AM SPORTS GROUP SAS y necesita la aprobación de Gerencia Noss
--   ANTES de Coordinación: solicitudes.ofn_aprobacion = Pendiente | Aprobada | Devuelta (+ quién, cuándo,
--   comentario). Solo la cambia ofn_decidir() (desde Noss vía integracion-noss).
-- • Trigger: sin aprobación de Noss la solicitud no puede pasar a Aprobado / Pagado / Legalizado; si se
--   cambia su contenido (ítems, valor, concepto u OFN) la aprobación vuelve a Pendiente.
-- • gastos.ofn: el Gasto generado al pagar hereda la OFN (para el Área Financiera de Noss).
-- =====================================================================================

begin;

create table if not exists public.noss_catalogo (
  tipo text not null check (tipo in ('proceso', 'jugador', 'club')),
  id text not null,
  nombre text not null,
  detalle text,
  orden integer not null default 0,
  activo boolean not null default true,
  actualizado_at timestamptz not null default now(),
  primary key (tipo, id)
);
alter table public.noss_catalogo enable row level security;
grant select on public.noss_catalogo to authenticated;
drop policy if exists noss_catalogo_leer on public.noss_catalogo;
create policy noss_catalogo_leer on public.noss_catalogo for select to authenticated using (true);

alter table public.solicitudes
  add column if not exists ofn jsonb,
  add column if not exists ofn_aprobacion text,
  add column if not exists ofn_aprobado_por text,
  add column if not exists ofn_aprobado_at timestamptz,
  add column if not exists ofn_comentario text;
alter table public.solicitudes drop constraint if exists solicitudes_ofn_aprobacion_check;
alter table public.solicitudes add constraint solicitudes_ofn_aprobacion_check
  check (ofn_aprobacion is null or ofn_aprobacion in ('Pendiente', 'Aprobada', 'Devuelta'));
create index if not exists solicitudes_ofn_pendiente on public.solicitudes (ofn_aprobacion) where ofn is not null;

alter table public.gastos add column if not exists ofn jsonb;

-- Control de la aprobación Noss -------------------------------------------------------------------
create or replace function public.ofn_solicitud_control() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sistema boolean := coalesce(current_setting('app.ofn_sistema', true), '') = 'on';
begin
  if not v_sistema then
    if tg_op = 'INSERT' then
      new.ofn_aprobado_por := null; new.ofn_aprobado_at := null; new.ofn_comentario := null;
      new.ofn_aprobacion := case when new.ofn is not null then 'Pendiente' end;
    else
      -- La decisión solo la escribe ofn_decidir(): la app no la puede tocar.
      new.ofn_aprobacion := old.ofn_aprobacion; new.ofn_aprobado_por := old.ofn_aprobado_por;
      new.ofn_aprobado_at := old.ofn_aprobado_at; new.ofn_comentario := old.ofn_comentario;
      if new.ofn is null then
        new.ofn_aprobacion := null; new.ofn_aprobado_por := null; new.ofn_aprobado_at := null; new.ofn_comentario := null;
      elsif old.ofn is null
         or new.ofn is distinct from old.ofn
         or new.documentos is distinct from old.documentos
         or new.valor is distinct from old.valor
         or new.total_calculado is distinct from old.total_calculado
         or new.detalle is distinct from old.detalle
         or (old.ofn_aprobacion = 'Devuelta' and new.estado = 'Pendiente' and old.estado <> 'Pendiente') then
        -- Cambió lo que Gerencia Noss aprobó: vuelve a su bandeja.
        new.ofn_aprobacion := 'Pendiente'; new.ofn_aprobado_por := null; new.ofn_aprobado_at := null;
      end if;
    end if;
  end if;

  if new.ofn is not null and coalesce(new.ofn_aprobacion, '') <> 'Aprobada'
     and new.estado in ('Aprobado', 'Pagado', 'Legalizado')
     and (tg_op = 'INSERT' or new.estado is distinct from old.estado) then
    raise exception 'Falta la aprobación de Gerencia Noss (Operación Financiera Noss)';
  end if;
  return new;
end;
$$;
drop trigger if exists ofn_solicitud_control on public.solicitudes;
create trigger ofn_solicitud_control before insert or update on public.solicitudes
  for each row execute function public.ofn_solicitud_control();

-- Decisión de Gerencia Noss (solo service role: la llama integracion-noss) ---------------------------
create or replace function public.ofn_decidir(p_solicitud text, p_decision text, p_por text, p_comentario text default null)
returns text language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if p_decision not in ('Aprobada', 'Devuelta') then raise exception 'Decisión no válida'; end if;
  if p_decision = 'Devuelta' and coalesce(trim(p_comentario), '') = '' then raise exception 'Para devolver hace falta el motivo'; end if;
  select id, estado, ofn, ofn_aprobacion into s from public.solicitudes where id::text = p_solicitud for update;
  if not found then return 'no_existe'; end if;
  if s.ofn is null then return 'sin_ofn'; end if;
  if s.ofn_aprobacion is distinct from 'Pendiente' or s.estado <> 'Pendiente' then return 'ya_no_pendiente'; end if;
  perform set_config('app.ofn_sistema', 'on', true);
  update public.solicitudes
     set ofn_aprobacion = p_decision, ofn_aprobado_por = p_por, ofn_aprobado_at = now(),
         ofn_comentario = nullif(trim(coalesce(p_comentario, '')), ''),
         estado = case when p_decision = 'Devuelta' then 'Devuelto' else estado end,
         motivo_devolucion = case when p_decision = 'Devuelta' then 'Gerencia Noss (' || p_por || '): ' || trim(p_comentario) else motivo_devolucion end
   where id = s.id;
  perform set_config('app.ofn_sistema', 'off', true);
  return 'ok';
end;
$$;
revoke all on function public.ofn_decidir(text, text, text, text) from public, anon, authenticated;
grant execute on function public.ofn_decidir(text, text, text, text) to service_role;

commit;

notify pgrst, 'reload schema';

-- Verificación (solo lectura): columnas nuevas creadas.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'solicitudes' and column_name like 'ofn%' order by 1;
