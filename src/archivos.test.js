import { describe, expect, it } from 'vitest';
import { motivoRechazo, medidasReducidas, esImagen, prepararArchivos, MAX_MB } from './archivos';

const archivo = (name, type, size = 1000) => ({ name, type, size });

describe('archivos', () => {
  it('acepta fotos, PDF y documentos; rechaza lo demás', () => {
    expect(motivoRechazo(archivo('recibo.jpg', 'image/jpeg'))).toBeNull();
    expect(motivoRechazo(archivo('factura.pdf', 'application/pdf'))).toBeNull();
    expect(motivoRechazo(archivo('cuadro.xlsx', ''))).toBeNull();
    expect(motivoRechazo(archivo('video.mp4', 'video/mp4'))).toMatch(/no permitido/);
    expect(motivoRechazo(archivo('app.exe', ''))).toMatch(/no permitido/);
  });

  it('límite de tamaño: 10 MB para documentos; las fotos se reducen antes', () => {
    expect(motivoRechazo(archivo('grande.pdf', 'application/pdf', (MAX_MB + 1) * 1048576))).toMatch(/máximo 10 MB/);
    expect(motivoRechazo(archivo('foto.jpg', 'image/jpeg', 15 * 1048576))).toBeNull();
    expect(motivoRechazo(archivo('foto.jpg', 'image/jpeg', 50 * 1048576))).toMatch(/máximo/);
  });

  it('reduce manteniendo la proporción', () => {
    expect(medidasReducidas(4000, 3000)).toEqual({ ancho: 2000, alto: 1500 });
    expect(medidasReducidas(3024, 4032)).toEqual({ ancho: 1500, alto: 2000 });
    expect(medidasReducidas(800, 600)).toEqual({ ancho: 800, alto: 600 });
  });

  it('detecta imágenes por tipo o extensión (incluye HEIC)', () => {
    expect(esImagen(archivo('IMG_1.HEIC', ''))).toBe(true);
    expect(esImagen(archivo('x.pdf', 'application/pdf'))).toBe(false);
  });

  it('prepararArchivos deja pasar los documentos y reporta los rechazados', async () => {
    const { archivos, errores } = await prepararArchivos([archivo('a.pdf', 'application/pdf'), archivo('b.mp4', 'video/mp4')]);
    expect(archivos.map(a => a.name)).toEqual(['a.pdf']);
    expect(errores[0]).toMatch(/b\.mp4/);
  });
});
