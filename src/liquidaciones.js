// Liquidaciones por colaborador (LiquidacionesView.jsx + 20261105_liquidaciones.sql): todo lo que la
// empresa le debe a una persona en un mes, menos préstamos y descuentos = NETO A PAGAR. Aquí solo
// reglas puras (qué entra, con qué signo y valor); pagar y registrar en Finanzas lo hace App.js con
// la misma lógica de siempre (un movimiento por concepto).

export const ESTADOS_LIQUIDACION = ['Borrador', 'En revisión', 'Aprobada', 'Pagada', 'Anulada'];
export const ESTADOS_EDITABLES = ['Borrador', 'En revisión'];

// Claves iguales a las de los lotes PAB: un registro no puede estar en dos liquidaciones (ni en un lote) vigentes.
export const claveSolicitud = (id) => `solicitud:${id}`;
export const clavePresupuesto = (id, anio, mes) => `presupuesto:${id}:${anio}-${mes}`;

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const centavos = (n) => Math.round(n * 100) / 100;

// Estado en que debe estar la solicitud para entrar a la liquidación, y al que pasa al pagarla.
// Legalización T. Pro no tiene "Aprobado": va de Pendiente a Legalizado (la aprobación es la de la liquidación).
export const estadoOrigenSolicitud = (s) => (s.tipo === 'Legalización T. Pro' ? 'Pendiente' : 'Aprobado');
export const estadoDestinoSolicitud = (s) => (s.tipo === 'Legalización T. Pro' ? 'Legalizado' : 'Pagado');

// Qué representa una solicitud en la liquidación. Mismas reglas que calcularAccionFinanzasSolicitud
// (App.js): Legalización = lo gastado − el anticipo (a favor del colaborador si es positivo; descuento
// si debe devolver). Pago a Tercero no entra: se le paga a un tercero, no al colaborador.
export function conceptoSolicitud(s) {
  if (!s || s.tipo === 'Pago a Tercero') return null;
  const etiqueta = `${s.tipo}${s.detalle ? ` — ${s.detalle}` : ''}`;
  if (s.tipo === 'Anticipo' || s.tipo === 'Comisión') return { signo: 1, valor: centavos(num(s.valor)), concepto: etiqueta };
  if (s.tipo === 'Reembolso' || s.tipo === 'Legalización T. Pro') return { signo: 1, valor: centavos(num(s.totalCalculado)), concepto: etiqueta };
  if (s.tipo === 'Legalización') {
    const diferencia = centavos(num(s.totalCalculado) - num(s.valorAnticipoOriginal));
    if (diferencia < 0) return { signo: -1, valor: -diferencia, concepto: `${etiqueta} (devuelve saldo del anticipo)` };
    return { signo: 1, valor: diferencia, concepto: diferencia > 0 ? `${etiqueta} (saldo a su favor)` : `${etiqueta} (cuadrada)` };
  }
  return null;
}

// Solicitudes del colaborador que pueden entrar en la liquidación de esa empresa: en el estado de
// origen, de esa empresa o "General", en la moneda de la empresa, y que no estén en un lote PAB ni en
// otra liquidación vigente. Devuelve { incluibles, excluidas: [{ solicitud, motivo }] }.
export function solicitudesLiquidables({ solicitudes, responsableId, empresa, monedaEmpresa, clavesOcupadas = {} }) {
  const incluibles = [];
  const excluidas = [];
  for (const s of solicitudes) {
    if (String(s.responsableId) !== String(responsableId) || s.estado !== estadoOrigenSolicitud(s)) continue;
    const c = conceptoSolicitud(s);
    if (!c) continue;
    const clave = claveSolicitud(s.id);
    let motivo = '';
    if (s.empresa && s.empresa !== empresa) motivo = `es de ${s.empresa}`;
    else if (s.moneda && monedaEmpresa && s.moneda !== monedaEmpresa) motivo = `está en ${s.moneda}`;
    else if (clavesOcupadas[clave]) motivo = clavesOcupadas[clave];
    if (motivo) excluidas.push({ solicitud: s, motivo });
    else incluibles.push({ solicitud: s, clave, ...c });
  }
  return { incluibles, excluidas };
}

// Anticipos ya pagados que vencieron sin legalizar (no los cubre ninguna Legalización). No se descuentan
// solos: la pantalla los avisa y permite agregarlos como descuento.
export function anticiposVencidos({ solicitudes, responsableId, hoy }) {
  const legalizados = new Set(solicitudes.filter(s => s.tipo === 'Legalización').flatMap(s => (s.anticipoIds || []).map(String)));
  return solicitudes.filter(s => s.tipo === 'Anticipo' && String(s.responsableId) === String(responsableId)
    && s.estado === 'Pagado' && s.legalizarAntes && s.legalizarAntes < hoy && !legalizados.has(String(s.id)));
}

// Totales de una liquidación (solo ítems activos).
export function totalesLiquidacion(items) {
  let aFavor = 0;
  let descuentos = 0;
  for (const it of items) {
    if (it.activo === false) continue;
    if (Number(it.signo) === -1) descuentos += num(it.valor);
    else aFavor += num(it.valor);
  }
  aFavor = centavos(aFavor);
  descuentos = centavos(descuentos);
  return { aFavor, descuentos, neto: centavos(aFavor - descuentos) };
}

// ¿Se puede pagar? Debe estar Aprobada, tener ítems y un neto que no sea negativo.
export function bloqueoPago(liquidacion, items) {
  if (liquidacion.estado !== 'Aprobada') return 'Solo se paga una liquidación Aprobada.';
  const activos = items.filter(i => i.activo !== false);
  if (!activos.length) return 'La liquidación no tiene conceptos.';
  const { neto } = totalesLiquidacion(activos);
  if (neto < 0) return 'El neto es negativo: el colaborador le debe a la empresa. Agrega conceptos a su favor o déjalo para la siguiente liquidación.';
  return '';
}
