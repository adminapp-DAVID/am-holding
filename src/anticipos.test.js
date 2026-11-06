import { describe, it, expect } from 'vitest';
import { itemsAnticipo, totalAnticipo, validarItemsAnticipo, itemsParaGuardar, filasExcelAnticipo } from './anticipos';

describe('anticipos', () => {
  it('ítems guardados y anticipos viejos sin lista', () => {
    expect(itemsAnticipo({ documentos: [{ descripcion: 'Hotel', valor: 300000, cotizacionNombre: 'cot.pdf' }, { descripcion: 'Taxis', valor: '50000' }] }))
      .toEqual([{ descripcion: 'Hotel', valor: 300000, cotizacionNombre: 'cot.pdf' }, { descripcion: 'Taxis', valor: 50000, cotizacionNombre: '' }]);
    expect(itemsAnticipo({ documentos: [], valor: '1500000', detalle: 'Viaje Bogotá' })).toEqual([{ descripcion: 'Viaje Bogotá', valor: 1500000, cotizacionNombre: '' }]);
    expect(itemsAnticipo({ documentos: null, valor: 0 })).toEqual([]);
  });

  it('total al centavo', () => {
    expect(totalAnticipo([{ valor: 21.32 }, { valor: '56,82' }, { valor: '1.000' }])).toBe(1078.14);
  });

  it('validación', () => {
    expect(validarItemsAnticipo([])).toMatch(/al menos un concepto/);
    expect(validarItemsAnticipo([{ descripcion: ' ', valor: 10 }])).toMatch(/Falta el concepto en 1/);
    expect(validarItemsAnticipo([{ descripcion: 'Hotel', valor: '' }])).toMatch(/mayor a cero en 1/);
    expect(validarItemsAnticipo([{ descripcion: 'Hotel', valor: '300.000' }])).toBe('');
  });

  it('se guarda sin el archivo, solo el nombre de la cotización', () => {
    expect(itemsParaGuardar([{ descripcion: ' Hotel ', valor: '300.000', cotizacionArchivo: { nombre: 'cot.pdf', data: 'data:...' } }, { descripcion: 'Taxi', valor: 5, cotizacionNombre: 'vieja.jpg' }]))
      .toEqual([{ descripcion: 'Hotel', valor: 300000, cotizacionNombre: 'cot.pdf' }, { descripcion: 'Taxi', valor: 5, cotizacionNombre: 'vieja.jpg' }]);
  });

  it('Excel del anticipo', () => {
    const s = { fecha: '2026-11-06', fechaRequerida: '2026-11-10', tipoAnticipo: 'Viaje nacional', responsableNombre: 'Ana Pérez', estado: 'Pendiente', documentos: [{ descripcion: 'Hotel', valor: 300000, cotizacionNombre: 'cot.pdf' }, { descripcion: 'Taxis', valor: 50000 }] };
    const { rows, total } = filasExcelAnticipo(s, { empresa: 'AM SPORTS GROUP SAS', nit: '900', cedula: '123', hoy: '2026-11-06' });
    expect(total).toBe(350000);
    expect(rows[0][0]).toBe('FORMATO SOLICITUD DE ANTICIPO');
    expect(rows[1][0]).toContain('ANA PÉREZ CC 123 POR CONCEPTO HOTEL, TAXIS');
    expect(rows).toContainEqual([1, 'Hotel', 300000, 'Sí — cot.pdf']);
    expect(rows).toContainEqual([2, 'Taxis', 50000, 'No']);
    expect(rows).toContainEqual(['', 'TOTAL ANTICIPO', 350000]);
  });
});
