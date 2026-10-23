// Excel de un Traslado: relación de los campos del formulario (salida y entrada). No se guarda en
// la base ni en Storage: se arma al abrir los documentos del movimiento, con los datos actuales,
// así que aparece igual en los traslados nuevos y en los que ya están en el historial.

const EXTERNA = /^Empresa Externa — Cta: (.*?) — (.*)$/;

// cuenta_destino es texto: "EMPRESA: CUENTA" (otra empresa), "CUENTA" (misma empresa) o
// "Empresa Externa — Cta: N — Detalle" (cuenta de un tercero).
export const destinoTraslado = (cuentaDestino, empresaOrigen) => {
  const texto = String(cuentaDestino || '');
  const ext = texto.match(EXTERNA);
  if (ext) return { externa: true, empresa: 'Empresa Externa', cuenta: texto, numero: ext[1], detalle: ext[2] };
  if (texto.startsWith('Empresa Externa')) return { externa: true, empresa: 'Empresa Externa', cuenta: texto, numero: '', detalle: '' };
  const pos = texto.indexOf(': ');
  return pos >= 0
    ? { externa: false, empresa: texto.slice(0, pos), cuenta: texto.slice(pos + 2) }
    : { externa: false, empresa: empresaOrigen || '', cuenta: texto };
};

const tieneValor = (v) => v !== null && v !== undefined && v !== '';

// t: el traslado tal como está en la base (gastoDBToLocal, no la línea "entrada" del historial).
// → { rows, moneda, monedaFila, nombreArchivo, tipo, etiqueta } (mismo formato que el Excel de
// solicitudes, para el visor). monedaFila: moneda de cada fila con valor (la entrada puede ir en
// otra moneda).
export const construirExcelTraslado = (t, { getMoneda = () => 'COP', nits = {}, cecoNombre = '' } = {}) => {
  const dest = destinoTraslado(t.cuentaDestino, t.empresa);
  const monedaSalida = getMoneda(t.empresa);
  const monedaEntrada = dest.externa ? monedaSalida : getMoneda(dest.empresa);
  const valorSalida = parseFloat(t.valor) || 0;
  const valorEntrada = tieneValor(t.valorDestino) ? (parseFloat(t.valorDestino) || 0) : valorSalida;
  const monedaFila = {};
  const rows = [];
  const conMoneda = (fila, moneda) => { monedaFila[rows.length] = moneda; rows.push(fila); };

  rows.push(['TRASLADO ENTRE CUENTAS']);
  rows.push([]);
  rows.push(['Fecha', t.fecha || '']);
  rows.push(['Tipo', 'Traslado']);
  rows.push(['Estado', t.estado || '']);
  rows.push([]);
  rows.push(['SALIDA']);
  rows.push(['Empresa', t.empresa || '']);
  rows.push(['NIT', nits[t.empresa] || '']);
  rows.push(['Cuenta salida', t.cuentaSalida || '']);
  conMoneda([`Valor salida (${monedaSalida})`, valorSalida], monedaSalida);
  rows.push([]);
  rows.push(['ENTRADA']);
  rows.push(['Empresa', dest.empresa]);
  if (dest.externa) {
    rows.push(['Número de cuenta', dest.numero]);
    rows.push(['Detalle de la cuenta', dest.detalle]);
  } else {
    rows.push(['NIT', nits[dest.empresa] || '']);
    rows.push(['Cuenta destino', dest.cuenta]);
  }
  conMoneda([`Valor entrada (${monedaEntrada})`, valorEntrada], monedaEntrada);
  rows.push([]);
  rows.push(['CECO', [t.ceco, cecoNombre].filter(Boolean).join(' — ')]);
  rows.push(['Detalle/Descripción', t.detalle || '']);
  rows.push(['Observaciones', t.observaciones || '']);

  const limpio = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').trim();
  return {
    rows, moneda: monedaSalida, monedaFila, tipo: 'Traslado', etiqueta: 'Excel del traslado',
    nombreArchivo: `Traslado_${limpio(t.empresa)}_${t.fecha || ''}_${t.id ?? ''}.xlsx`,
  };
};
