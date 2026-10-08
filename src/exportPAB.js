// Exportador de pagos masivos PAB (Bancolombia) — lógica pura, sin React ni Supabase.
//
// Formato: plantilla oficial "FORMATOPAB_CONVERSORPAGOS.xlsx" (public/plantillas). El archivo
// generado es ESA misma plantilla con solo los valores escritos: mismas hojas, columnas,
// validaciones y comentarios, para que el Conversor de pagos de Bancolombia lo acepte tal cual.
//   Fila 2  → encabezado (A NIT pagador … G Descripción)
//   Fila 3  → títulos del detalle (no se tocan)
//   Fila 4+ → un pago por fila (A Tipo doc … L Fecha de aplicación)
// La plantilla no trae fila de control/totales; los totales se muestran en la vista previa y se
// guardan en el lote.

import { BANCOS_ACH, TIPOS_DOCUMENTO, problemasDatosBancarios } from './datosBancarios';

export const TIPO_TRANSACCION = { Ahorros: 37, Corriente: 27 }; // comentario de la columna D
export const TIPOS_PAGO_PAB = { 220: 'Pago a Proveedores', 225: 'Pago de Nómina', 238: 'Pagos a Terceros' };
const ABREV_TIPO_PAGO = { 220: 'PROV', 225: 'NOM', 238: 'TERC' };

// Nombre del beneficiario: máx. 30 caracteres. Se pasa a mayúsculas sin tildes ni símbolos raros
// (el conversor genera un .txt plano; una tilde o una ñ puede salir corrupta en el banco).
export const normalizarNombrePAB = (texto) => String(texto || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9 .&-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 30)
  .trim();

// "2026-10-15" → "20261015" (columna L, formato AAAAMMDD)
export const fechaPAB = (iso) => String(iso || '').replace(/-/g, '');

// Valor: > 0, máx. 15 enteros y 2 decimales (comentario de la columna K). Devuelve el número
// redondeado a centavos o null si no sirve.
export const valorPAB = (valor) => {
  const n = Math.round((parseFloat(valor) || 0) * 100) / 100;
  if (!(n > 0)) return null;
  if (Math.floor(n).toString().length > 15) return null;
  return n;
};

// Referencia (columna I, máx. 21): identifica el registro de la app en el extracto del banco.
export const referenciaPAB = (prefijo, id) => `${prefijo}-${String(id || '').replace(/-/g, '').slice(0, 21 - prefijo.length - 1)}`.toUpperCase();

// Descripción del encabezado (G2, máx. 10): "NOM 1026", "PROV 1026", "TERC 1026".
export const descripcionLotePAB = (tipoPago, anio, mes) =>
  `${ABREV_TIPO_PAGO[tipoPago] || 'PAGO'} ${String(mes).padStart(2, '0')}${String(anio).slice(-2)}`.slice(0, 10);

// Secuencia de envío (D2, máx. 2 caracteres): A1…A9, B1…B9… según cuántos lotes ya se
// generaron ese día para esa cuenta (la calcula también la base de datos al crear el lote).
export const secuenciaPAB = (n) => `${String.fromCharCode(65 + Math.floor(n / 9))}${(n % 9) + 1}`;

// Encabezado a partir de la configuración bancaria de la empresa.
export const problemasEncabezadoPAB = (config) => {
  const p = [];
  if (!config) return ['La empresa no tiene cuenta origen configurada (🏦 Datos Bancarios)'];
  if (!/^\d{1,15}$/.test(String(config.nit_pagador || ''))) p.push('NIT pagador inválido');
  if (!/^\d{6,11}$/.test(String(config.numero_cuenta || ''))) p.push('Cuenta a debitar inválida (6 a 11 dígitos)');
  if (!['S', 'D'].includes(config.tipo_cuenta)) p.push('Tipo de cuenta a debitar inválido');
  return p;
};

export const construirEncabezadoPAB = ({ config, tipoPago, secuencia, descripcion }) => ({
  nitPagador: String(config.nit_pagador),
  tipoPago: Number(tipoPago),
  aplicacion: 'I',
  secuencia,
  cuentaDebitar: String(config.numero_cuenta),
  tipoCuentaDebitar: config.tipo_cuenta,
  descripcion: String(descripcion || '').slice(0, 10)
});

// Fila del detalle para un beneficiario. Devuelve { fila, problemas }; si hay problemas, la fila
// NO se puede exportar.
export const construirFilaPAB = ({ beneficiario, valor, referencia, fechaAplicacion }) => {
  const b = beneficiario || {};
  const problemas = problemasDatosBancarios(b);
  const nombre = normalizarNombrePAB(b.nombre);
  if (!nombre) problemas.push('sin nombre del titular');
  const v = valorPAB(valor);
  if (v === null) problemas.push('valor debe ser mayor a 0 (máx. 15 enteros y 2 decimales)');
  const fecha = fechaPAB(fechaAplicacion);
  if (!/^\d{8}$/.test(fecha)) problemas.push('fecha de aplicación inválida');
  const fila = {
    tipoDocumento: Number(b.tipoDocumento) || '',
    documento: String(b.documento || '').trim(),
    nombre,
    tipoTransaccion: TIPO_TRANSACCION[b.tipoCuenta] || '',
    codigoBanco: Number(b.codigoBanco) || '',
    cuenta: String(b.numeroCuenta || '').trim(),
    email: '',
    documentoAutorizado: '',
    referencia: String(referencia || '').slice(0, 21),
    celular: '',
    valor: v || 0,
    fechaAplicacion: fecha
  };
  return { fila, problemas };
};

export const totalesPAB = (filas) => ({
  cantidad: filas.length,
  total: Math.round(filas.reduce((s, f) => s + (Number(f.valor) || 0), 0) * 100) / 100
});

// ---------------------------------------------------------------------------------------------
// Candidatos a pagar (todo lo Aprobado de una empresa) — se arma con los datos que ya tiene la app.
// ---------------------------------------------------------------------------------------------
const beneficiarioDeUsuario = (u) => u ? ({
  tipoDocumento: u.tipoDocumento, documento: u.cedula, nombre: u.titularCuenta || u.nombre,
  codigoBanco: u.codigoBanco, tipoCuenta: u.tipoCuentaBancaria, numeroCuenta: u.numeroCuenta
}) : null;

const beneficiarioDeTercero = (t, info) => {
  if (t) return {
    tipoDocumento: t.tipo_documento, documento: t.dni, nombre: t.nombre,
    codigoBanco: t.codigo_banco, tipoCuenta: t.tipo_cuenta, numeroCuenta: t.numero_cuenta
  };
  if (info) return {
    tipoDocumento: info.tipoDocumento, documento: info.dni, nombre: info.nombre,
    codigoBanco: info.codigoBanco, tipoCuenta: info.tipoCuenta, numeroCuenta: info.numeroCuenta
  };
  return null;
};

export const TIPOS_PRESUPUESTO_PAB = { 'Nómina': 'nomina', 'Prestación de Servicio': 'proveedores' };
const TIPOS_SOLICITUD_PAB = { Reembolso: 'proveedores', Anticipo: 'proveedores', 'Pago a Tercero': 'terceros' };

// Devuelve los candidatos: { clave, origen, entidadTipo, entidadId, anio, mes, etiqueta,
// tipoPago, beneficiario, valor, referencia, bloqueos[] } — un bloqueo es un motivo que impide
// exportarlo (no aprobado, ya exportado, datos bancarios incompletos, moneda…).
export const construirCandidatosPAB = ({
  empresa, config, anio, mes, fechaAplicacion,
  presupuestoDetalle = [], solicitudes = [], usuarios = [], terceros = [], lotePorClave = {}, getMoneda
}) => {
  const tipoPagoDe = (grupo) => Number(config?.[`tipo_pago_${grupo}`]) || ({ nomina: 225, proveedores: 220, terceros: 238 }[grupo]);
  const candidatos = [];
  const agregar = (c) => {
    const { fila, problemas } = construirFilaPAB({ beneficiario: c.beneficiario, valor: c.valor, referencia: c.referencia, fechaAplicacion });
    const bloqueos = [...(c.bloqueos || [])];
    if (lotePorClave[c.clave]) bloqueos.unshift(`ya exportado en el lote #${lotePorClave[c.clave]}`);
    if (!c.beneficiario) bloqueos.push('sin beneficiario vinculado');
    else bloqueos.push(...problemas);
    candidatos.push({ ...c, fila, bloqueos });
  };

  presupuestoDetalle
    .filter(i => i.empresa === empresa && TIPOS_PRESUPUESTO_PAB[i.tipo] && !i.pagado)
    .forEach(i => {
      const bloqueos = [];
      if (!i.aprobado) bloqueos.push(i.requisitoCuentaCobro && !i.requisitoCuentaCobro.ok ? i.requisitoCuentaCobro.motivo : (i.aprobacionDesactualizada ? 'aprobación desactualizada: reaprobar en Presupuesto' : 'no aprobado en Presupuesto'));
      agregar({
        clave: `presupuesto:${i.id}:${anio}-${mes}`, origen: 'Presupuesto', entidadTipo: 'presupuesto', entidadId: String(i.id), anio, mes,
        etiqueta: `${i.tipo} — ${i.nombre}`, tipoPago: tipoPagoDe(TIPOS_PRESUPUESTO_PAB[i.tipo]),
        beneficiario: beneficiarioDeUsuario(usuarios.find(u => u.id === i.responsableId)),
        valor: i.netoAPagar, referencia: referenciaPAB(i.tipo === 'Nómina' ? 'NOM' : 'HON', `${anio}${String(mes).padStart(2, '0')}${i.id}`), bloqueos
      });
    });

  solicitudes
    .filter(s => s.empresa === empresa && s.estado === 'Aprobado' && TIPOS_SOLICITUD_PAB[s.tipo])
    .forEach(s => {
      const esTercero = s.tipo === 'Pago a Tercero';
      const bloqueos = [];
      const moneda = esTercero ? (s.moneda || (getMoneda ? getMoneda(s.empresa) : 'COP')) : (getMoneda ? getMoneda(s.empresa) : 'COP');
      if (moneda !== 'COP') bloqueos.push(`moneda ${moneda}: el PAB solo paga en pesos`);
      agregar({
        clave: `solicitud:${s.id}`, origen: 'Solicitudes', entidadTipo: 'solicitud', entidadId: String(s.id), anio: null, mes: null,
        etiqueta: `${s.tipo} — ${s.detalle || ''}`.trim(), tipoPago: tipoPagoDe(TIPOS_SOLICITUD_PAB[s.tipo]),
        beneficiario: esTercero
          ? beneficiarioDeTercero(terceros.find(t => t.id === s.terceroId), s.terceroInfo)
          : beneficiarioDeUsuario(usuarios.find(u => u.id === s.responsableId)),
        valor: s.tipo === 'Reembolso' ? s.totalCalculado : s.valor,
        referencia: referenciaPAB({ Reembolso: 'REE', Anticipo: 'ANT', 'Pago a Tercero': 'TER' }[s.tipo], s.id),
        bloqueos
      });
    });

  return candidatos;
};

// ---------------------------------------------------------------------------------------------
// Escritura sobre la plantilla oficial (xl/worksheets/sheet1.xml)
// ---------------------------------------------------------------------------------------------
const escaparXml = (t) => String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COLUMNAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'];
const indiceColumna = (ref) => COLUMNAS.indexOf(ref.replace(/\d+/g, ''));

// Una celda con valor, conservando el estilo (s="…") que ya tenía la plantilla.
const celdaXml = (ref, estilo, valor) => {
  const s = estilo ? ` s="${estilo}"` : '';
  if (valor === '' || valor === null || valor === undefined) return `<c r="${ref}"${s}/>`;
  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t>${escaparXml(valor)}</t></is></c>`;
};

// Calcula el reemplazo de la fila `numFila`: conserva sus celdas (y estilos) y escribe/agrega
// las indicadas en `valores`, en orden de columna. Devuelve { inicio, fin, xml } sobre el original.
const reemplazoFila = (xml, numFila, valores) => {
  const inicio = xml.indexOf(`<row r="${numFila}" `);
  if (inicio === -1) throw new Error(`La plantilla no tiene la fila ${numFila}`);
  const finApertura = xml.indexOf('>', inicio);
  const autocierre = xml[finApertura - 1] === '/';
  const fin = autocierre ? finApertura + 1 : xml.indexOf('</row>', finApertura) + '</row>'.length;
  const apertura = xml.slice(inicio, finApertura + 1).replace(/\/>$/, '>');
  const interior = autocierre ? '' : xml.slice(finApertura + 1, fin - '</row>'.length);

  const celdas = {};
  (interior.match(/<c [^>]*?(\/>|>[\s\S]*?<\/c>)/g) || []).forEach(c => {
    const ref = c.match(/r="([A-Z]+\d+)"/)[1];
    celdas[ref] = { xml: c, estilo: (c.match(/ s="(\d+)"/) || [])[1] };
  });
  Object.entries(valores).forEach(([col, valor]) => {
    const ref = `${col}${numFila}`;
    celdas[ref] = { xml: celdaXml(ref, celdas[ref]?.estilo, valor), estilo: celdas[ref]?.estilo };
  });
  const nuevoInterior = Object.keys(celdas)
    .sort((a, b) => indiceColumna(a) - indiceColumna(b))
    .map(ref => celdas[ref].xml)
    .join('');
  return { inicio, fin, xml: apertura + nuevoInterior + '</row>' };
};

export const llenarHojaPAB = (xml, encabezado, filas) => {
  const reemplazos = [
    reemplazoFila(xml, 2, {
      A: encabezado.nitPagador, B: encabezado.tipoPago, C: encabezado.aplicacion, D: encabezado.secuencia,
      E: encabezado.cuentaDebitar, F: encabezado.tipoCuentaDebitar, G: encabezado.descripcion
    }),
    ...filas.map((f, i) => reemplazoFila(xml, 4 + i, {
      A: f.tipoDocumento, B: f.documento, C: f.nombre, D: f.tipoTransaccion, E: f.codigoBanco, F: f.cuenta,
      G: f.email, H: f.documentoAutorizado, I: f.referencia, J: f.celular, K: f.valor, L: f.fechaAplicacion
    }))
  ].sort((a, b) => a.inicio - b.inicio);
  // Una sola pasada sobre el XML (la hoja trae 65.536 filas con formato: ~8 MB).
  const partes = [];
  let cursor = 0;
  reemplazos.forEach(r => { partes.push(xml.slice(cursor, r.inicio), r.xml); cursor = r.fin; });
  partes.push(xml.slice(cursor));
  return partes.join('');
};

// Genera el .xlsx final a partir del ArrayBuffer de la plantilla. Devuelve un Uint8Array.
export const generarArchivoPAB = async (JSZip, plantilla, encabezado, filas) => {
  const zip = await JSZip.loadAsync(plantilla);
  const ruta = 'xl/worksheets/sheet1.xml';
  const xml = await zip.file(ruta).async('string');
  zip.file(ruta, llenarHojaPAB(xml, encabezado, filas));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
};

export const nombreArchivoPAB = ({ empresa, tipoPago, fechaAplicacion, numeroLote }) =>
  `PAB_${String(empresa || '').split(' ')[0]}_${tipoPago}_${fechaPAB(fechaAplicacion)}_lote${numeroLote}.xlsx`;

// Para la vista previa: nombre legible del banco y del tipo de documento.
export const nombreBancoCorto = (codigo) => BANCOS_ACH.find(b => b.codigo === String(codigo))?.nombre || '';
export const nombreTipoDocCorto = (codigo) => TIPOS_DOCUMENTO.find(t => t.codigo === Number(codigo))?.nombre || '';
