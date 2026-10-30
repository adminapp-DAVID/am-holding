// Links de Google Drive guardados en soporte_drive_link (registros históricos importados):
// convierte el link en una URL que se puede mostrar dentro del visor de soportes (iframe).
// Para verse, el archivo debe estar compartido con quien lo abre (o "cualquiera con el enlace").

const ID_ARCHIVO = /\/(?:file|document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]{10,})/;
const ID_CARPETA = /\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})/;
const ID_PARAM = /[?&]id=([A-Za-z0-9_-]{10,})/;

export const esLinkDrive = (url) => /^https:\/\/(drive|docs)\.google\.com\//i.test(String(url || '').trim());

// { tipo: 'archivo' | 'carpeta', id, vista } o null si no es un link de Drive reconocible.
export const vistaPreviaDrive = (url) => {
  const u = String(url || '').trim();
  if (!esLinkDrive(u)) return null;
  const carpeta = u.match(ID_CARPETA);
  if (carpeta) return { tipo: 'carpeta', id: carpeta[1], vista: `https://drive.google.com/embeddedfolderview?id=${carpeta[1]}#list` };
  const archivo = u.match(ID_ARCHIVO);
  if (archivo) {
    const base = u.match(/^https:\/\/[^/]+\/(?:[a-z]+\/)?(?:u\/\d+\/)?(file|document|spreadsheets|presentation)\//i)?.[1]?.toLowerCase() || 'file';
    const raiz = base === 'file' ? 'https://drive.google.com/file' : `https://docs.google.com/${base}`;
    return { tipo: 'archivo', id: archivo[1], vista: `${raiz}/d/${archivo[1]}/preview` };
  }
  const param = u.match(ID_PARAM);
  if (param) return { tipo: 'archivo', id: param[1], vista: `https://drive.google.com/file/d/${param[1]}/preview` };
  return null;
};
