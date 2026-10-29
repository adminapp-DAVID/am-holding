import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import { FileDown, FileSpreadsheet, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { etiquetaColumna, textoCelda, datosGrafico, filasExcel, nombreArchivo, textoPlano } from './asistente';

// ✨ Asistente (Administrador / Coordinadora / Gerente) — fase 1, SOLO LECTURA. Se pregunta en
// lenguaje natural; la Edge Function supabase/functions/asistente consulta el sistema con los
// permisos de quien pregunta (RLS) y devuelve texto + tablas exportables a Excel/PDF.
// La conversación vive en sessionStorage (se borra al cerrar la pestaña).

const CLAVE_SESION = 'asistente:conversacion';
const EJEMPLOS = [
  '¿Cuánto se gastó este mes por empresa?',
  '¿Qué solicitudes están pendientes de aprobar?',
  '¿Cómo va el presupuesto de este mes: qué está pagado y qué falta?',
  'Traslados entre cuentas del mes pasado',
  'Compara los gastos de los últimos 3 meses por CECO',
];

const leerSesion = () => {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION) || '[]'); } catch { return []; }
};

// Markdown mínimo: **negrita** y saltos de línea.
const TextoRespuesta = ({ texto }) => (
  <div className="text-sm leading-relaxed whitespace-pre-wrap">
    {String(texto).split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>))}
  </div>
);

const Grafico = ({ tabla, formatMoneyByMoneda }) => {
  const datos = datosGrafico(tabla).slice(0, 30);
  if (!datos.length) return null;
  const max = Math.max(...datos.map(d => Math.abs(d.valor)), 1);
  const dinero = (tabla.columnasDinero || []).includes(tabla.grafico.valor);
  return (
    <div className="mb-3 flex flex-col gap-1">
      {datos.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-40 shrink-0 truncate" title={d.etiqueta}>{d.etiqueta || '—'}</span>
          <div className="h-4 flex-1 rounded bg-muted">
            <div className="h-4 rounded bg-primary" style={{ width: `${(Math.abs(d.valor) / max) * 100}%` }} />
          </div>
          <span className="w-36 shrink-0 text-right font-semibold">{dinero ? formatMoneyByMoneda(d.valor, 'COP') : d.valor.toLocaleString('es-CO')}</span>
        </div>
      ))}
    </div>
  );
};

const TablaRespuesta = ({ tabla, formatMoneyByMoneda }) => {
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filasExcel(tabla)), 'Datos');
    XLSX.writeFile(wb, nombreArchivo(tabla.titulo, 'xlsx'));
  };
  return (
    <div className="mt-3 rounded-md border border-solid border-border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <b className="flex-1 text-sm">{tabla.titulo} <span className="font-normal text-muted-foreground">({tabla.filas.length})</span></b>
        <Button size="sm" variant="outline" onClick={exportarExcel}><FileSpreadsheet size={14} /> Excel</Button>
      </div>
      <Grafico tabla={tabla} formatMoneyByMoneda={formatMoneyByMoneda} />
      <div className="max-h-[420px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">{tabla.columnas.map(c => <TableHead key={c}>{etiquetaColumna(c)}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {tabla.filas.slice(0, 500).map((f, i) => (
              <TableRow key={i}>
                {tabla.columnas.map((c, j) => (
                  <TableCell key={c} className={`text-xs ${(tabla.columnasDinero || []).includes(c) ? 'whitespace-nowrap text-right' : ''}`}>{textoCelda(tabla, f, j, formatMoneyByMoneda)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {tabla.filas.length > 500 && <p className="m-0 mt-2 text-xs text-muted-foreground">Se muestran 500 de {tabla.filas.length}; el Excel y el PDF las incluyen todas.</p>}
    </div>
  );
};

// PDF de una respuesta: pregunta, texto y todas sus tablas.
const exportarPDF = (pregunta, respuesta, formatMoneyByMoneda) => {
  const doc = new jsPDF({ orientation: (respuesta.tablas || []).some(t => t.columnas.length > 6) ? 'landscape' : 'portrait' });
  const ancho = doc.internal.pageSize.getWidth() - 28;
  doc.setFontSize(14); doc.setFont(undefined, 'bold');
  doc.text('AM Holding · Asistente', 14, 16);
  doc.setFontSize(9); doc.setFont(undefined, 'normal');
  doc.text(new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }), 14, 22);
  let y = 30;
  doc.setFont(undefined, 'bold'); doc.setFontSize(10);
  const lineasPregunta = doc.splitTextToSize(pregunta || '', ancho);
  doc.text(lineasPregunta, 14, y); y += lineasPregunta.length * 5 + 3;
  doc.setFont(undefined, 'normal');
  for (const linea of doc.splitTextToSize(textoPlano(respuesta.texto), ancho)) {
    if (y > doc.internal.pageSize.getHeight() - 15) { doc.addPage(); y = 16; }
    doc.text(linea, 14, y); y += 5;
  }
  for (const t of respuesta.tablas || []) {
    if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 16; }
    doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text(t.titulo, 14, y + 6);
    doc.setFont(undefined, 'normal');
    doc.autoTable({
      startY: y + 9,
      head: [t.columnas.map(etiquetaColumna)],
      body: t.filas.map(f => t.columnas.map((_, j) => textoCelda(t, f, j, formatMoneyByMoneda))),
      styles: { fontSize: 7 }, headStyles: { fillColor: [184, 146, 61] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 4;
  }
  doc.save(nombreArchivo(respuesta.tablas?.[0]?.titulo || pregunta, 'pdf'));
};

const AsistenteView = ({ user, formatMoneyByMoneda }) => {
  const [mensajes, setMensajes] = useState(leerSesion);
  const [pregunta, setPregunta] = useState('');
  const [pensando, setPensando] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(mensajes)); } catch { /* sin almacenamiento */ }
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes]);

  const enviar = async (texto) => {
    const q = String(texto ?? pregunta).trim();
    if (!q || pensando) return;
    const conPregunta = [...mensajes, { rol: 'user', texto: q }];
    setMensajes(conPregunta);
    setPregunta('');
    setPensando(true);
    const { data, error } = await supabase.functions.invoke('asistente', {
      body: { mensajes: conPregunta.filter(m => !m.error).map(m => ({ rol: m.rol, texto: m.texto })) },
    });
    let mensajeError = data?.error || null;
    if (error && !mensajeError) {
      try { mensajeError = (await error.context?.json())?.error; } catch { /* respuesta sin JSON */ }
      mensajeError = mensajeError || error.message || 'No se pudo contactar al asistente.';
    }
    setMensajes(prev => [...prev, mensajeError
      ? { rol: 'assistant', texto: `⚠️ ${mensajeError}`, error: true }
      : { rol: 'assistant', texto: data.texto, tablas: data.tablas || [] }]);
    setPensando(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg"><Sparkles size={18} className="text-primary" /> Asistente</CardTitle>
            <CardDescription>
              Pregunta lo que necesites del sistema (Finanzas, Presupuesto, Solicitudes, Cuentas de cobro). Responde con los datos que tu rol puede ver y puedes exportar las tablas a Excel o PDF. Por ahora es solo de consulta: no crea, aprueba ni modifica nada.
            </CardDescription>
          </div>
          {mensajes.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setMensajes([])} disabled={pensando}><Trash2 size={14} /> Nueva conversación</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:px-6">
        {mensajes.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-sm text-muted-foreground">Hola {String(user?.nombre || '').split(' ')[0]}, prueba con:</p>
            <div className="flex flex-wrap gap-2">
              {EJEMPLOS.map(e => <Button key={e} size="sm" variant="outline" onClick={() => enviar(e)}>{e}</Button>)}
            </div>
          </div>
        )}

        {mensajes.map((m, i) => (
          m.rol === 'user' ? (
            <div key={i} className="ml-auto max-w-[80%] rounded-lg bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap">{m.texto}</div>
          ) : (
            <div key={i} className={`rounded-lg border border-solid px-3 py-2 ${m.error ? 'border-destructive/40 text-destructive' : 'border-border bg-card'}`}>
              <TextoRespuesta texto={m.texto} />
              {(m.tablas || []).map((t, j) => <TablaRespuesta key={j} tabla={t} formatMoneyByMoneda={formatMoneyByMoneda} />)}
              {!m.error && (
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => exportarPDF(mensajes[i - 1]?.texto, m, formatMoneyByMoneda)}><FileDown size={14} /> PDF</Button>
                </div>
              )}
            </div>
          )
        ))}

        {pensando && <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Consultando el sistema…</p>}
        <div ref={finRef} />

        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
          <Textarea
            aria-label="Pregunta"
            rows={2}
            value={pregunta}
            placeholder="Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            className="flex-1"
          />
          <Button type="submit" disabled={pensando || !pregunta.trim()}><Send size={14} /> Enviar</Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AsistenteView;
