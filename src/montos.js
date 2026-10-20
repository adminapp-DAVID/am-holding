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

// ---------------------------------------------------------------------------------------------
// Campo de moneda con formato en vivo (components/ui/input-moneda.jsx)
//
// Dentro del estado de los formularios el valor se guarda "canónico": solo dígitos y, si hay
// decimales, un punto ("1250000.5"). En pantalla se muestra con el formato colombiano
// ("1.250.000,5"). Así parsearMonto lee igual el canónico, los valores que vienen de la base y
// los que todavía se escriban a mano.
// ---------------------------------------------------------------------------------------------
const MAX_DECIMALES = 2;
const agruparMiles = (digitos) => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const sinCerosIzquierda = (digitos) => digitos.replace(/^0+(?=\d)/, '');

// Canónico ("1250000.5", "1250.", número) → texto en pantalla ("1.250.000,5", "1.250,").
export const formatearMontoPantalla = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '';
  let canon = typeof valor === 'number' ? (Number.isFinite(valor) ? String(Math.round(Math.abs(valor) * 100) / 100) : '') : String(valor).trim();
  if (canon && !/^\d*(\.\d{0,2})?$/.test(canon)) {
    // No es canónico (p. ej. "50.000" escrito antes de este campo): se interpreta una vez.
    const n = parsearMonto(canon);
    canon = Number.isNaN(n) ? '' : String(Math.abs(n));
  }
  if (!canon) return '';
  const [entero, decimales] = canon.split('.');
  const parteEntera = agruparMiles(sinCerosIzquierda(entero || '0'));
  return decimales === undefined ? parteEntera : `${parteEntera},${decimales.slice(0, MAX_DECIMALES)}`;
};

// Lo que el usuario acaba de escribir en pantalla → canónico. `anterior` es lo que había en
// pantalla antes: si el texto creció más de un carácter es un pegado y se interpreta completo
// ("1250.50" o "1.250,50" pegados quedan bien); al escribir, el punto de miles lo pone el campo
// y la coma (o un punto escrito al final) abre los decimales.
export const montoDesdePantalla = (texto, anterior = '') => {
  const t = String(texto || '').replace(/[^\d.,]/g, '');
  if (!t) return '';
  if (t.length - String(anterior || '').length > 1) {
    const n = parsearMonto(t);
    if (Number.isNaN(n)) return '';
    return String(Math.round(Math.abs(n) * 10 ** MAX_DECIMALES) / 10 ** MAX_DECIMALES);
  }
  const conComa = /\.$/.test(t) && !t.includes(',') ? `${t.slice(0, -1)},` : t;
  const pos = conComa.lastIndexOf(',');
  if (pos < 0) return sinCerosIzquierda(conComa.replace(/\D/g, ''));
  const entero = sinCerosIzquierda(conComa.slice(0, pos).replace(/\D/g, '')) || '0';
  const decimales = conComa.slice(pos + 1).replace(/\D/g, '').slice(0, MAX_DECIMALES);
  return `${entero}.${decimales}`;
};

// Confirmación antes de guardar: solo para montos superiores a este valor (lo pidió el usuario,
// para no interrumpir cada guardado ahora que el campo ya muestra el formato).
export const UMBRAL_CONFIRMAR_MONTO = 1000000;

// Mensaje para confirmar los montos grandes antes de guardar. null = no hay nada que confirmar.
// items: [{ etiqueta, texto }] (texto = lo que hay en el estado del formulario).
export const mensajeConfirmacionMontos = (items) => {
  const grandes = (items || [])
    .map(({ etiqueta, texto }) => ({ etiqueta, valor: parsearMonto(texto) }))
    .filter(({ valor }) => !Number.isNaN(valor) && Math.abs(valor) > UMBRAL_CONFIRMAR_MONTO);
  if (grandes.length === 0) return null;
  const formato = (n) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const lineas = grandes.map(({ etiqueta, valor }) => `• ${etiqueta}: ${formato(valor)}`);
  return `Revisa los valores antes de guardar:\n\n${lineas.join('\n')}\n\n¿Es correcto?`;
};

// true si se puede guardar: no hay montos grandes, o el usuario confirmó.
export const confirmarMontos = (items) => {
  const mensaje = mensajeConfirmacionMontos(items);
  return !mensaje || window.confirm(mensaje);
};
