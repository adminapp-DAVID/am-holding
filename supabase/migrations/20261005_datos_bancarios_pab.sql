-- =====================================================================================
-- Datos bancarios para pagos masivos PAB (Bancolombia) — PR 1
--
-- Correr COMPLETO en Supabase → SQL Editor ANTES de hacer merge del PR (la app nueva lee
-- estas columnas; sin ellas, Colaboradores / Mi Perfil / Terceros fallan al cargar).
-- Es idempotente: si se corre dos veces no duplica nada ni rompe lo ya migrado.
-- Solo AGREGA columnas/tabla y limpia formato (puntos, guiones, espacios); no borra datos.
-- =====================================================================================

begin;

-- 1) Columnas nuevas -------------------------------------------------------------------
-- tipo_documento: códigos de la plantilla PAB (1 CC, 2 CE, 3 NIT, 4 TI, 5 Pasaporte).
-- codigo_banco:   código ACH de 4 dígitos de la hoja "CODIGOS DE BANCOS", o 'EXTERIOR'
--                 para cuentas fuera de Colombia (no se pagan por PAB).
alter table public.usuarios      add column if not exists tipo_documento smallint, add column if not exists codigo_banco text;
alter table public.terceros      add column if not exists tipo_documento smallint, add column if not exists codigo_banco text;
alter table public.cuentas_cobro add column if not exists tipo_documento smallint, add column if not exists codigo_banco text;

do $$
declare t text;
begin
  foreach t in array array['usuarios', 'terceros', 'cuentas_cobro'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_tipo_documento_chk');
    execute format('alter table public.%I add constraint %I check (tipo_documento between 1 and 5)', t, t || '_tipo_documento_chk');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_codigo_banco_chk');
    execute format($f$alter table public.%I add constraint %I check (codigo_banco ~ '^[0-9]{4}$' or codigo_banco = 'EXTERIOR')$f$, t, t || '_codigo_banco_chk');
  end loop;
end $$;

-- 2) Limpieza de formato ------------------------------------------------------------------
-- Números de cuenta: quitar espacios, puntos y guiones (conserva ceros a la izquierda).
update public.usuarios      set numero_cuenta = regexp_replace(numero_cuenta, '[[:space:].-]', '', 'g') where numero_cuenta ~ '[[:space:].-]';
update public.terceros      set numero_cuenta = regexp_replace(numero_cuenta, '[[:space:].-]', '', 'g') where numero_cuenta ~ '[[:space:].-]';
update public.cuentas_cobro set numero_cuenta = regexp_replace(numero_cuenta, '[[:space:].-]', '', 'g') where numero_cuenta ~ '[[:space:].-]';

-- Documentos: quitar espacios, puntos y comas.
update public.usuarios      set cedula             = regexp_replace(cedula, '[[:space:].,]', '', 'g')             where cedula ~ '[[:space:].,]';
update public.terceros      set dni                = regexp_replace(dni, '[[:space:].,]', '', 'g')                where dni ~ '[[:space:].,]';
update public.cuentas_cobro set responsable_cedula = regexp_replace(responsable_cedula, '[[:space:].,]', '', 'g') where responsable_cedula ~ '[[:space:].,]';

-- Terceros que son empresas (nombre termina en SAS / S.A.S / S.A / LTDA) → NIT.
update public.terceros
set tipo_documento = 3
where tipo_documento is null
  and nombre ~* '(^|[[:space:]])(s\.?a\.?s\.?|s\.?a\.?|ltda\.?)[[:space:]]*$';

-- NIT con dígito de verificación separado por guion ("900123456-7") → sin DV.
-- Solo en los marcados como NIT: en una cédula el guion no significa DV.
update public.terceros set dni = split_part(dni, '-', 1) where tipo_documento = 3 and dni ~ '^[0-9]+-[0-9]$';

-- 3) Banco en texto libre → código ACH -------------------------------------------------
-- Mapeo armado con los textos que existen hoy (diagnóstico 2026-10). "Itau" NO se traduce:
-- la plantilla tiene dos códigos (1006 y 1014) y debe elegirlo una persona. Lo que no
-- reconoce queda en null y aparece en la pantalla "🏦 Datos Bancarios" para completarlo.
create or replace function pg_temp.codigo_banco_de(t text) returns text language sql immutable as $$
  select case upper(trim(translate(coalesce(t, ''), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')))
    when 'BANCOLOMBIA' then '1007'
    when 'BANCOLOMBIA S.A.' then '1007'
    when 'BANCOLOMBIA S.A' then '1007'
    when 'NU' then '1809'
    when 'NU BANK' then '1809'
    when 'NUBANK' then '1809'
    when 'DAVIVIENDA' then '1051'
    when 'BANCO DAVIVIENDA' then '1051'
    when 'DAVIBANK' then '1019'
    when 'DAVIBANK S.A' then '1019'
    when 'DAVIBANK S.A.' then '1019'
    when 'NEQUI' then '1507'
    when 'DAVIPLATA' then '1551'
    when 'BBVA' then '1013'
    when 'BANK OF AMERICA' then 'EXTERIOR'
    when 'BANK OF AMERICA, NATIONAL ASSOCIATION' then 'EXTERIOR'
    when 'CHASE' then 'EXTERIOR'
    when 'CHASE BANK' then 'EXTERIOR'
    when 'BANCO FAMILIAR' then 'EXTERIOR'
    when 'WISE' then 'EXTERIOR'
  end
$$;

update public.usuarios      set codigo_banco = pg_temp.codigo_banco_de(banco) where codigo_banco is null and pg_temp.codigo_banco_de(banco) is not null;
update public.terceros      set codigo_banco = pg_temp.codigo_banco_de(banco) where codigo_banco is null and pg_temp.codigo_banco_de(banco) is not null;
update public.cuentas_cobro set codigo_banco = pg_temp.codigo_banco_de(banco) where codigo_banco is null and pg_temp.codigo_banco_de(banco) is not null;

-- 4) Cuentas origen por empresa (encabezado de la plantilla PAB) ---------------------------
-- empresa_id / actualizado_por se crean con el mismo tipo que empresas.id / usuarios.id.
do $$
declare tipo_id text; tipo_usuario text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo_id
  from pg_attribute a
  where a.attrelid = 'public.empresas'::regclass and a.attname = 'id';
  select format_type(a.atttypid, a.atttypmod) into tipo_usuario
  from pg_attribute a
  where a.attrelid = 'public.usuarios'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.config_bancaria_empresa (
      id uuid primary key default gen_random_uuid(),
      empresa_id %s not null references public.empresas(id),
      nombre_cuenta text not null,                      -- igual al de la app: 'CUENTA BANCOLOMBIA'
      nit_pagador text not null check (nit_pagador ~ '^[0-9]{1,15}$'),       -- sin DV
      numero_cuenta text not null check (numero_cuenta ~ '^[0-9]{6,11}$'),   -- regla celda E2
      tipo_cuenta char(1) not null check (tipo_cuenta in ('S', 'D')),        -- S ahorros, D corriente
      tipo_pago_nomina smallint not null default 225,
      tipo_pago_proveedores smallint not null default 220,
      tipo_pago_terceros smallint not null default 238,
      activo boolean not null default true,
      actualizado_por %s,
      actualizado_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      unique (empresa_id, nombre_cuenta),
      check (tipo_pago_nomina      in (220, 225, 238, 239, 240, 250, 320, 325, 820, 920)),
      check (tipo_pago_proveedores in (220, 225, 238, 239, 240, 250, 320, 325, 820, 920)),
      check (tipo_pago_terceros    in (220, 225, 238, 239, 240, 250, 320, 325, 820, 920))
    )$f$, tipo_id, tipo_usuario);
end $$;

alter table public.config_bancaria_empresa enable row level security;

drop policy if exists config_bancaria_empresa_select on public.config_bancaria_empresa;
create policy config_bancaria_empresa_select on public.config_bancaria_empresa
  for select to authenticated
  using (public.current_rol() in ('Administrador', 'Coordinadora Administrativa'));

drop policy if exists config_bancaria_empresa_admin on public.config_bancaria_empresa;
create policy config_bancaria_empresa_admin on public.config_bancaria_empresa
  for all to authenticated
  using (public.current_rol() = 'Administrador')
  with check (public.current_rol() = 'Administrador');

-- 5) Mi Perfil: tipo de documento y banco ---------------------------------------------------
-- Igual que actualizar_mi_perfil: cada quien toca SOLO su fila y SOLO estas columnas.
create or replace function public.actualizar_mi_perfil_bancario(p_tipo_documento integer, p_codigo_banco text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_usuario_id() is null then
    raise exception 'Sin sesión válida';
  end if;
  update public.usuarios
  set tipo_documento = p_tipo_documento,
      codigo_banco = nullif(p_codigo_banco, '')
  where id = public.current_usuario_id();
end;
$$;

revoke all on function public.actualizar_mi_perfil_bancario(integer, text) from public;
grant execute on function public.actualizar_mi_perfil_bancario(integer, text) to authenticated;

commit;

-- 6) Resumen (solo lectura): lo que queda por completar a mano --------------------------------
select origen,
       count(*) filter (where tipo_documento is null) as sin_tipo_documento,
       count(*) filter (where codigo_banco is null)   as sin_codigo_banco,
       count(*) filter (where codigo_banco = 'EXTERIOR') as cuentas_exterior,
       count(*) as total
from (
  select 'usuarios' as origen, tipo_documento, codigo_banco from public.usuarios
  union all
  select 'terceros', tipo_documento, codigo_banco from public.terceros where activo is not false
) t
group by origen;
