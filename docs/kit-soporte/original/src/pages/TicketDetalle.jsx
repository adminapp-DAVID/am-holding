import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatoFechaHora } from '../lib/datos';
import { ESTADOS_TICKET, PRIORIDADES, abrirAdjunto, claseEstadoTicket, sincronizarGitHub } from '../lib/soporte';
import TicketForm from '../components/TicketForm';

const Dato = ({ label, children }) => (
  <div className="dato">
    <span className="dato-label">{label}</span>
    <span className="dato-valor">{children || children === 0 ? children : '—'}</span>
  </div>
);

const EVENTO = { creado: 'creó el ticket', estado: 'cambió el estado', prioridad: 'cambió la prioridad', github: 'GitHub' };

export default function TicketDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario, puede } = useAuth();
  const gestiona = puede('soporte.gestionar');
  const [t, setT] = useState(undefined);
  const [comentarios, setComentarios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [texto, setTexto] = useState('');
  const [gestion, setGestion] = useState(null);
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('tickets').select('*, autor:creado_por(nombre), apoyos:ticket_apoyos(usuario_id, usuario:usuario_id(nombre))').eq('id', id).maybeSingle(),
      supabase.from('ticket_comentarios').select('*, autor:autor_id(nombre)').eq('ticket_id', id).order('created_at'),
      supabase.from('ticket_historial').select('*, actor:actor_id(nombre)').eq('ticket_id', id).order('fecha', { ascending: false }),
    ]);
    setT(a.data || null);
    setComentarios(b.data || []);
    setHistorial(c.data || []);
    if (a.data) setGestion({ estado: a.data.estado, prioridad: a.data.prioridad, respuesta: a.data.respuesta || '' });
  }, [id]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (t === undefined) return <div className="card vacio">Cargando…</div>;
  if (t === null) return <div className="card vacio">Ticket no encontrado. <Link to="/soporte">Volver a Soporte</Link></div>;

  const esMio = t.creado_por === usuario?.id;
  const puedeEditar = gestiona || (esMio && ['Nuevo', 'Necesita información'].includes(t.estado));
  const puedeEliminar = gestiona || (esMio && t.estado === 'Nuevo');
  const apoyo = t.apoyos.some((a) => a.usuario_id === usuario?.id);

  async function apoyar() {
    setError('');
    const q = apoyo
      ? supabase.from('ticket_apoyos').delete().eq('ticket_id', t.id).eq('usuario_id', usuario.id).select('ticket_id')
      : supabase.from('ticket_apoyos').insert({ ticket_id: t.id, usuario_id: usuario.id }).select('ticket_id');
    const { data, error: e } = await q;
    if (e || !data?.length) setError('No se pudo registrar');
    cargar();
  }

  async function comentar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setOcupado(true);
    const { error: e1 } = await supabase.from('ticket_comentarios').insert({ ticket_id: t.id, autor_id: usuario.id, texto: texto.trim() });
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
    // GitHub: se crea el issue al aprobar y se cierra al publicar o rechazar
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
    navigate('/soporte');
  }

  return (
    <div className="ticket-detalle">
      <div className="page-header">
        <div className="migas"><Link to="/soporte">Soporte</Link> › <strong>Ticket #{t.numero}</strong></div>
        <div className="ticket-acciones">
          {puedeEliminar && <button className="btn btn-peligro" onClick={eliminar}>Eliminar</button>}
          {puedeEditar && <button className="btn btn-secundario" onClick={() => setEditando(true)}>Editar</button>}
          <button className={`btn ${apoyo ? 'btn-primario' : 'btn-secundario'}`} onClick={apoyar}
            title="Súmate si también te pasa o también lo necesitas">
            👍 {apoyo ? 'Lo apoyas' : 'A mí también'} {t.apoyos.length > 0 && `(${t.apoyos.length})`}
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {aviso && <p className="aviso">{aviso}</p>}

      <section className="card perfil-seccion">
        <div className="ticket-titulo">
          <h1>{t.titulo}</h1>
          <span className={`estado grande ${claseEstadoTicket(t.estado)}`}>{t.estado}</span>
        </div>
        <div className="datos">
          <Dato label="Tipo">{t.tipo}</Dato>
          <Dato label="Módulo">{t.modulo}</Dato>
          <Dato label="Prioridad">{t.prioridad}</Dato>
          <Dato label="Reportó">{t.autor?.nombre}</Dato>
          <Dato label="Fecha">{formatoFechaHora(t.created_at)}</Dato>
          <Dato label="Pantalla">{t.pantalla && <Link to={t.pantalla}>{t.pantalla}</Link>}</Dato>
          <Dato label="Apoyos">{t.apoyos.map((a) => a.usuario?.nombre).filter(Boolean).join(', ')}</Dato>
          <Dato label="GitHub">{t.github_url && <a href={t.github_url} target="_blank" rel="noopener noreferrer">Issue #{t.github_issue}</a>}</Dato>
        </div>
        <h2>Descripción</h2>
        <p className="texto-largo">{t.descripcion || <span className="suave">Sin descripción.</span>}</p>
        {t.adjuntos.length > 0 && (
          <>
            <h2>Archivos</h2>
            <ul className="ticket-adjuntos">
              {t.adjuntos.map((p) => (
                <li key={p}><button className="btn-link" onClick={() => abrirAdjunto(p)}>{p.split('/').pop().replace(/^\d+_/, '')}</button></li>
              ))}
            </ul>
          </>
        )}
        {t.respuesta && (
          <div className={`ticket-respuesta ${claseEstadoTicket(t.estado)}`}>
            <strong>Respuesta de Gerencia</strong>
            <p className="texto-largo">{t.respuesta}</p>
          </div>
        )}
      </section>

      {gestiona && gestion && (
        <section className="card perfil-seccion">
          <h2>Gestión</h2>
          <form className="form" onSubmit={guardarGestion}>
            <div className="form-grid">
              <label className="campo">
                <span>Estado</span>
                <select value={gestion.estado} onChange={(e) => setGestion((g) => ({ ...g, estado: e.target.value }))}>
                  {ESTADOS_TICKET.map((e) => <option key={e}>{e}</option>)}
                </select>
              </label>
              <label className="campo">
                <span>Prioridad</span>
                <select value={gestion.prioridad} onChange={(e) => setGestion((g) => ({ ...g, prioridad: e.target.value }))}>
                  {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <label className="campo">
              <span>Respuesta para quien lo pidió {['Rechazado', 'Necesita información'].includes(gestion.estado) && '*'}</span>
              <textarea rows="3" value={gestion.respuesta} onChange={(e) => setGestion((g) => ({ ...g, respuesta: e.target.value }))}
                placeholder="Motivo del rechazo, qué información falta o qué se hizo" />
            </label>
            <p className="suave nota">Al pasar a Aprobado se crea el issue en GitHub; al pasar a Publicado o Rechazado se cierra.</p>
            <div className="ticket-acciones">
              {!t.github_issue && <button type="button" className="btn btn-secundario" onClick={enviarGitHub} disabled={ocupado}>Enviar a GitHub</button>}
              <button type="submit" className="btn btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="card perfil-seccion">
        <h2>Conversación</h2>
        {comentarios.length ? (
          <ul className="ticket-comentarios">
            {comentarios.map((c) => (
              <li key={c.id} className={c.autor_id === usuario?.id ? 'mio' : ''}>
                <div className="suave"><strong>{c.autor?.nombre || '—'}</strong> · {formatoFechaHora(c.created_at)}</div>
                <p className="texto-largo">{c.texto}</p>
              </li>
            ))}
          </ul>
        ) : <p className="suave">Aún no hay comentarios.</p>}
        <form className="ticket-comentar" onSubmit={comentar}>
          <textarea rows="2" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe un comentario o responde una pregunta…" />
          <button className="btn btn-primario" disabled={ocupado || !texto.trim()}>Enviar</button>
        </form>
      </section>

      <section className="card perfil-seccion">
        <h2>Historial</h2>
        {historial.length ? (
          <ol className="timeline">
            {historial.map((h) => (
              <li key={h.id}>
                <span className="timeline-punto" />
                <div className="timeline-cabecera">
                  <strong>{formatoFechaHora(h.fecha)}</strong>
                  <span>{h.actor?.nombre || 'Sistema'}</span>
                  <span>{EVENTO[h.evento] || h.evento}</span>
                </div>
                {h.detalle && <p className="texto-largo suave">{h.detalle}</p>}
              </li>
            ))}
          </ol>
        ) : <p className="suave">Sin movimientos.</p>}
      </section>

      {editando && (
        <TicketForm ticket={t} onCerrar={() => setEditando(false)} onGuardado={() => { setEditando(false); cargar(); }} />
      )}
    </div>
  );
}
