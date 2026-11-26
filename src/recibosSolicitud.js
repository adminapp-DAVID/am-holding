import { parsearMonto } from './montos';

// "🧾 Recibos" de una solicitud (revisión de Administración / Coordinación / Gerencia):
// une cada ítem del desglose (`documentos`) con el archivo de su recibo para verlo con el ojito.
//   1) Recibo de la bandeja enviado en esta solicitud con la misma fecha, valor y concepto
//      (soportes_pendientes). Su archivo: el de la solicitud con el mismo nombre (public.soportes)
//      o, si no está, el de la bandeja.
//   2) Si no, por posición, solo cuando hay exactamente tantos archivos sin usar como ítems sin recibo.
// Devuelve { filas: [{ ...ítem, archivo | null }], sueltos: archivos de la solicitud que no quedaron
// unidos a ningún ítem } (ej. Pago a Tercero o Anticipo, que no tienen desglose).
const clave = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const monto = (v) => { const n = parsearMonto(v); return Number.isFinite(n) ? Math.round(n * 100) : null; };
const mismoRecibo = (doc, r) => String(doc.fecha || '') === String(r.fecha || '')
  && monto(doc.valor) === monto(r.valor)
  && clave(doc.descripcion) === clave(r.descripcion);

export function recibosDeSolicitud({ documentos = [], bandeja = [], archivos = [] }) {
  const usadosBandeja = new Set();
  const usadosArchivo = new Set();
  const archivoPorNombre = (nombre) => archivos.find(a => !usadosArchivo.has(a.bucketPath) && a.nombre && a.nombre === nombre);

  const filas = documentos.map((doc) => {
    const r = bandeja.find(x => !usadosBandeja.has(x.id) && mismoRecibo(doc, x));
    if (!r) return { ...doc, archivo: null };
    usadosBandeja.add(r.id);
    const propio = archivoPorNombre(r.nombre);
    if (propio) { usadosArchivo.add(propio.bucketPath); return { ...doc, archivo: propio }; }
    return { ...doc, archivo: r.bucketPath ? { nombre: r.nombre, bucketPath: r.bucketPath } : null };
  });

  const sinArchivo = filas.filter(f => !f.archivo);
  const libres = archivos.filter(a => !usadosArchivo.has(a.bucketPath));
  if (sinArchivo.length > 0 && sinArchivo.length === libres.length) {
    sinArchivo.forEach((f, i) => { f.archivo = libres[i]; f.porPosicion = true; usadosArchivo.add(libres[i].bucketPath); });
  }
  return { filas, sueltos: archivos.filter(a => !usadosArchivo.has(a.bucketPath)) };
}
