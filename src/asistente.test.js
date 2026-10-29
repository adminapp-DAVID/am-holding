import { describe, it, expect } from 'vitest';
import { etiquetaColumna, monedaDeFila, textoCelda, datosGrafico, filasExcel, nombreArchivo, textoPlano } from './asistente';

const tabla = {
  titulo: 'Gastos octubre',
  columnas: ['empresa', 'total_valor', 'cantidad', 'neutro'],
  filas: [['AM SPORTS GROUP SAS', '48350000.5', 62, false], ['ARKO', 4250, 7, true]],
  columnasDinero: ['total_valor'],
  grafico: { etiqueta: 'empresa', valor: 'total_valor' },
};
const fmt = (v, m) => `${m} ${v}`;

describe('asistente', () => {
  it('etiqueta columnas', () => {
    expect(etiquetaColumna('cuenta_salida')).toBe('Cuenta salida');
    expect(etiquetaColumna('total_valor')).toBe('Total valor');
  });

  it('moneda por fila: moneda_pago o ARKO en USD', () => {
    expect(monedaDeFila(tabla, tabla.filas[0])).toBe('COP');
    expect(monedaDeFila(tabla, tabla.filas[1])).toBe('USD');
    expect(monedaDeFila({ columnas: ['moneda_pago'] }, ['EUR'])).toBe('EUR');
  });

  it('formatea dinero sin redondear y booleanos', () => {
    expect(textoCelda(tabla, tabla.filas[0], 1, fmt)).toBe('COP 48350000.5');
    expect(textoCelda(tabla, tabla.filas[1], 1, fmt)).toBe('USD 4250');
    expect(textoCelda(tabla, tabla.filas[1], 3, fmt)).toBe('Sí');
    expect(textoCelda(tabla, [null], 0, fmt)).toBe('');
  });

  it('datos del gráfico', () => {
    expect(datosGrafico(tabla)).toEqual([{ etiqueta: 'AM SPORTS GROUP SAS', valor: 48350000.5 }, { etiqueta: 'ARKO', valor: 4250 }]);
    expect(datosGrafico({ ...tabla, grafico: null })).toEqual([]);
  });

  it('Excel con números reales', () => {
    const f = filasExcel(tabla);
    expect(f[0]).toEqual(['Empresa', 'Total valor', 'Cantidad', 'Neutro']);
    expect(f[1]).toEqual(['AM SPORTS GROUP SAS', 48350000.5, 62, 'No']);
  });

  it('nombre de archivo y texto plano', () => {
    expect(nombreArchivo('Gastos de octubre · PRONOVA', 'xlsx')).toBe('Gastos_de_octubre_PRONOVA.xlsx');
    expect(textoPlano('## Resumen\n**Total**: `$1`')).toBe('Resumen\nTotal: $1');
  });
});
