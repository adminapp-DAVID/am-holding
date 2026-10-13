-- =====================================================================================
-- Solicitudes (RLS):
--  1) El rol Colaborador queda igual que Responsable/Gerente: ve, crea y elimina SOLO lo propio.
--  2) El dueño puede corregir su solicitud Pendiente o Devuelta (al guardar vuelve a Pendiente).
--     Antes solo podía editar las Pendientes y las Devueltas fallaban.
-- Admin/Coordinadora y la lectura de Contadora no cambian. Idempotente.
-- =====================================================================================
begin;

-- Quita las políticas viejas de "lo propio" (se buscan por nombre porque uno quedó recortado a 63 caracteres).
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'solicitudes'
             and (policyname like 'solicitudes: Responsable y Gerente eliminan lo propio%'
               or policyname like 'solicitudes: Responsable, Gerente, Admin y Coordinadora crean%'
               or policyname like 'solicitudes: Responsable y Gerente ven solo lo propio%'
               or policyname = 'Responsable edita su propia solicitud pendiente'
               or policyname like 'solicitudes: propias -%'
               or policyname = 'solicitudes: el dueño corrige lo pendiente o devuelto')
  loop
    execute format('drop policy %I on public.solicitudes', p.policyname);
  end loop;
end $$;

create policy "solicitudes: propias - ver" on public.solicitudes
  for select to authenticated
  using (public.current_rol() in ('Colaborador', 'Responsable', 'Gerente') and responsable_id = public.current_usuario_id());

create policy "solicitudes: propias - crear" on public.solicitudes
  for insert to authenticated
  with check (
    public.current_rol() in ('Administrador', 'Coordinadora Administrativa')
    or (public.current_rol() in ('Colaborador', 'Responsable', 'Gerente') and responsable_id = public.current_usuario_id())
  );

create policy "solicitudes: propias - eliminar" on public.solicitudes
  for delete to authenticated
  using (
    public.current_rol() in ('Administrador', 'Coordinadora Administrativa')
    or (public.current_rol() in ('Colaborador', 'Responsable', 'Gerente') and responsable_id = public.current_usuario_id())
  );

create policy "solicitudes: propias - corregir pendiente o devuelta" on public.solicitudes
  for update to authenticated
  using (responsable_id = public.current_usuario_id() and estado in ('Pendiente', 'Devuelto'))
  with check (responsable_id = public.current_usuario_id() and estado = 'Pendiente');

commit;

-- Verificación (solo lectura): políticas resultantes.
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'solicitudes' order by cmd, policyname;
