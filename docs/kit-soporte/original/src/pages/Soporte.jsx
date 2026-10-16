import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatoFecha } from '../lib/datos';
import { fechaEnZona } from '../lib/zona';
import { ABIERTOS, ESTADOS_TICKET, MODULOS_SOPORTE, TIPOS_TICKET, claseEstadoTicket } from '../lib/soporte';
import TicketForm from '../components/TicketForm';

const FILTRO = { texto: '', estado: 'abiertos', tipo: '', modulo: '', mios: false };
const ORDEN_PRIORIDAD = { Alta: 0, Media: 1, Baja: 2 };

// Soporte: todas las peticiones, mejoras y errores reportados por el equipo
export default function Soporte() {
  const { usuario, puede } = useAuth();
  const navigate = useNavigate();
  const gestiona = puede('soporte.gestionar');
  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [vista, setVista] = useState('lista');
  const [filtro, setFiltro] = useState(FILTRO);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('tickets')
      .select('*, autor:creado_por(nombre), apoyos:ticket_apoyos(usuario_id), comentarios:ticket_comentarios(count)')
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setCargando(false);
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const setF = (k) => (e) => setFiltro((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const visibles = useMemo(() => {
    const t = filtro.texto.trim().toLowerCase().replace(/^#/, '');
    return tickets
      .filter((x) =>
        (!t || String(x.numero) === t || [x.titulo, x.descripcion, x.autor?.nombre].some((v) => v?.toLowerCase().includes(t))) &&
        (filtro.estado === '' || (filtro.estado === 'abiertos' ? ABIERTOS.includes(x.estado) : x.estado === filtro.estado)) &&
        (!filtro.tipo || x.tipo === filtro.tipo) &&
        (!filtro.modulo || x.modulo === filtro.modulo) &&
        (!filtro.mios || x.creado_por === usuario?.id || x.apoyos.some((a) => a.usuario_id === usuario?.id)))
      .sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || b.apoyos.length - a.apoyos.length || b.numero - a.numero);
  }, [tickets, filtro, usuario]);

  const cuenta = (e) => tickets.filter((x) => x.estado === e).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Soporte</h1>
          <p className="suave">Errores, mejoras y peticiones para la app. Revisa si ya está pedido antes de crear uno nuevo.</p>
        </div>
        {puede('soporte.crear') && <button className="btn btn-oscuro" onClick={() => setNuevo(true)}>Nuevo ticket</button>}
      </div>

      <div className="soporte-resumen">
        {ESTADOS_TICKET.map((e) => (
          <button key={e} className={`card soporte-cifra ${filtro.estado === e ? 'activo' : ''}`}
            onClick={() => setFiltro((p) => ({ ...p, estado: p.estado === e ? 'abiertos' : e }))}>
            <strong>{cuenta(e)}</strong>
            <span className={`estado ${claseEstadoTicket(e)}`}>{e}</span>
          </button>
        ))}
      </div>

      <div className="filtros filtros-5">
        <label className="campo">
          <span>Buscar</span>
          <input value={filtro.texto} onChange={setF('texto')} placeholder="Número, título, texto o persona…" />
        </label>
        <label className="campo">
          <span>Estado</span>
          <select value={filtro.estado} onChange={setF('estado')}>
            <option value="abiertos">Abiertos</option>
            <option value="">Todos</option>
            {ESTADOS_TICKET.map((e) => <option key={e}>{e}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Tipo</span>
          <select value={filtro.tipo} onChange={setF('tipo')}>
            <option value="">Todos</option>
            {TIPOS_TICKET.map((e) => <option key={e}>{e}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Módulo</span>
          <select value={filtro.modulo} onChange={setF('modulo')}>
            <option value="">Todos</option>
            {MODULOS_SOPORTE.map((e) => <option key={e}>{e}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={filtro.mios} onChange={setF('mios')} /> Míos y los que apoyo</label>
      </div>

      <div className="barra-lista">
        {gestiona ? (
          <div className="toggle">
            <button className={vista === 'lista' ? 'activo' : ''} onClick={() => setVista('lista')}>Lista</button>
            <button className={vista === 'tablero' ? 'activo' : ''} onClick={() => setVista('tablero')}>Tablero</button>
          </div>
        ) : <span />}
        <span className="suave">{visibles.length} de {tickets.length} tickets</span>
      </div>

      {cargando ? (
        <div className="card vacio">Cargando…</div>
      ) : vista === 'tablero' ? (
        <div className="kanban">
          {ESTADOS_TICKET.filter((e) => filtro.estado === '' || filtro.estado === e || (filtro.estado === 'abiertos' && ABIERTOS.includes(e))).map((e) => {
            const col = visibles.filter((x) => x.estado === e);
            return (
              <div key={e} className="kanban-col">
                <div className="kanban-titulo"><span className={`estado ${claseEstadoTicket(e)}`}>{e}</span><span className="suave">{col.length}</span></div>
                {col.map((x) => (
                  <div key={x.id} className="kanban-tarjeta" onClick={() => navigate(`/soporte/${x.id}`)}>
                    <strong>#{x.numero} {x.titulo}</strong>
                    <span className="suave">{x.tipo} · {x.modulo} · {x.prioridad}</span>
                    <span className="suave">{x.autor?.nombre}{x.apoyos.length ? ` · 👍 ${x.apoyos.length}` : ''}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : visibles.length === 0 ? (
        <div className="card vacio">{tickets.length ? 'Ningún ticket coincide con los filtros.' : 'Aún no hay tickets. Crea el primero con "Nuevo ticket".'}</div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr><th>#</th><th>Título</th><th>Tipo</th><th>Módulo</th><th>Prioridad</th><th>Estado</th><th>Apoyos</th><th>Reportó</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {visibles.map((x) => (
                <tr key={x.id} className="clicable" onClick={() => navigate(`/soporte/${x.id}`)}>
                  <td>{x.numero}</td>
                  <td>
                    <strong>{x.titulo}</strong>
                    {x.comentarios?.[0]?.count > 0 && <span className="suave"> · 💬 {x.comentarios[0].count}</span>}
                    {x.github_issue && <span className="suave"> · GitHub #{x.github_issue}</span>}
                  </td>
                  <td>{x.tipo}</td>
                  <td>{x.modulo}</td>
                  <td>{x.prioridad}</td>
                  <td><span className={`estado ${claseEstadoTicket(x.estado)}`}>{x.estado}</span></td>
                  <td>{x.apoyos.length ? `👍 ${x.apoyos.length}` : ''}</td>
                  <td>{x.autor?.nombre}</td>
                  <td className="nowrap">{formatoFecha(fechaEnZona(x.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nuevo && (
        <TicketForm onCerrar={() => setNuevo(false)} onGuardado={(id) => { setNuevo(false); navigate(`/soporte/${id}`); }} />
      )}
    </>
  );
}
