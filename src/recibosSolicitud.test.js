import { describe, expect, it } from 'vitest';
import { recibosDeSolicitud } from './recibosSolicitud';

const docs = [
  { fecha: '2026-10-29', proveedor: 'Peaje Sajonia', descripcion: 'Peaje subida', valor: '26300' },
  { fecha: '2026-10-29', proveedor: 'Peaje Sajonia', descripcion: 'Peaje regreso', valor: 26300 },
  { fecha: '2026-10-30', proveedor: 'EDS', descripcion: 'Gasolina', valor: '61.151' },
];

describe('recibosDeSolicitud', () => {
  it('une cada ítem con su recibo de la bandeja y prefiere el archivo de la solicitud con el mismo nombre', () => {
    const bandeja = [
      { id: 'b3', fecha: '2026-10-30', descripcion: 'gasolina', valor: 61151, nombre: 'eds.pdf', bucketPath: 'pendiente/u/eds.pdf' },
      { id: 'b2', fecha: '2026-10-29', descripcion: 'Peaje regreso', valor: 26300, nombre: 'regreso.jpg', bucketPath: 'pendiente/u/regreso.jpg' },
      { id: 'b1', fecha: '2026-10-29', descripcion: 'Peaje subida', valor: 26300, nombre: 'subida.jpg', bucketPath: 'pendiente/u/subida.jpg' },
    ];
    const archivos = [{ nombre: 'subida.jpg', bucketPath: 'sol/1/subida.jpg' }, { nombre: 'regreso.jpg', bucketPath: 'sol/1/regreso.jpg' }];
    const { filas, sueltos } = recibosDeSolicitud({ documentos: docs, bandeja, archivos });
    expect(filas.map(f => f.archivo.bucketPath)).toEqual(['sol/1/subida.jpg', 'sol/1/regreso.jpg', 'pendiente/u/eds.pdf']);
    expect(sueltos).toEqual([]);
  });

  it('sin bandeja une por posición solo si hay tantos archivos como ítems', () => {
    const archivos = [{ nombre: 'a.pdf', bucketPath: 'a' }, { nombre: 'b.pdf', bucketPath: 'b' }, { nombre: 'c.pdf', bucketPath: 'c' }];
    const { filas } = recibosDeSolicitud({ documentos: docs, archivos });
    expect(filas.map(f => f.archivo.bucketPath)).toEqual(['a', 'b', 'c']);
    expect(filas.every(f => f.porPosicion)).toBe(true);
    const otro = recibosDeSolicitud({ documentos: docs, archivos: archivos.slice(0, 2) });
    expect(otro.filas.every(f => f.archivo === null)).toBe(true);
    expect(otro.sueltos).toHaveLength(2);
  });

  it('sin desglose (Pago a Tercero, Anticipo) deja todos los archivos como sueltos', () => {
    const { filas, sueltos } = recibosDeSolicitud({ documentos: [], archivos: [{ nombre: 'x.pdf', bucketPath: 'x' }] });
    expect(filas).toEqual([]);
    expect(sueltos).toHaveLength(1);
  });
});
