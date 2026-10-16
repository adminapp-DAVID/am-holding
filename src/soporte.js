import { supabase } from './supabaseClient';

// Soporte técnico (tickets) — adaptado de Noss App. Ver supabase/migrations/20261016_soporte_tickets.sql.
// Ojo: "soportes" en AM Holding son los comprobantes de pagos; los archivos de los tickets van en
// otro bucket (BUCKET_TICKETS).

export const BUCKET_TICKETS = 'tickets-adjuntos';

// Mismos roles que usa_soporte() / gestiona_soporte() en la base de datos.
export const ROLES_SOPORTE = ['Administrador', 'Coordinadora Administrativa', 'Gerente', 'Colaborador'];
export const ROLES_GESTION_SOPORTE = ['Administrador', 'Gerente'];
export const usaSoporte = (rol) => ROLES_SOPORTE.includes(rol);
export const gestionaSoporte = (rol) => ROLES_GESTION_SOPORTE.includes(rol);

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

// Vistas de la app (currentView en App.js) → módulo del ticket.
export const VISTAS_SOPORTE = {
  dashboard: 'Dashboard',
  solicitudes: 'Solicitudes',
  cuentasCobro: 'Cuentas de cobro',
  dashboardFinanciero: 'Dashboard financiero',
  finanzas: 'Finanzas',
  presupuesto: 'Presupuesto',
  pagosPAB: 'Pagos PAB',
  responsables: 'Colaboradores',
  datosBancarios: 'Datos bancarios',
  auditoria: 'Auditoría',
  'mi-perfil': 'Mi perfil',
};
export const MODULOS_SOPORTE = [...Object.values(VISTAS_SOPORTE), 'General'];
export const moduloDeVista = (vista) => VISTAS_SOPORTE[vista] || 'General';

// Variante del Badge (components/ui/badge) por estado del ticket.
export const varianteEstadoTicket = (e) => ({
  Nuevo: 'info',
  'En revisión': 'secondary',
  'Necesita información': 'orange',
  Aprobado: 'warning',
  'En desarrollo': 'purple',
  Publicado: 'success',
  Rechazado: 'destructive',
})[e] || 'muted';

const palabras = (t) =>
  (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);

// Tickets parecidos (para no repetir): comparten palabras del título o la descripción.
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

// Nombre de archivo seguro para Storage (sin tildes, espacios ni símbolos raros).
export const nombreSeguro = (nombre) => {
  const limpio = String(nombre || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^[_.]+|_+$/g, '');
  return (limpio || 'archivo').slice(-80);
};
export const nombreAdjunto = (path) => String(path || '').split('/').pop().replace(/^\d+_/, '');

const opcionesFecha = { timeZone: 'America/Bogota' };
export const formatoFecha = (f) => (f ? new Date(f).toLocaleDateString('es-CO', opcionesFecha) : '—');
export const formatoFechaHora = (f) => (f ? new Date(f).toLocaleString('es-CO', { ...opcionesFecha, dateStyle: 'short', timeStyle: 'short' }) : '—');

// Enlace de una notificación de ticket ("soporte/<id>") → id del ticket, o null.
export const ticketDeEnlace = (enlace) => {
  const m = /^soporte\/([0-9a-f-]{36})$/i.exec(String(enlace || ''));
  return m ? m[1] : null;
};

// { [usuario_id]: nombre } de quienes participan en tickets (rpc nombres_usuarios_soporte: no
// depende de que el rol pueda leer la tabla usuarios).
export async function cargarNombresSoporte() {
  const { data, error } = await supabase.rpc('nombres_usuarios_soporte');
  if (error) console.error('No se pudieron cargar los nombres de soporte:', error);
  return Object.fromEntries((data || []).map((u) => [String(u.id), u.nombre]));
}

// Crea el issue en GitHub (al aprobar) o lo cierra (al publicar o rechazar).
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
  const { data, error } = await supabase.storage.from(BUCKET_TICKETS).createSignedUrl(path, 300);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  else alert('No se pudo abrir el archivo' + (error?.message ? `: ${error.message}` : ''));
}
