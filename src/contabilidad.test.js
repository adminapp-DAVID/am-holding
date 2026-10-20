import { describe, expect, it } from 'vitest';
import { filasContabilidad, filtrarFilas, ordenarFilas, agruparFilas, nombreMes, totalesPorMoneda, tipoArchivo, FILTRO_CONTABILIDAD } from './contabilidad';

const registros = [
  { _origen: 'gasto', id: 1, fecha: '2026-10-05', empresa: 'AM', cuenta: 'Bancolombia', detalle: 'Arriendo octubre', tipo: 'Gasto', valor: 4500000, cantidadSoportes: 2 },
  { _origen: 'gasto', id: 2, fecha: '2026-09-20', empresa: 'PRONOVA', cuenta: 'Davivienda', detalle: 'Nómina', tipo: 'Gasto', valor: 8200000, cantidadSoportes: 0 },
  { _origen: 'gasto', id: 3, fecha: '2026-10-06', empresa: 'AM', cuentaSalida: 'Bancolombia', tipo: 'Traslado', valor: 2000000, _ladoTraslado: 'salida', cuenta: 'Bancolombia' },
  { _origen: 'gasto', id: 3, fecha: '2026-10-06', empresa: 'PRONOVA', cuenta: 'Davivienda', tipo: 'Traslado', valor: 2000000, _ladoTraslado: 'entrada' },
  { _origen: 'ingreso', id: 9, fecha: '2025-12-01', empresa: 'AM', cuenta: 'Bancolombia', detalle: 'Pago cliente', tipo: 'Ingreso', valor: 12000000, cantidadSoportes: 1, moneda: 'USD' },
];
const filas = filasContabilidad(registros);

describe('contabilidad', () => {
  it('un traslado queda una sola vez, con su cuenta de salida', () => {
    expect(filas).toHaveLength(4);
    expect(filas.find(f => f.tipo === 'Traslado')).toMatchObject({ cuenta: 'Bancolombia', empresa: 'AM' });
    expect(filas.find(f => f.id === 9)).toMatchObject({ entidadTipo: 'ingreso', anio: '2025', mes: '2025-12' });
  });

  it('filtra por empresa, cuenta, año, mes, texto y soportes', () => {
    const f = (patch) => filtrarFilas(filas, { ...FILTRO_CONTABILIDAD, ...patch }).map(x => x.id);
    expect(f({ empresa: 'AM' })).toEqual([1, 3, 9]);
    expect(f({ cuenta: 'Davivienda' })).toEqual([2]);
    expect(f({ anio: '2026', mes: '10' })).toEqual([1, 3]);
    expect(f({ texto: 'nomina' })).toEqual([2]);
    expect(f({ soloConSoportes: true })).toEqual([1, 9]);
    expect(f({ desde: '2026-10-01', hasta: '2026-10-05' })).toEqual([1]);
  });

  it('ordena ascendente y descendente', () => {
    expect(ordenarFilas(filas, 'fecha', 'desc').map(x => x.id)).toEqual([3, 1, 2, 9]);
    expect(ordenarFilas(filas, 'fecha', 'asc').map(x => x.id)).toEqual([9, 2, 1, 3]);
    expect(ordenarFilas(filas, 'valor', 'desc').map(x => x.id)).toEqual([9, 2, 1, 3]);
  });

  it('agrupa por mes, año, empresa y cuenta', () => {
    const porMes = agruparFilas(ordenarFilas(filas), 'mes', 'desc');
    expect(porMes.map(g => g.titulo)).toEqual(['Octubre 2026', 'Septiembre 2026', 'Diciembre 2025']);
    expect(agruparFilas(filas, 'anio', 'asc').map(g => g.titulo)).toEqual(['2025', '2026']);
    expect(agruparFilas(filas, 'empresa').map(g => g.titulo)).toEqual(['AM', 'PRONOVA']);
    expect(agruparFilas(filas, 'cuenta').map(g => g.titulo)).toContain('AM · Bancolombia');
    expect(agruparFilas(filas, 'ninguno')[0].filas).toHaveLength(4);
  });

  it('utilidades', () => {
    expect(nombreMes('2026-03')).toBe('Marzo 2026');
    expect(totalesPorMoneda(filas, x => x.moneda || 'COP')).toEqual({ COP: 14700000, USD: 12000000 });
    expect(tipoArchivo('Factura.PDF')).toBe('pdf');
    expect(tipoArchivo('foto.jpeg')).toBe('imagen');
    expect(tipoArchivo('x.docx')).toBe('otro');
  });
});
