import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink, GitBranch, Loader2, MessageSquare, Pencil, Plus, ThumbsUp, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import {
  ABIERTOS, BUCKET_TICKETS, ESTADOS_TICKET, MODULOS_SOPORTE, PRIORIDADES, TIPOS_TICKET, VISTAS_SOPORTE,
  abrirAdjunto, cargarNombresSoporte, formatoFecha, formatoFechaHora, gestionaSoporte, nombreAdjunto, sincronizarGitHub, varianteEstadoTicket,
} from './soporte';
import TicketForm from './components/TicketForm';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

// Módulo 🛟 Soporte técnico: errores, mejoras y peticiones para la app (adaptado de Noss App).
// Lo ven Administrador, Coordinadora Administrativa, Gerente y Colaborador; gestionan (estado,
// prioridad, respuesta, GitHub) Administrador y Gerente. La base de datos vuelve a validar todo
// (RLS + trigger tickets_antes, ver 20261016_soporte_tickets.sql).

const FILTRO = { texto: '', estado: 'abiertos', tipo: '', modulo: '', mios: false };
const ORDEN_PRIORIDAD = { Alta: 0, Media: 1, Baja: 2 };
const EVENTO = { creado: 'creó el ticket', estado: 'cambió el estado', prioridad: 'cambió la prioridad', github: 'GitHub' };

const Campo = ({ label, htmlFor, className, children }) => (
  <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);
const Dato = ({ label, children }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold">{children || children === 0 ? children : '—'}</span>
  </div>
);

// ---------- Lista ----------
function ListaTickets({ user, version, onAbrir, onNuevo }) {
  const gestiona = gestionaSoporte(user.rol);
  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState('lista');
  const [filtro, setFiltro] = useState(FILTRO);
  const [nombres, setNombres] = useState({});
  const nombre = (id) => nombres[String(id)] || '';

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.from('tickets')
      .select('*, apoyos:ticket_apoyos(usuario_id), comentarios:ticket_comentarios(count)')
      .order('created_at', { ascending: false });
    if (e) setError(e.message);
    setNombres(await cargarNombresSoporte());
    setTickets(data || []);
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar, version]);

  const setF = (k) => (e) => setFiltro((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const visibles = useMemo(() => {
    const t = filtro.texto.trim().toLowerCase().replace(/^#/, '');
    return tickets
      .filter((x) =>
        (!t || String(x.numero) === t || [x.titulo, x.descripcion, nombres[String(x.creado_por)]].some((v) => v?.toLowerCase().includes(t))) &&
        (filtro.estado === '' || (filtro.estado === 'abiertos' ? ABIERTOS.includes(x.estado) : x.estado === filtro.estado)) &&
        (!filtro.tipo || x.tipo === filtro.tipo) &&
        (!filtro.modulo || x.modulo === filtro.modulo) &&
        (!filtro.mios || String(x.creado_por) === String(user.id) || x.apoyos.some((a) => String(a.usuario_id) === String(user.id))))
      .sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || b.apoyos.length - a.apoyos.length || b.numero - a.numero);
  }, [tickets, filtro, user.id, nombres]);

  const cuenta = (e) => tickets.filter((x) => x.estado === e).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl font-bold">🛟 Soporte técnico</h2>
          <p className="m-0 text-sm text-muted-foreground">Errores, mejoras y peticiones para la app. Revisa si ya está pedido antes de crear uno nuevo.</p>
        </div>
        <Button onClick={onNuevo}><Plus size={16} /> Nuevo ticket</Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {ESTADOS_TICKET.map((e) => (
          <button key={e} type="button" onClick={() => setFiltro((p) => ({ ...p, estado: p.estado === e ? 'abiertos' : e }))}
            className={cn('flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-solid bg-card p-3 text-left font-[inherit]',
              filtro.estado === e ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-muted')}>
            <strong className="text-xl">{cuenta(e)}</strong>
            <Badge variant={varianteEstadoTicket(e)}>{e}</Badge>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <Campo label="Buscar" htmlFor="tk-buscar">
            <Input id="tk-buscar" value={filtro.texto} onChange={setF('texto')} placeholder="Número, título, texto o persona…" />
          </Campo>
          <Campo label="Estado" htmlFor="tk-f-estado">
            <Select id="tk-f-estado" value={filtro.estado} onChange={setF('estado')}>
              <option value="abiertos">Abiertos</option>
              <option value="">Todos</option>
              {ESTADOS_TICKET.map((e) => <option key={e}>{e}</option>)}
            </Select>
          </Campo>
          <Campo label="Tipo" htmlFor="tk-f-tipo">
            <Select id="tk-f-tipo" value={filtro.tipo} onChange={setF('tipo')}>
              <option value="">Todos</option>
              {TIPOS_TICKET.map((e) => <option key={e}>{e}</option>)}
            </Select>
          </Campo>
          <Campo label="Módulo" htmlFor="tk-f-modulo">
            <Select id="tk-f-modulo" value={filtro.modulo} onChange={setF('modulo')}>
              <option value="">Todos</option>
              {MODULOS_SOPORTE.map((e) => <option key={e}>{e}</option>)}
            </Select>
          </Campo>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={filtro.mios} onChange={setF('mios')} /> Míos y los que apoyo
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        {gestiona ? (
          <div className="flex gap-1">
            <Button size="sm" variant={vista === 'lista' ? 'default' : 'outline'} onClick={() => setVista('lista')}>Lista</Button>
            <Button size="sm" variant={vista === 'tablero' ? 'default' : 'outline'} onClick={() => setVista('tablero')}>Tablero</Button>
          </div>
        ) : <span />}
        <span className="text-sm text-muted-foreground">{visibles.length} de {tickets.length} tickets</span>
      </div>

      {error && <p className="m-0 text-sm text-destructive">❌ {error}</p>}
      {cargando ? (
        <Card><CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 size={18} className="animate-spin" /> Cargando…</CardContent></Card>
      ) : vista === 'tablero' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ESTADOS_TICKET.filter((e) => filtro.estado === '' || filtro.estado === e || (filtro.estado === 'abiertos' && ABIERTOS.includes(e))).map((e) => {
            const col = visibles.filter((x) => x.estado === e);
            return (
              <div key={e} className="flex w-64 shrink-0 flex-col gap-2 rounded-lg bg-muted p-2">
                <div className="flex items-center justify-between px-1"><Badge variant={varianteEstadoTicket(e)}>{e}</Badge><span className="text-xs text-muted-foreground">{col.length}</span></div>
                {col.map((x) => (
                  <button key={x.id} type="button" onClick={() => onAbrir(x.id)}
                    className="flex cursor-pointer flex-col gap-1 rounded-md border border-solid border-border bg-card p-2.5 text-left font-[inherit] hover:border-primary">
                    <strong className="text-sm">#{x.numero} {x.titulo}</strong>
                    <span className="text-xs text-muted-foreground">{x.tipo} · {x.modulo} · {x.prioridad}</span>
                    <span className="text-xs text-muted-foreground">{nombre(x.creado_por)}{x.apoyos.length ? ` · 👍 ${x.apoyos.length}` : ''}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : visibles.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">{tickets.length ? 'Ningún ticket coincide con los filtros.' : 'Aún no hay tickets. Crea el primero con "Nuevo ticket".'}</CardContent></Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>#</TableHead><TableHead>Título</TableHead><TableHead>Tipo</TableHead><TableHead>Módulo</TableHead><TableHead>Prioridad</TableHead><TableHead>Estado</TableHead><TableHead>Apoyos</TableHead><TableHead>Reportó</TableHead><TableHead>Fecha</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((x) => (
                <TableRow key={x.id} className="cursor-pointer" onClick={() => onAbrir(x.id)}>
                  <TableCell>{x.numero}</TableCell>
                  <TableCell className="min-w-[220px]">
                    <strong>{x.titulo}</strong>
                    {x.comentarios?.[0]?.count > 0 && <span className="text-muted-foreground"> · 💬 {x.comentarios[0].count}</span>}
                    {x.github_issue && <span className="text-muted-foreground"> · GitHub #{x.github_issue}</span>}
                  </TableCell>
                  <TableCell>{x.tipo}</TableCell>
                  <TableCell>{x.modulo}</TableCell>
                  <TableCell>{x.prioridad}</TableCell>
                  <TableCell><Badge variant={varianteEstadoTicket(x.estado)}>{x.estado}</Badge></TableCell>
                  <TableCell>{x.apoyos.length ? `👍 ${x.apoyos.length}` : ''}</TableCell>
                  <TableCell>{nombre(x.creado_por)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatoFecha(x.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ---------- Detalle ----------
function DetalleTicket({ user, id, onVolver, onNavegar, onAbrir }) {
  const gestiona = gestionaSoporte(user.rol);
  const [t, setT] = useState(undefined);
  const [comentarios, setComentarios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [texto, setTexto] = useState('');
  const [gestion, setGestion] = useState(null);
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [nombres, setNombres] = useState({});
  const nombre = (uid) => nombres[String(uid)] || '';

  const cargar = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('tickets').select('*, apoyos:ticket_apoyos(usuario_id)').eq('id', id).maybeSingle(),
      supabase.from('ticket_comentarios').select('*').eq('ticket_id', id).order('created_at'),
      supabase.from('ticket_historial').select('*').eq('ticket_id', id).order('fecha', { ascending: false }),
    ]);
    setNombres(await cargarNombresSoporte());
    setT(a.data || null);
    setComentarios(b.data || []);
    setHistorial(c.data || []);
    if (a.data) setGestion({ estado: a.data.estado, prioridad: a.data.prioridad, respuesta: a.data.respuesta || '' });
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  if (t === undefined) return <Card><CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 size={18} className="animate-spin" /> Cargando…</CardContent></Card>;
  if (t === null) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
        Ticket no encontrado (o tu rol no puede verlo).
        <Button variant="outline" onClick={onVolver}><ChevronLeft size={16} /> Volver a Soporte</Button>
      </CardContent></Card>
    );
  }

  const esMio = String(t.creado_por) === String(user.id);
  const puedeEditar = gestiona || (esMio && ['Nuevo', 'Necesita información'].includes(t.estado));
  const puedeEliminar = gestiona || (esMio && t.estado === 'Nuevo');
  const apoyo = t.apoyos.some((a) => String(a.usuario_id) === String(user.id));

  async function apoyar() {
    setError('');
    const q = apoyo
      ? supabase.from('ticket_apoyos').delete().eq('ticket_id', t.id).eq('usuario_id', user.id).select('ticket_id')
      : supabase.from('ticket_apoyos').insert({ ticket_id: t.id, usuario_id: user.id }).select('ticket_id');
    const { data, error: e } = await q;
    if (e || !data?.length) setError('No se pudo registrar');
    cargar();
  }

  async function comentar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setOcupado(true);
    const { error: e1 } = await supabase.from('ticket_comentarios').insert({ ticket_id: t.id, autor_id: user.id, texto: texto.trim() });
    setOcupado(false);
    if (e1) return setError('No se pudo enviar el comentario');
    setTexto('');
    cargar();
  }

  async function guardarGestion(e) {
    e.preventDefault();
    setError('');
    setAviso('');
    if (['Rechazado', 'Necesita información'].includes(gestion.estado) && !gestion.respuesta.trim()) {
      return setError(gestion.estado === 'Rechazado' ? 'Escribe el motivo del rechazo' : 'Escribe qué información falta');
    }
    setOcupado(true);
    const { data, error: e1 } = await supabase.from('tickets')
      .update({ estado: gestion.estado, prioridad: gestion.prioridad, respuesta: gestion.respuesta.trim() || null }).eq('id', t.id).select('id');
    if (e1 || !data?.length) {
      setOcupado(false);
      return setError('No se pudo guardar');
    }
    // GitHub: se crea el issue al aprobar y se cierra al publicar o rechazar.
    try {
      if (['Aprobado', 'En desarrollo'].includes(gestion.estado) && !t.github_issue) {
        const r = await sincronizarGitHub(t.id, 'crear');
        setAviso(`Enviado a GitHub como issue #${r.github_issue}`);
      } else if (['Publicado', 'Rechazado'].includes(gestion.estado) && t.github_issue && gestion.estado !== t.estado) {
        await sincronizarGitHub(t.id, 'cerrar');
        setAviso(`Issue #${t.github_issue} cerrado en GitHub`);
      } else setAviso('Guardado');
    } catch (err) {
      setError(`Guardado, pero GitHub falló: ${err.message}`);
    }
    setOcupado(false);
    cargar();
  }

  async function enviarGitHub() {
    setError('');
    setOcupado(true);
    try {
      const r = await sincronizarGitHub(t.id, 'crear');
      setAviso(`Enviado a GitHub como issue #${r.github_issue}`);
    } catch (err) {
      setError(err.message);
    }
    setOcupado(false);
    cargar();
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar el ticket #${t.numero}?`)) return;
    const { data, error: e } = await supabase.from('tickets').delete().eq('id', t.id).select('id');
    if (e || !data?.length) return setError('No se pudo eliminar');
    if (t.adjuntos.length) await supabase.storage.from(BUCKET_TICKETS).remove(t.adjuntos);
    onVolver();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={onVolver}><ChevronLeft size={16} /> Soporte</Button>
          <span className="text-muted-foreground">›</span> <strong>Ticket #{t.numero}</strong>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeEliminar && <Button variant="outline" className="text-destructive" onClick={eliminar}><Trash2 size={16} /> Eliminar</Button>}
          {puedeEditar && <Button variant="outline" onClick={() => setEditando(true)}><Pencil size={16} /> Editar</Button>}
          <Button variant={apoyo ? 'default' : 'outline'} onClick={apoyar} title="Súmate si también te pasa o también lo necesitas">
            <ThumbsUp size={16} /> {apoyo ? 'Lo apoyas' : 'A mí también'} {t.apoyos.length > 0 && `(${t.apoyos.length})`}
          </Button>
        </div>
      </div>
      {error && <p className="m-0 text-sm text-destructive">❌ {error}</p>}
      {aviso && <p className="m-0 text-sm text-success">✅ {aviso}</p>}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="text-xl">{t.titulo}</CardTitle>
            <Badge variant={varianteEstadoTicket(t.estado)} className="text-sm">{t.estado}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato label="Tipo">{t.tipo}</Dato>
            <Dato label="Módulo">{t.modulo}</Dato>
            <Dato label="Prioridad">{t.prioridad}</Dato>
            <Dato label="Reportó">{nombre(t.creado_por)}</Dato>
            <Dato label="Fecha">{formatoFechaHora(t.created_at)}</Dato>
            <Dato label="Pantalla">{t.pantalla && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onNavegar(t.pantalla)}>{VISTAS_SOPORTE[t.pantalla] || t.pantalla}</Button>
            )}</Dato>
            <Dato label="Apoyos">{t.apoyos.map((a) => nombre(a.usuario_id)).filter(Boolean).join(', ')}</Dato>
            <Dato label="GitHub">{t.github_url && (
              <a href={t.github_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary">Issue #{t.github_issue} <ExternalLink size={12} /></a>
            )}</Dato>
          </div>
          <div>
            <h3 className="m-0 mb-1 text-sm font-bold">Descripción</h3>
            <p className="m-0 whitespace-pre-wrap text-sm">{t.descripcion || <span className="text-muted-foreground">Sin descripción.</span>}</p>
          </div>
          {t.adjuntos.length > 0 && (
            <div>
              <h3 className="m-0 mb-1 text-sm font-bold">Archivos</h3>
              <div className="flex flex-wrap gap-2">
                {t.adjuntos.map((p) => (
                  <Button key={p} variant="outline" size="sm" onClick={() => abrirAdjunto(p)}>{nombreAdjunto(p)}</Button>
                ))}
              </div>
            </div>
          )}
          {t.respuesta && (
            <div className={cn('rounded-lg border border-solid p-3', t.estado === 'Rechazado' ? 'border-destructive/40 bg-destructive/5' : 'border-primary/40 bg-primary/5')}>
              <strong className="text-sm">Respuesta de soporte</strong>
              <p className="m-0 mt-1 whitespace-pre-wrap text-sm">{t.respuesta}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {gestiona && gestion && (
        <Card>
          <CardHeader><CardTitle>Gestión</CardTitle><CardDescription>Al pasar a Aprobado se crea el issue en GitHub; al pasar a Publicado o Rechazado se cierra.</CardDescription></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={guardarGestion}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Estado" htmlFor="tk-g-estado">
                  <Select id="tk-g-estado" value={gestion.estado} onChange={(e) => setGestion((g) => ({ ...g, estado: e.target.value }))}>
                    {ESTADOS_TICKET.map((e) => <option key={e}>{e}</option>)}
                  </Select>
                </Campo>
                <Campo label="Prioridad" htmlFor="tk-g-prioridad">
                  <Select id="tk-g-prioridad" value={gestion.prioridad} onChange={(e) => setGestion((g) => ({ ...g, prioridad: e.target.value }))}>
                    {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
                  </Select>
                </Campo>
              </div>
              <Campo label={`Respuesta para quien lo pidió${['Rechazado', 'Necesita información'].includes(gestion.estado) ? ' *' : ''}`} htmlFor="tk-g-resp">
                <Textarea id="tk-g-resp" rows={3} value={gestion.respuesta} onChange={(e) => setGestion((g) => ({ ...g, respuesta: e.target.value }))}
                  placeholder="Motivo del rechazo, qué información falta o qué se hizo" />
              </Campo>
              <div className="flex flex-wrap justify-end gap-2">
                {!t.github_issue && <Button variant="outline" onClick={enviarGitHub} disabled={ocupado}><GitBranch size={16} /> Enviar a GitHub</Button>}
                <Button type="submit" disabled={ocupado}>{ocupado && <Loader2 size={16} className="animate-spin" />} {ocupado ? 'Guardando…' : 'Guardar'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare size={18} /> Conversación</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {comentarios.length ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {comentarios.map((c) => (
                <li key={c.id} className={cn('rounded-lg border border-solid border-border p-3', String(c.autor_id) === String(user.id) ? 'ml-6 bg-primary/5' : 'mr-6 bg-background')}>
                  <div className="text-xs text-muted-foreground"><strong className="text-foreground">{nombre(c.autor_id) || '—'}</strong> · {formatoFechaHora(c.created_at)}</div>
                  <p className="m-0 mt-1 whitespace-pre-wrap text-sm">{c.texto}</p>
                </li>
              ))}
            </ul>
          ) : <p className="m-0 text-sm text-muted-foreground">Aún no hay comentarios.</p>}
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={comentar}>
            <Textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe un comentario o responde una pregunta…" className="flex-1" />
            <Button type="submit" disabled={ocupado || !texto.trim()}>Enviar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
        <CardContent>
          {historial.length ? (
            <ol className="m-0 flex list-none flex-col gap-3 border-0 border-l-2 border-solid border-border p-0 pl-4">
              {historial.map((h) => (
                <li key={h.id} className="text-sm">
                  <div className="flex flex-wrap gap-x-2"><strong>{formatoFechaHora(h.fecha)}</strong><span>{nombre(h.actor_id) || 'Sistema'}</span><span className="text-muted-foreground">{EVENTO[h.evento] || h.evento}</span></div>
                  {h.detalle && <p className="m-0 whitespace-pre-wrap text-muted-foreground">{h.detalle}</p>}
                </li>
              ))}
            </ol>
          ) : <p className="m-0 text-sm text-muted-foreground">Sin movimientos.</p>}
        </CardContent>
      </Card>

      {editando && (
        <TicketForm ticket={t} onCerrar={() => setEditando(false)} onAbrirTicket={onAbrir} onGuardado={() => { setEditando(false); cargar(); }} />
      )}
    </div>
  );
}

const SoporteView = ({ user, ticketId, version, onAbrirTicket, onNuevoTicket, onNavegar }) => (
  ticketId
    ? <DetalleTicket key={ticketId} user={user} id={ticketId} onVolver={() => onAbrirTicket(null)} onNavegar={onNavegar} onAbrir={onAbrirTicket} />
    : <ListaTickets user={user} version={version} onAbrir={onAbrirTicket} onNuevo={onNuevoTicket} />
);

export default SoporteView;
