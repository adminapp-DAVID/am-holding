-- Permisos de la clave de servidor (service_role) sobre el esquema public.
-- Las Edge Functions (integracion-noss) leen y escriben con service_role; en este proyecto las tablas no
-- tenían GRANT para ese rol ("permission denied for table usuarios"). service_role solo existe en el
-- servidor (nunca en el navegador) y ya ignora RLS, así que darle acceso a las tablas no abre nada al público.
-- Idempotente.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Tablas, secuencias y funciones que se creen después.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- Verificación: debe devolver 0 filas (tablas de public sin SELECT para service_role).
select c.relname as tabla_sin_permiso
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
  and not has_table_privilege('service_role', c.oid, 'SELECT');
