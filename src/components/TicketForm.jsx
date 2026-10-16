import { useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, Pencil, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  AYUDA_TIPO, BUCKET_TICKETS, MODULOS_SOPORTE, PRIORIDADES, TIPOS_TICKET, VISTAS_SOPORTE,
  moduloDeVista, nombreAdjunto, nombreSeguro, parecidos, varianteEstadoTicket,
} from '../soporte';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import AnotarImagen from './AnotarImagen';

const MAX_MB = 10;
const claseInputArchivo = 'h-auto cursor-pointer py-2 text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:font-[inherit] file:text-xs file:font-semibold file:text-secondary-foreground';

const Campo = ({ label, htmlFor, className, children }) => (
  <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

// Nuevo ticket de soporte técnico (o edición del propio mientras está Nuevo / Necesita información).
// `pantalla` = vista de la app (currentView) desde donde se abrió.
export default function TicketForm({ ticket, pantalla, onCerrar, onGuardado, onAbrirTicket }) {
  const [f, setF] = useState(() => ({
    tipo: ticket?.tipo || 'Mejora',
    titulo: ticket?.titulo || '',
    descripcion: ticket?.descripcion || '',
    modulo: ticket?.modulo || moduloDeVista(pantalla),
    prioridad: ticket?.prioridad || 'Media',
    adjuntos: ticket?.adjuntos || [],
  }));
  const [archivos, setArchivos] = useState([]);
  const [anotando, setAnotando] = useState(null); // índice del archivo que se está marcando
  const [capturando, setCapturando] = useState(false);
  const [otros, setOtros] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('tickets').select('id, numero, titulo, descripcion, estado').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setOtros(data || []));
  }, []);
  const similares = useMemo(() => (ticket ? [] : parecidos(`${f.titulo} ${f.descripcion}`, otros, ticket?.id)), [f.titulo, f.descripcion, otros, ticket]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  // Foto de la pantalla que está detrás del formulario (el formulario vive en un portal fuera de
  // #root, así que no sale en la foto), para marcarla enseguida.
  async function capturarPantalla() {
    setCapturando(true);
    setError('');
    try {
      const { toBlob } = await import('html-to-image');
      const nodo = document.getElementById('root') || document.body;
      const blob = await toBlob(nodo, {
        filter: (n) => !String(n.dataset?.slot || '').startsWith('dialog'),
        width: window.innerWidth,
        height: window.innerHeight,
        style: { transform: `translateY(-${window.scrollY}px)` },
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      });
      if (!blob) throw new Error('sin imagen');
      const archivo = new File([blob], `captura_${Date.now()}.png`, { type: 'image/png' });
      setArchivos((a) => [...a, archivo]);
      setAnotando(archivos.length);
    } catch {
      setError('No se pudo capturar la pantalla; puedes adjuntar una captura tomada con tu equipo');
    }
    setCapturando(false);
  }

  function elegirArchivos(e) {
    const lista = [...(e.target.files || [])];
    const grandes = lista.filter((a) => a.size > MAX_MB * 1024 * 1024);
    if (grandes.length) setError(`Cada archivo debe pesar menos de ${MAX_MB} MB`);
    setArchivos((a) => [...a, ...lista.filter((x) => x.size <= MAX_MB * 1024 * 1024)]);
    e.target.value = '';
  }

  async function guardar(e) {
    e.preventDefault();
    if (!f.titulo.trim()) return setError('Escribe un título');
    setGuardando(true);
    setError('');
    const datos = { tipo: f.tipo, titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, modulo: f.modulo };
    let id = ticket?.id;
    if (!id) {
      const { data, error: e1 } = await supabase.from('tickets')
        .insert({ ...datos, prioridad: f.prioridad, pantalla: pantalla || null }).select('id').single();
      if (e1) {
        setGuardando(false);
        return setError('No se pudo crear el ticket: ' + e1.message);
      }
      id = data.id;
    }
    // Capturas y archivos: carpeta = id del ticket (bucket tickets-adjuntos, no "soportes").
    const subidos = [];
    for (const a of archivos) {
      const path = `${id}/${Date.now()}_${nombreSeguro(a.name)}`;
      const { error: e2 } = await supabase.storage.from(BUCKET_TICKETS).upload(path, a, { contentType: a.type || undefined });
      if (!e2) subidos.push(path);
    }
    const quitados = ticket ? (ticket.adjuntos || []).filter((p) => !f.adjuntos.includes(p)) : [];
    const cambios = ticket ? { ...datos, adjuntos: [...f.adjuntos, ...subidos] } : subidos.length ? { adjuntos: subidos } : null;
    if (cambios) {
      const { data, error: e3 } = await supabase.from('tickets').update(cambios).eq('id', id).select('id');
      if (e3 || !data?.length) {
        setGuardando(false);
        return setError(ticket ? 'No se pudo guardar (solo se puede editar mientras está Nuevo o Necesita información)' : 'El ticket se creó, pero no se pudieron adjuntar los archivos');
      }
    }
    if (quitados.length) await supabase.storage.from(BUCKET_TICKETS).remove(quitados);
    setGuardando(false);
    if (subidos.length < archivos.length) alert(`${archivos.length - subidos.length} archivo(s) no se pudieron subir`);
    onGuardado(id);
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && anotando === null) onCerrar(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ticket ? `Editar ticket #${ticket.numero}` : '🛟 Nuevo ticket de soporte técnico'}</DialogTitle>
          <DialogDescription>Errores, mejoras o peticiones para la app. No es para comprobantes de pago.</DialogDescription>
        </DialogHeader>
        <form id="form-ticket" className="flex flex-col gap-4" onSubmit={guardar}>
          <div className="flex flex-col gap-1.5">
            <Label>¿Qué necesitas?</Label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_TICKET.map((t) => (
                <button key={t} type="button" title={AYUDA_TIPO[t]} onClick={() => setF((p) => ({ ...p, tipo: t }))}
                  className={cn('cursor-pointer rounded-full border border-solid px-3 py-1 text-xs font-semibold',
                    f.tipo === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted')}>
                  {t}
                </button>
              ))}
            </div>
            <p className="m-0 text-xs text-muted-foreground">{AYUDA_TIPO[f.tipo]}</p>
          </div>

          <Campo label="Título *" htmlFor="tk-titulo">
            <Input id="tk-titulo" value={f.titulo} onChange={set('titulo')} required maxLength={140} autoFocus
              placeholder={f.tipo === 'Error' ? 'Ej: No se puede adjuntar el soporte de un gasto' : 'Ej: Poder filtrar las solicitudes por CECO'} />
          </Campo>

          {similares.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-solid border-warning/50 bg-warning/10 p-3 text-sm">
              <strong>¿Ya está pedido? Revisa estos tickets antes de crear uno nuevo:</strong>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {similares.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2">
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={() => { onCerrar(); onAbrirTicket?.(t.id); }}>#{t.numero} {t.titulo}</Button>
                    <Badge variant={varianteEstadoTicket(t.estado)}>{t.estado}</Badge>
                  </li>
                ))}
              </ul>
              <p className="m-0 text-xs text-muted-foreground">Si es lo mismo, ábrelo y pulsa "A mí también": así sabemos cuántos lo necesitan.</p>
            </div>
          )}

          <Campo label="Descripción" htmlFor="tk-desc">
            <Textarea id="tk-desc" rows={5} value={f.descripcion} onChange={set('descripcion')}
              placeholder={f.tipo === 'Error'
                ? '¿Qué hiciste?, ¿qué esperabas que pasara? y ¿qué pasó? (copia el mensaje de error si aparece)'
                : '¿Qué necesitas y para qué? Mientras más detalle, mejor.'} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Módulo" htmlFor="tk-modulo">
              <Select id="tk-modulo" value={f.modulo} onChange={set('modulo')}>{MODULOS_SOPORTE.map((m) => <option key={m}>{m}</option>)}</Select>
            </Campo>
            {!ticket && (
              <Campo label="¿Qué tan urgente es?" htmlFor="tk-prioridad">
                <Select id="tk-prioridad" value={f.prioridad} onChange={set('prioridad')}>{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}</Select>
              </Campo>
            )}
          </div>
          <Campo label="Capturas o archivos (opcional)" htmlFor="tk-archivos">
            <Input id="tk-archivos" type="file" multiple accept="image/*,application/pdf,.xlsx,.csv,.docx" onChange={elegirArchivos} className={claseInputArchivo} />
          </Campo>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={capturarPantalla} disabled={capturando}>
              {capturando ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {capturando ? 'Capturando…' : 'Capturar esta pantalla'}
            </Button>
            <span className="text-xs text-muted-foreground">Toma una foto de la pantalla y márcala con flechas, recuadros o texto.</span>
          </div>
          {(f.adjuntos.length > 0 || archivos.length > 0) && (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {f.adjuntos.map((p) => (
                <li key={p} className="flex items-center gap-2 rounded-md border border-solid border-border bg-background px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{nombreAdjunto(p)}</span>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setF((x) => ({ ...x, adjuntos: x.adjuntos.filter((y) => y !== p) }))}><X size={14} /> Quitar</Button>
                </li>
              ))}
              {archivos.map((a, i) => (
                <li key={`${a.name}${i}`} className="flex items-center gap-2 rounded-md border border-solid border-border bg-background px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  {a.type.startsWith('image/') && <Button variant="ghost" size="sm" onClick={() => setAnotando(i)}><Pencil size={14} /> Marcar</Button>}
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setArchivos((x) => x.filter((_, j) => j !== i))}><X size={14} /> Quitar</Button>
                </li>
              ))}
            </ul>
          )}
          {pantalla && !ticket && <p className="m-0 text-xs text-muted-foreground">Se registra la pantalla desde donde lo reportas: {VISTAS_SOPORTE[pantalla] || pantalla}</p>}
        </form>
        <DialogFooter className="items-center">
          {error && <p className="m-0 mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" form="form-ticket" disabled={guardando}>
            {guardando && <Loader2 size={16} className="animate-spin" />} {guardando ? 'Guardando…' : ticket ? 'Guardar' : 'Enviar ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
      {anotando !== null && archivos[anotando] && (
        <AnotarImagen archivo={archivos[anotando]} onCerrar={() => setAnotando(null)}
          onGuardar={(nuevo) => { setArchivos((x) => x.map((a, j) => (j === anotando ? nuevo : a))); setAnotando(null); }} />
      )}
    </Dialog>
  );
}
