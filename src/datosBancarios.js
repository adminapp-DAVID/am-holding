// Catálogos y validaciones de datos bancarios para el pago masivo PAB de Bancolombia.
//
// Fuente: plantilla oficial "FORMATOPAB_CONVERSORPAGOS.xlsx" de Bancolombia (hoja
// "CODIGOS DE BANCOS" y comentarios de la hoja "FORMATOPAB"). No agregar códigos que no
// estén en esa plantilla: si el banco publica una versión nueva, actualizar desde ahí.

// Hoja "CODIGOS DE BANCOS" — código ACH de 4 dígitos (se guarda como texto en la BD).
export const BANCOS_ACH = [
  { codigo: '1001', nombre: 'BANCO DE BOGOTA' },
  { codigo: '1002', nombre: 'BANCO POPULAR' },
  { codigo: '1006', nombre: 'ITAU antes Corpbanca' },
  { codigo: '1007', nombre: 'BANCOLOMBIA' },
  { codigo: '1009', nombre: 'CITIBANK' },
  { codigo: '1012', nombre: 'BANCO GNB SUDAMERIS' },
  { codigo: '1013', nombre: 'BBVA COLOMBIA' },
  { codigo: '1014', nombre: 'ITAU' },
  { codigo: '1019', nombre: 'DAVIbank S.A' },
  { codigo: '1023', nombre: 'BANCO DE OCCIDENTE' },
  { codigo: '1026', nombre: 'TUYA S.A' },
  { codigo: '1031', nombre: 'BANCOLDEX S.A.' },
  { codigo: '1032', nombre: 'BANCO CAJA SOCIAL BCSC SA' },
  { codigo: '1040', nombre: 'BANCO AGRARIO' },
  { codigo: '1047', nombre: 'BANCO MUNDO MUJER' },
  { codigo: '1051', nombre: 'BANCO DAVIVIENDA SA' },
  { codigo: '1052', nombre: 'BANCO AV VILLAS' },
  { codigo: '1053', nombre: 'BANCO W' },
  { codigo: '1059', nombre: 'BANCO DE LAS MICROFINANZAS - BANCAMIA S.A.' },
  { codigo: '1060', nombre: 'BANCO PICHINCHA' },
  { codigo: '1061', nombre: 'BANCOOMEVA' },
  { codigo: '1062', nombre: 'BANCO FALABELLA S.A.' },
  { codigo: '1063', nombre: 'BANCO FINANDINA S.A.' },
  { codigo: '1065', nombre: 'BANCO SANTANDER DE NEGOCIOS COLOMBIA S.A' },
  { codigo: '1066', nombre: 'BANCO COOPERATIVO COOPCENTRAL' },
  { codigo: '1067', nombre: 'MIBANCO S.A.' },
  { codigo: '1069', nombre: 'BANCO SERFINANZA S.A' },
  { codigo: '1070', nombre: 'LULO BANK S.A.' },
  { codigo: '1071', nombre: 'BANCO J.P. MORGAN COLOMBIA S.A.' },
  { codigo: '1086', nombre: 'ASOPAGOS S.A.S' },
  { codigo: '1121', nombre: 'FINANCIERA JURISCOOP S.A. COMPAÑIA DE FINANCIAMIENTO' },
  { codigo: '1283', nombre: 'COOPERATIVA FINANCIERA DE ANTIOQUIA' },
  { codigo: '1286', nombre: 'JFK COOPERATIVA FINANCIERA' },
  { codigo: '1289', nombre: 'COOTRAFA COOPERATIVA FINANCIERA' },
  { codigo: '1292', nombre: 'CONFIAR COOPERATIVA FINANCIERA' },
  { codigo: '1303', nombre: 'BANCO UNION S.A' },
  { codigo: '1370', nombre: 'COLTEFINANCIERA S.A' },
  { codigo: '1507', nombre: 'NEQUI' },
  { codigo: '1551', nombre: 'DAVIPLATA' },
  { codigo: '1558', nombre: 'BAN100 S.A' },
  { codigo: '1560', nombre: 'PIBANK' },
  { codigo: '1637', nombre: 'IRIS' },
  { codigo: '1801', nombre: 'MOVII' },
  { codigo: '1802', nombre: 'DING TECNIPAGOS SA' },
  { codigo: '1803', nombre: 'POWWI' },
  { codigo: '1804', nombre: 'UALA' },
  { codigo: '1805', nombre: 'BANCO BTG PACTUAL' },
  { codigo: '1808', nombre: 'BOLD CF' },
  { codigo: '1809', nombre: 'NU' },
  { codigo: '1811', nombre: 'RAPPIPAY' },
  { codigo: '1812', nombre: 'COINK' },
  { codigo: '1814', nombre: 'GLOBAL66' },
  { codigo: '1816', nombre: 'CREZCAMOS S.A. COMPAÑÍA DE FINANCIAMIENTO' },
  { codigo: '1819', nombre: 'BANCO CONTACTAR S.A.' },
  { codigo: '1829', nombre: 'ADDI CF' },
  { codigo: '1843', nombre: 'PLATA S.A. COMPAÑÍA DE FINANCIAMIENTO' },
  { codigo: '1899', nombre: 'AVAL SOLUCIONES DIGITALES S.A.' }
];

// Cuentas fuera de Colombia (Bank of America, Chase, Wise…): son válidas para la app, pero
// no se pueden pagar por PAB — el exportador las excluye y se pagan por otro canal.
export const CODIGO_BANCO_EXTERIOR = 'EXTERIOR';

// Comentario de la celda A3 de la plantilla.
export const TIPOS_DOCUMENTO = [
  { codigo: 1, nombre: 'Cédula de ciudadanía' },
  { codigo: 2, nombre: 'Cédula de extranjería' },
  { codigo: 3, nombre: 'NIT' },
  { codigo: 4, nombre: 'Tarjeta de identidad' },
  { codigo: 5, nombre: 'Pasaporte' }
];
export const TIPO_DOCUMENTO_NIT = 3;

export const nombreBancoPorCodigo = (codigo) => {
  if (codigo === CODIGO_BANCO_EXTERIOR) return 'Banco del exterior';
  return BANCOS_ACH.find(b => b.codigo === String(codigo))?.nombre || '';
};

export const nombreTipoDocumento = (codigo) =>
  TIPOS_DOCUMENTO.find(t => t.codigo === Number(codigo))?.nombre || '';

const normalizarTexto = (v) => String(v || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

// Traduce el texto libre que se escribía antes en "Banco" a su código ACH. Solo cubre los
// textos que existen hoy en la BD (diagnóstico del 2026-10) y equivalencias inequívocas; lo
// que no reconoce devuelve '' para que alguien lo elija a mano. "Itau" queda a propósito sin
// traducir: la plantilla trae dos códigos (1006 y 1014) y adivinar mandaría la plata al banco
// equivocado.
const ALIAS_BANCOS = {
  'BANCOLOMBIA': '1007',
  'BANCOLOMBIA S.A.': '1007',
  'BANCOLOMBIA S.A': '1007',
  'NU': '1809',
  'NU BANK': '1809',
  'NUBANK': '1809',
  'DAVIVIENDA': '1051',
  'BANCO DAVIVIENDA': '1051',
  'BANCO DAVIVIENDA SA': '1051',
  'DAVIBANK': '1019',
  'DAVIBANK S.A': '1019',
  'DAVIBANK S.A.': '1019',
  'NEQUI': '1507',
  'DAVIPLATA': '1551',
  'BBVA': '1013',
  'BBVA COLOMBIA': '1013',
  'BANCO DE BOGOTA': '1001',
  'BANCO DE OCCIDENTE': '1023',
  'BANCO POPULAR': '1002',
  'AV VILLAS': '1052',
  'BANCO AV VILLAS': '1052',
  'CAJA SOCIAL': '1032',
  'BANCO CAJA SOCIAL': '1032',
  'LULO': '1070',
  'LULO BANK': '1070',
  'BANK OF AMERICA': CODIGO_BANCO_EXTERIOR,
  'BANK OF AMERICA, NATIONAL ASSOCIATION': CODIGO_BANCO_EXTERIOR,
  'CHASE': CODIGO_BANCO_EXTERIOR,
  'CHASE BANK': CODIGO_BANCO_EXTERIOR,
  'BANCO FAMILIAR': CODIGO_BANCO_EXTERIOR,
  'WISE': CODIGO_BANCO_EXTERIOR
};

const TEXTOS_AMBIGUOS = ['ITAU', 'BANCO ITAU', 'ITAU COLOMBIA'];

export const inferirCodigoBanco = (texto) => {
  const t = normalizarTexto(texto);
  if (!t || TEXTOS_AMBIGUOS.includes(t)) return '';
  if (ALIAS_BANCOS[t]) return ALIAS_BANCOS[t];
  const exacto = BANCOS_ACH.find(b => normalizarTexto(b.nombre) === t);
  return exacto ? exacto.codigo : '';
};

// Número de cuenta: quita espacios, puntos y guiones (así lo escribe la gente), sin tocar
// letras — si quedan letras, la validación lo marca en vez de "arreglarlo" a ciegas.
export const limpiarNumeroCuenta = (v) => String(v || '').replace(/[\s.-]/g, '');

// Documento: quita puntos, comas y espacios. En NIT, si viene con guion y dígito de
// verificación ("901.234.567-8"), se descarta el DV — el PAB lo pide sin DV. Sin guion no se
// puede saber si el último dígito es el DV, así que no se toca.
export const limpiarDocumento = (v, tipoDocumento) => {
  let d = String(v || '').replace(/[\s.,]/g, '');
  if (Number(tipoDocumento) === TIPO_DOCUMENTO_NIT && /^\d+-\d$/.test(d)) d = d.split('-')[0];
  return d;
};

// Problemas que impiden pagar a este beneficiario por PAB. Lista vacía = listo.
// Límites tomados de las validaciones de la plantilla (columnas B y F del detalle).
export const problemasDatosBancarios = ({ tipoDocumento, documento, codigoBanco, tipoCuenta, numeroCuenta }) => {
  const problemas = [];
  if (!TIPOS_DOCUMENTO.some(t => t.codigo === Number(tipoDocumento))) problemas.push('sin tipo de documento');
  const doc = String(documento || '').trim();
  if (!doc) problemas.push('sin documento');
  else if (!/^\d{1,15}$/.test(doc)) problemas.push('documento debe ser solo números (máx. 15)');
  if (!codigoBanco) problemas.push('sin banco');
  else if (codigoBanco === CODIGO_BANCO_EXTERIOR) problemas.push('cuenta en el exterior (no se paga por PAB)');
  else if (!BANCOS_ACH.some(b => b.codigo === String(codigoBanco))) problemas.push('código de banco no válido');
  if (!['Ahorros', 'Corriente'].includes(tipoCuenta)) problemas.push('sin tipo de cuenta');
  const cuenta = String(numeroCuenta || '').trim();
  if (!cuenta) problemas.push('sin número de cuenta');
  else if (!/^\d{1,17}$/.test(cuenta)) problemas.push('cuenta debe ser solo números (máx. 17)');
  return problemas;
};

export const esCuentaExterior = (codigoBanco) => codigoBanco === CODIGO_BANCO_EXTERIOR;
