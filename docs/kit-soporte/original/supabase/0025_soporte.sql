-- =========================================================
-- 0025 — Soporte: tickets de errores, mejoras y peticiones de los usuarios
--   * Todos ven todos los tickets (para no repetir) y pueden apoyarlos ("a mí también") y comentar.
--   * Gestionan (estado, prioridad, respuesta, envío a GitHub) quienes tengan soporte.gestionar
--     (el Administrador y los roles con supervisión / Gerencia).
--   * Historial y avisos en la campana los generan triggers.
-- =========================================================

-- ---------- Permisos ----------
insert into public.permisos (clave, modulo, accion, nombre, orden) values
  ('soporte.ver', 'Soporte (tickets)', 'ver', 'Ver', 60),
  ('soporte.crear', 'Soporte (tickets)', 'crear', 'Crear', 61),
  ('soporte.gestionar', 'Especiales', 'soporte.gestionar', 'Gestionar tickets de soporte (estado, prioridad, GitHub)', 62)
on conflict (clave) do update set modulo = excluded.modulo, accion = excluded.accion, nombre = excluded.nombre, orden = excluded.orden;

insert into public.rol_permisos (rol, permiso)
select r.nombre, p.clave from public.roles r cross join (values ('soporte.ver'), ('soporte.crear')) p(clave)
where not r.es_admin
on conflict do nothing;
-- Gestionan: los roles de Gerencia (con supervisión)
insert into public.rol_permisos (rol, permiso)
select distinct rp.rol, 'soporte.gestionar' from public.rol_permisos rp where rp.permiso = 'supervision'
on conflict do nothing;

-- ---------- Tablas ----------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity unique,
  tipo text not null default 'Mejora' check (tipo in ('Error', 'Mejora', 'Nueva función', 'Duda', 'Datos')),
  titulo text not null check (length(trim(titulo)) > 0),
  descripcion text,
  modulo text,
  pantalla text,                        -- ruta de la app desde donde se reportó
  prioridad text not null default 'Media' check (prioridad in ('Alta', 'Media', 'Baja')),
  estado text not null default 'Nuevo'
    check (estado in ('Nuevo', 'En revisión', 'Necesita información', 'Aprobado', 'En desarrollo', 'Publicado', 'Rechazado')),
  respuesta text,                       -- nota de Gerencia (motivo de rechazo, qué se hizo…)
  adjuntos text[] not null default '{}', -- bucket soporte: {ticket_id}/archivo
  github_issue int,
  github_url text,
  creado_por uuid references public.usuarios(id) default public.current_usuario_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cerrado_at timestamptz
);
create index if not exists tickets_estado_idx on public.tickets (estado, created_at desc);

create table if not exists public.ticket_comentarios (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  autor_id uuid references public.usuarios(id) default public.current_usuario_id(),
  texto text not null check (length(trim(texto)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists ticket_comentarios_idx on public.ticket_comentarios (ticket_id, created_at);

create table if not exists public.ticket_apoyos (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade default public.current_usuario_id(),
  created_at timestamptz not null default now(),
  primary key (ticket_id, usuario_id)
);

create table if not exists public.ticket_historial (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  fecha timestamptz not null default now(),
  actor_id uuid references public.usuarios(id),
  evento text not null,                 -- creado, estado, prioridad, github
  detalle text
);
create index if not exists ticket_historial_idx on public.ticket_historial (ticket_id, fecha);

-- ---------- Avisos ----------
-- Quienes gestionan soporte (activos)
create or replace function public.gestores_soporte() returns setof uuid
language sql stable security definer set search_path = public as $$
  select u.id from public.usuarios u where u.activo and public.usuario_tiene_permiso(u.id, 'soporte.gestionar')
$$;
revoke execute on function public.gestores_soporte() from public, anon;

-- Creador, quienes apoyaron y quienes comentaron (sin el que hizo el cambio)
create or replace function public.interesados_ticket(t uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select creado_por from public.tickets where id = t and creado_por is not null
  union select usuario_id from public.ticket_apoyos where ticket_id = t
  union select autor_id from public.ticket_comentarios where ticket_id = t and autor_id is not null
$$;
revoke execute on function public.interesados_ticket(uuid) from public, anon;

create or replace function public.tickets_al_crear() returns trigger
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  insert into public.ticket_historial (ticket_id, actor_id, evento, detalle) values (new.id, new.creado_por, 'creado', new.tipo || ' · ' || new.titulo);
  for g in select * from public.gestores_soporte() loop
    if g is distinct from new.creado_por then
      perform public.notificar(g, 'ticket', 'Nuevo ticket #' || new.numero || ' (' || new.tipo || ')', new.titulo, '/soporte/' || new.id, 'ticket-' || new.id);
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists tickets_al_crear on public.tickets;
create trigger tickets_al_crear after insert on public.tickets for each row execute function public.tickets_al_crear();

-- Antes de actualizar: solo quien gestiona cambia estado, prioridad, respuesta y GitHub
create or replace function public.tickets_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.numero := old.numero;
  new.creado_por := old.creado_por;
  new.created_at := old.created_at;
  new.updated_at := now();
  -- (desde el SQL Editor no hay usuario de la app y no se restringe)
  if public.current_usuario_id() is not null and not public.tiene_permiso('soporte.gestionar') then
    new.estado := old.estado;
    new.prioridad := old.prioridad;
    new.respuesta := old.respuesta;
    new.github_issue := old.github_issue;
    new.github_url := old.github_url;
    -- Si pidieron más información y el autor completa el ticket, vuelve a revisión
    if old.estado = 'Necesita información' and (new.titulo, new.descripcion, new.adjuntos) is distinct from (old.titulo, old.descripcion, old.adjuntos) then
      new.estado := 'En revisión';
    end if;
  end if;
  new.cerrado_at := case when new.estado in ('Publicado', 'Rechazado') then coalesce(old.cerrado_at, now()) else null end;
  return new;
end $$;
drop trigger if exists tickets_antes on public.tickets;
create trigger tickets_antes before update on public.tickets for each row execute function public.tickets_antes();

create or replace function public.tickets_despues() returns trigger
language plpgsql security definer set search_path = public as $$
declare yo uuid := public.current_usuario_id(); u uuid; msg text;
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
    for u in select * from public.interesados_ticket(new.id) loop
      if u is distinct from yo then
        perform public.notificar(u, 'ticket', 'Ticket #' || new.numero || ': ' || new.estado, new.titulo || ' — ' || msg, '/soporte/' || new.id);
      end if;
    end loop;
    -- El autor completó lo que se pidió: avisar a Gerencia
    if old.estado = 'Necesita información' and new.estado = 'En revisión' then
      for u in select * from public.gestores_soporte() loop
        if u is distinct from yo then
          perform public.notificar(u, 'ticket', 'Ticket #' || new.numero || ' actualizado', new.titulo, '/soporte/' || new.id);
        end if;
      end loop;
    end if;
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

-- Comentario: avisa a los interesados y, si comenta alguien que no gestiona, a Gerencia
create or replace function public.ticket_comentario_al_crear() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.tickets; u uuid; quien text;
begin
  select * into t from public.tickets where id = new.ticket_id;
  select nombre into quien from public.usuarios where id = new.autor_id;
  for u in
    select * from public.interesados_ticket(new.ticket_id)
    union select * from public.gestores_soporte() where not public.usuario_tiene_permiso(coalesce(new.autor_id, '00000000-0000-0000-0000-000000000000'::uuid), 'soporte.gestionar')
  loop
    if u is distinct from new.autor_id then
      perform public.notificar(u, 'ticket', coalesce(quien, 'Alguien') || ' comentó el ticket #' || t.numero, left(new.texto, 140), '/soporte/' || t.id);
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists ticket_comentario_al_crear on public.ticket_comentarios;
create trigger ticket_comentario_al_crear after insert on public.ticket_comentarios for each row execute function public.ticket_comentario_al_crear();

-- ---------- Seguridad (RLS) ----------
alter table public.tickets enable row level security;
alter table public.ticket_comentarios enable row level security;
alter table public.ticket_apoyos enable row level security;
alter table public.ticket_historial enable row level security;

drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select using (public.tiene_permiso('soporte.ver'));
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert
  with check (public.tiene_permiso('soporte.crear') and creado_por = public.current_usuario_id());
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets for update
  using (public.tiene_permiso('soporte.gestionar')
         or (creado_por = public.current_usuario_id() and estado in ('Nuevo', 'Necesita información')))
  with check (public.tiene_permiso('soporte.gestionar') or creado_por = public.current_usuario_id()); -- el estado lo controla tickets_antes
drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets for delete
  using (public.tiene_permiso('soporte.gestionar') or (creado_por = public.current_usuario_id() and estado = 'Nuevo'));

drop policy if exists ticket_comentarios_select on public.ticket_comentarios;
create policy ticket_comentarios_select on public.ticket_comentarios for select using (public.tiene_permiso('soporte.ver'));
drop policy if exists ticket_comentarios_insert on public.ticket_comentarios;
create policy ticket_comentarios_insert on public.ticket_comentarios for insert
  with check (public.tiene_permiso('soporte.ver') and autor_id = public.current_usuario_id());
drop policy if exists ticket_comentarios_delete on public.ticket_comentarios;
create policy ticket_comentarios_delete on public.ticket_comentarios for delete
  using (autor_id = public.current_usuario_id() or public.tiene_permiso('soporte.gestionar'));

drop policy if exists ticket_apoyos_select on public.ticket_apoyos;
create policy ticket_apoyos_select on public.ticket_apoyos for select using (public.tiene_permiso('soporte.ver'));
drop policy if exists ticket_apoyos_insert on public.ticket_apoyos;
create policy ticket_apoyos_insert on public.ticket_apoyos for insert
  with check (public.tiene_permiso('soporte.ver') and usuario_id = public.current_usuario_id());
drop policy if exists ticket_apoyos_delete on public.ticket_apoyos;
create policy ticket_apoyos_delete on public.ticket_apoyos for delete using (usuario_id = public.current_usuario_id());

drop policy if exists ticket_historial_select on public.ticket_historial;
create policy ticket_historial_select on public.ticket_historial for select using (public.tiene_permiso('soporte.ver'));
-- (el historial solo lo escriben los triggers)

-- ---------- Capturas y archivos (bucket privado "soporte", carpeta = id del ticket) ----------
insert into storage.buckets (id, name, public) values ('soporte', 'soporte', false) on conflict (id) do nothing;
drop policy if exists soporte_select on storage.objects;
create policy soporte_select on storage.objects for select using (bucket_id = 'soporte' and public.tiene_permiso('soporte.ver'));
drop policy if exists soporte_insert on storage.objects;
create policy soporte_insert on storage.objects for insert with check (bucket_id = 'soporte' and public.tiene_permiso('soporte.crear'));
drop policy if exists soporte_delete on storage.objects;
create policy soporte_delete on storage.objects for delete
  using (bucket_id = 'soporte' and public.tiene_permiso('soporte.gestionar'));
