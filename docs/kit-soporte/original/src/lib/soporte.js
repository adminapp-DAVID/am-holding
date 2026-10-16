import { supabase } from './supabase';

export const TIPOS_TICKET = ['Error', 'Mejora', 'Nueva función', 'Duda', 'Datos'];
export const AYUDA_TIPO = {
  Error: 'Algo no funciona o da error',
  Mejora: 'Cambiar o mejorar algo que ya existe',
  'Nueva función': 'Algo que la app aún no hace',
  Duda: 'No sé cómo hacer algo',
  Datos: 'Un dato está mal, falta o está repetido',
};
export const ESTADOS_TICKET = ['Nuevo', 'En revisión', 'Necesita información', 'Aprobado', 'En desarrollo', 'Publicado', 'Rechazado'];
export const ABIERTOS = ['Nuevo', 'En revisión', 'Necesita información', 'Aprobado', 'En desarrollo'];
export const PRIORIDADES = ['Alta', 'Media', 'Baja'];
export const MODULOS_SOPORTE = ['Jugadores', 'Contactos', 'Mercado', 'Administrativo', 'CRM', 'Calendario', 'Configuración', 'General'];

export const claseEstadoTicket = (e) =>
  ({ Publicado: 'ok', Rechazado: 'mal', 'Necesita información': 'alerta', Aprobado: 'ok', 'En desarrollo': 'alerta' })[e] || '';

// Módulo según la pantalla desde donde se reporta
export function moduloDeRuta(ruta = '') {
  const r = ruta.split('/')[1] || '';
  return {
    jugadores: 'Jugadores', contactos: 'Contactos', inteligencia: 'Contactos', mercado: 'Mercado', administrativo: 'Administrativo',
    crm: 'CRM', eventos: 'Calendario', configuracion: 'Configuración',
  }[r] || 'General';
}

const palabras = (t) =>
  (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);

// Tickets parecidos (para no repetir): comparten palabras del título o la descripción
export function parecidos(texto, tickets, excluir) {
  const p = new Set(palabras(texto));
  if (p.size < 1) return [];
  return tickets
    .filter((t) => t.id !== excluir)
    .map((t) => {
      const otras = new Set(palabras(`${t.titulo} ${t.descripcion || ''}`));
      const comunes = [...p].filter((w) => otras.has(w)).length;
      return { t, puntos: comunes / Math.min(p.size, 6) };
    })
    .filter((x) => x.puntos >= 0.5)
    .sort((a, b) => b.puntos - a.puntos || (ABIERTOS.includes(a.t.estado) ? -1 : 1))
    .slice(0, 5)
    .map((x) => x.t);
}

// Crea el issue en GitHub (al aprobar) o lo cierra (al publicar o rechazar)
export async function sincronizarGitHub(ticketId, accion = 'crear') {
  const { data, error } = await supabase.functions.invoke('soporte-github', { body: { ticket_id: ticketId, accion } });
  if (!error) return data;
  let info = {};
  try {
    info = await error.context.json();
  } catch {
    /* sin cuerpo */
  }
  throw new Error(info.error || 'No se pudo conectar con GitHub. ¿Ya se desplegó la función soporte-github?');
}

export async function abrirAdjunto(path) {
  const { data } = await supabase.storage.from('soporte').createSignedUrl(path, 300);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
}
