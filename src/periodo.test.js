import { describe, expect, it } from 'vitest';
import { mesAnterior, nombrePeriodo, periodoDeGasto, periodoPorDefecto } from './periodo';

describe('periodo', () => {
  it('mes vencido: el pago de inicio de mes corresponde al mes anterior', () => {
    expect(periodoPorDefecto('2026-10-05', true)).toBe('2026-09');
    expect(periodoPorDefecto('2026-01-04', true)).toBe('2025-12');
    expect(periodoPorDefecto('2026-10-05', false)).toBe('2026-10');
  });
  it('gastos sin periodo cuentan en el mes de su fecha', () => {
    expect(periodoDeGasto({ fecha: '2026-10-05' })).toBe('2026-10');
    expect(periodoDeGasto({ fecha: '2026-10-05', periodo: '2026-09' })).toBe('2026-09');
  });
  it('utilidades', () => {
    expect(mesAnterior('2026-03')).toBe('2026-02');
    expect(nombrePeriodo('2026-09')).toBe('Septiembre 2026');
  });
});
