import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { Download, Loader2, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

// Administrativo → 🗑️ Papelera (Administrador / Coordinadora / Gerente Financiero): lo eliminado en
// Finanzas, Solicitudes y Cuentas de cobro queda aquí 90 días (20261031_papelera.sql). Se puede
// restaurar tal cual (con sus soportes) o eliminar definitivamente. Al abrir la pantalla, lo que
// lleva más de DIAS_PAPELERA días se elimina definitivamente solo.

export const DIAS_PAPELERA = 90;
const MODULOS = { gastos: 'Finanzas · Gasto', ingresos: 'Finanzas · Ingreso', solicitudes: 'Solicitud', cuentas_cobro: 'Cuenta de cobro' };
const diasDesde = (fecha) => Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
const fechaHora = (f) => new Date(f).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });

const PapeleraView = ({ formatMoneyByMoneda, onRestaurado }) => {
  const [filas, setFilas] = useState(null);
  const [filtro, setFiltro] = useState({ tabla: '', texto: '' });
  const [trabajando, setTrabajando] = useState(null);

  // Borra definitivamente (base + archivos que ya no usa nadie). Devuelve true si se pudo.
  const eliminarDefinitivo = useCallback(async (id) => {
    const { data: rutas, error } = await supabase.rpc('eliminar_definitivo_papelera', { p_id: id });
    if (error) { console.error('Error eliminando definitivamente:', error); return false; }
    if (rutas?.length) {
      const { error: errorArchivos } = await supabase.storage.from('soportes').remove(rutas);
      if (errorArchivos) console.warn('No se pudieron borrar algunos archivos de la papelera:', errorArchivos);
    }
    return true;
  }, []);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('papelera')
      .select('id, tabla, registro_id, descripcion, fecha, valor, empresa, responsable, soportes, eliminado_at, eliminado_por_nombre, eliminado_rol, datos')
      .eq('estado', 'En papelera').order('eliminado_at', { ascending: false }).limit(500);
    if (error) { console.error('Error cargando la papelera:', error); setFilas([]); return; }
    // Limpieza automática: lo que ya cumplió el plazo se elimina definitivamente.
    const vencidos = (data || []).filter(f => diasDesde(f.eliminado_at) >= DIAS_PAPELERA);
    for (const f of vencidos) await eliminarDefinitivo(f.id);
    setFilas((data || []).filter(f => !vencidos.includes(f)));
  }, [eliminarDefinitivo]);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const t = filtro.texto.trim().toLowerCase();
    return (filas || []).filter(f => (!filtro.tabla || f.tabla === filtro.tabla)
      && (!t || [f.descripcion, f.empresa, f.responsable, f.eliminado_por_nombre].some(x => String(x || '').toLowerCase().includes(t))));
  }, [filas, filtro]);

  const restaurar = async (f) => {
    if (!window.confirm(`¿Restaurar "${f.descripcion}"?\n\nVuelve a ${MODULOS[f.tabla]} tal como estaba, con sus soportes.`)) return;
    setTrabajando(f.id);
    const { error } = await supabase.rpc('restaurar_papelera', { p_id: f.id });
    setTrabajando(null);
    if (error) { alert('❌ No se pudo restaurar: ' + error.message); return; }
    setFilas(prev => prev.filter(x => x.id !== f.id));
    onRestaurado?.(f.tabla);
    alert('✅ Restaurado.');
  };

  const eliminar = async (f) => {
    if (!window.confirm(`¿Eliminar DEFINITIVAMENTE "${f.descripcion}"?\n\nSe borran también sus soportes. No se puede deshacer.`)) return;
    setTrabajando(f.id);
    const ok = await eliminarDefinitivo(f.id);
    setTrabajando(null);
    if (!ok) { alert('❌ No se pudo eliminar definitivamente.'); return; }
    setFilas(prev => prev.filter(x => x.id !== f.id));
  };

  const descargar = async (s) => {
    const { data, error } = await supabase.storage.from('soportes').createSignedUrl(s.bucket_path, 120);
    if (error || !data?.signedUrl) { alert('❌ No se pudo abrir el archivo: ' + (error?.message || 'no existe')); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Trash2 size={18} className="text-primary" /> Papelera</CardTitle>
        <CardDescription>
          Lo eliminado en Finanzas, Solicitudes y Cuentas de cobro queda aquí {DIAS_PAPELERA} días, con sus soportes. Puedes restaurarlo tal como estaba o eliminarlo definitivamente; al cumplir el plazo se elimina solo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <Select aria-label="Módulo" value={filtro.tabla} onChange={(e) => setFiltro({ ...filtro, tabla: e.target.value })}>
              <option value="">Todos los módulos</option>
              {Object.entries(MODULOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar" placeholder="Buscar por concepto, empresa o persona" value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} className="pl-8" />
          </div>
        </div>

        {filas === null ? (
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
        ) : (
          <Table fija>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Eliminado</TableHead><TableHead>Módulo</TableHead><TableHead>Registro</TableHead>
                <TableHead className="text-right">Valor</TableHead><TableHead>Soportes</TableHead><TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">La papelera está vacía.</TableCell></TableRow>
              ) : visibles.map(f => {
                const quedan = DIAS_PAPELERA - diasDesde(f.eliminado_at);
                const moneda = f.datos?.moneda_pago || (f.empresa === 'ARKO' ? 'USD' : 'COP');
                return (
                  <TableRow key={f.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      <div>{fechaHora(f.eliminado_at)}</div>
                      <div className="text-muted-foreground">por {f.eliminado_por_nombre}{f.eliminado_rol ? ` (${f.eliminado_rol})` : ''}</div>
                      <Badge variant={quedan <= 7 ? 'destructive' : 'muted'} className="mt-1 text-[0.6rem]">Se borra en {quedan} día{quedan === 1 ? '' : 's'}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs font-semibold text-primary">{MODULOS[f.tabla] || f.tabla}</TableCell>
                    <TableCell className="min-w-[220px] text-xs">
                      <div className="font-semibold">{f.descripcion}</div>
                      <div className="text-muted-foreground">{[f.fecha, f.empresa, f.responsable].filter(Boolean).join(' · ')}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs font-bold">{f.valor != null ? formatMoneyByMoneda(f.valor, moneda) : '—'}</TableCell>
                    <TableCell className="text-xs">
                      {(f.soportes || []).length === 0 ? <span className="text-muted-foreground">—</span> : (
                        <div className="flex flex-col gap-0.5">
                          {f.soportes.map((s, i) => (
                            <button key={i} type="button" onClick={() => descargar(s)} className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left font-[inherit] text-[#6C63D1] hover:underline">
                              <Download size={12} /> {s.nombre_original || 'archivo'}
                            </button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-center">
                      <Button size="sm" variant="outline" disabled={trabajando === f.id} onClick={() => restaurar(f)}><RotateCcw size={14} /> Restaurar</Button>
                      <Button size="sm" variant="ghost" disabled={trabajando === f.id} onClick={() => eliminar(f)} className="ml-1 text-destructive" title="Eliminar definitivamente" aria-label="Eliminar definitivamente"><Trash2 size={14} /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PapeleraView;
