import { PDFDocument, degrees } from 'pdf-lib';
import { supabase } from './supabaseClient';
import { redibujarImagen } from './archivos';

// Corrige un soporte YA subido que quedó volteado (Administrador / Coordinadora Administrativa):
//   • Foto: se redibuja girada y se guarda como JPEG.
//   • PDF: se gira la página indicada (p. ej. la foto que quedó de lado dentro del PDF
//     consolidado de una Legalización/Reembolso), o todas.
// Se sube como archivo nuevo en la misma carpeta y se actualizan TODAS las filas de
// public.soportes que apuntaban al archivo anterior (un mismo archivo puede estar compartido
// entre la solicitud y su gasto); después se borra el anterior. Requiere
// 20261022_soportes_girar.sql (permiso de actualizar public.soportes).

const esPdf = (nombre) => /\.pdf$/i.test(nombre || '');

export const paginasPdf = async (blob) => {
  const pdf = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
  return pdf.getPageCount();
};

export const pdfGirado = async (blob, grados, pagina) => {
  const pdf = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
  const paginas = pdf.getPages();
  const cuales = pagina ? [paginas[pagina - 1]].filter(Boolean) : paginas;
  if (!cuales.length) throw new Error('Esa página no existe en el PDF');
  cuales.forEach(p => p.setRotation(degrees(((p.getRotation().angle + grados) % 360 + 360) % 360)));
  return new Blob([await pdf.save()], { type: 'application/pdf' });
};

// soporte: { bucketPath, nombre }. opciones: { grados (90 | -90 | 180), pagina (solo PDF; null = todas) }
// Devuelve { bucketPath, nombre, tamanoKb } del archivo nuevo.
export const guardarSoporteGirado = async (soporte, { grados, pagina = null }) => {
  const { data, error } = await supabase.storage.from('soportes').download(soporte.bucketPath);
  if (error || !data) throw new Error('No se pudo leer el archivo: ' + (error?.message || ''));

  const pdf = esPdf(soporte.nombre);
  const blob = pdf ? await pdfGirado(data, grados, pagina) : await redibujarImagen(data, grados);
  const nombre = pdf ? soporte.nombre : `${String(soporte.nombre || 'foto').replace(/\.[^.]+$/, '')}.jpg`;
  const carpeta = soporte.bucketPath.split('/').slice(0, -1).join('/');
  const limpio = nombre.replace(/[^a-zA-Z0-9._-]/g, '_');
  const nuevaRuta = `${carpeta}/${Date.now()}_girado_${limpio}`;

  const { error: errorSubida } = await supabase.storage.from('soportes')
    .upload(nuevaRuta, blob, { contentType: pdf ? 'application/pdf' : 'image/jpeg', upsert: false });
  if (errorSubida) throw new Error('No se pudo guardar el archivo girado: ' + errorSubida.message);

  const tamanoKb = Math.round(blob.size / 1024);
  const { data: filas, error: errorFilas } = await supabase.from('soportes')
    .update({ bucket_path: nuevaRuta, nombre_original: nombre, tamano_kb: tamanoKb })
    .eq('bucket_path', soporte.bucketPath)
    .select('id');
  if (errorFilas || !filas?.length) {
    await supabase.storage.from('soportes').remove([nuevaRuta]);
    throw new Error(errorFilas?.message || 'Tu rol no puede reemplazar este soporte (¿ya se corrió 20261022_soportes_girar.sql?)');
  }
  // El archivo anterior ya no lo usa nadie; si el permiso no alcanza para borrarlo, solo queda huérfano.
  await supabase.storage.from('soportes').remove([soporte.bucketPath]);
  return { bucketPath: nuevaRuta, nombre, tamanoKb };
};
