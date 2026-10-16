// Convierte lo que el usuario escribe en un campo de valor a número, entendiendo el formato
// colombiano (punto de miles, coma decimal) sin romper el decimal con punto de USD/EUR.
//
//   "50.000" → 50000        "1.250.000,50" → 1250000.5     "$ 1.500.000" → 1500000
//   "50000"  → 50000        "1,250,000.50" → 1250000.5     "1250.50"     → 1250.5
//   "70,88"  → 70.88        "1,5"          → 1.5           ""            → NaN
//
// Regla para un solo tipo de separador: si aparece varias veces, o una vez seguido de
// exactamente 3 dígitos (y la parte entera no es 0), es separador de miles; si no, es decimal.
// Con ambos separadores, el que va de último es el decimal.
// Devuelve NaN si no hay número (igual que parseFloat), para poder reemplazarlo 1:1.
export const parsearMonto = (entrada) => {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : NaN;
  if (entrada === null || entrada === undefined) return NaN;
  let s = String(entrada).trim();
  const negativo = /^-|^\(.*\)$/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return NaN;

  const ultimoPunto = s.lastIndexOf('.');
  const ultimaComa = s.lastIndexOf(',');
  let entero = s;
  let decimales = '';

  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    const pos = Math.max(ultimoPunto, ultimaComa);
    entero = s.slice(0, pos);
    decimales = s.slice(pos + 1);
  } else if (ultimoPunto >= 0 || ultimaComa >= 0) {
    const sep = ultimoPunto >= 0 ? '.' : ',';
    const partes = s.split(sep);
    const ultima = partes[partes.length - 1];
    const esMiles = partes.length > 2 || (ultima.length === 3 && /[1-9]/.test(partes[0]));
    if (!esMiles) {
      entero = partes.slice(0, -1).join('');
      decimales = ultima;
    }
  }

  entero = entero.replace(/[.,]/g, '');
  decimales = decimales.replace(/[.,]/g, '');
  const n = parseFloat(`${entero || '0'}${decimales ? `.${decimales}` : ''}`);
  if (Number.isNaN(n)) return NaN;
  return negativo ? -n : n;
};

// Igual que parsearMonto pero devuelve 0 cuando no hay número (para sumas y para guardar).
export const montoONumero0 = (entrada) => parsearMonto(entrada) || 0;

// Mensaje para confirmar, antes de guardar, cómo quedó interpretado cada valor que el usuario
// escribió con punto o coma (los únicos que pueden prestarse a confusión). null = no hay nada
// que confirmar. items: [{ etiqueta, texto }].
export const mensajeConfirmacionMontos = (items) => {
  const dudosos = (items || []).filter(({ texto }) => typeof texto === 'string' && /[.,]/.test(texto) && !Number.isNaN(parsearMonto(texto)));
  if (dudosos.length === 0) return null;
  const formato = (n) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const lineas = dudosos.map(({ etiqueta, texto }) => `• ${etiqueta}: escribiste "${texto.trim()}" → se guardará ${formato(parsearMonto(texto))}`);
  return `Revisa los valores antes de guardar:\n\n${lineas.join('\n')}\n\n¿Es correcto?`;
};

// true si se puede guardar: no hay valores con punto/coma, o el usuario confirmó.
export const confirmarMontos = (items) => {
  const mensaje = mensajeConfirmacionMontos(items);
  return !mensaje || window.confirm(mensaje);
};
