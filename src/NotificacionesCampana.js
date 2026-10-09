import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

// Campana 🔔 del encabezado: cada persona ve SOLO sus notificaciones (RLS en
// public.notificaciones). Las crea la base de datos (trigger auditar_cambio y el recordatorio
// semanal de perfil); aquí solo se leen, se marcan como leídas y se navega al módulo.

const ICONOS = { solicitud: '📋', cuenta_cobro: '💳', perfil: '🙋', perfil_resumen: '👥' };

const haceCuanto = (fecha) => {
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : new Date(fecha).toLocaleDateString('es-CO');
};

const NotificacionesCampana = ({ user, onNavegar }) => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [abierta, setAbierta] = useState(false);
  const contenedor = useRef(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('id, tipo, mensaje, enlace, leida, created_at')
      .eq('destinatario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { console.error('Error cargando notificaciones:', error); return; }
    setNotificaciones(data || []);
  }, [user.id]);

  useEffect(() => {
    cargar();
    const canal = supabase
      .channel(`notificaciones-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones', filter: `destinatario_id=eq.${user.id}` }, () => cargar())
      .subscribe((status) => { if (status === 'SUBSCRIBED') cargar(); });
    return () => { supabase.removeChannel(canal); };
  }, [user.id, cargar]);

  // Cerrar al hacer clic fuera del panel.
  useEffect(() => {
    if (!abierta) return;
    const cerrar = (e) => { if (contenedor.current && !contenedor.current.contains(e.target)) setAbierta(false); };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierta]);

  const noLeidas = notificaciones.filter(n => !n.leida);

  const marcarLeidas = async (ids) => {
    if (ids.length === 0) return;
    setNotificaciones(prev => prev.map(n => (ids.includes(n.id) ? { ...n, leida: true } : n)));
    const { data, error } = await supabase.from('notificaciones').update({ leida: true }).in('id', ids).select('id');
    if (error || !data || data.length === 0) {
      console.error('No se pudieron marcar como leídas:', error);
      cargar();
    }
  };

  const abrirNotificacion = (n) => {
    if (!n.leida) marcarLeidas([n.id]);
    setAbierta(false);
    if (n.enlace) onNavegar(n.enlace);
  };

  return (
    <div ref={contenedor} style={{ position: 'relative' }}>
      <button onClick={() => setAbierta(!abierta)} title="Notificaciones"
        style={{ position: 'relative', background: '#F8F6F1', border: '1px solid #E6E0D2', borderRadius: '6px', padding: '0.6rem 0.8rem', fontSize: '1.1rem', cursor: 'pointer' }}>
        🔔
        {noLeidas.length > 0 && (
          <span style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#CC4B4B', color: '#FFFFFF', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 'bold', minWidth: '18px', height: '18px', lineHeight: '18px', padding: '0 4px', textAlign: 'center' }}>
            {noLeidas.length > 99 ? '99+' : noLeidas.length}
          </span>
        )}
      </button>
      {abierta && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 'min(380px, calc(100vw - 2rem))', maxHeight: '70vh', overflowY: 'auto', backgroundColor: '#FFFFFF', border: '1px solid #E6E0D2', borderRadius: '8px', boxShadow: '0 10px 30px rgba(34,30,21,0.15)', zIndex: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #E6E0D2' }}>
            <strong style={{ color: '#221E15' }}>Notificaciones</strong>
            {noLeidas.length > 0 && (
              <button onClick={() => marcarLeidas(noLeidas.map(n => n.id))} style={{ background: 'none', border: 'none', color: '#C4A747', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Marcar todas como leídas</button>
            )}
          </div>
          {notificaciones.length === 0 ? (
            <p style={{ color: '#8F8877', fontSize: '0.85rem', padding: '1rem', margin: 0 }}>No tienes notificaciones.</p>
          ) : notificaciones.map(n => (
            <button key={n.id} onClick={() => abrirNotificacion(n)}
              style={{ display: 'flex', gap: '0.6rem', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', border: 'none', borderBottom: '1px solid #F0ECE2', backgroundColor: n.leida ? '#FFFFFF' : '#FBF7EA', cursor: 'pointer' }}>
              <span>{ICONOS[n.tipo] || '🔔'}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', color: '#332D1E', fontSize: '0.82rem', fontWeight: n.leida ? 'normal' : 'bold' }}>{n.mensaje}</span>
                <span style={{ color: '#8F8877', fontSize: '0.7rem' }}>{haceCuanto(n.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificacionesCampana;
