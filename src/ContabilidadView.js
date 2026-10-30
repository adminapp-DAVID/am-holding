import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  Archive, ArrowDown, ArrowUp, BookOpen, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Download,
  ExternalLink, FileSpreadsheet, Trash2, RotateCcw as GirarIzquierda, RotateCw as GirarDerecha, Save, FileText, FolderOpen, Image as IconoImagen, Loader2, Paperclip, RotateCcw, Search, ZoomIn, ZoomOut,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { guardarSoporteGirado, paginasPdf } from './girarSoportes';
import { vistaPreviaDrive } from './drive';
import {
  AGRUPACIONES, CAMPOS_ORDEN, FILTRO_CONTABILIDAD, MESES, agruparFilas, filasContabilidad, filtrarFilas, ordenarFilas,
  tipoArchivo, totalesPorMoneda,
} from './contabilidad';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Módulo 📚 Contabilidad (submenú de Finanzas). Reemplaza "Reportes y Descargas" del Dashboard:
// arriba las descargas de siempre (Excel de Finanzas / Solicitudes y ZIP de soportes) y abajo un
// gestor de soportes de todos los movimientos de Finanzas (gastos, pagos a tercero, traslados e
// ingresos), organizados por empresa, cuenta, año y mes, con visor de archivos.
// Lo ven Administrador, Coordinadora Administrativa, Gerente y Contadora (solo consulta).

const VARIANTE_TIPO = { Gasto: 'destructive', 'Pago a Tercero': 'orange', Traslado: 'info', Ingreso: 'success' };
const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
const mimeDe = (nombre) => MIME[String(nombre || '').split('.').pop().toLowerCase()] || 'application/octet-stream';
const limpiarNombre = (t) => String(t || '').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
const tamano = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb || 0))} KB`);

const Campo = ({ label, htmlFor, className, children }) => (
  <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

const IconoArchivo = ({ nombre, size = 16, className }) => {
  const t = tipoArchivo(nombre);
  const Icono = t === 'imagen' ? IconoImagen : t === 'hoja' ? FileSpreadsheet : FileText;
  return <Icono size={size} className={cn(t === 'pdf' ? 'text-destructive' : t === 'imagen' ? 'text-chart-3' : t === 'hoja' ? 'text-success' : 'text-muted-foreground', className)} />;
};

// ---------- Visor de soportes ----------
// Libro .xlsx del Excel de una solicitud (mismas columnas que el botón de Solicitudes).
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const blobExcel = ({ rows, tipo }) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(tipo || 'Solicitud').substring(0, 30));
  return new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: XLSX_MIME });
};

// Vista previa del Excel de la solicitud (no es un archivo guardado: se arma con sus datos).
const TablaExcel = ({ rows, moneda, monedaFila, formatMoneyByMoneda }) => {
  const ancho = Math.max(...rows.map(r => r.length), 1);
  const celda = (v, i) => (typeof v === 'number' ? formatMoneyByMoneda(v, monedaFila?.[i] || moneda) : v);
  return (
    <div className="h-full w-full overflow-auto rounded-md border border-solid border-border bg-card">
      <table className="w-full border-collapse text-xs">
        <tbody>
          {rows.map((r, i) => (
            r.length === 0 ? <tr key={i}><td colSpan={ancho} className="h-3" /></tr> : (
              <tr key={i} className={cn(i === 0 && 'bg-primary/15 font-bold', r.length === 1 && i > 0 && 'font-semibold')}>
                {r.length === 1 ? (
                  <td colSpan={ancho} className="border-0 border-b border-solid border-border px-2 py-1.5">{celda(r[0], i)}</td>
                ) : r.map((v, j) => (
                  <td key={j} className={cn('border-0 border-b border-r border-solid border-border px-2 py-1.5 align-top', typeof v === 'number' && 'whitespace-nowrap text-right tabular-nums')}>{celda(v, i)}</td>
                ))}
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Visor de documentos de un registro: los que genera el sistema (PDF / Excel de la solicitud) y
// sus soportes, en pestañas. Lo usan Contabilidad (un movimiento de Finanzas) y Solicitudes.
//   fila: { entidadTipo, id, solicitudOrigenId, concepto, fecha, empresa, cuenta, tipo, colaborador }
//   documentosSistema(fila): async → [{ id, nombre_original, generar: async () => Blob } | { id, nombre_original, excel }]
//   onEliminar(archivo): async → true si se borró (Admin / Coordinadora / Gerente en Finanzas).
export function VisorSoportes({ fila, onCerrar, formatoValor, EmpresaLogo, excelSolicitud, documentosSistema, formatMoneyByMoneda, puedeGirar, onEliminar }) {
  const [archivos, setArchivos] = useState(null); // null = cargando
  const [error, setError] = useState('');
  const [indice, setIndice] = useState(0);
  const [urls, setUrls] = useState({}); // { id: objectURL }
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [zoom, setZoom] = useState(1);
  // Girar lo ya subido: en fotos el giro se ve al instante y se guarda con "Guardar girada"; en
  // PDF se gira la página elegida y se guarda de una (solo Administrador / Coordinadora).
  const [giro, setGiro] = useState(0);
  const [paginas, setPaginas] = useState(0);
  const [paginaGirar, setPaginaGirar] = useState('');
  const [girando, setGirando] = useState(false);
  const [zipeando, setZipeando] = useState(false);
  const blobs = useRef({});
  // En un ref: la función llega nueva en cada render de App y no debe recargar el visor.
  const excelRef = useRef(excelSolicitud);
  excelRef.current = excelSolicitud;
  const sistemaRef = useRef(documentosSistema);
  sistemaRef.current = documentosSistema;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [{ data, error: e1 }, { data: deSol, error: e2 }] = await Promise.all([
        supabase.from('soportes').select('id, bucket_path, nombre_original, tamano_kb, created_at').eq('entidad_tipo', fila.entidadTipo).eq('entidad_id', fila.id).order('created_at'),
        fila.solicitudOrigenId
          ? supabase.from('soportes').select('id, bucket_path, nombre_original, tamano_kb, created_at').eq('entidad_tipo', 'solicitud').eq('entidad_id', fila.solicitudOrigenId).order('created_at')
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (!vivo) return;
      if (e1 || e2) { setError((e1 || e2).message); setArchivos([]); return; }
      const propias = new Set((data || []).map(r => r.bucket_path));
      // Legalización / Reembolso / Legalización T. Pro: su Excel también es un soporte.
      let excel = null;
      if (fila.solicitudOrigenId && excelRef.current) {
        try { excel = await excelRef.current(fila.solicitudOrigenId); } catch (e) { console.error('Excel de la solicitud:', e); }
      }
      let sistema = [];
      if (sistemaRef.current) {
        try { sistema = await sistemaRef.current(fila); } catch (e) { console.error('Documentos del sistema:', e); setError('No se pudo generar un documento: ' + e.message); }
      }
      if (!vivo) return;
      // Registro histórico con soporte en Google Drive: se muestra aquí mismo (iframe de Drive).
      const linkDrive = fila.soporteDriveLink || fila.registro?.soporteDriveLink || '';
      const drive = linkDrive ? [{ id: 'drive-link', nombre_original: 'Soporte en Google Drive', tamano_kb: null, drive: { url: linkDrive, vista: vistaPreviaDrive(linkDrive)?.vista || null } }] : [];
      setArchivos([
        ...sistema.map(d => ({ tamano_kb: null, ...d, sistema: true })),
        ...drive,
        ...(excel ? [{ id: 'excel-solicitud', nombre_original: excel.nombreArchivo, tamano_kb: null, deSolicitud: true, excel }] : []),
        ...(data || []).map(r => ({ ...r, deSolicitud: false })),
        ...(deSol || []).filter(r => !propias.has(r.bucket_path)).map(r => ({ ...r, deSolicitud: true })),
      ]);
    })();
    return () => { vivo = false; };
  }, [fila]);

  // Libera los archivos en memoria al cerrar.
  useEffect(() => () => { Object.values(blobs.current).forEach(b => URL.revokeObjectURL(b.url)); }, []);

  const cargarBlob = useCallback(async (a) => {
    if (blobs.current[a.id]) return blobs.current[a.id];
    let blob;
    if (a.excel) blob = blobExcel(a.excel);
    else if (a.generar) blob = await a.generar();
    else {
      const { data, error: e } = await supabase.storage.from('soportes').download(a.bucket_path);
      if (e || !data) throw new Error(e?.message || 'No se pudo descargar el archivo');
      blob = new Blob([data], { type: mimeDe(a.nombre_original) });
    }
    const entrada = { blob, url: URL.createObjectURL(blob) };
    blobs.current[a.id] = entrada;
    setUrls(prev => ({ ...prev, [a.id]: entrada.url }));
    return entrada;
  }, []);

  // Pestañas: PDF y Excel generados por el sistema, y los soportes subidos.
  const grupoDe = (a) => (a.excel ? 'excel' : a.generar ? 'pdf' : 'soportes');
  const grupos = archivos ? ['pdf', 'excel', 'soportes'].filter(g => g === 'soportes' ? archivos.some(a => a.sistema) || archivos.some(a => grupoDe(a) === 'soportes') : archivos.some(a => grupoDe(a) === g)) : [];
  const actual = archivos?.[indice] || null;
  const grupoActual = actual ? grupoDe(actual) : (grupos[0] || 'soportes');
  const [grupoVacio, setGrupoVacio] = useState(null); // pestaña "Soportes" sin archivos
  const grupoVisible = grupoVacio || grupoActual;
  const irAGrupo = (g) => {
    const i = (archivos || []).findIndex(a => grupoDe(a) === g);
    if (i >= 0) { setIndice(i); setGrupoVacio(null); } else setGrupoVacio(g);
  };
  const ETIQUETA_GRUPO = { pdf: 'PDF', excel: 'Excel', soportes: 'Soportes' };
  const tipoActual = actual ? tipoArchivo(actual.nombre_original) : null;

  const idActual = actual?.id;
  useEffect(() => { setZoom(1); setGiro(0); }, [idActual]);

  useEffect(() => {
    if (!actual || urls[actual.id] || !['pdf', 'imagen'].includes(tipoActual)) return;
    setCargandoArchivo(true);
    cargarBlob(actual).catch(e => setError(e.message)).finally(() => setCargandoArchivo(false));
  }, [actual, tipoActual, urls, cargarBlob]);

  // Páginas del PDF actual (para elegir cuál girar).
  useEffect(() => {
    setPaginas(0);
    setPaginaGirar('');
    if (!puedeGirar || !actual || actual.sistema || tipoActual !== 'pdf' || !urls[actual.id]) return;
    const b = blobs.current[actual.id];
    if (b) paginasPdf(b.blob).then(setPaginas).catch(() => setPaginas(0));
  }, [puedeGirar, actual, tipoActual, urls]);

  const [eliminando, setEliminando] = useState(false);
  const eliminarActual = async () => {
    if (!actual || actual.sistema || actual.excel || !onEliminar) return;
    setEliminando(true);
    setError('');
    try {
      const ok = await onEliminar({ id: actual.id, bucketPath: actual.bucket_path, nombre: actual.nombre_original, deSolicitud: actual.deSolicitud });
      if (ok) {
        const viejo = blobs.current[actual.id];
        if (viejo) { URL.revokeObjectURL(viejo.url); delete blobs.current[actual.id]; }
        // Un soporte compartido con la solicitud de origen se quita de ambos lados.
        setArchivos(prev => prev.filter(a => a.id !== actual.id && !(a.bucket_path && a.bucket_path === actual.bucket_path)));
        setIndice(0);
      }
    } catch (e) { setError(e.message); } finally { setEliminando(false); }
  };

  const guardarGiro = async (grados, pagina = null) => {
    if (!actual || !grados) return;
    const queGira = tipoActual === 'pdf' ? (pagina ? `la página ${pagina}` : 'todas las páginas') : 'la foto';
    if (!window.confirm(`¿Guardar ${queGira} girada${grados === 180 ? ' 180°' : ''}? Reemplaza el archivo para todos los que lo ven (solicitud y Finanzas).`)) return;
    setGirando(true);
    setError('');
    try {
      const nuevo = await guardarSoporteGirado({ bucketPath: actual.bucket_path, nombre: actual.nombre_original }, { grados, pagina });
      const viejo = blobs.current[actual.id];
      if (viejo) { URL.revokeObjectURL(viejo.url); delete blobs.current[actual.id]; }
      setUrls(prev => { const n = { ...prev }; delete n[actual.id]; return n; });
      setArchivos(prev => prev.map(a => (a.id === actual.id ? { ...a, bucket_path: nuevo.bucketPath, nombre_original: nuevo.nombre, tamano_kb: nuevo.tamanoKb } : a)));
      setGiro(0);
    } catch (e) { setError(e.message); } finally { setGirando(false); }
  };

  const descargar = async (a) => {
    if (a.drive) { window.open(a.drive.url, '_blank', 'noopener'); return; }
    try {
      const { url } = await cargarBlob(a);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.nombre_original || 'soporte';
      link.click();
    } catch (e) { setError(e.message); }
  };

  const abrirPestana = async (a) => {
    if (a.drive) { window.open(a.drive.url, '_blank', 'noopener'); return; }
    try { window.open((await cargarBlob(a)).url, '_blank', 'noopener'); } catch (e) { setError(e.message); }
  };

  const descargarTodo = async () => {
    if (!archivos?.length) return;
    setZipeando(true);
    try {
      const zip = new JSZip();
      const usados = new Set();
      for (const a of archivos) {
        if (a.drive) continue; // vive en Drive: no se puede empacar en el ZIP
        const { blob } = await cargarBlob(a);
        let nombre = limpiarNombre(a.nombre_original) || 'soporte';
        while (usados.has(nombre)) nombre = `copia_${nombre}`;
        usados.add(nombre);
        zip.file(nombre, blob);
      }
      const contenido = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(contenido);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fila.fecha}_${limpiarNombre(fila.empresa)}_${limpiarNombre(fila.concepto) || fila.tipo}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { setError(e.message); } finally { setZipeando(false); }
  };

  const mover = useCallback((d) => setIndice(i => (archivos?.length ? (i + d + archivos.length) % archivos.length : 0)), [archivos]);
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'ArrowRight') mover(1); if (e.key === 'ArrowLeft') mover(-1); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [mover]);

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        {/* Encabezado: a qué registro pertenecen los soportes */}
        <div className="flex flex-wrap items-start gap-4 border-0 border-b border-solid border-border bg-secondary/40 px-6 py-4 pr-12">
          {EmpresaLogo && fila.empresa && <span className="hidden sm:block"><EmpresaLogo empresa={fila.empresa} height={34} /></span>}
          <div className="min-w-0 flex-[1_1_220px]">
            <DialogTitle className="truncate text-base">{fila.concepto || fila.tipo}</DialogTitle>
            <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{fila.fecha}</span>
              <span>{fila.empresa || 'Sin empresa'}</span>
              {fila.cuenta && <span>🏦 {fila.cuenta}</span>}
              {fila.colaborador && <span>👤 {fila.colaborador}</span>}
              <Badge variant={VARIANTE_TIPO[fila.tipo] || 'muted'}>{fila.tipo}</Badge>
            </DialogDescription>
          </div>
          <div className="sm:text-right">
            <p className="m-0 text-xs text-muted-foreground">Valor</p>
            <p className="m-0 text-lg font-bold">{formatoValor(fila)}</p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Lista de archivos */}
          <aside className="flex max-h-48 shrink-0 flex-col border-0 border-b border-solid border-border md:max-h-none md:w-72 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{grupos.length > 1 ? 'Documentos' : 'Soportes'} {archivos ? `(${archivos.length})` : ''}</span>
              {archivos?.length > 1 && (
                <Button size="sm" variant="outline" onClick={descargarTodo} disabled={zipeando} title="Descargar todos en un ZIP">
                  {zipeando ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} Todo
                </Button>
              )}
            </div>
            {grupos.length > 1 && (
              <div className="mx-3 mb-2 flex rounded-lg bg-muted p-1" role="tablist">
                {grupos.map(g => {
                  const n = archivos.filter(a => grupoDe(a) === g).length;
                  return (
                    <button key={g} type="button" role="tab" aria-selected={grupoVisible === g} onClick={() => irAGrupo(g)}
                      className={cn('flex-1 cursor-pointer whitespace-nowrap rounded-md border-0 px-2 py-1.5 font-[inherit] text-xs font-semibold',
                        grupoVisible === g ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground')}>
                      {ETIQUETA_GRUPO[g]}{g === 'soportes' ? ` (${n})` : ''}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {archivos === null ? (
                <p className="m-0 flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
              ) : archivos.length === 0 ? (
                <p className="m-0 p-3 text-sm text-muted-foreground">Este registro no tiene soportes.</p>
              ) : grupoVacio && !archivos.some(a => grupoDe(a) === grupoVacio) ? (
                <p className="m-0 p-3 text-sm text-muted-foreground">No hay soportes subidos.</p>
              ) : archivos.map((a, i) => (grupos.length > 1 && grupoDe(a) !== grupoVisible) ? null : (
                <button key={a.id} type="button" onClick={() => { setIndice(i); setGrupoVacio(null); }}
                  className={cn('mb-1 flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-solid px-3 py-2 text-left font-[inherit]',
                    i === indice ? 'border-primary bg-primary/10' : 'border-transparent bg-transparent hover:bg-muted')}>
                  <IconoArchivo nombre={a.nombre_original} size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.nombre_original}</span>
                    <span className="block text-xs text-muted-foreground">{a.drive ? 'Link de Drive' : a.excel ? (a.excel.etiqueta || 'Excel de la solicitud') : a.generar ? 'Generado por el sistema' : `${tamano(a.tamano_kb)}${a.deSolicitud ? ' · de la solicitud' : ''}`}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {/* Vista previa */}
          <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40">
            {actual && !grupoVacio && (
              <div className="flex flex-wrap items-center gap-2 border-0 border-b border-solid border-border bg-card px-4 py-2">
                <Button size="icon" variant="ghost" onClick={() => mover(-1)} disabled={archivos.length < 2} aria-label="Anterior"><ChevronLeft size={18} /></Button>
                <span className="text-xs text-muted-foreground">{indice + 1} / {archivos.length}</span>
                <Button size="icon" variant="ghost" onClick={() => mover(1)} disabled={archivos.length < 2} aria-label="Siguiente"><ChevronRight size={18} /></Button>
                <span className="mx-2 hidden min-w-0 flex-1 truncate text-sm font-semibold sm:block">{actual.nombre_original}</span>
                <span className="flex-1 sm:hidden" />
                {tipoActual === 'imagen' && !actual.excel && (
                  <>
                    <Button size="icon" variant="outline" onClick={() => setGiro(g => (g + 270) % 360)} aria-label="Girar a la izquierda" title="Girar a la izquierda"><GirarIzquierda size={16} /></Button>
                    <Button size="icon" variant="outline" onClick={() => setGiro(g => (g + 90) % 360)} aria-label="Girar a la derecha" title="Girar a la derecha"><GirarDerecha size={16} /></Button>
                    {puedeGirar && giro !== 0 && !actual.sistema && (
                      <Button size="sm" variant="success" disabled={girando} onClick={() => guardarGiro(giro)} title="Reemplaza el archivo por la versión girada">
                        {girando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar girada
                      </Button>
                    )}
                  </>
                )}
                {tipoActual === 'pdf' && puedeGirar && paginas > 0 && (
                  <div className="flex items-center gap-1" title="Gira una página del PDF (p. ej. una foto que quedó de lado) y guarda el PDF corregido">
                    <Select aria-label="Página a girar" value={paginaGirar} onChange={(e) => setPaginaGirar(e.target.value)} className="h-8 w-32 text-xs">
                      <option value="">Todas las pág.</option>
                      {Array.from({ length: paginas }, (_, i) => <option key={i} value={i + 1}>Página {i + 1}</option>)}
                    </Select>
                    <Button size="icon" variant="outline" disabled={girando} onClick={() => guardarGiro(-90, paginaGirar ? Number(paginaGirar) : null)} aria-label="Girar página a la izquierda"><GirarIzquierda size={16} /></Button>
                    <Button size="icon" variant="outline" disabled={girando} onClick={() => guardarGiro(90, paginaGirar ? Number(paginaGirar) : null)} aria-label="Girar página a la derecha">{girando ? <Loader2 size={16} className="animate-spin" /> : <GirarDerecha size={16} />}</Button>
                  </div>
                )}
                {tipoActual === 'imagen' && (
                  <>
                    <Button size="icon" variant="outline" onClick={() => setZoom(z => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label="Alejar"><ZoomOut size={16} /></Button>
                    <span className="w-12 text-center text-xs font-semibold">{Math.round(zoom * 100)}%</span>
                    <Button size="icon" variant="outline" onClick={() => setZoom(z => Math.min(4, z + 0.5))} disabled={zoom >= 4} aria-label="Acercar"><ZoomIn size={16} /></Button>
                  </>
                )}
                {!actual.excel && <Button size="sm" variant="outline" onClick={() => abrirPestana(actual)} title="Abrir en una pestaña nueva"><ExternalLink size={14} /> {actual.drive ? 'Abrir en Drive' : 'Abrir'}</Button>}
                {!actual.drive && <Button size="sm" onClick={() => descargar(actual)}><Download size={14} /> Descargar</Button>}
                {onEliminar && !actual.sistema && !actual.excel && actual.bucket_path && (
                  <Button size="icon" variant="outline" className="text-destructive" disabled={eliminando} onClick={eliminarActual} title="Eliminar este soporte" aria-label="Eliminar este soporte">
                    {eliminando ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </Button>
                )}
              </div>
            )}
            <div className={cn('relative flex min-h-0 flex-1 overflow-auto p-4', tipoActual === 'imagen' && zoom > 1 ? 'items-start justify-start' : 'items-center justify-center')}>
              {error && <p className="absolute left-4 top-3 m-0 rounded-md bg-destructive/10 px-3 py-1.5 text-sm text-destructive">❌ {error}</p>}
              {!actual || grupoVacio ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground"><FolderOpen size={40} /><span className="text-sm">{archivos === null ? 'Cargando documentos…' : 'Sin soportes para mostrar'}</span></div>
              ) : actual.drive ? (
                actual.drive.vista ? (
                  <div className="flex h-full min-h-[50vh] w-full flex-col gap-2">
                    <iframe title="Soporte en Google Drive" src={actual.drive.vista} allow="autoplay" className="min-h-0 w-full flex-1 rounded-md border border-solid border-border bg-card" />
                    <p className="m-0 text-center text-xs text-muted-foreground">Si no se ve, el archivo no está compartido contigo en Drive: ábrelo con "Abrir en Drive" o pide acceso.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
                    <ExternalLink size={40} />
                    <span className="text-sm">Este enlace no se puede mostrar aquí.</span>
                    <Button onClick={() => abrirPestana(actual)}><ExternalLink size={16} /> Abrir enlace</Button>
                  </div>
                )
              ) : actual.excel ? (
                <TablaExcel rows={actual.excel.rows} moneda={actual.excel.moneda} monedaFila={actual.excel.monedaFila} formatMoneyByMoneda={formatMoneyByMoneda} />
              ) : cargandoArchivo && !urls[actual.id] ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 size={20} className="animate-spin" /> Cargando vista previa…</div>
              ) : tipoActual === 'pdf' && urls[actual.id] ? (
                <iframe title={actual.nombre_original} src={urls[actual.id]} className="h-full min-h-[50vh] w-full rounded-md border border-solid border-border bg-card" />
              ) : tipoActual === 'imagen' && urls[actual.id] ? (
                <img src={urls[actual.id]} alt={actual.nombre_original} onClick={() => setZoom(z => (z > 1 ? 1 : 2))}
                  className={cn('rounded-md bg-card shadow-sm transition-[width]', zoom > 1 ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain')}
                  style={{ ...(zoom > 1 ? { width: `${zoom * 100}%` } : {}), ...(giro ? { transform: `rotate(${giro}deg)${giro % 180 && zoom === 1 ? ' scale(0.8)' : ''}` } : {}) }} />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
                  <IconoArchivo nombre={actual.nombre_original} size={44} />
                  <span className="text-sm">Este tipo de archivo no tiene vista previa.</span>
                  <Button onClick={() => descargar(actual)}><Download size={16} /> Descargar</Button>
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Vista principal ----------
const ContabilidadView = ({
  registros, empresas, getMoneda, formatMoneyByMoneda, EmpresaLogo,
  excelSolicitud, // async (solicitudId) => { rows, moneda, nombreArchivo, tipo } | null
  puedeGirarSoportes, // Administrador / Coordinadora: guardar soportes girados
  documentosSistemaDeFila, // async (fila) => documentos del sistema (PDF / Excel de la solicitud de origen)
  eliminarSoporte, // async (archivo, fila) => true si se borró (null = no se puede borrar)
  tieneExcelSolicitud, // (solicitudId) => boolean: la solicitud de origen tiene Excel (Legalización / Reembolso)
  reportes, // { desde, hasta, setDesde, setHasta, onFinanzas, onSolicitudes, onZip, progresoZip }
}) => {
  const [filtro, setFiltro] = useState(FILTRO_CONTABILIDAD);
  const [agrupar, setAgrupar] = useState('mes');
  const [orden, setOrden] = useState({ campo: 'fecha', direccion: 'desc' });
  const [cerrados, setCerrados] = useState(() => new Set());
  const [visor, setVisor] = useState(null);

  const filas = useMemo(() => filasContabilidad(registros, tieneExcelSolicitud), [registros, tieneExcelSolicitud]);
  const monedaDe = useCallback((x) => x.moneda || getMoneda(x.empresa), [getMoneda]);
  const formatoValor = useCallback((x) => formatMoneyByMoneda(x.valor, monedaDe(x)), [formatMoneyByMoneda, monedaDe]);

  const anios = useMemo(() => [...new Set(filas.map(x => x.anio).filter(Boolean))].sort().reverse(), [filas]);
  const cuentas = useMemo(() => [...new Set(filas.filter(x => !filtro.empresa || x.empresa === filtro.empresa).map(x => x.cuenta).filter(Boolean))].sort(), [filas, filtro.empresa]);
  const tipos = useMemo(() => [...new Set(filas.map(x => x.tipo).filter(Boolean))].sort(), [filas]);

  const visibles = useMemo(() => ordenarFilas(filtrarFilas(filas, filtro), orden.campo, orden.direccion), [filas, filtro, orden]);
  const grupos = useMemo(() => agruparFilas(visibles, agrupar, orden.direccion), [visibles, agrupar, orden.direccion]);
  const totalSoportes = visibles.reduce((s, x) => s + x.soportes, 0);
  const sinSoporte = visibles.filter(x => !x.soportes && !x.soporteDriveLink).length;

  const setF = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFiltro(p => ({ ...p, [k]: v, ...(k === 'empresa' ? { cuenta: '' } : {}) }));
  };
  const ordenarPor = (campo) => setOrden(o => (o.campo === campo ? { campo, direccion: o.direccion === 'asc' ? 'desc' : 'asc' } : { campo, direccion: campo === 'fecha' || campo === 'valor' ? 'desc' : 'asc' }));
  const alternarGrupo = (clave) => setCerrados(prev => { const n = new Set(prev); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });

  // Los soportes en Google Drive (registros históricos) también se ven dentro del visor.
  const abrir = (x) => setVisor(x);

  const exportarLista = () => {
    const encabezados = ['Fecha', 'Empresa', 'Cuenta', 'Tipo', 'Concepto', 'CECO', 'Valor', 'Moneda', 'Soportes'];
    const datos = visibles.map(x => [x.fecha, x.empresa, x.cuenta, x.tipo, x.concepto, x.ceco, x.valor, monedaDe(x), x.soportes || (x.soporteDriveLink ? 'Drive' : 0)]);
    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...datos]);
    ws['!cols'] = [12, 28, 26, 14, 45, 16, 16, 8, 10].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Soportes');
    XLSX.writeFile(wb, `Contabilidad_soportes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const CabeceraOrden = ({ campo, children, className }) => (
    <TableHead className={className}>
      <button type="button" onClick={() => ordenarPor(campo)} className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-[length:inherit] font-[inherit] uppercase text-inherit hover:text-foreground">
        {children}
        {orden.campo === campo && (orden.direccion === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="m-0 flex items-center gap-2 text-2xl font-bold"><BookOpen size={24} className="text-primary" /> Contabilidad</h2>
        <p className="m-0 text-sm text-muted-foreground">Reportes, descargas y el archivo de soportes de todos los movimientos de Finanzas.</p>
      </div>

      {/* Reportes y descargas (antes en el Dashboard) */}
      <Card className="gap-4 px-0 py-6">
        <CardHeader className="sm:px-6">
          <CardTitle className="flex items-center gap-2"><Download size={18} className="text-primary" /> Reportes y descargas</CardTitle>
          <CardDescription>Usan este rango de fechas y solo incluyen lo que tu rol puede ver.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:px-6">
          <div className="flex flex-wrap items-end gap-3">
            <Campo label="Desde" htmlFor="ct-rep-desde" className="w-[calc(50%-0.375rem)] sm:w-40"><Input id="ct-rep-desde" type="date" value={reportes.desde} onChange={(e) => reportes.setDesde(e.target.value)} /></Campo>
            <Campo label="Hasta" htmlFor="ct-rep-hasta" className="w-[calc(50%-0.375rem)] sm:w-40"><Input id="ct-rep-hasta" type="date" value={reportes.hasta} onChange={(e) => reportes.setHasta(e.target.value)} /></Campo>
          </div>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
            {[
              { onClick: reportes.onFinanzas, icon: FileSpreadsheet, titulo: 'Reporte Finanzas (Excel)', detalle: 'Gastos, Pagos a Tercero, Traslados e Ingresos del período' },
              { onClick: reportes.onSolicitudes, icon: ClipboardList, titulo: 'Reporte Solicitudes (Excel)', detalle: 'Solicitudes del período con su estado' },
              { onClick: reportes.onZip, icon: reportes.progresoZip ? Loader2 : Archive, cargando: !!reportes.progresoZip, titulo: reportes.progresoZip ? `Descargando soportes… ${reportes.progresoZip.hechos}/${reportes.progresoZip.total || '?'}` : 'Soportes del período (ZIP)', detalle: 'Soportes de Solicitudes, Finanzas y Cuentas de cobro, en carpetas' },
            ].map(r => {
              const Icono = r.icon;
              return (
                <button key={r.detalle} type="button" onClick={r.onClick} disabled={r.cargando}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-solid border-border bg-background p-4 text-left font-[inherit] transition-colors hover:border-primary hover:bg-secondary/30 disabled:cursor-wait disabled:opacity-70">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Icono size={18} className={cn(r.cargando && 'animate-spin')} /></span>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-foreground">{r.titulo}</span>
                    <span className="text-xs text-muted-foreground">{r.detalle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gestor de soportes */}
      <Card className="gap-4 px-0 py-6">
        <CardHeader className="sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Paperclip size={18} className="text-primary" /> Gestor de soportes</CardTitle>
              <CardDescription>Organiza y consulta los soportes por empresa, cuenta, año y mes. Pulsa el clip para verlos.</CardDescription>
            </div>
            <Button variant="outline" onClick={exportarLista} disabled={!visibles.length}><FileSpreadsheet size={16} /> Exportar lista</Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Campo label="Empresa" htmlFor="ct-empresa">
              <Select id="ct-empresa" value={filtro.empresa} onChange={setF('empresa')}>
                <option value="">Todas</option>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
              </Select>
            </Campo>
            <Campo label="Cuenta" htmlFor="ct-cuenta">
              <Select id="ct-cuenta" value={filtro.cuenta} onChange={setF('cuenta')}>
                <option value="">Todas</option>
                {cuentas.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Campo>
            <Campo label="Año" htmlFor="ct-anio">
              <Select id="ct-anio" value={filtro.anio} onChange={setF('anio')}>
                <option value="">Todos</option>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </Select>
            </Campo>
            <Campo label="Mes" htmlFor="ct-mes">
              <Select id="ct-mes" value={filtro.mes} onChange={setF('mes')}>
                <option value="">Todos</option>
                {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
              </Select>
            </Campo>
            <Campo label="Desde" htmlFor="ct-desde"><Input id="ct-desde" type="date" value={filtro.desde} onChange={setF('desde')} /></Campo>
            <Campo label="Hasta" htmlFor="ct-hasta"><Input id="ct-hasta" type="date" value={filtro.hasta} onChange={setF('hasta')} /></Campo>
            <Campo label="Tipo" htmlFor="ct-tipo">
              <Select id="ct-tipo" value={filtro.tipo} onChange={setF('tipo')}>
                <option value="">Todos</option>
                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Campo>
            <Campo label="Buscar" htmlFor="ct-buscar" className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="ct-buscar" value={filtro.texto} onChange={setF('texto')} placeholder="Concepto, cuenta, CECO…" className="pl-9" />
              </div>
            </Campo>
            <Campo label="Agrupar por" htmlFor="ct-agrupar">
              <Select id="ct-agrupar" value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
                {Object.entries(AGRUPACIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Campo>
            <Campo label="Ordenar por" htmlFor="ct-orden">
              <div className="flex gap-2">
                <Select id="ct-orden" value={orden.campo} onChange={(e) => setOrden(o => ({ ...o, campo: e.target.value }))}>
                  {Object.entries(CAMPOS_ORDEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => setOrden(o => ({ ...o, direccion: o.direccion === 'asc' ? 'desc' : 'asc' }))}
                  title={orden.direccion === 'asc' ? 'Ascendente (clic para descendente)' : 'Descendente (clic para ascendente)'} aria-label="Cambiar dirección del orden">
                  {orden.direccion === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                </Button>
              </div>
            </Campo>
            <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={filtro.soloConSoportes} onChange={setF('soloConSoportes')} /> Solo con soportes
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-2.5 text-sm">
            <span><strong>{visibles.length}</strong> registros · <strong>{totalSoportes}</strong> soportes{sinSoporte > 0 && <span className="text-[#C4622D]"> · {sinSoporte} sin soporte</span>}</span>
            <Button variant="ghost" size="sm" onClick={() => { setFiltro(FILTRO_CONTABILIDAD); setAgrupar('mes'); setOrden({ campo: 'fecha', direccion: 'desc' }); }}><RotateCcw size={14} /> Reiniciar</Button>
          </div>

          {visibles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground"><FolderOpen size={36} /><span className="text-sm">No hay registros con estos filtros.</span></div>
          ) : (
            <div className="flex flex-col gap-4">
              {grupos.map(g => {
                const abierto = !cerrados.has(g.clave);
                const totales = totalesPorMoneda(g.filas, monedaDe);
                return (
                  <div key={g.clave} className="overflow-hidden rounded-lg border border-solid border-border">
                    {agrupar !== 'ninguno' && (
                      <button type="button" onClick={() => alternarGrupo(g.clave)}
                        className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 border-0 bg-secondary/50 px-4 py-2.5 text-left font-[inherit] hover:bg-secondary">
                        <ChevronDown size={16} className={cn('transition-transform', !abierto && '-rotate-90')} />
                        <span className="text-sm font-bold">{g.titulo}</span>
                        <span className="text-xs text-muted-foreground">{g.filas.length} registros · {g.filas.reduce((s, x) => s + x.soportes, 0)} soportes</span>
                        <span className="ml-auto text-xs font-semibold">{Object.entries(totales).map(([m, v]) => formatMoneyByMoneda(v, m)).join(' · ')}</span>
                      </button>
                    )}
                    {abierto && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <CabeceraOrden campo="fecha" className="w-28">Fecha</CabeceraOrden>
                            <CabeceraOrden campo="empresa">Empresa</CabeceraOrden>
                            <CabeceraOrden campo="cuenta">Cuenta</CabeceraOrden>
                            <CabeceraOrden campo="concepto">Concepto</CabeceraOrden>
                            <CabeceraOrden campo="valor" className="text-right">Valor</CabeceraOrden>
                            <TableHead className="w-24 text-center">Soportes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.filas.map(x => {
                            const cantidad = x.soportes;
                            const tiene = cantidad > 0 || !!x.soporteDriveLink;
                            return (
                              <TableRow key={x.clave}>
                                <TableCell className="whitespace-nowrap text-xs">{x.fecha}</TableCell>
                                <TableCell className="text-xs">
                                  <div className="flex items-center gap-2">
                                    {EmpresaLogo && x.empresa && <EmpresaLogo empresa={x.empresa} height={18} />}
                                    <span className="hidden xl:inline">{x.empresa}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">{x.cuenta || '—'}</TableCell>
                                <TableCell className="min-w-[220px]">
                                  <span className="text-sm">{x.concepto || '—'}</span>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                    <Badge variant={VARIANTE_TIPO[x.tipo] || 'muted'} className="text-[0.65rem]">{x.tipo}</Badge>
                                    {x.ceco && <span className="text-[0.7rem] text-muted-foreground">{x.ceco}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className={cn('whitespace-nowrap text-right font-bold', x.tipo === 'Ingreso' ? 'text-success' : 'text-destructive')}>{formatoValor(x)}</TableCell>
                                <TableCell className="text-center">
                                  {tiene ? (
                                    <Button variant="ghost" size="sm" onClick={() => abrir(x)} title={cantidad ? `Ver soportes${x.conExcel ? ' (incluye el Excel de la solicitud)' : ''}` : 'Abrir el soporte en Drive'} className="text-success">
                                      <Paperclip size={15} /> {cantidad || 'Drive'}
                                    </Button>
                                  ) : <span className="text-xs text-[#C4622D]" title="Este registro no tiene soportes">Sin soporte</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {visor && <VisorSoportes fila={visor} onCerrar={() => setVisor(null)} formatoValor={formatoValor} EmpresaLogo={EmpresaLogo} excelSolicitud={documentosSistemaDeFila ? undefined : excelSolicitud} documentosSistema={documentosSistemaDeFila} formatMoneyByMoneda={formatMoneyByMoneda} puedeGirar={puedeGirarSoportes} onEliminar={eliminarSoporte ? (a) => eliminarSoporte(a, visor) : undefined} />}
    </div>
  );
};

export default ContabilidadView;
