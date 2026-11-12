import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Save } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  ROLES_BASE, NOMBRE_ROL_BASE, MODULOS, NIVELES, ETIQUETA_NIVEL,
  nivelEfectivo, nivelesPermitidos, nivelMaximo, permisosParaGuardar,
} from './permisos';

// 🔑 Administrativo → Roles y permisos (20261113_roles_permisos.sql). El Administrador crea y
// edita roles (nombre visible, rol base, orden, si presentan solicitudes propias, activo) y define
// en la matriz el nivel de cada rol en cada módulo — nunca por encima de lo que permite su rol
// base (eso lo garantiza también la base de datos). La Coordinación solo consulta.

const COLOR_NIVEL = { ninguno: 'muted', ver: 'info', editar: 'warning', aprobar: 'success' };

export default function RolesPermisosView({ roles, usuarios, puedeEditar, onRecargar }) {
  const [edicion, setEdicion] = useState({});        // codigo → cambios de la fila
  const [matriz, setMatriz] = useState({});          // codigo → { modulo: nivel }
  const [nuevo, setNuevo] = useState({ nombre: '', rolBase: 'Responsable', descripcion: '' });
  const [guardando, setGuardando] = useState(false);
  const [verInactivos, setVerInactivos] = useState(false);

  useEffect(() => {
    setMatriz(Object.fromEntries(roles.map(r => [r.codigo, Object.fromEntries(MODULOS.map(m => [m.id, nivelEfectivo(r.rolBase, r.permisos, m.id)]))])));
    setEdicion({});
  }, [roles]);

  const usuariosPorRol = useMemo(() => {
    const conteo = {};
    (usuarios || []).forEach(u => { conteo[u.rol] = (conteo[u.rol] || 0) + 1; });
    return conteo;
  }, [usuarios]);

  const visibles = roles.filter(r => verInactivos || r.activo);
  const fila = (r) => ({ ...r, ...(edicion[r.codigo] || {}) });
  const cambiar = (codigo, campo, valor) => setEdicion(e => ({ ...e, [codigo]: { ...(e[codigo] || {}), [campo]: valor } }));
  const esAdmin = (r) => r.codigo === 'Administrador';

  if (!roles.length) {
    return (
      <Card className="px-6 py-8">
        <CardTitle className="text-lg">🔑 Roles y permisos</CardTitle>
        <p className="m-0 text-muted-foreground">Falta correr el SQL <code>20261113_roles_permisos.sql</code> en Supabase para administrar los roles desde aquí.</p>
      </Card>
    );
  }

  const guardarFila = async (r) => {
    const f = fila(r);
    const nombre = String(f.nombre || '').trim();
    if (!nombre) { alert('El nombre del rol no puede quedar vacío'); return; }
    if (roles.some(x => x.codigo !== r.codigo && x.nombre.trim().toLowerCase() === nombre.toLowerCase())) { alert('Ya existe un rol con ese nombre'); return; }
    if (esAdmin(r) && (f.rolBase !== 'Administrador' || !f.activo)) { alert('El rol Administrador no se puede cambiar de rol base ni desactivar'); return; }
    if (!f.activo && usuariosPorRol[r.codigo]) { alert(`No se puede desactivar: ${usuariosPorRol[r.codigo]} usuario(s) tienen este rol. Cámbialos primero en Colaboradores.`); return; }
    if (f.rolBase !== r.rolBase && usuariosPorRol[r.codigo]
      && !window.confirm(`Cambiar el rol base de "${r.nombre}" a ${NOMBRE_ROL_BASE[f.rolBase]} cambia lo que pueden hacer sus ${usuariosPorRol[r.codigo]} usuario(s). ¿Continuar?`)) return;
    setGuardando(true);
    const permisos = permisosParaGuardar(f.rolBase, matriz[r.codigo]);
    const { data, error } = await supabase.from('roles').update({
      nombre, rol_base: f.rolBase, descripcion: String(f.descripcion || '').trim() || null,
      orden: Number(f.orden) || 99, activo: !!f.activo, presenta_solicitudes: !!f.presentaSolicitudes, permisos,
    }).eq('codigo', r.codigo).select('codigo');
    setGuardando(false);
    if (error || !data?.length) { alert('❌ No se pudo guardar: ' + (error?.message || 'solo el Administrador edita roles')); return; }
    await onRecargar();
  };

  const guardarMatriz = async () => {
    const cambiados = roles.filter(r => !esAdmin(r)
      && JSON.stringify(permisosParaGuardar(r.rolBase, matriz[r.codigo])) !== JSON.stringify(permisosParaGuardar(r.rolBase, r.permisos)));
    if (!cambiados.length) { alert('No hay cambios en la matriz'); return; }
    if (!window.confirm(`¿Guardar los permisos de ${cambiados.map(r => r.nombre).join(', ')}?\n\nAplican cuando cada persona vuelve a iniciar sesión.`)) return;
    setGuardando(true);
    const fallidos = [];
    for (const r of cambiados) {
      const { data, error } = await supabase.from('roles').update({ permisos: permisosParaGuardar(r.rolBase, matriz[r.codigo]) }).eq('codigo', r.codigo).select('codigo');
      if (error || !data?.length) fallidos.push(`${r.nombre}: ${error?.message || 'sin permiso'}`);
    }
    setGuardando(false);
    if (fallidos.length) alert('❌ No se pudieron guardar:\n' + fallidos.join('\n'));
    await onRecargar();
  };

  const crearRol = async () => {
    const nombre = nuevo.nombre.trim();
    if (!nombre) { alert('Escribe el nombre del rol'); return; }
    if (roles.some(x => x.nombre.trim().toLowerCase() === nombre.toLowerCase() || x.codigo.toLowerCase() === nombre.toLowerCase())) { alert('Ya existe un rol con ese nombre'); return; }
    setGuardando(true);
    const orden = Math.max(0, ...roles.filter(r => r.orden < 90).map(r => r.orden)) + 1;
    const { data, error } = await supabase.from('roles').insert({
      codigo: nombre, nombre, rol_base: nuevo.rolBase, descripcion: nuevo.descripcion.trim() || null, orden,
      presenta_solicitudes: nuevo.rolBase === 'Responsable', permisos: {},
    }).select('codigo');
    setGuardando(false);
    if (error || !data?.length) { alert('❌ No se pudo crear: ' + (error?.message || 'solo el Administrador crea roles')); return; }
    setNuevo({ nombre: '', rolBase: 'Responsable', descripcion: '' });
    await onRecargar();
  };

  const grupos = [...new Set(MODULOS.map(m => m.grupo))];
  const rolesMatriz = visibles;

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 px-0 py-6">
        <CardHeader className="sm:px-7">
          <CardTitle className="flex items-center gap-2 text-lg"><KeyRound size={18} /> Roles</CardTitle>
          <CardDescription>
            Cada rol tiene un <strong>nombre visible</strong> y un <strong>rol base</strong> (Administrador, Coordinación Administrativa, Gerente, Contadora o Colaborador) que define lo máximo que puede hacer y la seguridad de la base de datos.
            {!puedeEditar && ' Solo el Administrador puede modificarlos.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:px-7">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Ver roles inactivos
          </label>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-center">Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol base</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-center">Presenta solicitudes</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-center">Usuarios</TableHead>
                {puedeEditar && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map(r => {
                const f = fila(r);
                const cambiado = !!edicion[r.codigo];
                return (
                  <TableRow key={r.codigo} className={f.activo ? undefined : 'opacity-60'}>
                    <TableCell className="w-20 text-center">
                      {puedeEditar ? <Input type="number" aria-label="Orden" value={f.orden} onChange={(e) => cambiar(r.codigo, 'orden', e.target.value)} className="h-8 w-16 text-center text-xs" /> : f.orden}
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      {puedeEditar ? <Input aria-label="Nombre" value={f.nombre} onChange={(e) => cambiar(r.codigo, 'nombre', e.target.value)} className="h-8 text-xs" /> : <strong>{f.nombre}</strong>}
                      {r.codigo !== f.nombre && <div className="mt-0.5 text-[0.65rem] text-muted-foreground">Código: {r.codigo}</div>}
                    </TableCell>
                    <TableCell className="min-w-[170px]">
                      {puedeEditar && !esAdmin(r) ? (
                        <Select aria-label="Rol base" value={f.rolBase} onChange={(e) => cambiar(r.codigo, 'rolBase', e.target.value)} className="h-8 text-xs">
                          {ROLES_BASE.map(b => <option key={b} value={b}>{NOMBRE_ROL_BASE[b]}</option>)}
                        </Select>
                      ) : <span className="text-xs">{NOMBRE_ROL_BASE[f.rolBase]}</span>}
                    </TableCell>
                    <TableCell className="min-w-[220px] text-xs text-muted-foreground">
                      {puedeEditar ? <Input aria-label="Descripción" value={f.descripcion} onChange={(e) => cambiar(r.codigo, 'descripcion', e.target.value)} className="h-8 text-xs" /> : f.descripcion}
                    </TableCell>
                    <TableCell className="text-center">
                      <input type="checkbox" aria-label="Presenta solicitudes" disabled={!puedeEditar} checked={!!f.presentaSolicitudes} onChange={(e) => cambiar(r.codigo, 'presentaSolicitudes', e.target.checked)} title="Puede presentar sus propias solicitudes y usar Mi Bandeja (para roles de gestión)" />
                    </TableCell>
                    <TableCell className="text-center">
                      <input type="checkbox" aria-label="Activo" disabled={!puedeEditar || esAdmin(r)} checked={!!f.activo} onChange={(e) => cambiar(r.codigo, 'activo', e.target.checked)} />
                    </TableCell>
                    <TableCell className="text-center"><Badge variant={usuariosPorRol[r.codigo] ? 'info' : 'muted'}>{usuariosPorRol[r.codigo] || 0}</Badge></TableCell>
                    {puedeEditar && (
                      <TableCell>
                        <Button size="sm" variant={cambiado ? 'default' : 'outline'} disabled={!cambiado || guardando} onClick={() => guardarFila(r)}><Save size={14} /> Guardar</Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {puedeEditar && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-solid border-border bg-background p-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Nuevo rol</span>
                <Input aria-label="Nombre del nuevo rol" placeholder="Nombre (ej. Analista Financiero)" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className="w-56" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Rol base</span>
                <Select aria-label="Rol base del nuevo rol" value={nuevo.rolBase} onChange={(e) => setNuevo({ ...nuevo, rolBase: e.target.value })} className="w-auto">
                  {ROLES_BASE.filter(b => b !== 'Administrador').map(b => <option key={b} value={b}>{NOMBRE_ROL_BASE[b]}</option>)}
                </Select>
              </div>
              <Input aria-label="Descripción del nuevo rol" placeholder="Descripción (opcional)" value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} className="min-w-[200px] flex-1" />
              <Button disabled={guardando} onClick={crearRol}><Plus size={16} /> Crear rol</Button>
            </div>
          )}
          <p className="m-0 text-xs text-muted-foreground">Para asignar un rol a una persona: Equipo → Colaboradores → editar → Rol / Perfil. Los cambios aplican cuando la persona vuelve a iniciar sesión.</p>
        </CardContent>
      </Card>

      <Card className="gap-4 px-0 py-6">
        <CardHeader className="sm:px-7">
          <CardTitle className="text-lg">Matriz de permisos</CardTitle>
          <CardDescription>
            Nivel de cada rol en cada módulo: <strong>Sin acceso</strong> (no aparece en el menú), <strong>Ver</strong> (solo consulta), <strong>Editar</strong> (crear y modificar) o <strong>Aprobar</strong> (además aprueba, paga y gestiona lo de otros). Solo se ofrecen los niveles que permite el rol base.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:px-7">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Módulo</TableHead>
                {rolesMatriz.map(r => <TableHead key={r.codigo} className="text-center">{r.nombre}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.map(g => (
                <React.Fragment key={g}>
                  <TableRow className="hover:bg-transparent"><TableCell colSpan={rolesMatriz.length + 1} className="bg-muted/40 py-1.5 text-xs font-bold uppercase text-muted-foreground">{g}</TableCell></TableRow>
                  {MODULOS.filter(m => m.grupo === g).map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-sm">{m.label}</TableCell>
                      {rolesMatriz.map(r => {
                        const permitidos = nivelesPermitidos(r.rolBase, m.id);
                        const valor = matriz[r.codigo]?.[m.id] || nivelMaximo(r.rolBase, m.id);
                        const fijo = !puedeEditar || esAdmin(r) || permitidos.length === 1;
                        return (
                          <TableCell key={r.codigo} className="text-center">
                            {fijo ? (
                              <Badge variant={COLOR_NIVEL[valor]}>{ETIQUETA_NIVEL[valor]}</Badge>
                            ) : (
                              <Select aria-label={`${m.label} — ${r.nombre}`} value={valor} onChange={(e) => setMatriz(mx => ({ ...mx, [r.codigo]: { ...mx[r.codigo], [m.id]: e.target.value } }))} className="h-8 min-w-[110px] text-xs">
                                {NIVELES.filter(n => permitidos.includes(n)).map(n => <option key={n} value={n}>{ETIQUETA_NIVEL[n]}</option>)}
                              </Select>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
          {puedeEditar && (
            <div className="flex justify-end">
              <Button disabled={guardando} onClick={guardarMatriz}><Save size={16} /> Guardar matriz</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
