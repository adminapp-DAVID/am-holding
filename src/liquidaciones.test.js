import { describe, it, expect } from 'vitest';
import {
  conceptoSolicitud, solicitudesLiquidables, anticiposVencidos, totalesLiquidacion, bloqueoPago,
  estadoOrigenSolicitud, estadoDestinoSolicitud, claveSolicitud, clavePresupuesto,
} from './liquidaciones';

describe('liquidaciones', () => {
  it('concepto y signo por tipo de solicitud', () => {
    expect(conceptoSolicitud({ tipo: 'Reembolso', totalCalculado: 209.76, detalle: 'Taxis' })).toEqual({ signo: 1, valor: 209.76, concepto: 'Reembolso — Taxis' });
    expect(conceptoSolicitud({ tipo: 'Anticipo', valor: '500000' }).valor).toBe(500000);
    expect(conceptoSolicitud({ tipo: 'Comisión', valor: 1200 }).signo).toBe(1);
    expect(conceptoSolicitud({ tipo: 'Legalización T. Pro', totalCalculado: 80000 }).valor).toBe(80000);
    expect(conceptoSolicitud({ tipo: 'Pago a Tercero', valor: 10 })).toBeNull();
  });

  it('legalización: saldo a favor, devolución o cuadrada', () => {
    expect(conceptoSolicitud({ tipo: 'Legalización', totalCalculado: 4042890, valorAnticipoOriginal: 1500000 })).toMatchObject({ signo: 1, valor: 2542890 });
    expect(conceptoSolicitud({ tipo: 'Legalización', totalCalculado: 900000, valorAnticipoOriginal: 1000000 })).toMatchObject({ signo: -1, valor: 100000 });
    expect(conceptoSolicitud({ tipo: 'Legalización', totalCalculado: 1000, valorAnticipoOriginal: 1000 })).toMatchObject({ signo: 1, valor: 0 });
  });

  it('estados de origen y destino', () => {
    expect(estadoOrigenSolicitud({ tipo: 'Reembolso' })).toBe('Aprobado');
    expect(estadoOrigenSolicitud({ tipo: 'Legalización T. Pro' })).toBe('Pendiente');
    expect(estadoDestinoSolicitud({ tipo: 'Legalización T. Pro' })).toBe('Legalizado');
    expect(estadoDestinoSolicitud({ tipo: 'Anticipo' })).toBe('Pagado');
  });

  it('solicitudes liquidables: filtra persona, estado, empresa, moneda y claves ocupadas', () => {
    const base = { responsableId: 'u1', estado: 'Aprobado', tipo: 'Reembolso', totalCalculado: 100, empresa: '', moneda: '' };
    const solicitudes = [
      { ...base, id: 1 },
      { ...base, id: 2, empresa: 'PRONOVA CAPITAL SAS' },
      { ...base, id: 3, moneda: 'USD' },
      { ...base, id: 4 },
      { ...base, id: 5, responsableId: 'u2' },
      { ...base, id: 6, estado: 'Pagado' },
      { ...base, id: 7, empresa: 'AM SPORTS GROUP SAS' },
    ];
    const r = solicitudesLiquidables({ solicitudes, responsableId: 'u1', empresa: 'AM SPORTS GROUP SAS', monedaEmpresa: 'COP', clavesOcupadas: { [claveSolicitud(4)]: 'en el lote PAB #3' } });
    expect(r.incluibles.map(x => x.solicitud.id)).toEqual([1, 7]);
    expect(r.excluidas.map(x => [x.solicitud.id, x.motivo])).toEqual([[2, 'es de PRONOVA CAPITAL SAS'], [3, 'está en USD'], [4, 'en el lote PAB #3']]);
  });

  it('anticipos vencidos sin legalizar', () => {
    const solicitudes = [
      { id: 'a1', tipo: 'Anticipo', responsableId: 'u1', estado: 'Pagado', legalizarAntes: '2026-10-01' },
      { id: 'a2', tipo: 'Anticipo', responsableId: 'u1', estado: 'Pagado', legalizarAntes: '2026-10-01' },
      { id: 'a3', tipo: 'Anticipo', responsableId: 'u1', estado: 'Pagado', legalizarAntes: '2026-12-01' },
      { id: 'l1', tipo: 'Legalización', responsableId: 'u1', estado: 'Pendiente', anticipoIds: ['a2'] },
    ];
    expect(anticiposVencidos({ solicitudes, responsableId: 'u1', hoy: '2026-11-05' }).map(s => s.id)).toEqual(['a1']);
  });

  it('totales al centavo y solo activos', () => {
    const items = [{ signo: 1, valor: 21.32 }, { signo: 1, valor: 56.82 }, { signo: -1, valor: '10.10' }, { signo: 1, valor: 999, activo: false }];
    expect(totalesLiquidacion(items)).toEqual({ aFavor: 78.14, descuentos: 10.1, neto: 68.04 });
  });

  it('bloqueos de pago', () => {
    const items = [{ signo: 1, valor: 100 }, { signo: -1, valor: 30 }];
    expect(bloqueoPago({ estado: 'Borrador' }, items)).toMatch(/Aprobada/);
    expect(bloqueoPago({ estado: 'Aprobada' }, [])).toMatch(/conceptos/);
    expect(bloqueoPago({ estado: 'Aprobada' }, [{ signo: -1, valor: 5 }])).toMatch(/negativo/);
    expect(bloqueoPago({ estado: 'Aprobada' }, items)).toBe('');
    expect(clavePresupuesto(9, 2026, 11)).toBe('presupuesto:9:2026-11');
  });
});
