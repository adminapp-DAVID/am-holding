import { describe, expect, it } from 'vitest';
import { anticipoFueraDePlazo, avisosPolitica, bloquesContenido, resumenPolitica, textoHora } from './politicas';

describe('politicas', () => {
  it('anticipación mínima igual que la base (días × 24 en hora Colombia)', () => {
    const creada = '2026-10-23T02:00:00Z'; // 22 oct 9:00 p. m. en Colombia
    expect(anticipoFueraDePlazo('2026-10-23', creada, 48)).toBe(true);
    expect(anticipoFueraDePlazo('2026-10-24', creada, 48)).toBe(false);
    expect(anticipoFueraDePlazo('', creada, 48)).toBe(false);
  });

  it('formato del texto de políticas', () => {
    const b = bloquesContenido('# Pagos\n- Los **viernes** de cada semana\n  - sub\nTexto libre');
    expect(b.map(x => [x.tipo, x.nivel])).toEqual([['titulo', 0], ['item', 0], ['item', 1], ['parrafo', 0]]);
    expect(b[1].partes).toEqual([{ texto: 'Los ', negrilla: false }, { texto: 'viernes', negrilla: true }, { texto: ' de cada semana', negrilla: false }]);
  });

  it('resumen y horas', () => {
    expect(textoHora('11:00:00')).toBe('11:00 a. m.');
    expect(textoHora('15:30')).toBe('3:30 p. m.');
    expect(resumenPolitica({})[0][1]).toBe('23 de octubre de 2026');
    expect(resumenPolitica({})[2][1]).toBe('Jueves a las 11:00 a. m.');
  });

  it('avisos por solicitud', () => {
    const ahora = new Date('2026-10-23T15:00:00Z');
    const claves = (s, o) => avisosPolitica(s, { ahora, ...o }).map(a => a.clave);
    expect(claves({ estado: 'Devuelto', devueltaLimite: '2026-10-23T20:00:00Z' })).toEqual(['devuelta']);
    expect(claves({ tipo: 'Reembolso', estado: 'Pendiente', fechaPagoEstimada: '2026-10-30', extemporanea: true })).toEqual(['pago']);
    expect(claves({ tipo: 'Anticipo', estado: 'Pendiente', requiereConfirmacionGerencia: true })).toEqual(['gerencia']);
    expect(claves({ tipo: 'Anticipo', estado: 'Pagado', legalizarAntes: '2026-10-20' })).toEqual(['legalizar']);
    expect(avisosPolitica({ tipo: 'Anticipo', estado: 'Pagado', legalizarAntes: '2026-10-20' }, { ahora })[0].tono).toBe('destructive');
    expect(claves({ tipo: 'Anticipo', estado: 'Pagado', legalizarAntes: '2026-10-20' }, { legalizada: true })).toEqual([]);
  });
});
