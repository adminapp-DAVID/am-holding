import { describe, expect, it } from 'vitest';
import { parsearMonto, montoONumero0, mensajeConfirmacionMontos, formatearMontoPantalla, montoDesdePantalla } from './montos';

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

describe('campo de moneda en vivo', () => {
  it.each([
    ['1250000.5', '1.250.000,5'],
    ['1250.', '1.250,'],
    ['50000', '50.000'],
    [1250.5, '1.250,5'],
    ['0.5', '0,5'],
    ['', ''],
    ['50.000', '50.000'],
  ])('pantalla de %s → %s', (canon, pantalla) => {
    expect(formatearMontoPantalla(canon)).toBe(pantalla);
  });

  it('escribiendo dígito a dígito', () => {
    expect(montoDesdePantalla('5', '')).toBe('5');
    expect(montoDesdePantalla('5.0000', '5.000')).toBe('50000');
    expect(montoDesdePantalla('1.250.', '1.250')).toBe('1250.');
    expect(montoDesdePantalla('1.250,', '1.250')).toBe('1250.');
    expect(montoDesdePantalla('1.250,55', '1.250,5')).toBe('1250.55');
    expect(montoDesdePantalla('1.250,555', '1.250,55')).toBe('1250.55');
    expect(montoDesdePantalla('1.25', '1.250')).toBe('125');
    expect(montoDesdePantalla('', '5')).toBe('');
  });

  it('pegando un valor completo', () => {
    expect(montoDesdePantalla('1.250.000,50', '')).toBe('1250000.5');
    expect(montoDesdePantalla('1250.50', '')).toBe('1250.5');
    expect(montoDesdePantalla('$ 4.250.000', '')).toBe('4250000');
  });

  it('el canónico se lee igual al guardar', () => {
    expect(parsearMonto('1250000.5')).toBe(1250000.5);
    expect(parsearMonto('1250.')).toBe(1250);
    expect(parsearMonto('50000')).toBe(50000);
  });
});

describe('mensajeConfirmacionMontos', () => {
  it('no pide confirmación hasta 1 millón', () => {
    expect(mensajeConfirmacionMontos([{ etiqueta: 'Valor', texto: '1000000' }, { etiqueta: 'X', texto: 50000 }])).toBeNull();
  });
  it('lista solo los montos superiores a 1 millón', () => {
    const m = mensajeConfirmacionMontos([{ etiqueta: 'Valor', texto: '12500000' }, { etiqueta: 'Otro', texto: '300' }]);
    expect(m).toContain('Valor: 12.500.000');
    expect(m).not.toContain('Otro');
  });
});
