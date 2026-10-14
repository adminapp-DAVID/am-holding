import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { supabase } from './supabaseClient';
import {
  construirCandidatosPAB, construirEncabezadoPAB, problemasEncabezadoPAB, generarArchivoPAB,
  descripcionLotePAB, totalesPAB, nombreArchivoPAB, TIPOS_PAGO_PAB, nombreBancoCorto
} from './exportPAB';
import { RotateCcw, Download, Loader2, ChevronDown, ChevronRight, CheckCircle2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

// Pantalla "💸 Pagos PAB" (Administrador / Coordinadora Administrativa).
// 1) Arma, para una empresa y su cuenta origen, todo lo APROBADO que se puede pagar:
//    Presupuesto (Nómina 225 / Honorarios 220, del mes elegido) y Solicitudes (Reembolso y
//    Anticipo 220, Pago a Tercero 238 en COP). Lo que no se puede exportar sale con el motivo.
// 2) Vista previa por tipo de pago con cantidad y total; "Generar" crea un lote por grupo en la
//    BD (que bloquea pagos duplicados) y descarga el Excel con la plantilla oficial del banco.
// 3) Historial de lotes: volver a descargar, marcar pagado o anular (anular solo Administrador).
// La app NUNCA envía nada al banco: solo genera el archivo para el Conversor de pagos.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const claseCheckbox = 'size-4 cursor-pointer accent-[#C4A747]';
const claseInputArchivo = 'h-auto cursor-pointer py-2 text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:font-[inherit] file:text-xs file:font-semibold file:text-secondary-foreground';
const Campo = ({ label, htmlFor, className, children }) => (
  <div className={cn('flex flex-col gap-1.5', className)}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const descargarBytes = (bytes, nombre) => {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
};

let plantillaCache = null;
const cargarPlantilla = async () => {
  if (plantillaCache) return plantillaCache;
  const resp = await fetch(`${import.meta.env.BASE_URL}plantillas/FORMATOPAB_CONVERSORPAGOS.xlsx`);
  if (!resp.ok) throw new Error('No se pudo cargar la plantilla oficial del banco');
  plantillaCache = await resp.arrayBuffer();
  return plantillaCache;
};

const ExportadorPABView = ({
  user, empresas, solicitudes, presupuestoDetalle, filtroPresupuesto, setFiltroPresupuesto,
  usuarios, terceros, lotes, lotePorClave, onRecargarLotes, onRecargarDatos, onRegistrarPagoLote, cecosGasto, getMoneda, formatCOP
}) => {
  const esAdmin = user?.rol === 'Administrador';
  const [configs, setConfigs] = useState([]);
  const [errorConfigs, setErrorConfigs] = useState('');
  const [configId, setConfigId] = useState('');
  const [fechaAplicacion, setFechaAplicacion] = useState(hoyLocal());
  const [deseleccionados, setDeseleccionados] = useState([]);
  const [mostrarBloqueados, setMostrarBloqueados] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [trabajandoLote, setTrabajandoLote] = useState(null);
  // Modal "Marcar pagado": { lote, fechaPago, comprobante, cecos: { [solicitudId]: codigo } }.
  const [pagoLote, setPagoLote] = useState(null);
  const [guardandoPago, setGuardandoPago] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('config_bancaria_empresa')
        .select('id, nombre_cuenta, nit_pagador, numero_cuenta, tipo_cuenta, tipo_pago_nomina, tipo_pago_proveedores, tipo_pago_terceros, activo, empresas ( nombre )')
        .eq('activo', true);
      if (error) { setErrorConfigs(error.message); return; }
      setConfigs((data || []).map(c => ({ ...c, empresa: c.empresas?.nombre || '' })));
    })();
  }, []);

  const empresa = filtroPresupuesto.empresa;
  const configsEmpresa = configs.filter(c => c.empresa === empresa);
  const config = configsEmpresa.find(c => c.id === configId) || configsEmpresa[0] || null;
  const problemasConfig = problemasEncabezadoPAB(config);

  const candidatos = useMemo(() => construirCandidatosPAB({
    empresa, config, anio: filtroPresupuesto.anio, mes: filtroPresupuesto.mes, fechaAplicacion,
    presupuestoDetalle, solicitudes, usuarios, terceros, lotePorClave, getMoneda
  }), [empresa, config, filtroPresupuesto.anio, filtroPresupuesto.mes, fechaAplicacion, presupuestoDetalle, solicitudes, usuarios, terceros, lotePorClave, getMoneda]);

  const exportables = candidatos.filter(c => c.bloqueos.length === 0);
  const bloqueados = candidatos.filter(c => c.bloqueos.length > 0);
  const seleccionados = exportables.filter(c => !deseleccionados.includes(c.clave));
  const grupos = Object.entries(seleccionados.reduce((acc, c) => {
    (acc[c.tipoPago] = acc[c.tipoPago] || []).push(c);
    return acc;
  }, {})).map(([tipoPago, items]) => ({ tipoPago: Number(tipoPago), items, ...totalesPAB(items.map(i => i.fila)) }))
    .sort((a, b) => a.tipoPago - b.tipoPago);
  const totalGeneral = grupos.reduce((s, g) => s + g.total, 0);

  const cambiarFiltro = (patch) => { setDeseleccionados([]); setFiltroPresupuesto({ ...filtroPresupuesto, ...patch }); };
  const alternar = (clave) => setDeseleccionados(prev => prev.includes(clave) ? prev.filter(x => x !== clave) : [...prev, clave]);

  const handleGenerar = async () => {
    if (generando || grupos.length === 0 || problemasConfig.length > 0) return;
    if (!window.confirm(
      `Se van a generar ${grupos.length} archivo(s) PAB de ${empresa} desde ${config.nombre_cuenta}:\n\n`
      + grupos.map(g => `• ${g.tipoPago} – ${TIPOS_PAGO_PAB[g.tipoPago] || ''}: ${g.cantidad} pago(s) por ${formatCOP(g.total)}`).join('\n')
      + `\n\nFecha de aplicación: ${fechaAplicacion}\nEstos registros quedarán marcados como EXPORTADOS y no se podrán volver a exportar mientras el lote esté vigente.\n\n¿Continuar?`
    )) return;
    setGenerando(true);
    const generados = [];
    try {
      const plantilla = await cargarPlantilla();
      for (const g of grupos) {
        const encabezadoBase = construirEncabezadoPAB({ config, tipoPago: g.tipoPago, secuencia: '', descripcion: descripcionLotePAB(g.tipoPago, filtroPresupuesto.anio, filtroPresupuesto.mes) });
        const items = g.items.map((c, i) => ({
          orden: i + 1, entidad_clave: c.clave, entidad_tipo: c.entidadTipo, entidad_id: c.entidadId,
          anio: c.anio, mes: c.mes, valor: c.fila.valor, datos: { ...c.fila, meta: c.meta }
        }));
        const { data, error } = await supabase.rpc('crear_lote_pago_banco', {
          p_config_id: config.id, p_tipo_pago: g.tipoPago, p_fecha: fechaAplicacion, p_encabezado: encabezadoBase, p_items: items
        });
        if (error || !data || !data[0]) throw new Error(error?.message || 'La base de datos no devolvió el lote creado');
        const { numero, secuencia } = data[0];
        const bytes = await generarArchivoPAB(JSZip, plantilla, { ...encabezadoBase, secuencia }, g.items.map(c => c.fila));
        descargarBytes(bytes, nombreArchivoPAB({ empresa, tipoPago: g.tipoPago, fechaAplicacion, numeroLote: numero }));
        generados.push(`#${numero} (${secuencia})`);
      }
      alert(`✅ Generado(s) ${generados.length} archivo(s): lote ${generados.join(', ')}.\nPásalo(s) por el Conversor de pagos de Bancolombia y súbelo(s) a la Sucursal Virtual.`);
    } catch (e) {
      console.error('Error generando PAB:', e);
      alert(`❌ ${e.message}${generados.length ? `\n\nAlcanzaron a generarse: lote ${generados.join(', ')}.` : '\n\nNo se generó ningún archivo.'}`);
    } finally {
      setGenerando(false);
      setDeseleccionados([]);
      await onRecargarLotes();
    }
  };

  const handleRedescargar = async (lote) => {
    setTrabajandoLote(lote.id);
    try {
      const plantilla = await cargarPlantilla();
      const filas = [...(lote.lotes_pago_banco_items || [])].sort((a, b) => a.orden - b.orden).map(i => i.datos);
      const bytes = await generarArchivoPAB(JSZip, plantilla, lote.encabezado, filas);
      descargarBytes(bytes, nombreArchivoPAB({ empresa: lote.empresas?.nombre, tipoPago: lote.tipo_pago, fechaAplicacion: lote.fecha_aplicacion, numeroLote: lote.numero }));
    } catch (e) {
      alert('❌ ' + e.message);
    } finally {
      setTrabajandoLote(null);
    }
  };

  const itemsActivos = (lote) => [...(lote.lotes_pago_banco_items || [])].filter(i => i.activo !== false).sort((a, b) => a.orden - b.orden);

  const abrirPagoLote = (lote) => {
    const cecos = {};
    itemsActivos(lote).filter(i => i.entidad_tipo === 'solicitud').forEach(i => { cecos[i.entidad_id] = ''; });
    setPagoLote({ lote, fechaPago: lote.fecha_aplicacion || hoyLocal(), comprobante: null, cecos });
  };

  const leerComprobante = (file) => {
    if (!file) { setPagoLote(p => ({ ...p, comprobante: null })); return; }
    const reader = new FileReader();
    reader.onload = () => setPagoLote(p => ({ ...p, comprobante: { nombre: file.name, tipo: file.type, tamaño: file.size, data: reader.result } }));
    reader.readAsDataURL(file);
  };

  const confirmarPagoLote = async () => {
    const { lote, fechaPago, comprobante, cecos } = pagoLote;
    if (!fechaPago) { alert('Elige la fecha del pago'); return; }
    if (!comprobante) { alert('Adjunta el comprobante del banco (uno para todo el lote)'); return; }
    if (Object.values(cecos).some(c => !c)) { alert('Elige el CECO de cada solicitud'); return; }
    const mesesPresupuesto = [...new Set(itemsActivos(lote).filter(i => i.entidad_tipo === 'presupuesto').map(i => `${i.anio}-${String(i.mes).padStart(2, '0')}`))];
    const otroMes = mesesPresupuesto.filter(m => m !== fechaPago.substring(0, 7));
    if (otroMes.length && !window.confirm(`La fecha de pago (${fechaPago}) es de otro mes que los conceptos de Presupuesto (${otroMes.join(', ')}). En Presupuesto el concepto queda pagado en el mes de la fecha de pago. ¿Continuar?`)) return;
    setGuardandoPago(true);
    try {
      const r = await onRegistrarPagoLote(lote, { fechaPago, comprobante, cecoPorSolicitud: cecos });
      setPagoLote(null);
      alert(r.fallidos.length
        ? `⚠️ ${r.registrados} pago(s) registrados en Finanzas${r.saltados ? `, ${r.saltados} ya estaban` : ''}.\nNo se pudieron registrar:\n• ${r.fallidos.join('\n• ')}\n\nEl lote sigue en "Generado": corrige y vuelve a pulsar ✅ (lo ya registrado no se duplica).`
        : `✅ Lote #${lote.numero} pagado: ${r.registrados} pago(s) registrados en Finanzas${r.saltados ? ` (${r.saltados} ya estaban registrados)` : ''}.`);
    } catch (e) {
      console.error('Error registrando pago del lote:', e);
      alert('❌ ' + (e.message || 'Error inesperado'));
    } finally {
      setGuardandoPago(false);
      await onRecargarLotes();
    }
  };

  const handleCerrar = async (lote, estado) => {
    const motivo = window.prompt(`Anular el lote #${lote.numero}: sus ${lote.cantidad} registro(s) quedarán libres para exportarse de nuevo. Úsalo solo si el archivo NO se pagó en el banco.\n\nMotivo:`);
    if (motivo === null) return;
    setTrabajandoLote(lote.id);
    const { error } = await supabase.rpc('cerrar_lote_pago_banco', { p_lote_id: lote.id, p_estado: estado, p_motivo: motivo });
    setTrabajandoLote(null);
    if (error) { alert('❌ ' + error.message); return; }
    await onRecargarLotes();
  };

  const filaCandidato = (c, conCheck) => (
    <TableRow key={c.clave} className={cn(c.bloqueos.length && 'opacity-75')}>
      <TableCell className="w-8">{conCheck && <input type="checkbox" aria-label={`Exportar ${c.fila.nombre || ''}`} className={claseCheckbox} checked={!deseleccionados.includes(c.clave)} onChange={() => alternar(c.clave)} />}</TableCell>
      <TableCell className="text-xs">{c.origen}<div className="text-[0.7rem] text-muted-foreground">{c.etiqueta}</div></TableCell>
      <TableCell className="text-xs">{c.fila.nombre || '—'}<div className="text-[0.7rem] text-muted-foreground">{c.fila.documento}</div></TableCell>
      <TableCell className="text-xs">{nombreBancoCorto(c.fila.codigoBanco) || '—'}<div className="text-[0.7rem] text-muted-foreground">{c.fila.cuenta} {c.fila.tipoTransaccion === 37 ? '(Ahorros)' : c.fila.tipoTransaccion === 27 ? '(Corriente)' : ''}</div></TableCell>
      <TableCell className="whitespace-nowrap text-right font-bold">{formatCOP(c.fila.valor || 0)}</TableCell>
      <TableCell className={cn('text-[0.72rem]', c.bloqueos.length ? 'text-destructive' : 'text-success')}>{c.bloqueos.length ? c.bloqueos.join(' · ') : <Badge variant="success">Listo</Badge>}</TableCell>
    </TableRow>
  );

  const encabezadoCandidatos = (ultima) => (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="w-8"></TableHead><TableHead>Origen</TableHead><TableHead>Beneficiario</TableHead><TableHead>Banco / cuenta</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>{ultima}</TableHead>
      </TableRow>
    </TableHeader>
  );

  // Etapa 3 del sistema de diseño: misma lógica; solo cambia la presentación.
  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 px-0 py-6">
        <CardHeader className="sm:px-7">
          <CardTitle className="text-lg">💸 Pagos masivos Bancolombia (PAB)</CardTitle>
          <CardDescription>Genera el Excel con la plantilla oficial del banco para pasarlo por el Conversor de pagos. Solo entra lo Aprobado; la app no envía nada al banco.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:px-7">
          {errorConfigs && <p className="m-0 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">⚠️ No se pudo leer la configuración bancaria: {errorConfigs}</p>}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-solid border-border bg-background p-4">
            <Campo label="Empresa" htmlFor="pab-empresa" className="w-full sm:w-60">
              <Select id="pab-empresa" value={empresa} onChange={(e) => { setConfigId(''); cambiarFiltro({ empresa: e.target.value }); }}>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
              </Select>
            </Campo>
            <Campo label="Cuenta origen" htmlFor="pab-cuenta" className="w-full sm:w-72">
              <Select id="pab-cuenta" value={config?.id || ''} onChange={(e) => setConfigId(e.target.value)} disabled={configsEmpresa.length === 0}>
                {configsEmpresa.length === 0 ? <option value="">Sin cuenta configurada</option> : configsEmpresa.map(c => <option key={c.id} value={c.id}>{c.nombre_cuenta} — {c.numero_cuenta}</option>)}
              </Select>
            </Campo>
            <Campo label="Mes de Nómina / Honorarios" htmlFor="pab-mes" className="w-full sm:w-auto">
              <div className="flex gap-2">
                <div className="w-36">
                  <Select id="pab-mes" value={filtroPresupuesto.mes} onChange={(e) => cambiarFiltro({ mes: Number(e.target.value) })}>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </Select>
                </div>
                <Input type="number" aria-label="Año" value={filtroPresupuesto.anio} onChange={(e) => cambiarFiltro({ anio: Number(e.target.value) })} className="w-24" />
              </div>
            </Campo>
            <Campo label="Fecha de aplicación" htmlFor="pab-fecha" className="w-full sm:w-44">
              <Input id="pab-fecha" type="date" value={fechaAplicacion} onChange={(e) => setFechaAplicacion(e.target.value)} />
            </Campo>
            <Button variant="outline" onClick={onRecargarDatos}><RotateCcw size={14} /> Actualizar datos</Button>
          </div>
          {problemasConfig.length > 0 && (
            <p className="m-0 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">⛔ {problemasConfig.join(' · ')}. Configúrala en 🏦 Datos Bancarios.</p>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4 px-0 py-6">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 sm:px-7">
          <CardTitle className="text-base">Vista previa — {seleccionados.length} pago(s) por {formatCOP(totalGeneral)}</CardTitle>
          <Button variant="success" disabled={generando || grupos.length === 0 || problemasConfig.length > 0} onClick={handleGenerar} className={cn(generando && 'cursor-wait')}>
            {generando ? <><Loader2 size={16} className="animate-spin" /> Generando…</> : <><Download size={16} /> Generar {grupos.length || ''} archivo(s) PAB</>}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 sm:px-7">
          {grupos.length === 0 && <p className="m-0 text-sm text-muted-foreground">No hay pagos listos para exportar con estos filtros.</p>}
          {grupos.map(g => (
            <div key={g.tipoPago} className="flex flex-col gap-2">
              <h4 className="m-0 flex flex-wrap items-center gap-2 text-sm font-bold">
                <Badge variant="secondary">{g.tipoPago}</Badge> {TIPOS_PAGO_PAB[g.tipoPago] || 'Tipo de pago'} <span className="font-normal text-muted-foreground">· {g.cantidad} pago(s) · {formatCOP(g.total)}</span>
              </h4>
              <Table>
                {encabezadoCandidatos('Estado')}
                <TableBody>{exportables.filter(c => c.tipoPago === g.tipoPago).map(c => filaCandidato(c, true))}</TableBody>
              </Table>
            </div>
          ))}
          {exportables.filter(c => deseleccionados.includes(c.clave)).length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="m-0 text-sm font-bold text-muted-foreground">Desmarcados (no se exportarán)</h4>
              <Table><TableBody>{exportables.filter(c => deseleccionados.includes(c.clave)).map(c => filaCandidato(c, true))}</TableBody></Table>
            </div>
          )}
          {bloqueados.length > 0 && (
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setMostrarBloqueados(!mostrarBloqueados)} className="flex cursor-pointer items-center gap-1 self-start border-0 bg-transparent p-0 font-[inherit] text-sm font-bold text-destructive">
                {mostrarBloqueados ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {bloqueados.length} registro(s) que no se pueden exportar (ver motivo)
              </button>
              {mostrarBloqueados && (
                <Table>
                  {encabezadoCandidatos('Motivo')}
                  <TableBody>{bloqueados.map(c => filaCandidato(c, false))}</TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4 px-0 py-6">
        <CardHeader className="sm:px-7">
          <CardTitle className="text-base">📦 Lotes generados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:px-7">
          {lotes.length === 0 ? <p className="m-0 text-sm text-muted-foreground">Todavía no hay lotes.</p> : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Lote</TableHead><TableHead>Empresa / cuenta</TableHead><TableHead>Tipo</TableHead><TableHead>Aplicación</TableHead><TableHead className="text-right">Pagos</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map(l => (
                  <TableRow key={l.id} className={cn(l.estado === 'Anulado' && 'opacity-55')}>
                    <TableCell className="whitespace-nowrap text-xs"><strong>#{l.numero}</strong> ({l.secuencia})<div className="text-[0.7rem] text-muted-foreground">{new Date(l.created_at).toLocaleString('es-CO')}</div></TableCell>
                    <TableCell className="text-xs">{l.empresas?.nombre}<div className="text-[0.7rem] text-muted-foreground">{l.config_bancaria_empresa?.nombre_cuenta}</div></TableCell>
                    <TableCell className="text-xs">{l.tipo_pago} – {TIPOS_PAGO_PAB[l.tipo_pago] || ''}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{l.fecha_aplicacion}</TableCell>
                    <TableCell className="text-right">{l.cantidad}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-bold">{formatCOP(parseFloat(l.total) || 0)}</TableCell>
                    <TableCell>
                      <Badge variant={l.estado === 'Pagado' ? 'success' : l.estado === 'Anulado' ? 'destructive' : 'warning'}>{l.estado}</Badge>
                      {l.motivo_anulacion && <div className="mt-1 text-[0.7rem] text-muted-foreground">{l.motivo_anulacion}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        <Button variant="ghost" size="icon" disabled={trabajandoLote === l.id} onClick={() => handleRedescargar(l)} title="Volver a descargar el mismo archivo" aria-label="Volver a descargar"><Download size={16} /></Button>
                        {l.estado === 'Generado' && <Button variant="ghost" size="icon" disabled={trabajandoLote === l.id} onClick={() => abrirPagoLote(l)} title="Marcar pagado y registrar en Finanzas" aria-label="Marcar pagado" className="text-success"><CheckCircle2 size={16} /></Button>}
                        {l.estado === 'Generado' && esAdmin && <Button variant="ghost" size="icon" disabled={trabajandoLote === l.id} onClick={() => handleCerrar(l, 'Anulado')} title="Anular (libera los registros)" aria-label="Anular" className="text-destructive"><Ban size={16} /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="m-0 text-xs text-muted-foreground">
            <CheckCircle2 size={12} className="inline align-[-2px] text-success" /> cuando el banco confirme el pago: pide fecha, el comprobante del lote y el CECO de cada solicitud, y registra todo en Finanzas (Solicitudes quedan Pagado; Presupuesto, pagado en el mes). <Ban size={12} className="inline align-[-2px] text-destructive" /> Anular solo si el archivo no se pagó.
          </p>
        </CardContent>
      </Card>

      {pagoLote && (() => {
        const items = itemsActivos(pagoLote.lote);
        return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
            <Card className="max-h-[90vh] w-full max-w-3xl gap-4 overflow-y-auto px-0 py-6">
              <CardHeader className="sm:px-7">
                <CardTitle className="text-lg">✅ Lote #{pagoLote.lote.numero} pagado</CardTitle>
                <CardDescription>{pagoLote.lote.empresas?.nombre} · {pagoLote.lote.config_bancaria_empresa?.nombre_cuenta} · {items.length} pago(s) por {formatCOP(parseFloat(pagoLote.lote.total) || 0)}. Se registra cada pago en Finanzas con el mismo comprobante.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:px-7">
                <div className="flex flex-wrap gap-3">
                  <Campo label="Fecha del pago *" htmlFor="pab-fecha-pago" className="w-full sm:w-44">
                    <Input id="pab-fecha-pago" type="date" value={pagoLote.fechaPago} onChange={(e) => setPagoLote({ ...pagoLote, fechaPago: e.target.value })} />
                  </Campo>
                  <Campo label="Comprobante del banco (todo el lote) *" htmlFor="pab-comprobante" className="min-w-[220px] flex-1">
                    <Input id="pab-comprobante" type="file" accept=".pdf,image/*" onChange={(e) => leerComprobante(e.target.files[0])} className={claseInputArchivo} />
                  </Campo>
                </div>
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Pago</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>CECO</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {items.map(i => (
                      <TableRow key={i.entidad_clave}>
                        <TableCell className="text-xs">{i.datos?.nombre || '—'}<div className="text-[0.7rem] text-muted-foreground">{i.entidad_tipo === 'solicitud' ? `Solicitud · ${i.datos?.meta?.tipo || ''}` : `Presupuesto · ${i.datos?.meta?.nombre || ''}`}</div></TableCell>
                        <TableCell className="whitespace-nowrap text-right">{formatCOP(parseFloat(i.valor) || 0)}</TableCell>
                        <TableCell>
                          {i.entidad_tipo === 'solicitud' ? (
                            <div className="max-w-[240px]">
                              <Select aria-label="CECO" value={pagoLote.cecos[i.entidad_id] || ''} onChange={(e) => setPagoLote({ ...pagoLote, cecos: { ...pagoLote.cecos, [i.entidad_id]: e.target.value } })} className="h-8 text-xs">
                                <option value="">Elegir CECO…</option>
                                {cecosGasto.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                              </Select>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">{i.datos?.meta?.ceco || 'el del concepto'}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex gap-3">
                  <Button size="lg" variant="outline" disabled={guardandoPago} onClick={() => setPagoLote(null)}>Cancelar</Button>
                  <Button size="lg" variant="success" disabled={guardandoPago} onClick={confirmarPagoLote} className={cn('flex-1', guardandoPago && 'cursor-wait')}>
                    {guardandoPago ? '⏳ Registrando…' : 'Confirmar pago y registrar en Finanzas'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </div>
  );
};

export default ExportadorPABView;
