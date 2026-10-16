-- =====================================================================================
-- Soporte técnico (tickets): errores, mejoras y peticiones para la app — adaptado de Noss App
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de probar el PR (el preview usa la base real).
-- Es idempotente: se puede correr más de una vez. No modifica datos existentes.
-- Requiere 20261010_auditoria_notificaciones.sql (tabla notificaciones + notificar()).
--
-- • Crean, ven, comentan y apoyan ("a mí también") los tickets: Administrador, Coordinadora
--   Administrativa, Gerente y Colaborador (usa_soporte()). Todos ven todos los tickets, para no
--   repetir peticiones.
-- • Gestionan (estado, prioridad, respuesta, envío a GitHub): Administrador y Gerente
--   (gestiona_soporte()). El trigger tickets_antes impide que los demás cambien esos campos.
-- • Historial y avisos en la campana 🔔 los generan triggers (enlace "soporte/<id del ticket>").
-- • Capturas y archivos: bucket privado "tickets-adjuntos" (carpeta = id del ticket). OJO: no
--   es el bucket "soportes" (comprobantes de pagos).
-- =====================================================================================

begin;

-- 1) Roles ---------------------------------------------------------------------------------
create or replace function public.usa_soporte() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_rol() in ('Administrador', 'Coordinadora Administrativa', 'Gerente', 'Colaborador'), false)
$$;

create or replace function public.gestiona_soporte() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_rol() in ('Administrador', 'Gerente'), false)
$$;

revoke all on function public.usa_soporte() from public, anon;
revoke all on function public.gestiona_soporte() from public, anon;
grant execute on function public.usa_soporte() to authenticated;
grant execute on function public.gestiona_soporte() to authenticated;

-- 2) Tablas (el tipo de usuarios.id se lee de la base, como en las demás migraciones) --------
do $$
declare tipo_usuario text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_usuario
  from pg_attribute a where a.attrelid = 'public.usuarios'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.tickets (
      id uuid primary key default gen_random_uuid(),
      numero int generated always as identity unique,
      tipo text not null default 'Mejora' check (tipo in ('Error', 'Mejora', 'Nueva función', 'Duda', 'Datos')),
      titulo text not null check (length(trim(titulo)) > 0),
      descripcion text,
      modulo text,
      pantalla text,                         -- vista de la app desde donde se reportó
      prioridad text not null default 'Media' check (prioridad in ('Alta', 'Media', 'Baja')),
      estado text not null default 'Nuevo'
        check (estado in ('Nuevo', 'En revisión', 'Necesita información', 'Aprobado', 'En desarrollo', 'Publicado', 'Rechazado')),
      respuesta text,                        -- nota de quien gestiona (motivo de rechazo, qué se hizo…)
      adjuntos text[] not null default '{}', -- bucket tickets-adjuntos: {ticket_id}/archivo
      github_issue int,
      github_url text,
      creado_por %1$s references public.usuarios(id) on delete set null default public.current_usuario_id(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      cerrado_at timestamptz
    )$f$, tipo_usuario);

  execute format($f$
    create table if not exists public.ticket_comentarios (
      id uuid primary key default gen_random_uuid(),
      ticket_id uuid not null references public.tickets(id) on delete cascade,
      autor_id %1$s references public.usuarios(id) on delete set null default public.current_usuario_id(),
      texto text not null check (length(trim(texto)) > 0),
      created_at timestamptz not null default now()
    )$f$, tipo_usuario);

  execute format($f$
    create table if not exists public.ticket_apoyos (
      ticket_id uuid not null references public.tickets(id) on delete cascade,
      usuario_id %1$s not null references public.usuarios(id) on delete cascade default public.current_usuario_id(),
      created_at timestamptz not null default now(),
      primary key (ticket_id, usuario_id)
    )$f$, tipo_usuario);

  execute format($f$
    create table if not exists public.ticket_historial (
      id uuid primary key default gen_random_uuid(),
      ticket_id uuid not null references public.tickets(id) on delete cascade,
      fecha timestamptz not null default now(),
      actor_id %1$s references public.usuarios(id) on delete set null,
      evento text not null,                  -- creado, estado, prioridad, github
      detalle text
    )$f$, tipo_usuario);
end $$;

create index if not exists tickets_estado_idx on public.tickets (estado, created_at desc);
create index if not exists ticket_comentarios_idx on public.ticket_comentarios (ticket_id, created_at);
create index if not exists ticket_historial_idx on public.ticket_historial (ticket_id, fecha);

-- 3) Avisos ------------------------------------------------------------------------------------
-- Quienes gestionan soporte.
create or replace function public.gestores_soporte() returns setof public.usuarios.id%type
language sql stable security definer set search_path = public as $$
  select u.id from public.usuarios u where u.rol in ('Administrador', 'Gerente')
$$;
revoke all on function public.gestores_soporte() from public, anon, authenticated;

-- Creador, quienes apoyaron y quienes comentaron.
create or replace function public.interesados_ticket(t uuid) returns setof public.usuarios.id%type
language sql stable security definer set search_path = public as $$
  select creado_por from public.tickets where id = t and creado_por is not null
  union select usuario_id from public.ticket_apoyos where ticket_id = t
  union select autor_id from public.ticket_comentarios where ticket_id = t and autor_id is not null
$$;
revoke all on function public.interesados_ticket(uuid) from public, anon, authenticated;

create or replace function public.tickets_al_crear() returns trigger
language plpgsql security definer set search_path = public as $$
declare g public.usuarios.id%type;
begin
  insert into public.ticket_historial (ticket_id, actor_id, evento, detalle)
  values (new.id, new.creado_por, 'creado', new.tipo || ' · ' || new.titulo);
  for g in select * from public.gestores_soporte() loop
    if g is distinct from new.creado_por then
      perform public.notificar(g, 'ticket', 'Nuevo ticket #' || new.numero || ' (' || new.tipo || '): ' || new.titulo,
        'soporte/' || new.id, null::bigint);
    end if;
  end loop;
  return null;
exception when others then
  raise warning 'tickets_al_crear: %', sqlerrm;
  return null;
end $$;
drop trigger if exists tickets_al_crear on public.tickets;
create trigger tickets_al_crear after insert on public.tickets for each row execute function public.tickets_al_crear();

-- Antes de actualizar: solo quien gestiona cambia estado, prioridad, respuesta y GitHub.
create or replace function public.tickets_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.numero := old.numero;
  new.creado_por := old.creado_por;
  new.created_at := old.created_at;
  new.updated_at := now();
  -- (desde el SQL Editor no hay usuario de la app y no se restringe)
  if public.current_usuario_id() is not null and not public.gestiona_soporte() then
    new.estado := old.estado;
    new.prioridad := old.prioridad;
    new.respuesta := old.respuesta;
    new.github_issue := old.github_issue;
    new.github_url := old.github_url;
    -- Si pidieron más información y el autor completa el ticket, vuelve a revisión.
    if old.estado = 'Necesita información'
       and (new.titulo, new.descripcion, new.adjuntos) is distinct from (old.titulo, old.descripcion, old.adjuntos) then
      new.estado := 'En revisión';
    end if;
  end if;
  new.cerrado_at := case when new.estado in ('Publicado', 'Rechazado') then coalesce(old.cerrado_at, now()) end;
  return new;
end $$;
drop trigger if exists tickets_antes on public.tickets;
create trigger tickets_antes before update on public.tickets for each row execute function public.tickets_antes();

create or replace function public.tickets_despues() returns trigger
language plpgsql security definer set search_path = public as $$
declare yo public.usuarios.id%type := public.current_usuario_id(); u public.usuarios.id%type; msg text;
begin
  if new.estado is distinct from old.estado then
    insert into public.ticket_historial (ticket_id, actor_id, evento, detalle)
    values (new.id, yo, 'estado', old.estado || ' → ' || new.estado
      || case when new.estado in ('Necesita información', 'Publicado', 'Rechazado') then coalesce(': ' || nullif(trim(new.respuesta), ''), '') else '' end);
    msg := case new.estado
      when 'Necesita información' then 'Necesitamos más información: ' || coalesce(new.respuesta, 'revisa los comentarios')
      when 'Publicado' then 'Ya está disponible en la app' || coalesce('. ' || new.respuesta, '')
      when 'Rechazado' then 'No se hará' || coalesce(': ' || new.respuesta, '')
      else 'Ahora está: ' || new.estado end;
    begin
      for u in select * from public.interesados_ticket(new.id) loop
        if u is distinct from yo then
          perform public.notificar(u, 'ticket', 'Ticket #' || new.numero || ' (' || new.titulo || ') — ' || msg, 'soporte/' || new.id, null::bigint);
        end if;
      end loop;
      -- El autor completó lo que se pidió: avisar a quienes gestionan.
      if old.estado = 'Necesita información' and new.estado = 'En revisión' then
        for u in select * from public.gestores_soporte() loop
          if u is distinct from yo then
            perform public.notificar(u, 'ticket', 'Ticket #' || new.numero || ' actualizado: ' || new.titulo, 'soporte/' || new.id, null::bigint);
          end if;
        end loop;
      end if;
    exception when others then
      raise warning 'tickets_despues (avisos): %', sqlerrm;
    end;
  end if;
  if new.prioridad is distinct from old.prioridad then
    insert into public.ticket_historial (ticket_id, actor_id, evento, detalle) values (new.id, yo, 'prioridad', old.prioridad || ' → ' || new.prioridad);
  end if;
  if new.github_issue is distinct from old.github_issue and new.github_issue is not null then
    insert into public.ticket_historial (ticket_id, actor_id, evento, detalle) values (new.id, yo, 'github', 'Enviado a GitHub como issue #' || new.github_issue);
  end if;
  return null;
end $$;
drop trigger if exists tickets_despues on public.tickets;
create trigger tickets_despues after update on public.tickets for each row execute function public.tickets_despues();

-- Comentario: avisa a los interesados y, si comenta alguien que no gestiona, a quienes gestionan.
create or replace function public.ticket_comentario_al_crear() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.tickets; u public.usuarios.id%type; quien text; autor_gestiona boolean;
begin
  select * into t from public.tickets where id = new.ticket_id;
  select nombre, rol in ('Administrador', 'Gerente') into quien, autor_gestiona from public.usuarios where id = new.autor_id;
  for u in
    select * from public.interesados_ticket(new.ticket_id)
    union select * from public.gestores_soporte() where not coalesce(autor_gestiona, false)
  loop
    if u is distinct from new.autor_id then
      perform public.notificar(u, 'ticket', coalesce(quien, 'Alguien') || ' comentó el ticket #' || t.numero || ': ' || left(new.texto, 140),
        'soporte/' || t.id, null::bigint);
    end if;
  end loop;
  return null;
exception when others then
  raise warning 'ticket_comentario_al_crear: %', sqlerrm;
  return null;
end $$;
drop trigger if exists ticket_comentario_al_crear on public.ticket_comentarios;
create trigger ticket_comentario_al_crear after insert on public.ticket_comentarios for each row execute function public.ticket_comentario_al_crear();

-- 4) Seguridad (RLS) ---------------------------------------------------------------------------
alter table public.tickets enable row level security;
alter table public.ticket_comentarios enable row level security;
alter table public.ticket_apoyos enable row level security;
alter table public.ticket_historial enable row level security;

revoke all on public.tickets, public.ticket_comentarios, public.ticket_apoyos, public.ticket_historial from anon;
grant select, insert, update, delete on public.tickets, public.ticket_comentarios, public.ticket_apoyos to authenticated;
grant select on public.ticket_historial to authenticated;  -- el historial solo lo escriben los triggers

drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select to authenticated using (public.usa_soporte());
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert to authenticated
  with check (public.usa_soporte() and creado_por = public.current_usuario_id());
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets for update to authenticated
  using (public.gestiona_soporte()
         or (public.usa_soporte() and creado_por = public.current_usuario_id() and estado in ('Nuevo', 'Necesita información')))
  with check (public.gestiona_soporte() or creado_por = public.current_usuario_id()); -- el estado lo controla tickets_antes
drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets for delete to authenticated
  using (public.gestiona_soporte() or (public.usa_soporte() and creado_por = public.current_usuario_id() and estado = 'Nuevo'));

drop policy if exists ticket_comentarios_select on public.ticket_comentarios;
create policy ticket_comentarios_select on public.ticket_comentarios for select to authenticated using (public.usa_soporte());
drop policy if exists ticket_comentarios_insert on public.ticket_comentarios;
create policy ticket_comentarios_insert on public.ticket_comentarios for insert to authenticated
  with check (public.usa_soporte() and autor_id = public.current_usuario_id());
drop policy if exists ticket_comentarios_delete on public.ticket_comentarios;
create policy ticket_comentarios_delete on public.ticket_comentarios for delete to authenticated
  using (autor_id = public.current_usuario_id() or public.gestiona_soporte());

drop policy if exists ticket_apoyos_select on public.ticket_apoyos;
create policy ticket_apoyos_select on public.ticket_apoyos for select to authenticated using (public.usa_soporte());
drop policy if exists ticket_apoyos_insert on public.ticket_apoyos;
create policy ticket_apoyos_insert on public.ticket_apoyos for insert to authenticated
  with check (public.usa_soporte() and usuario_id = public.current_usuario_id());
drop policy if exists ticket_apoyos_delete on public.ticket_apoyos;
create policy ticket_apoyos_delete on public.ticket_apoyos for delete to authenticated
  using (usuario_id = public.current_usuario_id());

drop policy if exists ticket_historial_select on public.ticket_historial;
create policy ticket_historial_select on public.ticket_historial for select to authenticated using (public.usa_soporte());

-- Nombres de quienes participan en tickets (autor, apoyos, comentarios, historial): la tabla
-- usuarios puede no ser legible para todos los roles, así que la app los pide por aquí.
create or replace function public.nombres_usuarios_soporte() returns table (id text, nombre text)
language sql stable security definer set search_path = public as $$
  select u.id::text, u.nombre from public.usuarios u
  where public.usa_soporte() and (
    u.id in (select creado_por from public.tickets)
    or u.id in (select usuario_id from public.ticket_apoyos)
    or u.id in (select autor_id from public.ticket_comentarios)
    or u.id in (select actor_id from public.ticket_historial)
  )
$$;
revoke all on function public.nombres_usuarios_soporte() from public, anon;
grant execute on function public.nombres_usuarios_soporte() to authenticated;

-- 5) Capturas y archivos: bucket privado "tickets-adjuntos", carpeta = id del ticket ----------
-- Suben archivos el autor del ticket o quien gestiona; los borran los mismos.
insert into storage.buckets (id, name, public) values ('tickets-adjuntos', 'tickets-adjuntos', false) on conflict (id) do nothing;

create or replace function public.puede_adjuntar_ticket(p_carpeta text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.usa_soporte() and (
    public.gestiona_soporte()
    or exists (select 1 from public.tickets t where t.id::text = p_carpeta and t.creado_por = public.current_usuario_id())
  )
$$;
revoke all on function public.puede_adjuntar_ticket(text) from public, anon;
grant execute on function public.puede_adjuntar_ticket(text) to authenticated;

drop policy if exists tickets_adjuntos_select on storage.objects;
create policy tickets_adjuntos_select on storage.objects for select to authenticated
  using (bucket_id = 'tickets-adjuntos' and public.usa_soporte());
drop policy if exists tickets_adjuntos_insert on storage.objects;
create policy tickets_adjuntos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tickets-adjuntos' and public.puede_adjuntar_ticket(split_part(name, '/', 1)));
drop policy if exists tickets_adjuntos_delete on storage.objects;
create policy tickets_adjuntos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tickets-adjuntos' and public.puede_adjuntar_ticket(split_part(name, '/', 1)));

commit;

-- Verificación (solo lectura): deben salir las 4 tablas y el bucket.
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('tickets', 'ticket_comentarios', 'ticket_apoyos', 'ticket_historial')
union all
select 'bucket: ' || id from storage.buckets where id = 'tickets-adjuntos';
