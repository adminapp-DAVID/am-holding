// DEDUCCIONES (préstamos, seguridad social, otros descuentos) — reglas puras.
// Con el historial real (tabla deduccion_aplicaciones, 20261106_deduccion_aplicaciones.sql) el saldo
// de un préstamo es saldo_total − lo realmente descontado (cuotas de los pagos + abonos/condonaciones).
// Si el historial no está disponible (SQL aún sin correr), `aplicaciones` llega null y se usa el
// cálculo por calendario de siempre (cuotas a partir de fechaInicio).

export const TIPOS_APLICACION_MANUAL = ['Abono extra', 'Condonación', 'Ajuste'];

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const centavos = (n) => Math.round(n * 100) / 100;
const periodo = (anio, mes) => Number(anio) * 12 + (Number(mes) - 1);
const dePeriodo = (p) => ({ anio: Math.floor(p / 12), mes: (p % 12) + 1 });
const suma = (lista) => centavos(lista.reduce((t, a) => t + num(a.valor), 0));

export const claveMes = (anio, mes) => `${Number(anio)}-${Number(mes)}`;

// Meses desde fechaInicio (0 = el mes de inicio; -1 = sin fecha o antes del inicio).
export const mesesTranscurridos = (fechaInicio, anio, mes) => {
  if (!fechaInicio) return -1;
  const [a, m] = String(fechaInicio).split('-').map(Number);
  return (anio - a) * 12 + (mes - m);
};

// --- Cálculo por calendario (respaldo si no hay historial) ---------------------------------------
export const cuotaCalendario = (d, anio, mes) => {
  if (d.activo === false) return 0;
  const transcurridos = mesesTranscurridos(d.fechaInicio, anio, mes);
  if (transcurridos < 0) return 0;
  const cuota = num(d.valorCuota);
  if (d.tipo === 'Préstamo') {
    const saldoAntes = num(d.saldoTotal) - cuota * transcurridos;
    if (saldoAntes <= 0) return 0;
    return Math.min(cuota, saldoAntes);
  }
  return cuota;
};

export const saldoCalendario = (d, anio, mes) => {
  if (d.tipo !== 'Préstamo') return null;
  const transcurridos = mesesTranscurridos(d.fechaInicio, anio, mes);
  if (transcurridos < 0) return num(d.saldoTotal);
  return Math.max(0, num(d.saldoTotal) - num(d.valorCuota) * (transcurridos + 1));
};

// --- Con historial real ----------------------------------------------------------------------------
export const aplicacionesDe = (aplicaciones, deduccionId) =>
  (aplicaciones || []).filter(a => String(a.deduccionId) === String(deduccionId));

const cuotaYaAplicada = (propias, p) => suma(propias.filter(a => a.tipo === 'Cuota' && periodo(a.anio, a.mes) === p));

// Cuánto se descuenta ESE mes: lo ya descontado si el mes ya se pagó; si no, la cuota (un préstamo
// nunca pasa de su saldo real antes de ese mes).
export function cuotaEnMes(d, anio, mes, aplicaciones) {
  if (!Array.isArray(aplicaciones)) return cuotaCalendario(d, anio, mes);
  const propias = aplicacionesDe(aplicaciones, d.id);
  const p = periodo(anio, mes);
  const ya = cuotaYaAplicada(propias, p);
  if (ya > 0) return ya;
  if (d.activo === false || mesesTranscurridos(d.fechaInicio, anio, mes) < 0) return 0;
  const cuota = num(d.valorCuota);
  if (d.tipo !== 'Préstamo') return cuota;
  const saldoAntes = num(d.saldoTotal) - suma(propias.filter(a => periodo(a.anio, a.mes) < p));
  return centavos(Math.max(0, Math.min(cuota, saldoAntes)));
}

// Saldo del préstamo DESPUÉS de ese mes (con la cuota del mes, aplicada o por aplicar). null si no es préstamo.
export function saldoPendienteEnMes(d, anio, mes, aplicaciones) {
  if (d.tipo !== 'Préstamo') return null;
  if (!Array.isArray(aplicaciones)) return saldoCalendario(d, anio, mes);
  const propias = aplicacionesDe(aplicaciones, d.id);
  const p = periodo(anio, mes);
  const hasta = suma(propias.filter(a => periodo(a.anio, a.mes) <= p));
  const porAplicar = cuotaYaAplicada(propias, p) > 0 ? 0 : cuotaEnMes(d, anio, mes, aplicaciones);
  return centavos(Math.max(0, num(d.saldoTotal) - hasta - porAplicar));
}

// Resumen de una deducción: lo hecho y lo que falta. hoy = { anio, mes }.
export function resumenDeduccion(d, aplicaciones, hoy) {
  const propias = aplicacionesDe(aplicaciones, d.id);
  const cuotas = propias.filter(a => a.tipo === 'Cuota');
  const totalDescontado = suma(propias);
  const periodosCuota = [...new Set(cuotas.map(a => periodo(a.anio, a.mes)))];
  const ultimo = periodosCuota.length ? Math.max(...periodosCuota) : null;
  const esPrestamo = d.tipo === 'Préstamo';
  const cuota = num(d.valorCuota);
  const saldoReal = esPrestamo ? centavos(Math.max(0, num(d.saldoTotal) - totalDescontado)) : null;
  const cuotasTotales = esPrestamo && cuota > 0 ? Math.ceil(num(d.saldoTotal) / cuota - 1e-9) : null;
  const cuotasFaltantes = esPrestamo ? (saldoReal > 0 && cuota > 0 ? Math.ceil(saldoReal / cuota - 1e-9) : 0) : null;
  let finEstimado = null;
  if (esPrestamo && cuotasFaltantes > 0 && d.activo !== false) {
    const inicio = d.fechaInicio ? periodo(...String(d.fechaInicio).split('-').slice(0, 2).map(Number)) : periodo(hoy.anio, hoy.mes);
    const pHoy = periodo(hoy.anio, hoy.mes);
    const hoyYaDescontado = cuotas.some(a => periodo(a.anio, a.mes) === pHoy);
    const base = Math.max(inicio, hoyYaDescontado ? pHoy + 1 : pHoy, ultimo !== null ? ultimo + 1 : -Infinity);
    finEstimado = dePeriodo(base + cuotasFaltantes - 1);
  }
  return {
    totalDescontado,
    totalCuotas: suma(cuotas),
    totalManual: suma(propias.filter(a => a.tipo !== 'Cuota')),
    cuotasHechas: periodosCuota.length,
    cuotasTotales,
    cuotasFaltantes,
    saldoReal,
    ultimoMes: ultimo !== null ? dePeriodo(ultimo) : null,
    finEstimado,
    pagado: esPrestamo && saldoReal <= 0,
  };
}

// Historial mes a mes: desde el inicio hasta hoy (y, para un préstamo activo, la proyección de los
// meses que faltan). mesesConPago = Set de claveMes() con un pago del concepto en Finanzas, para
// distinguir "pagado sin descuento" de "sin pago".
// estado: 'descontada' | 'sin descuento' | 'sin pago' | 'pendiente'
export function historialDeduccion(d, aplicaciones, { hoy, mesesConPago = new Set(), maxProyeccion = 120 } = {}) {
  const propias = aplicacionesDe(aplicaciones, d.id);
  const pHoy = periodo(hoy.anio, hoy.mes);
  const conFecha = d.fechaInicio ? periodo(...String(d.fechaInicio).split('-').slice(0, 2).map(Number)) : null;
  const periodosApl = propias.map(a => periodo(a.anio, a.mes));
  const inicio = Math.min(...[conFecha, ...periodosApl].filter(p => p !== null && Number.isFinite(p)), pHoy);
  const fin = Math.max(pHoy, ...periodosApl);
  const esPrestamo = d.tipo === 'Préstamo';
  const cuota = num(d.valorCuota);
  const filas = [];
  let acumulado = 0;
  for (let p = inicio; p <= fin; p++) {
    const delMes = propias.filter(a => periodo(a.anio, a.mes) === p);
    const descontado = suma(delMes.filter(a => a.tipo === 'Cuota'));
    const manual = suma(delMes.filter(a => a.tipo !== 'Cuota'));
    const saldoAntes = esPrestamo ? num(d.saldoTotal) - acumulado : null;
    acumulado += descontado + manual;
    const { anio, mes } = dePeriodo(p);
    const antesDelInicio = conFecha !== null && p < conFecha;
    if (!delMes.length && (antesDelInicio || (esPrestamo && saldoAntes <= 0))) continue;
    let estado;
    let valor = descontado;
    if (descontado > 0) estado = 'descontada';
    else if (p === pHoy) { estado = 'pendiente'; valor = d.activo === false ? 0 : (esPrestamo ? Math.min(cuota, Math.max(0, saldoAntes - manual)) : cuota); }
    else if (p > pHoy) estado = manual > 0 ? 'abono' : 'pendiente';
    else estado = mesesConPago.has(claveMes(anio, mes)) ? 'sin descuento' : 'sin pago';
    if (estado === 'pendiente' && valor <= 0 && !manual) continue;
    filas.push({ anio, mes, estado, valor: centavos(valor), manual, saldoDespues: esPrestamo ? centavos(Math.max(0, num(d.saldoTotal) - acumulado - (estado === 'pendiente' ? valor : 0))) : null });
  }
  // Proyección de lo que falta (solo préstamo activo con saldo).
  if (esPrestamo && d.activo !== false && cuota > 0) {
    let saldo = centavos(Math.max(0, num(d.saldoTotal) - acumulado - (filas.find(f => periodo(f.anio, f.mes) === pHoy && f.estado === 'pendiente')?.valor || 0)));
    for (let p = fin + 1, n = 0; saldo > 0 && n < maxProyeccion; p++, n++) {
      const valor = centavos(Math.min(cuota, saldo));
      saldo = centavos(saldo - valor);
      const { anio, mes } = dePeriodo(p);
      filas.push({ anio, mes, estado: 'pendiente', valor, manual: 0, saldoDespues: saldo });
    }
  }
  return filas;
}

// Orden genérico de tablas: orden = { campo, direccion } | null; valorDe(x, campo) → número o texto.
export function ordenarPor(lista, orden, valorDe) {
  if (!orden) return lista;
  const norm = (v) => (typeof v === 'number' ? v : String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  return [...lista].sort((a, b) => {
    const va = norm(valorDe(a, orden.campo));
    const vb = norm(valorDe(b, orden.campo));
    const r = va < vb ? -1 : va > vb ? 1 : 0;
    return orden.direccion === 'asc' ? r : -r;
  });
}

// Siguiente orden al pulsar una columna: natural → invertido → sin orden.
export const alternarOrden = (o, campo, natural = 'asc') => {
  if (!o || o.campo !== campo) return { campo, direccion: natural };
  if (o.direccion === natural) return { campo, direccion: natural === 'asc' ? 'desc' : 'asc' };
  return null;
};

// Valida un abono / condonación / ajuste manual.
export function validarAplicacionManual({ tipo, valor, fecha }, d, aplicaciones) {
  if (!TIPOS_APLICACION_MANUAL.includes(tipo)) return 'Tipo no válido';
  if (!(num(valor) > 0)) return 'El valor debe ser mayor a cero';
  if (!fecha) return 'Falta la fecha';
  if (d.tipo === 'Préstamo') {
    const { saldoReal } = resumenDeduccion(d, aplicaciones, { anio: 2000, mes: 1 });
    if (num(valor) > saldoReal + 0.005) return `El valor supera el saldo pendiente del préstamo`;
  }
  return '';
}

export const aplicacionDBToLocal = (r) => ({
  id: r.id,
  deduccionId: r.deduccion_id,
  anio: r.anio,
  mes: r.mes,
  valor: num(r.valor),
  tipo: r.tipo,
  gastoId: r.gasto_id,
  fecha: r.fecha,
  observaciones: r.observaciones || '',
  createdAt: r.created_at,
});
