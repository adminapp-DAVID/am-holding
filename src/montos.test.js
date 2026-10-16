import { describe, expect, it } from 'vitest';
import { parsearMonto, montoONumero0 } from './montos';

describe('parsearMonto', () => {
  it.each([
    ['50.000', 50000],
    ['50000', 50000],
    ['1.250.000', 1250000],
    ['1.250.000,50', 1250000.5],
    ['1,250,000.50', 1250000.5],
    ['$ 1.500.000', 1500000],
    ['COP 2.000', 2000],
    ['70,88', 70.88],
    ['1,5', 1.5],
    ['1250.50', 1250.5],
    ['1250,5', 1250.5],
    ['0.500', 0.5],
    ['1,500', 1500],
    [' 300 ', 300],
    ['-50.000', -50000],
    [50000, 50000],
    [1250.5, 1250.5],
    ['50000.00', 50000],
  ])('%s → %s', (entrada, esperado) => {
    expect(parsearMonto(entrada)).toBe(esperado);
  });

  it('sin número devuelve NaN (como parseFloat)', () => {
    expect(parsearMonto('')).toBeNaN();
    expect(parsearMonto(null)).toBeNaN();
    expect(parsearMonto(undefined)).toBeNaN();
    expect(parsearMonto('abc')).toBeNaN();
  });

  it('montoONumero0 cae en 0', () => {
    expect(montoONumero0('')).toBe(0);
    expect(montoONumero0('50.000')).toBe(50000);
  });
});
