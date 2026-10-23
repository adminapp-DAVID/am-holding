import { describe, expect, it } from 'vitest';
import { buscarReciboDuplicado } from './bandeja';
import { parsearMonto } from './montos';

const recibos = [
  { id: 1, fecha: '2026-10-15', nit: '900.123.456', proveedor: 'Uber', valor: 65000 },
  { id: 2, fecha: '2026-10-16', nit: '', proveedor: 'Restaurante El Cielo', valor: 180000 },
];
const dup = (n) => buscarReciboDuplicado(n, recibos, parsearMonto)?.id ?? null;

describe('buscarReciboDuplicado', () => {
  it('misma fecha, valor y NIT (con o sin puntos)', () => {
    expect(dup({ fecha: '2026-10-15', nit: '900123456', proveedor: 'otro', valor: '65.000' })).toBe(1);
  });
  it('sin NIT compara el "Pagado a" sin tildes ni mayúsculas', () => {
    expect(dup({ fecha: '2026-10-16', proveedor: 'restaurante el cielo', valor: '180000' })).toBe(2);
  });
  it('otro valor, otra fecha u otro NIT no es duplicado', () => {
    expect(dup({ fecha: '2026-10-15', nit: '900123456', valor: '65001' })).toBeNull();
    expect(dup({ fecha: '2026-10-14', nit: '900123456', valor: '65000' })).toBeNull();
    expect(dup({ fecha: '2026-10-15', nit: '800111222', valor: '65000' })).toBeNull();
  });
});
