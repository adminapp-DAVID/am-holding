-- =====================================================================================
-- Cuentas de Cobro (RLS): el rol Colaborador queda igual que Responsable/Gerente —
-- ve y crea SOLO sus propias cuentas de cobro. Antes no podía ni verlas ni crearlas.
-- Admin/Coordinadora (aprobar, pagar, eliminar) y la lectura de Contadora no cambian.
-- Soportes no requiere cambios: ya se ven por dueño de la cuenta, sin importar el rol. Idempotente.
-- =====================================================================================
begin;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'cuentas_cobro'
             and (policyname like 'cuentas_cobro: Responsable, Gerente, Admin y Coordinadora crean%'
               or policyname like 'cuentas_cobro: Responsable y Gerente ven solo lo propio%'
               or policyname like 'cuentas_cobro: propias -%')
  loop
    execute format('drop policy %I on public.cuentas_cobro', p.policyname);
  end loop;
end $$;

create policy "cuentas_cobro: propias - ver" on public.cuentas_cobro
  for select to authenticated
  using (public.current_rol() in ('Colaborador', 'Responsable', 'Gerente') and responsable_id = public.current_usuario_id());

create policy "cuentas_cobro: propias - crear" on public.cuentas_cobro
  for insert to authenticated
  with check (
    public.current_rol() in ('Administrador', 'Coordinadora Administrativa')
    or (public.current_rol() in ('Colaborador', 'Responsable', 'Gerente') and responsable_id = public.current_usuario_id())
  );

commit;

-- Verificación (solo lectura)
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'cuentas_cobro' order by cmd, policyname;
