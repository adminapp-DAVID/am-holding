import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { MODULOS_AUDITORIA, ACCIONES_AUDITORIA, cambiosAuditoria, csvAuditoria, faltantesPerfil } from './auditoria';
import { CheckCircle2, ChevronDown, FileDown, Loader2, RotateCcw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

// Módulo 🕵️ Auditoría (Administrador / Coordinadora Administrativa): registro inmutable de
// toda acción en la app (lo escribe la base de datos, ver 20261010_auditoria_notificaciones.sql),
// con filtros por usuario, módulo, acción y fechas, y exportación CSV. Arriba, la lista de
// colaboradores con perfil incompleto.

const POR_PAGINA = 200;
const MAX_CSV = 10000;
// Variante del Badge por tipo de acción.
const VARIANTE_ACCION = { 'Creación': 'success', 'Edición': 'secondary', 'Cambio de estado': 'warning', 'Eliminación': 'destructive' };
const Campo = ({ label, htmlFor, className, children }) => (
  <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

// Fin del día en hora Colombia (UTC-5) para que "hasta" incluya todo ese día.
const inicioDia = (d) => `${d}T00:00:00-05:00`;
const finDia = (d) => `${d}T23:59:59.999-05:00`;

const AuditoriaView = ({ usuarios, onNavegar }) => {
  const [filtros, setFiltros] = useState({ usuarioId: '', modulo: '', accion: '', desde: '', hasta: '', texto: '' });
  const [filas, setFilas] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);
  const [expandida, setExpandida] = useState(null);

  const consulta = useCallback((f) => {
    let q = supabase.from('auditoria')
      .select('id, fecha, usuario_id, usuario_nombre, rol, modulo, accion, tabla, registro_id, registro, antes, despues')
      .order('fecha', { ascending: false }).order('id', { ascending: false });
    if (f.usuarioId === 'sistema') q = q.is('usuario_id', null);
    else if (f.usuarioId) q = q.eq('usuario_id', f.usuarioId);
    if (f.modulo) q = q.eq('modulo', f.modulo);
    if (f.accion) q = q.eq('accion', f.accion);
    if (f.desde) q = q.gte('fecha', inicioDia(f.desde));
    if (f.hasta) q = q.lte('fecha', finDia(f.hasta));
    if (f.texto.trim()) q = q.ilike('registro', `%${f.texto.trim().replace(/[%_]/g, '')}%`);
    return q;
  }, []);

  const cargar = useCallback(async (f, desde = 0) => {
    setCargando(true);
    setError('');
    const { data, error: err } = await consulta(f).range(desde, desde + POR_PAGINA - 1);
    setCargando(false);
    if (err) { setError(err.message); return; }
    setFilas(prev => (desde === 0 ? data || [] : [...prev, ...(data || [])]));
    setHayMas((data || []).length === POR_PAGINA);
  }, [consulta]);

  useEffect(() => { cargar(filtros); }, [filtros, cargar]);

  const exportarCSV = async () => {
    setExportando(true);
    try {
      const todas = [];
      for (let desde = 0; desde < MAX_CSV; desde += 1000) {
        const { data, error: err } = await consulta(filtros).range(desde, desde + 999);
        if (err) throw err;
        todas.push(...(data || []));
        if ((data || []).length < 1000) break;
      }
      const blob = new Blob([csvAuditoria(todas)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      if (todas.length >= MAX_CSV) alert(`Se exportaron las ${MAX_CSV} acciones más recientes. Usa los filtros de fecha para exportar el resto.`);
    } catch (e) {
      alert('❌ No se pudo exportar: ' + e.message);
    } finally {
      setExportando(false);
    }
  };

  const cambiar = (patch) => setFiltros({ ...filtros, ...patch });
  const incompletos = usuarios.map(u => ({ u, faltan: faltantesPerfil(u) })).filter(x => x.faltan.length > 0);

  // Etapa 3 del sistema de diseño: misma lógica; solo cambia la presentación.
  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-1 px-0 py-6">
        <CardHeader className="sm:px-7">
          <CardTitle className="text-lg">🕵️ Auditoría</CardTitle>
          <CardDescription>Registro de toda acción en la app: quién, cuándo y qué cambió. Lo escribe la base de datos y no se puede editar ni borrar.</CardDescription>
        </CardHeader>
      </Card>

      <Card className={cn('gap-4 px-0 py-6', incompletos.length > 0 && 'border-l-4 border-l-[#C4622D]')}>
        <CardHeader className="sm:px-7">
          <CardTitle className="text-base">👥 Perfiles incompletos ({incompletos.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:px-7">
          {incompletos.length === 0 ? (
            <p className="m-0 inline-flex items-center gap-1.5 text-sm text-success"><CheckCircle2 size={16} /> Todos los colaboradores tienen documento y datos bancarios.</p>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-solid border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent"><TableHead>Colaborador</TableHead><TableHead>Rol</TableHead><TableHead>Falta</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {incompletos.map(({ u, faltan }) => (
                      <TableRow key={u.id}>
                        <TableCell className="whitespace-nowrap font-medium">{u.nombre}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{u.rol}</TableCell>
                        <TableCell className="min-w-[200px] text-xs text-destructive">{faltan.join(', ')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="m-0 text-xs text-muted-foreground">
                Cada lunes reciben un recordatorio en la campana hasta completarlo. Se puede completar en{' '}
                <Button variant="link" className="h-auto p-0 text-xs" onClick={() => onNavegar('datosBancarios')}>🏦 Datos bancarios</Button>.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4 px-0 py-6">
        <CardContent className="flex flex-col gap-4 sm:px-7">
          <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-solid border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-[repeat(6,minmax(0,1fr))]">
            <Campo label="Usuario" htmlFor="aud-usuario">
              <Select id="aud-usuario" value={filtros.usuarioId} onChange={(e) => cambiar({ usuarioId: e.target.value })}>
                <option value="">Todos</option>
                <option value="sistema">Sistema</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
              </Select>
            </Campo>
            <Campo label="Módulo" htmlFor="aud-modulo">
              <Select id="aud-modulo" value={filtros.modulo} onChange={(e) => cambiar({ modulo: e.target.value })}>
                <option value="">Todos</option>
                {MODULOS_AUDITORIA.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Campo>
            <Campo label="Acción" htmlFor="aud-accion">
              <Select id="aud-accion" value={filtros.accion} onChange={(e) => cambiar({ accion: e.target.value })}>
                <option value="">Todas</option>
                {ACCIONES_AUDITORIA.map(a => <option key={a} value={a}>{a}</option>)}
              </Select>
            </Campo>
            <Campo label="Desde" htmlFor="aud-desde">
              <Input id="aud-desde" type="date" value={filtros.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
            </Campo>
            <Campo label="Hasta" htmlFor="aud-hasta">
              <Input id="aud-hasta" type="date" value={filtros.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
            </Campo>
            <Campo label="Registro contiene" htmlFor="aud-texto">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="aud-texto" value={filtros.texto} placeholder="nombre, detalle…" onChange={(e) => cambiar({ texto: e.target.value })} className="pl-8" />
              </div>
            </Campo>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
              <Button variant="outline" onClick={() => setFiltros({ usuarioId: '', modulo: '', accion: '', desde: '', hasta: '', texto: '' })}><RotateCcw /> Limpiar</Button>
              <Button disabled={exportando} onClick={exportarCSV} className={cn(exportando && 'cursor-wait')}>
                {exportando ? <Loader2 className="animate-spin" /> : <FileDown />} {exportando ? 'Exportando…' : 'Exportar CSV'}
              </Button>
            </div>
          </div>

          {error && <p className="m-0 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">⚠️ {error}</p>}
          <div className="overflow-hidden rounded-lg border border-solid border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Fecha</TableHead><TableHead>Usuario</TableHead><TableHead>Módulo</TableHead><TableHead>Acción</TableHead><TableHead>Registro</TableHead><TableHead>Cambios (anterior → nuevo)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map(f => {
                  const cambios = cambiosAuditoria(f);
                  const verTodo = expandida === f.id;
                  const visibles = verTodo ? cambios : cambios.slice(0, 3);
                  return (
                    <TableRow key={f.id} className="align-top">
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">{new Date(f.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{f.usuario_nombre}<div className="text-[0.7rem] text-muted-foreground">{f.rol || ''}</div></TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{f.modulo}</TableCell>
                      <TableCell><Badge variant={VARIANTE_ACCION[f.accion] || 'secondary'}>{f.accion}</Badge></TableCell>
                      <TableCell className="min-w-[160px] text-xs">{f.registro || '—'}<div className="text-[0.7rem] text-muted-foreground">{f.tabla}</div></TableCell>
                      <TableCell className="min-w-[260px] text-xs">
                        {visibles.map(c => (
                          <div key={c.campo} className="break-words">
                            <strong>{c.campo}:</strong>{' '}
                            {c.antes && c.despues ? <><span className="text-destructive">{c.antes}</span> → <span className="text-success">{c.despues}</span></> : (c.despues || c.antes)}
                          </div>
                        ))}
                        {cambios.length > 3 && (
                          <Button variant="link" className="h-auto p-0 text-[0.72rem]" onClick={() => setExpandida(verTodo ? null : f.id)}>
                            {verTodo ? 'Ver menos' : `Ver ${cambios.length - 3} campo(s) más`}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!cargando && filas.length === 0 && !error && (
                  <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No hay acciones con estos filtros.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {cargando && <p className="m-0 inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Cargando…</p>}
          {hayMas && !cargando && (
            <Button variant="outline" className="self-center" onClick={() => cargar(filtros, filas.length)}><ChevronDown /> Cargar más</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditoriaView;
