-- =====================================================================================
-- Cambiar el correo de acceso de un usuario desde la app (Colaboradores → editar, solo
-- Administrador): actualiza Authentication (auth.users + su identidad de correo) y public.usuarios.
-- La contraseña NO cambia. Con el mismo correo, "Continuar con Google" entra a la misma cuenta.
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR. Idempotente.
-- =====================================================================================

create or replace function public.cambiar_correo_usuario(p_usuario text, p_correo text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_correo text := lower(trim(p_correo));
  v_auth uuid;
begin
  if public.current_rol() is distinct from 'Administrador' then
    raise exception 'Solo el Administrador cambia correos de acceso';
  end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Correo no válido: %', p_correo;
  end if;
  select auth_user_id into v_auth from public.usuarios where id::text = p_usuario;
  if not found then raise exception 'Usuario no encontrado'; end if;
  if exists (select 1 from public.usuarios where lower(email) = v_correo and id::text <> p_usuario) then
    raise exception 'Ese correo ya lo tiene otro usuario';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_correo and id is distinct from v_auth) then
    raise exception 'Ese correo ya tiene una cuenta de acceso distinta (Authentication)';
  end if;

  update public.usuarios set email = v_correo where id::text = p_usuario;
  if v_auth is not null then
    update auth.users
       set email = v_correo, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
     where id = v_auth;
    update auth.identities
       set identity_data = identity_data || jsonb_build_object('email', v_correo, 'email_verified', true), updated_at = now()
     where user_id = v_auth and provider = 'email';
  end if;
end;
$$;
revoke all on function public.cambiar_correo_usuario(text, text) from public, anon;
grant execute on function public.cambiar_correo_usuario(text, text) to authenticated;

notify pgrst, 'reload schema';

-- Verificación (solo lectura): correos de usuarios vs. Authentication (deben coincidir).
select u.nombre, u.email as correo_app, a.email as correo_acceso
from public.usuarios u left join auth.users a on a.id = u.auth_user_id
where a.email is distinct from u.email
order by u.nombre;

-- =====================================================================================
-- Vincular al entrar: si alguien inicia sesión (ej. con Google) con un correo que ya está en un
-- perfil SIN cuenta de acceso, se liga ese perfil a su cuenta. Solo su propio correo (auth.email()),
-- solo perfiles sin cuenta y solo si el correo de acceso está verificado.
-- =====================================================================================
create or replace function public.vincular_mi_usuario() returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare v_correo text; v_ok boolean;
begin
  select lower(email), email_confirmed_at is not null into v_correo, v_ok from auth.users where id = auth.uid();
  if v_correo is null or not v_ok then return false; end if;
  if exists (select 1 from public.usuarios where auth_user_id = auth.uid()) then return true; end if;
  update public.usuarios set auth_user_id = auth.uid()
   where lower(email) = v_correo and auth_user_id is null;
  return found;
end;
$$;
revoke all on function public.vincular_mi_usuario() from public, anon;
grant execute on function public.vincular_mi_usuario() to authenticated;

notify pgrst, 'reload schema';
