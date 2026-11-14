// OPERACIÓN FINANCIERA NOSS (OFN) — reglas puras. Una solicitud con OFN es un gasto de AM SPORTS GROUP SAS
// (Noss) y queda ligada a un proceso misional y, si aplica, a jugadores y clubes de la app Noss (listas en
// public.noss_catalogo). Necesita la aprobación de Gerencia Noss antes de que Coordinación la apruebe
// (20261115_operacion_financiera_noss.sql).

export const EMPRESA_OFN = 'AM SPORTS GROUP SAS';
export const ofnVacia = () => ({ proceso: '', jugadores: [], clubes: [] });

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Reparto: si nadie escribió porcentajes, partes iguales; si se escribieron, deben sumar 100.
export const conPorcentajes = (lista) => (lista || []).some(x => num(x.pct) !== null);
export function repartoEfectivo(lista) {
  const l = lista || [];
  if (!l.length) return [];
  if (!conPorcentajes(l)) return l.map(x => ({ ...x, pct: Math.round((100 / l.length) * 100) / 100 }));
  return l.map(x => ({ ...x, pct: num(x.pct) || 0 }));
}

export function validarOfn(ofn) {
  if (!ofn) return '';
  if (!ofn.proceso) return 'Elige el Proceso misional de la Operación Financiera Noss';
  for (const [lista, nombre] of [[ofn.jugadores, 'jugadores'], [ofn.clubes, 'clubes']]) {
    if (!conPorcentajes(lista)) continue;
    if ((lista || []).some(x => num(x.pct) === null || num(x.pct) < 0)) return `Completa el porcentaje de todos los ${nombre} (o déjalos todos vacíos para repartir en partes iguales)`;
    const total = (lista || []).reduce((t, x) => t + num(x.pct), 0);
    if (Math.abs(total - 100) > 0.01) return `Los porcentajes de ${nombre} deben sumar 100% (suman ${Math.round(total * 100) / 100}%)`;
  }
  return '';
}

// Lo que se guarda en solicitudes.ofn / gastos.ofn.
export function ofnParaGuardar(ofn, procesos = []) {
  if (!ofn) return null;
  const limpiar = (lista) => (lista || []).map(x => ({ id: String(x.id), nombre: x.nombre, pct: num(x.pct) }));
  return {
    proceso: ofn.proceso,
    proceso_nombre: procesos.find(p => p.id === ofn.proceso)?.nombre || ofn.proceso_nombre || ofn.proceso,
    jugadores: limpiar(ofn.jugadores),
    clubes: limpiar(ofn.clubes),
  };
}

// Cómo se muestra el estado de la aprobación de Gerencia Noss.
export function estadoAprobacionNoss(s) {
  if (!s?.ofn) return null;
  if (s.ofnAprobacion === 'Aprobada') return { texto: '✅ Aprobada por Gerencia Noss', corto: '✅ Noss', variante: 'success' };
  if (s.ofnAprobacion === 'Devuelta') return { texto: '↩️ Devuelta por Gerencia Noss', corto: '↩️ Noss', variante: 'orange' };
  return { texto: '⏳ Esperando aprobación de Gerencia Noss', corto: '⏳ Gerencia Noss', variante: 'warning' };
}

// ¿Puede Coordinación aprobar / pagar / legalizar? Solo si no tiene OFN o Gerencia Noss ya aprobó.
export const bloqueadaPorNoss = (s) => !!s?.ofn && s.ofnAprobacion !== 'Aprobada';

export const resumenOfn = (ofn) => {
  if (!ofn) return '';
  const partes = [ofn.proceso_nombre || ofn.proceso];
  if (ofn.jugadores?.length) partes.push(`${ofn.jugadores.length} jugador(es): ${ofn.jugadores.map(j => j.nombre).join(', ')}`);
  if (ofn.clubes?.length) partes.push(`${ofn.clubes.length} club(es): ${ofn.clubes.map(c => c.nombre).join(', ')}`);
  return partes.join(' · ');
};
