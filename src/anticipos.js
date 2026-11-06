// Anticipos con formulario propio: una lista de conceptos (concepto + valor + cotización opcional).
// Se guardan en solicitudes.documentos como [{ descripcion, valor, cotizacionNombre }] y la columna
// valor queda con el total (el resto del sistema —pago, Legalización, Liquidaciones, PAB— sigue
// usando solicitudes.valor del anticipo como siempre).

import { parsearMonto } from './montos';

// Mismo criterio de montos que el resto de la app ("1.500.000", "70,88", números).
const num = (v) => {
  const n = parsearMonto(v);
  return Number.isFinite(n) ? n : 0;
};

// Conceptos del anticipo. Los anticipos viejos (antes del formulario por ítems) no tienen lista:
// se muestran como un solo concepto con su concepto general y su valor.
export function itemsAnticipo(s) {
  const docs = Array.isArray(s?.documentos) ? s.documentos.filter(d => d && (d.descripcion || d.valor)) : [];
  if (docs.length) return docs.map(d => ({ descripcion: d.descripcion || '', valor: num(d.valor), cotizacionNombre: d.cotizacionNombre || '' }));
  if (num(s?.valor) > 0) return [{ descripcion: s.detalle || 'Anticipo', valor: num(s.valor), cotizacionNombre: '' }];
  return [];
}

export const totalAnticipo = (items) => Math.round(items.reduce((t, i) => t + num(i.valor), 0) * 100) / 100;

// Errores del formulario (vacío = se puede guardar).
export function validarItemsAnticipo(items) {
  if (!items.length) return 'Agrega al menos un concepto del anticipo';
  const sinConcepto = items.filter(i => !(i.descripcion || '').trim()).length;
  if (sinConcepto) return `Falta el concepto en ${sinConcepto} ítem(s) del anticipo`;
  const sinValor = items.filter(i => !(num(i.valor) > 0)).length;
  if (sinValor) return `El valor debe ser mayor a cero en ${sinValor} ítem(s) del anticipo`;
  return '';
}

// Lo que se guarda en la base: sin el archivo en memoria, solo el nombre de la cotización.
export const itemsParaGuardar = (items) => items.map(i => ({
  descripcion: (i.descripcion || '').trim(),
  valor: num(i.valor),
  cotizacionNombre: i.cotizacionArchivo?.nombre || i.cotizacionNombre || '',
}));

// Filas del Excel "FORMATO SOLICITUD DE ANTICIPO" (mismo estilo que el de Legalización/Reembolso).
export function filasExcelAnticipo(s, { empresa, nit, cedula, datosCuenta, revisadoPor, aprobadoPor, hoy }) {
  const items = itemsAnticipo(s);
  const total = totalAnticipo(items);
  const conceptos = (items.map(i => i.descripcion).filter(Boolean).join(', ') || s.detalle || '').toUpperCase();
  const parrafo = `SE PRESENTA LA SOLICITUD DE ANTICIPO DEL SEÑOR(A) ${(s.responsableNombre || '').toUpperCase()} CC ${cedula || ''} POR CONCEPTO ${conceptos}. SE ADJUNTA DETALLE. ${datosCuenta || ''}`.replace(/\s+/g, ' ').trim();
  const rows = [
    ['FORMATO SOLICITUD DE ANTICIPO'],
    [parrafo],
    [],
    ['Empresa: ', empresa],
    ['NIT: ', nit || ''],
    ['Fecha solicitud', s.fecha || hoy],
    ['Fecha requerida', s.fechaRequerida || ''],
    ['Tipo de anticipo', s.tipoAnticipo || 'General'],
    [],
    ['Detalle de los conceptos por los cuales se solicita el anticipo'],
    [],
    ['N°', 'Concepto', 'Valor', 'Cotización previa'],
    ...items.map((i, n) => [n + 1, i.descripcion, i.valor, i.cotizacionNombre ? `Sí — ${i.cotizacionNombre}` : 'No']),
    ['', 'TOTAL ANTICIPO', total],
    [],
    ['Elaborado por', 'Revisado:', 'Aprobado:'],
    [s.responsableNombre || '', revisadoPor || '(pendiente)', aprobadoPor || '(pendiente)'],
    [],
    ['Estado', s.estado || ''],
  ];
  return { rows, total };
}
