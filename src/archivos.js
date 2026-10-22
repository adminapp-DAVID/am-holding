// Archivos que suben los colaboradores (soportes, comprobantes, documentos): reglas y arreglo de
// fotos antes de subirlas.
//
// Las fotos del celular vienen "acostadas" con una marca (EXIF) que dice cómo girarlas; la
// galería la respeta pero pdf-lib (PDF consolidado de Legalización/Reembolso) no, y la foto queda
// de lado. Aquí cada foto se redibuja ya derecha, se reduce a un tamaño razonable y se guarda en
// JPEG. Los PDF y documentos se suben tal cual.

export const MAX_MB = 10;
export const MAX_LADO_PX = 2000;
const CALIDAD_JPEG = 0.85;

const ext = (nombre) => String(nombre || '').split('.').pop().toLowerCase();
const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'];
const EXT_HEIC = ['heic', 'heif'];
const EXT_DOCUMENTO = ['pdf', 'xls', 'xlsx', 'csv', 'doc', 'docx'];

export const esImagen = (archivo) => (archivo?.type || '').startsWith('image/') || EXT_IMAGEN.includes(ext(archivo?.name)) || EXT_HEIC.includes(ext(archivo?.name));
const esHeic = (archivo) => /heic|heif/i.test(archivo?.type || '') || EXT_HEIC.includes(ext(archivo?.name));
const esGif = (archivo) => archivo?.type === 'image/gif' || ext(archivo?.name) === 'gif';

// Motivo por el que un archivo no se acepta, o null si está bien.
export const motivoRechazo = (archivo) => {
  if (!archivo) return 'archivo vacío';
  const e = ext(archivo.name);
  if (!esImagen(archivo) && !EXT_DOCUMENTO.includes(e) && archivo.type !== 'application/pdf') {
    return 'tipo de archivo no permitido (solo fotos JPG/PNG, PDF, Excel o Word)';
  }
  // Las fotos se reducen antes de subir, así que el límite aplica al resultado; uno muy grande
  // de entrada (p. ej. un video renombrado) se rechaza igual.
  const limite = esImagen(archivo) ? MAX_MB * 4 : MAX_MB;
  if (archivo.size > limite * 1024 * 1024) return `pesa ${(archivo.size / 1048576).toFixed(1)} MB (máximo ${MAX_MB} MB)`;
  return null;
};

const MENSAJE_HEIC = 'es una foto HEIC (iPhone) que este navegador no puede abrir. En el iPhone: Ajustes → Cámara → Formatos → "Más compatible", o compártela como JPG.';

// Decodifica una imagen aplicando su orientación (EXIF). createImageBitmap con
// imageOrientation: 'from-image' es lo más directo; si no está, un <img> (los navegadores
// actuales también aplican la orientación al dibujarlo).
const decodificar = async (blob) => {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* se intenta con <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('no se pudo leer la imagen'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

// Tamaño final manteniendo proporción, con el lado mayor ≤ maxLado.
export const medidasReducidas = (ancho, alto, maxLado = MAX_LADO_PX) => {
  const escala = Math.min(1, maxLado / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
};

const aJpeg = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no se pudo convertir la imagen'))), 'image/jpeg', CALIDAD_JPEG);
});

const nombreJpg = (nombre) => `${String(nombre || 'foto').replace(/\.[^.]+$/, '') || 'foto'}.jpg`;

// Dibuja la imagen (ya derecha) girada `grados` (0, 90, 180, 270) y reducida; devuelve un JPEG.
export const redibujarImagen = async (blob, grados = 0) => {
  const imagen = await decodificar(blob);
  const ancho0 = imagen.width || imagen.naturalWidth;
  const alto0 = imagen.height || imagen.naturalHeight;
  const { ancho, alto } = medidasReducidas(ancho0, alto0);
  const g = ((grados % 360) + 360) % 360;
  const girada = g === 90 || g === 270;
  const canvas = document.createElement('canvas');
  canvas.width = girada ? alto : ancho;
  canvas.height = girada ? ancho : alto;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((g * Math.PI) / 180);
  ctx.drawImage(imagen, -ancho / 2, -alto / 2, ancho, alto);
  if (typeof imagen.close === 'function') imagen.close();
  return aJpeg(canvas);
};

// Foto lista para subir: derecha, reducida y en JPEG (las GIF se dejan igual).
export const normalizarImagen = async (archivo) => {
  if (esGif(archivo)) return archivo;
  try {
    const blob = await redibujarImagen(archivo, 0);
    return new File([blob], nombreJpg(archivo.name), { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    if (esHeic(archivo)) throw new Error(MENSAJE_HEIC);
    throw new Error('no se pudo leer la foto; tómala de nuevo o súbela como PDF.');
  }
};

// Gira una foto ya preparada `grados` (para los botones ⟲ ⟳ de la revisión).
export const girarArchivo = async (archivo, grados) => {
  if (!grados) return archivo;
  const blob = await redibujarImagen(archivo, grados);
  return new File([blob], nombreJpg(archivo.name), { type: 'image/jpeg', lastModified: Date.now() });
};

// Valida y prepara una lista de archivos. Devuelve los que quedan listos y los errores (texto
// para mostrar) de los que no.
export const prepararArchivos = async (lista) => {
  const archivos = [];
  const errores = [];
  for (const archivo of Array.from(lista || [])) {
    const motivo = motivoRechazo(archivo);
    if (motivo) { errores.push(`"${archivo?.name || 'archivo'}": ${motivo}`); continue; }
    if (!esImagen(archivo)) { archivos.push(archivo); continue; }
    try {
      const listo = await normalizarImagen(archivo);
      if (listo.size > MAX_MB * 1024 * 1024) { errores.push(`"${archivo.name}": sigue pesando más de ${MAX_MB} MB`); continue; }
      archivos.push(listo);
    } catch (e) {
      errores.push(`"${archivo.name}": ${e.message}`);
    }
  }
  return { archivos, errores };
};
