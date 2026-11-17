import { describe, it, expect } from 'vitest';
import { validarOfn, repartoEfectivo, ofnParaGuardar, estadoAprobacionNoss, bloqueadaPorNoss, resumenOfn } from './ofn';

describe('Operación Financiera Noss', () => {
  it('exige proceso y porcentajes completos que sumen 100', () => {
    expect(validarOfn(null)).toBe('');
    expect(validarOfn({ proceso: '', jugadores: [] })).toMatch(/Proceso/);
    expect(validarOfn({ proceso: 'scouting', jugadores: [{ id: 1 }, { id: 2 }] })).toBe('');
    expect(validarOfn({ proceso: 'scouting', jugadores: [{ id: 1, pct: 60 }, { id: 2 }] })).toMatch(/Completa/);
    expect(validarOfn({ proceso: 'scouting', jugadores: [{ id: 1, pct: 60 }, { id: 2, pct: 30 }] })).toMatch(/sumar 100/);
    expect(validarOfn({ proceso: 'scouting', clubes: [{ id: 1, pct: '70' }, { id: 2, pct: '30' }] })).toBe('');
  });
  it('reparte en partes iguales si no hay porcentajes', () => {
    expect(repartoEfectivo([{ id: 1 }, { id: 2 }, { id: 3 }]).map(x => x.pct)).toEqual([33.33, 33.33, 33.33]);
    expect(repartoEfectivo([{ id: 1, pct: 80 }, { id: 2, pct: 20 }]).map(x => x.pct)).toEqual([80, 20]);
  });
  it('guarda con nombre de proceso y pct numérico o null', () => {
    const g = ofnParaGuardar({ proceso: 'acompanamiento', jugadores: [{ id: 7, nombre: 'Juan', pct: '' }], clubes: [] }, [{ id: 'acompanamiento', nombre: 'Acompañamiento' }]);
    expect(g).toEqual({ proceso: 'acompanamiento', proceso_nombre: 'Acompañamiento', jugadores: [{ id: '7', nombre: 'Juan', pct: null }], clubes: [], evento: null });
    expect(resumenOfn(g)).toBe('Acompañamiento · 1 jugador(es): Juan');
  });
  it('estado y bloqueo de la aprobación de Gerencia Noss', () => {
    expect(estadoAprobacionNoss({})).toBeNull();
    expect(estadoAprobacionNoss({ ofn: {}, ofnAprobacion: 'Pendiente' }).corto).toMatch(/Gerencia/);
    expect(bloqueadaPorNoss({ ofn: {}, ofnAprobacion: 'Pendiente' })).toBe(true);
    expect(bloqueadaPorNoss({ ofn: {}, ofnAprobacion: 'Aprobada' })).toBe(false);
    expect(bloqueadaPorNoss({})).toBe(false);
  });
});

describe('OFN con proyecto/evento de Noss', () => {
  it('guarda solo id y nombre del evento y lo muestra en el resumen', () => {
    const g = ofnParaGuardar({ proceso: 'gestion', jugadores: [], clubes: [], evento: { id: 'e1', nombre: 'Gira Europa', detalle: 'Viajes' } }, [{ id: 'gestion', nombre: 'Gestión' }]);
    expect(g.evento).toEqual({ id: 'e1', nombre: 'Gira Europa' });
    expect(resumenOfn(g)).toContain('Proyecto/evento: Gira Europa');
    expect(ofnParaGuardar({ proceso: 'gestion' }).evento).toBeNull();
  });
});
