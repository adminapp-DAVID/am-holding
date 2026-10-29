// Asistente AM Holding (fase 1, solo lectura) — utilidades de la pantalla AsistenteView.jsx.
// Las tablas llegan de la Edge Function supabase/functions/asistente con la forma
// { titulo, columnas, filas, columnasDinero, grafico: { etiqueta, valor } | null }.

// Etiqueta legible de una columna de la base ("cuenta_salida" → "Cuenta salida").
export const etiquetaColumna = (c) => {
  const t = String(c ?? '').replace(/^total_/, 'total ').replace(/_/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};

// Moneda de una fila: la columna moneda_pago si viene; si no, ARKO maneja USD.
export const monedaDeFila = (tabla, fila) => {
  const iMoneda = tabla.columnas.indexOf('moneda_pago');
  if (iMoneda >= 0 && fila[iMoneda]) return String(fila[iMoneda]);
  const iEmpresa = tabla.columnas.indexOf('empresa');
  return iEmpresa >= 0 && String(fila[iEmpresa] || '').toUpperCase() === 'ARKO' ? 'USD' : 'COP';
};

const esDinero = (tabla, columna) => (tabla.columnasDinero || []).includes(columna);

// Texto de una celda para pantalla/PDF.
export const textoCelda = (tabla, fila, i, formatMoneyByMoneda) => {
  const v = fila[i];
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (esDinero(tabla, tabla.columnas[i]) && v !== '' && !Number.isNaN(Number(v))) {
    return formatMoneyByMoneda(Number(v), monedaDeFila(tabla, fila));
  }
  return String(v);
};

// Datos para el gráfico de barras: [{ etiqueta, valor }] con valores numéricos.
export const datosGrafico = (tabla) => {
  if (!tabla.grafico) return [];
  const iE = tabla.columnas.indexOf(tabla.grafico.etiqueta);
  const iV = tabla.columnas.indexOf(tabla.grafico.valor);
  if (iE < 0 || iV < 0) return [];
  return tabla.filas.map(f => ({ etiqueta: String(f[iE] ?? ''), valor: Number(f[iV]) || 0 }));
};

// Hoja de Excel: números como números (sin redondear) para que se puedan sumar en Excel.
export const filasExcel = (tabla) => [
  tabla.columnas.map(etiquetaColumna),
  ...tabla.filas.map(f => f.map((v, i) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (esDinero(tabla, tabla.columnas[i]) && v !== '' && !Number.isNaN(Number(v))) return Number(v);
    return v;
  })),
];

// Nombre de archivo seguro a partir del título.
export const nombreArchivo = (titulo, ext) => {
  const base = String(titulo || 'asistente').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'asistente';
  return `${base}.${ext}`;
};

// Texto plano a partir del markdown sencillo que responde el asistente (para el PDF).
export const textoPlano = (md) => String(md || '')
  .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1')
  .replace(/^#{1,6}\s*/gm, '').replace(/`/g, '');

// Texto para leer en voz alta: sin markdown, emojis ni símbolos que el lector deletrea.
export const textoParaVoz = (md) => textoPlano(md)
  .replace(/[\p{Extended_Pictographic}️]/gu, '')
  .replace(/^\s*[-*•]\s+/gm, '')
  .replace(/[|#>_~]/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .trim();
