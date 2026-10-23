import { describe, expect, it } from 'vitest';
import { construirExcelTraslado, destinoTraslado } from './traslados';

const getMoneda = (e) => (e === 'ARKO' ? 'USD' : 'COP');
const fila = (x, etiqueta) => x.rows.findIndex(r => r[0] === etiqueta);

describe('destinoTraslado', () => {
  it('lee los tres formatos de cuenta_destino', () => {
    expect(destinoTraslado('PRONOVA CAPITAL SAS: BBVA', 'AM')).toMatchObject({ externa: false, empresa: 'PRONOVA CAPITAL SAS', cuenta: 'BBVA' });
    expect(destinoTraslado('Bancolombia', 'AM')).toMatchObject({ externa: false, empresa: 'AM', cuenta: 'Bancolombia' });
    expect(destinoTraslado('Empresa Externa — Cta: 123 — Banco X', 'AM')).toMatchObject({ externa: true, empresa: 'Empresa Externa', cuenta: 'Cta: 123 — Banco X', numero: '123', detalle: 'Banco X' });
  });
});

describe('construirExcelTraslado', () => {
  it('salida y entrada con su moneda', () => {
    const x = construirExcelTraslado({ id: 7, fecha: '2026-10-20', empresa: 'ARKO', cuentaSalida: 'USD', cuentaDestino: 'AM: Bancolombia', valor: 500, valorDestino: 2000000, ceco: 'TRS-1', detalle: 'Fondeo', estado: 'Pagado' }, { getMoneda, nits: { AM: '900' }, cecoNombre: 'Fondeo' });
    const iSal = fila(x, 'Valor salida (USD)');
    const iEnt = fila(x, 'Valor entrada (COP)');
    expect(x.rows[iSal][1]).toBe(500);
    expect(x.rows[iEnt][1]).toBe(2000000);
    expect(x.monedaFila).toMatchObject({ [iSal]: 'USD', [iEnt]: 'COP' });
    expect(x.rows).toContainEqual(['NIT', '900']);
    expect(x.rows).toContainEqual(['CECO', 'TRS-1 — Fondeo']);
    expect(x.nombreArchivo).toBe('Traslado_ARKO_2026-10-20_7.xlsx');
  });

  it('misma moneda sin valor destino usa el mismo valor; externa muestra número y detalle', () => {
    const x = construirExcelTraslado({ empresa: 'AM', cuentaDestino: 'Empresa Externa — Cta: 55 — Banco Y', valor: '1000' }, { getMoneda });
    expect(x.rows[fila(x, 'Valor entrada (COP)')][1]).toBe(1000);
    expect(x.rows).toContainEqual(['Número de cuenta', '55']);
    expect(x.rows).toContainEqual(['Detalle de la cuenta', 'Banco Y']);
  });
});
