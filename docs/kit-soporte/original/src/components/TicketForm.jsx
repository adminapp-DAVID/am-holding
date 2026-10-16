import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { nombreSeguro } from '../lib/datos';
import { AYUDA_TIPO, MODULOS_SOPORTE, PRIORIDADES, TIPOS_TICKET, claseEstadoTicket, moduloDeRuta, parecidos } from '../lib/soporte';
import Modal from './Modal';
import AnotarImagen from './AnotarImagen';

const MAX_MB = 10;

// Nuevo ticket de soporte (o edición del propio mientras está Nuevo / Necesita información)
export default function TicketForm({ ticket, pantalla, onCerrar, onGuardado }) {
  const [f, setF] = useState(() => ({
    tipo: ticket?.tipo || 'Mejora',
    titulo: ticket?.titulo || '',
    descripcion: ticket?.descripcion || '',
    modulo: ticket?.modulo || moduloDeRuta(pantalla),
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
  const similares = useMemo(() => parecidos(`${f.titulo} ${f.descripcion}`, otros, ticket?.id), [f.titulo, f.descripcion, otros, ticket]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  // Foto de la pantalla que está detrás del formulario, para marcarla enseguida
  async function capturarPantalla() {
    setCapturando(true);
    setError('');
    try {
      const { toBlob } = await import('html-to-image');
      const nodo = document.querySelector('.app') || document.body;
      const blob = await toBlob(nodo, {
        filter: (n) => !n.classList?.contains('modal-fondo'),
        width: window.innerWidth,
        height: window.innerHeight,
        style: { transform: `translateY(-${window.scrollY}px)` },
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      });
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
        return setError('No se pudo crear el ticket');
      }
      id = data.id;
    }
    // Capturas y archivos: carpeta = id del ticket
    const subidos = [];
    for (const a of archivos) {
      const path = `${id}/${Date.now()}_${nombreSeguro(a.name)}`;
      const { error: e2 } = await supabase.storage.from('soporte').upload(path, a, { contentType: a.type || undefined });
      if (!e2) subidos.push(path);
    }
    const cambios = ticket ? { ...datos, adjuntos: [...f.adjuntos, ...subidos] } : subidos.length ? { adjuntos: subidos } : null;
    if (cambios) {
      const { data, error: e3 } = await supabase.from('tickets').update(cambios).eq('id', id).select('id');
      if (e3 || !data?.length) {
        setGuardando(false);
        return setError(ticket ? 'No se pudo guardar (solo se puede editar mientras está Nuevo o Necesita información)' : 'El ticket se creó, pero no se pudieron adjuntar los archivos');
      }
    }
    setGuardando(false);
    if (subidos.length < archivos.length) setError(`${archivos.length - subidos.length} archivo(s) no se pudieron subir`);
    onGuardado(id);
  }

  return (
    <Modal
      titulo={ticket ? `Editar ticket #${ticket.numero}` : 'Nuevo ticket de soporte'}
      onCerrar={onCerrar}
      pie={
        <>
          {error && <p className="error">{error}</p>}
          <span className="espacio" />
          <button type="button" className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-ticket" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : ticket ? 'Guardar' : 'Enviar ticket'}</button>
        </>
      }
    >
      <form id="form-ticket" className="form" onSubmit={guardar}>
        <div className="campo">
          <span>¿Qué necesitas?</span>
          <div className="chips">
            {TIPOS_TICKET.map((t) => (
              <label key={t} className={`chip ${f.tipo === t ? 'chip-activo' : ''}`} title={AYUDA_TIPO[t]}>
                <input type="radio" checked={f.tipo === t} onChange={() => setF((p) => ({ ...p, tipo: t }))} hidden />{t}
              </label>
            ))}
          </div>
          <small className="suave">{AYUDA_TIPO[f.tipo]}</small>
        </div>
        <label className="campo">
          <span>Título*</span>
          <input value={f.titulo} onChange={set('titulo')} required maxLength={140} autoFocus
            placeholder={f.tipo === 'Error' ? 'Ej: No se puede subir la foto de un jugador' : 'Ej: Poder filtrar contactos por club'} />
        </label>

        {similares.length > 0 && (
          <div className="ticket-similares">
            <strong>¿Ya está pedido? Revisa estos tickets antes de crear uno nuevo:</strong>
            <ul>
              {similares.map((t) => (
                <li key={t.id}>
                  <Link to={`/soporte/${t.id}`} onClick={onCerrar}>#{t.numero} {t.titulo}</Link>{' '}
                  <span className={`estado ${claseEstadoTicket(t.estado)}`}>{t.estado}</span>
                </li>
              ))}
            </ul>
            <small className="suave">Si es lo mismo, ábrelo y pulsa "A mí también": así sabemos cuántos lo necesitan.</small>
          </div>
        )}

        <label className="campo">
          <span>Descripción</span>
          <textarea rows="6" value={f.descripcion} onChange={set('descripcion')}
            placeholder={f.tipo === 'Error'
              ? '¿Qué hiciste?, ¿qué esperabas que pasara? y ¿qué pasó? (copia el mensaje de error si aparece)'
              : '¿Qué necesitas y para qué? Mientras más detalle, mejor.'} />
        </label>
        <div className="form-grid">
          <label className="campo">
            <span>Módulo</span>
            <select value={f.modulo} onChange={set('modulo')}>{MODULOS_SOPORTE.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          {!ticket && (
            <label className="campo">
              <span>¿Qué tan urgente es?</span>
              <select value={f.prioridad} onChange={set('prioridad')}>{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}</select>
            </label>
          )}
        </div>
        <label className="campo">
          <span>Capturas o archivos (opcional)</span>
          <input type="file" multiple accept="image/*,application/pdf,.xlsx,.csv,.docx" onChange={elegirArchivos} />
        </label>
        <div className="ticket-capturar">
          <button type="button" className="btn btn-secundario" onClick={capturarPantalla} disabled={capturando}>
            {capturando ? 'Capturando…' : '📸 Capturar esta pantalla'}
          </button>
          <span className="suave">Toma una foto de la pantalla y márcala con flechas, recuadros o texto.</span>
        </div>
        {(f.adjuntos.length > 0 || archivos.length > 0) && (
          <ul className="ticket-adjuntos">
            {f.adjuntos.map((p) => (
              <li key={p}>{p.split('/').pop().replace(/^\d+_/, '')}{' '}
                <button type="button" className="btn-link peligro" onClick={() => setF((x) => ({ ...x, adjuntos: x.adjuntos.filter((y) => y !== p) }))}>Quitar</button>
              </li>
            ))}
            {archivos.map((a, i) => (
              <li key={`${a.name}${i}`}>{a.name}{' '}
                {a.type.startsWith('image/') && <button type="button" className="btn-link" onClick={() => setAnotando(i)}>✏️ Marcar</button>}{' '}
                <button type="button" className="btn-link peligro" onClick={() => setArchivos((x) => x.filter((_, j) => j !== i))}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
        {pantalla && !ticket && <p className="suave nota">Se adjunta la pantalla desde donde lo reportas: {pantalla}</p>}
      </form>
      {anotando !== null && archivos[anotando] && (
        <AnotarImagen archivo={archivos[anotando]} onCerrar={() => setAnotando(null)}
          onGuardar={(nuevo) => { setArchivos((x) => x.map((a, j) => (j === anotando ? nuevo : a))); setAnotando(null); }} />
      )}
    </Modal>
  );
}
