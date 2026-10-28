// Periodo de un pago: el mes al que CORRESPONDE en Presupuesto ("AAAA-MM"), que puede ser distinto
// del mes en que salió la plata (la fecha del gasto en Finanzas). Ej.: la seguridad social de
// septiembre se paga el 5 de octubre → fecha 2026-10-05, periodo 2026-09.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const mesDeFecha = (fecha) => (fecha ? String(fecha).substring(0, 7) : '');

export const mesAnterior = (aaaamm) => {
  const [a, m] = String(aaaamm).split('-').map(Number);
  if (!a || !m) return '';
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};

// Periodo que toma un pago nuevo según su concepto: "mes vencido" = el mes anterior a la fecha.
export const periodoPorDefecto = (fecha, mesVencido) => (mesVencido ? mesAnterior(mesDeFecha(fecha)) : mesDeFecha(fecha));

// Periodo de un gasto ya registrado (los viejos no lo traen: cuentan en el mes de su fecha).
export const periodoDeGasto = (g) => (g && (g.periodo || mesDeFecha(g.fecha))) || '';

export const nombrePeriodo = (aaaamm) => {
  const [a, m] = String(aaaamm || '').split('-').map(Number);
  return MESES[m - 1] ? `${MESES[m - 1]} ${a}` : '';
};
