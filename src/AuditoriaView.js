import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { MODULOS_AUDITORIA, ACCIONES_AUDITORIA, cambiosAuditoria, csvAuditoria, faltantesPerfil } from './auditoria';

// Módulo 🕵️ Auditoría (Administrador / Coordinadora Administrativa): registro inmutable de
// toda acción en la app (lo escribe la base de datos, ver 20261010_auditoria_notificaciones.sql),
// con filtros por usuario, módulo, acción y fechas, y exportación CSV. Arriba, la lista de
// colaboradores con perfil incompleto.

const POR_PAGINA = 200;
const MAX_CSV = 10000;
const card = { backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '10px', border: '1px solid #E6E0D2', boxShadow: '0 1px 4px rgba(34,30,21,0.05)', marginBottom: '1.5rem' };
const input = { padding: '0.6rem', backgroundColor: '#F8F6F1', border: '1px solid #E6E0D2', borderRadius: '4px', color: '#332D1E' };
const label = { display: 'block', color: '#6B6458', fontSize: '0.75rem', marginBottom: '0.3rem' };
const th = { textAlign: 'left', padding: '0.5rem', color: '#C4A747', fontSize: '0.75rem', borderBottom: '2px solid #C4A747' };
const td = { padding: '0.5rem', fontSize: '0.8rem', borderBottom: '1px solid #E6E0D2', verticalAlign: 'top' };
const COLOR_ACCION = { 'Creación': '#2F9E52', 'Edición': '#6B6458', 'Cambio de estado': '#D6A419', 'Eliminación': '#CC4B4B' };

// Fin del día en hora Colombia (UTC-5) para que "hasta" incluya todo ese día.
const inicioDia = (d) => `${d}T00:00:00-05:00`;
const finDia = (d) => `${d}T23:59:59.999-05:00`;

const AuditoriaView = ({ usuarios, onNavegar }) => {
  const [filtros, setFiltros] = useState({ usuarioId: '', modulo: '', accion: '', desde: '', hasta: '', texto: '' });
  const [filas, setFilas] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);
  const [expandida, setExpandida] = useState(null);

  const consulta = useCallback((f) => {
    let q = supabase.from('auditoria')
      .select('id, fecha, usuario_id, usuario_nombre, rol, modulo, accion, tabla, registro_id, registro, antes, despues')
      .order('fecha', { ascending: false }).order('id', { ascending: false });
    if (f.usuarioId === 'sistema') q = q.is('usuario_id', null);
    else if (f.usuarioId) q = q.eq('usuario_id', f.usuarioId);
    if (f.modulo) q = q.eq('modulo', f.modulo);
    if (f.accion) q = q.eq('accion', f.accion);
    if (f.desde) q = q.gte('fecha', inicioDia(f.desde));
    if (f.hasta) q = q.lte('fecha', finDia(f.hasta));
    if (f.texto.trim()) q = q.ilike('registro', `%${f.texto.trim().replace(/[%_]/g, '')}%`);
    return q;
  }, []);

  const cargar = useCallback(async (f, desde = 0) => {
    setCargando(true);
    setError('');
    const { data, error: err } = await consulta(f).range(desde, desde + POR_PAGINA - 1);
    setCargando(false);
    if (err) { setError(err.message); return; }
    setFilas(prev => (desde === 0 ? data || [] : [...prev, ...(data || [])]));
    setHayMas((data || []).length === POR_PAGINA);
  }, [consulta]);

  useEffect(() => { cargar(filtros); }, [filtros, cargar]);

  const exportarCSV = async () => {
    setExportando(true);
    try {
      const todas = [];
      for (let desde = 0; desde < MAX_CSV; desde += 1000) {
        const { data, error: err } = await consulta(filtros).range(desde, desde + 999);
        if (err) throw err;
        todas.push(...(data || []));
        if ((data || []).length < 1000) break;
      }
      const blob = new Blob([csvAuditoria(todas)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      if (todas.length >= MAX_CSV) alert(`Se exportaron las ${MAX_CSV} acciones más recientes. Usa los filtros de fecha para exportar el resto.`);
    } catch (e) {
      alert('❌ No se pudo exportar: ' + e.message);
    } finally {
      setExportando(false);
    }
  };

  const cambiar = (patch) => setFiltros({ ...filtros, ...patch });
  const incompletos = usuarios.map(u => ({ u, faltan: faltantesPerfil(u) })).filter(x => x.faltan.length > 0);

  return (
    <div>
      <div style={card}>
        <h2 style={{ color: '#C4A747', margin: '0 0 0.25rem 0' }}>🕵️ Auditoría</h2>
        <p style={{ color: '#8F8877', fontSize: '0.8rem', margin: 0 }}>
          Registro de toda acción en la app: quién, cuándo y qué cambió. Lo escribe la base de datos y no se puede editar ni borrar.
        </p>
      </div>

      <div style={card}>
        <h3 style={{ color: '#221E15', margin: '0 0 0.75rem 0' }}>👥 Perfiles incompletos ({incompletos.length})</h3>
        {incompletos.length === 0 ? <p style={{ color: '#2F9E52', fontSize: '0.85rem', margin: 0 }}>✅ Todos los colaboradores tienen documento y datos bancarios.</p> : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Colaborador</th><th style={th}>Rol</th><th style={th}>Falta</th></tr></thead>
              <tbody>{incompletos.map(({ u, faltan }) => (
                <tr key={u.id}><td style={td}>{u.nombre}</td><td style={td}>{u.rol}</td><td style={{ ...td, color: '#CC4B4B' }}>{faltan.join(', ')}</td></tr>
              ))}</tbody>
            </table>
            <p style={{ color: '#8F8877', fontSize: '0.75rem', margin: '0.75rem 0 0 0' }}>
              Cada lunes reciben un recordatorio en la campana hasta completarlo. Se puede completar en <button onClick={() => onNavegar('datosBancarios')} style={{ background: 'none', border: 'none', padding: 0, color: '#C4A747', fontWeight: 'bold', cursor: 'pointer' }}>🏦 Datos Bancarios</button>.
            </p>
          </>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div>
            <label style={label}>Usuario</label>
            <select value={filtros.usuarioId} onChange={(e) => cambiar({ usuarioId: e.target.value })} style={input}>
              <option value="">Todos</option>
              <option value="sistema">Sistema</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Módulo</label>
            <select value={filtros.modulo} onChange={(e) => cambiar({ modulo: e.target.value })} style={input}>
              <option value="">Todos</option>
              {MODULOS_AUDITORIA.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Acción</label>
            <select value={filtros.accion} onChange={(e) => cambiar({ accion: e.target.value })} style={input}>
              <option value="">Todas</option>
              {ACCIONES_AUDITORIA.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Desde</label>
            <input type="date" value={filtros.desde} onChange={(e) => cambiar({ desde: e.target.value })} style={input} />
          </div>
          <div>
            <label style={label}>Hasta</label>
            <input type="date" value={filtros.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} style={input} />
          </div>
          <div>
            <label style={label}>Registro contiene</label>
            <input type="text" value={filtros.texto} placeholder="nombre, detalle…" onChange={(e) => cambiar({ texto: e.target.value })} style={input} />
          </div>
          <button onClick={() => setFiltros({ usuarioId: '', modulo: '', accion: '', desde: '', hasta: '', texto: '' })} style={{ ...input, cursor: 'pointer', fontWeight: 'bold', color: '#6B6458' }}>Limpiar</button>
          <button disabled={exportando} onClick={exportarCSV} style={{ padding: '0.65rem 1rem', backgroundColor: '#C4A747', color: '#221E15', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: exportando ? 'wait' : 'pointer' }}>
            {exportando ? '⏳ Exportando…' : '⬇️ Exportar CSV'}
          </button>
        </div>

        {error && <p style={{ color: '#CC4B4B', fontSize: '0.85rem' }}>⚠️ {error}</p>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Fecha</th><th style={th}>Usuario</th><th style={th}>Módulo</th><th style={th}>Acción</th><th style={th}>Registro</th><th style={th}>Cambios (anterior → nuevo)</th></tr></thead>
            <tbody>
              {filas.map(f => {
                const cambios = cambiosAuditoria(f);
                const verTodo = expandida === f.id;
                const visibles = verTodo ? cambios : cambios.slice(0, 3);
                return (
                  <tr key={f.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(f.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td>
                    <td style={td}>{f.usuario_nombre}<div style={{ color: '#8F8877', fontSize: '0.7rem' }}>{f.rol || ''}</div></td>
                    <td style={td}>{f.modulo}</td>
                    <td style={{ ...td, color: COLOR_ACCION[f.accion] || '#332D1E', fontWeight: 'bold' }}>{f.accion}</td>
                    <td style={td}>{f.registro || '—'}<div style={{ color: '#8F8877', fontSize: '0.7rem' }}>{f.tabla}</div></td>
                    <td style={{ ...td, fontSize: '0.75rem' }}>
                      {visibles.map(c => (
                        <div key={c.campo}>
                          <strong>{c.campo}:</strong>{' '}
                          {c.antes && c.despues ? <><span style={{ color: '#CC4B4B' }}>{c.antes}</span> → <span style={{ color: '#2F9E52' }}>{c.despues}</span></> : (c.despues || c.antes)}
                        </div>
                      ))}
                      {cambios.length > 3 && (
                        <button onClick={() => setExpandida(verTodo ? null : f.id)} style={{ background: 'none', border: 'none', padding: 0, color: '#C4A747', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}>
                          {verTodo ? 'Ver menos' : `Ver ${cambios.length - 3} campo(s) más`}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!cargando && filas.length === 0 && !error && <p style={{ color: '#8F8877', fontSize: '0.85rem' }}>No hay acciones con estos filtros.</p>}
        {cargando && <p style={{ color: '#8F8877', fontSize: '0.85rem' }}>Cargando…</p>}
        {hayMas && !cargando && (
          <button onClick={() => cargar(filtros, filas.length)} style={{ ...input, marginTop: '1rem', cursor: 'pointer', fontWeight: 'bold' }}>Cargar más</button>
        )}
      </div>
    </div>
  );
};

export default AuditoriaView;
