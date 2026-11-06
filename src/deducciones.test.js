import { describe, it, expect } from 'vitest';
import {
  cuotaEnMes, saldoPendienteEnMes, resumenDeduccion, historialDeduccion, ordenarPor, alternarOrden,
  cuotaCalendario, validarAplicacionManual, claveMes,
} from './deducciones';

const prestamo = { id: 'p1', tipo: 'Préstamo', valorCuota: 100, saldoTotal: 250, fechaInicio: '2026-07-01', activo: true };
const ps = { id: 's1', tipo: 'Seguridad Social (PS)', valorCuota: 50, saldoTotal: 0, fechaInicio: '2026-07-01', activo: true };
const apl = (deduccionId, anio, mes, valor, tipo = 'Cuota') => ({ deduccionId, anio, mes, valor, tipo });

describe('cuotaEnMes', () => {
  it('sin historial usa el calendario', () => {
    expect(cuotaEnMes(prestamo, 2026, 9, null)).toBe(cuotaCalendario(prestamo, 2026, 9));
    expect(cuotaEnMes(prestamo, 2026, 9, null)).toBe(50);
  });
  it('con historial: el saldo real manda (meses sin descuento no cuentan)', () => {
    const apls = [apl('p1', 2026, 7, 100)];
    expect(cuotaEnMes(prestamo, 2026, 9, apls)).toBe(100);
    expect(cuotaEnMes(prestamo, 2026, 7, apls)).toBe(100);
    expect(cuotaEnMes(prestamo, 2026, 6, apls)).toBe(0);
  });
  it('el préstamo no pasa del saldo y un abono lo reduce', () => {
    const apls = [apl('p1', 2026, 7, 100), apl('p1', 2026, 8, 120, 'Abono extra')];
    expect(cuotaEnMes(prestamo, 2026, 9, apls)).toBe(30);
    expect(cuotaEnMes(prestamo, 2026, 10, [...apls, apl('p1', 2026, 9, 30)])).toBe(0);
  });
  it('recurrente: siempre la cuota; inactiva 0 salvo lo ya descontado', () => {
    expect(cuotaEnMes(ps, 2026, 12, [])).toBe(50);
    expect(cuotaEnMes({ ...ps, activo: false }, 2026, 12, [])).toBe(0);
    expect(cuotaEnMes({ ...ps, activo: false }, 2026, 7, [apl('s1', 2026, 7, 50)])).toBe(50);
  });
});

describe('saldoPendienteEnMes', () => {
  it('descuenta lo aplicado y la cuota por aplicar del mes', () => {
    const apls = [apl('p1', 2026, 7, 100)];
    expect(saldoPendienteEnMes(prestamo, 2026, 7, apls)).toBe(150);
    expect(saldoPendienteEnMes(prestamo, 2026, 8, apls)).toBe(50);
    expect(saldoPendienteEnMes(ps, 2026, 8, apls)).toBeNull();
  });
});

describe('resumenDeduccion', () => {
  it('cuotas hechas, saldo real, faltantes y fin estimado', () => {
    const r = resumenDeduccion(prestamo, [apl('p1', 2026, 7, 100), apl('p1', 2026, 8, 100)], { anio: 2026, mes: 10 });
    expect(r).toMatchObject({ cuotasHechas: 2, cuotasTotales: 3, cuotasFaltantes: 1, saldoReal: 50, totalDescontado: 200, pagado: false });
    expect(r.finEstimado).toEqual({ anio: 2026, mes: 10 });
  });
  it('pagado cuando el saldo llega a 0 (condonación incluida)', () => {
    const r = resumenDeduccion(prestamo, [apl('p1', 2026, 7, 100), apl('p1', 2026, 8, 150, 'Condonación')], { anio: 2026, mes: 10 });
    expect(r).toMatchObject({ pagado: true, cuotasFaltantes: 0, finEstimado: null, totalManual: 150 });
  });
});

describe('historialDeduccion', () => {
  it('marca descontada / sin descuento / sin pago / pendiente y proyecta lo que falta', () => {
    const d = { ...prestamo, saldoTotal: 500 };
    const filas = historialDeduccion(d, [apl('p1', 2026, 7, 100)], { hoy: { anio: 2026, mes: 10 }, mesesConPago: new Set([claveMes(2026, 8)]) });
    expect(filas.map(f => `${f.mes}:${f.estado}:${f.valor}`)).toEqual([
      '7:descontada:100', '8:sin descuento:0', '9:sin pago:0', '10:pendiente:100', '11:pendiente:100', '12:pendiente:100', '1:pendiente:100',
    ]);
    expect(filas[filas.length - 1].saldoDespues).toBe(0);
  });
  it('recurrente: hasta hoy, sin proyección', () => {
    const filas = historialDeduccion(ps, [apl('s1', 2026, 7, 50)], { hoy: { anio: 2026, mes: 8 } });
    expect(filas.map(f => f.estado)).toEqual(['descontada', 'pendiente']);
  });
});

describe('orden y validación', () => {
  it('ordena números y textos sin tildes', () => {
    const l = [{ n: 'Óscar', v: 2 }, { n: 'ana', v: 10 }];
    expect(ordenarPor(l, { campo: 'n', direccion: 'asc' }, (x, c) => x[c]).map(x => x.n)).toEqual(['ana', 'Óscar']);
    expect(ordenarPor(l, { campo: 'v', direccion: 'desc' }, (x, c) => x[c]).map(x => x.v)).toEqual([10, 2]);
    expect(ordenarPor(l, null, () => 0)).toBe(l);
  });
  it('alternarOrden: natural → invertido → nada', () => {
    let o = alternarOrden(null, 'v', 'desc');
    expect(o).toEqual({ campo: 'v', direccion: 'desc' });
    o = alternarOrden(o, 'v', 'desc');
    expect(o).toEqual({ campo: 'v', direccion: 'asc' });
    expect(alternarOrden(o, 'v', 'desc')).toBeNull();
  });
  it('no deja abonar más que el saldo', () => {
    expect(validarAplicacionManual({ tipo: 'Abono extra', valor: 300, fecha: '2026-10-01' }, prestamo, [])).toMatch(/supera/);
    expect(validarAplicacionManual({ tipo: 'Abono extra', valor: 100, fecha: '2026-10-01' }, prestamo, [])).toBe('');
    expect(validarAplicacionManual({ tipo: 'X', valor: 1, fecha: 'x' }, prestamo, [])).toMatch(/Tipo/);
  });
});
