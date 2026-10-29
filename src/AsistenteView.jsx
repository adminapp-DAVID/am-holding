import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import { Check, FileDown, FileSpreadsheet, Loader2, Mic, MicOff, Send, Sparkles, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { etiquetaColumna, textoCelda, datosGrafico, filasExcel, nombreArchivo, textoPlano, textoParaVoz } from './asistente';

// ✨ Asistente (Administrador / Coordinadora / Gerente). Se pregunta en lenguaje natural (escrito
// o dictado); la Edge Function supabase/functions/asistente consulta el sistema con los permisos
// de quien pregunta (RLS) y devuelve texto + tablas exportables a Excel/PDF. Fase 2: también
// propone acciones (solo Administrador/Coordinadora) que se ejecutan al presionar Confirmar.
// La conversación vive en sessionStorage (se borra al cerrar la pestaña).

const CLAVE_SESION = 'asistente:conversacion';
const EJEMPLOS = [
  '¿Cuánto se gastó este mes por empresa?',
  '¿Qué solicitudes están pendientes de aprobar?',
  '¿Cómo va el presupuesto de este mes: qué está pagado y qué falta?',
  'Traslados entre cuentas del mes pasado',
  'Compara los gastos de los últimos 3 meses por CECO',
];
const EJEMPLOS_ACCIONES = ['Aprueba las solicitudes pendientes de reembolso de esta semana'];

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

// Tarjeta de una acción propuesta (fase 2): nada cambia hasta que el usuario presiona Confirmar.
const TarjetaAccion = ({ accion, formatMoneyByMoneda, onConfirmar, onCancelar, trabajando }) => {
  const resuelta = accion.estado !== 'pendiente';
  return (
    <div className={`mt-3 rounded-md border-2 border-solid p-3 ${resuelta ? 'border-border opacity-80' : 'border-primary'}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <b className="flex-1 text-sm">⚡ {accion.titulo}</b>
        {accion.estado === 'hecha' && <span className="text-xs font-bold text-success">✅ Hecho</span>}
        {accion.estado === 'fallida' && <span className="text-xs font-bold text-destructive">❌ No se pudo</span>}
        {accion.estado === 'cancelada' && <span className="text-xs text-muted-foreground">Cancelada</span>}
      </div>
      {accion.resumen && <p className="m-0 mb-2 text-xs text-muted-foreground">{accion.resumen}</p>}
      <div className="max-h-[260px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">{(accion.columnas || []).map(c => <TableHead key={c}>{c}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {(accion.filas || []).map((f, i) => (
              <TableRow key={i}>
                {f.map((v, j) => (
                  <TableCell key={j} className={`text-xs ${j === accion.columnaDinero ? 'whitespace-nowrap text-right font-semibold' : ''}`}>
                    {j === accion.columnaDinero ? formatMoneyByMoneda(Number(v) || 0, accion.moneda || 'COP') : String(v ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {(accion.avisos || []).length > 0 && (
        <ul className="m-0 mt-2 pl-4 text-xs text-muted-foreground">{accion.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
      )}
      {accion.resultado && <p className={`m-0 mt-2 text-xs font-semibold ${accion.estado === 'hecha' ? 'text-success' : 'text-destructive'}`}>{accion.resultado}</p>}
      {!resuelta && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancelar} disabled={trabajando}><X size={14} /> Cancelar</Button>
          <Button size="sm" onClick={onConfirmar} disabled={trabajando}>{trabajando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar</Button>
        </div>
      )}
    </div>
  );
};

// Voz: dictado con el reconocimiento del navegador (Chrome, Edge, Safari) y lectura en voz alta.
const Reconocimiento = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const hayLectura = typeof window !== 'undefined' && 'speechSynthesis' in window;
const CLAVE_LEER = 'asistente:leerRespuestas';

const leerEnVoz = (texto) => {
  if (!hayLectura) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(textoParaVoz(texto));
  u.lang = 'es-CO';
  const voz = window.speechSynthesis.getVoices().find(v => v.lang?.startsWith('es'));
  if (voz) u.voice = voz;
  window.speechSynthesis.speak(u);
};

const AsistenteView = ({ user, formatMoneyByMoneda, onEjecutarAccion }) => {
  const [mensajes, setMensajes] = useState(leerSesion);
  const [pregunta, setPregunta] = useState('');
  const [pensando, setPensando] = useState(false);
  const [ejecutando, setEjecutando] = useState(null);
  const [escuchando, setEscuchando] = useState(false);
  const [leerRespuestas, setLeerRespuestas] = useState(() => {
    try { return localStorage.getItem(CLAVE_LEER) === '1'; } catch { return false; }
  });
  const finRef = useRef(null);
  const reconocimientoRef = useRef(null);

  useEffect(() => {
    try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(mensajes)); } catch { /* sin almacenamiento */ }
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes]);

  // Al salir de la pantalla: apaga el micrófono y la lectura.
  useEffect(() => () => {
    reconocimientoRef.current?.abort();
    if (hayLectura) window.speechSynthesis.cancel();
  }, []);

  const alternarLectura = () => {
    const nuevo = !leerRespuestas;
    setLeerRespuestas(nuevo);
    try { localStorage.setItem(CLAVE_LEER, nuevo ? '1' : '0'); } catch { /* sin almacenamiento */ }
    if (!nuevo && hayLectura) window.speechSynthesis.cancel();
  };

  const alternarMicrofono = () => {
    if (escuchando) { reconocimientoRef.current?.stop(); return; }
    const r = new Reconocimiento();
    r.lang = 'es-CO';
    r.interimResults = true;
    r.continuous = false;
    const base = pregunta.trim();
    r.onresult = (e) => {
      const dicho = Array.from(e.results).map(x => x[0].transcript).join(' ').trim();
      setPregunta([base, dicho].filter(Boolean).join(' '));
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed') alert('Permite el uso del micrófono en el navegador para dictar.');
    };
    r.onend = () => setEscuchando(false);
    reconocimientoRef.current = r;
    if (hayLectura) window.speechSynthesis.cancel();
    setEscuchando(true);
    r.start();
  };

  const enviar = async (texto) => {
    const q = String(texto ?? pregunta).trim();
    if (!q || pensando) return;
    reconocimientoRef.current?.stop();
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
      : { rol: 'assistant', texto: data.texto, tablas: data.tablas || [], acciones: data.acciones || [] }]);
    if (!mensajeError && leerRespuestas) leerEnVoz(data.texto);
    setPensando(false);
  };

  // Marca el resultado de una acción en su mensaje y deja constancia en la conversación (así el
  // asistente sabe en la siguiente pregunta qué se hizo).
  const resolverAccion = (iMensaje, idAccion, cambios, nota) => {
    setMensajes(prev => {
      const copia = prev.map((m, i) => (i !== iMensaje ? m : { ...m, acciones: m.acciones.map(a => (a.id === idAccion ? { ...a, ...cambios } : a)) }));
      return nota ? [...copia, { rol: 'user', texto: nota, nota: true }] : copia;
    });
  };

  const confirmarAccion = async (iMensaje, accion) => {
    if (!onEjecutarAccion) return;
    setEjecutando(accion.id);
    let r;
    try { r = await onEjecutarAccion(accion); } catch (e) { r = { ok: false, mensaje: e?.message || 'Error inesperado' }; }
    setEjecutando(null);
    resolverAccion(iMensaje, accion.id, { estado: r.ok ? 'hecha' : 'fallida', resultado: r.mensaje },
      `[Sistema] Confirmé "${accion.titulo}". Resultado: ${r.mensaje}`);
    if (leerRespuestas) leerEnVoz(r.mensaje);
  };

  const cancelarAccion = (iMensaje, accion) => resolverAccion(iMensaje, accion.id, { estado: 'cancelada' }, `[Sistema] Cancelé "${accion.titulo}"; no se hizo nada.`);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[240px] flex-1">
            <CardTitle className="flex items-center gap-2 text-lg"><Sparkles size={18} className="text-primary" /> Asistente</CardTitle>
            <CardDescription>
              Pregunta lo que necesites del sistema (Finanzas, Presupuesto, Solicitudes, Cuentas de cobro) y exporta las tablas a Excel o PDF. Responde con los datos que tu rol puede ver.
              {onEjecutarAccion
                ? ' También puede aprobar o devolver solicitudes, aprobar cuentas de cobro y registrar gastos o ingresos: siempre te muestra la acción y solo se hace si presionas Confirmar.'
                : ' Con tu rol es solo de consulta.'}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {hayLectura && (
              <Button size="sm" variant={leerRespuestas ? 'outline' : 'ghost'} onClick={alternarLectura} title="Leer las respuestas en voz alta">
                {leerRespuestas ? <Volume2 size={14} /> : <VolumeX size={14} />} {leerRespuestas ? 'Voz activada' : 'Voz apagada'}
              </Button>
            )}
            {mensajes.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setMensajes([])} disabled={pensando}><Trash2 size={14} /> Nueva conversación</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:px-6">
        {mensajes.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-sm text-muted-foreground">Hola {String(user?.nombre || '').split(' ')[0]}, prueba con:</p>
            <div className="flex flex-wrap gap-2">
              {[...EJEMPLOS, ...(onEjecutarAccion ? EJEMPLOS_ACCIONES : [])].map(e => <Button key={e} size="sm" variant="outline" onClick={() => enviar(e)}>{e}</Button>)}
            </div>
          </div>
        )}

        {mensajes.map((m, i) => (
          m.nota ? (
            <p key={i} className="m-0 text-center text-xs text-muted-foreground">{m.texto.replace(/^\[Sistema\]\s*/, '')}</p>
          ) : m.rol === 'user' ? (
            <div key={i} className="ml-auto max-w-[80%] rounded-lg bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap">{m.texto}</div>
          ) : (
            <div key={i} className={`rounded-lg border border-solid px-3 py-2 ${m.error ? 'border-destructive/40 text-destructive' : 'border-border bg-card'}`}>
              <TextoRespuesta texto={m.texto} />
              {(m.tablas || []).map((t, j) => <TablaRespuesta key={j} tabla={t} formatMoneyByMoneda={formatMoneyByMoneda} />)}
              {(m.acciones || []).map(a => (
                <TarjetaAccion key={a.id} accion={a} formatMoneyByMoneda={formatMoneyByMoneda} trabajando={ejecutando === a.id}
                  onConfirmar={() => confirmarAccion(i, a)} onCancelar={() => cancelarAccion(i, a)} />
              ))}
              {!m.error && (
                <div className="mt-2 flex justify-end gap-1">
                  {hayLectura && <Button size="sm" variant="ghost" onClick={() => leerEnVoz(m.texto)} title="Escuchar"><Volume2 size={14} /> Escuchar</Button>}
                  <Button size="sm" variant="ghost" onClick={() => exportarPDF(mensajes.slice(0, i).reverse().find(x => x.rol === 'user' && !x.nota)?.texto, m, formatMoneyByMoneda)}><FileDown size={14} /> PDF</Button>
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
            placeholder={escuchando ? 'Te escucho… habla y luego presiona Enviar' : `Escribe tu pregunta…${Reconocimiento ? ' o dicta con 🎤' : ''} (Enter para enviar)`}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            className="flex-1"
          />
          {Reconocimiento && (
            <Button type="button" variant={escuchando ? 'destructive' : 'outline'} onClick={alternarMicrofono} title={escuchando ? 'Detener dictado' : 'Dictar con voz'} aria-label={escuchando ? 'Detener dictado' : 'Dictar con voz'}>
              {escuchando ? <MicOff size={14} /> : <Mic size={14} />}
            </Button>
          )}
          <Button type="submit" disabled={pensando || !pregunta.trim()}><Send size={14} /> Enviar</Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AsistenteView;
