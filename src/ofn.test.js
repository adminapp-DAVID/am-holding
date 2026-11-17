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

describe('OFN con servicio del plan del jugador', () => {
  it('guarda el servicio solo cuando se eligió', () => {
    const g = ofnParaGuardar({ proceso: 'acompanamiento', jugadores: [{ id: 1, nombre: 'Ana', pct: '', servicio_id: 's9', servicio_nombre: 'Nutrición' }, { id: 2, nombre: 'Leo', pct: '', servicio_id: '' }] });
    expect(g.jugadores[0]).toEqual({ id: '1', nombre: 'Ana', pct: null, servicio_id: 's9', servicio_nombre: 'Nutrición' });
    expect(g.jugadores[1]).toEqual({ id: '2', nombre: 'Leo', pct: null });
  });
});

describe('OFN con un solo jugador o club', () => {
  it('ignora el % y le asigna el 100%', () => {
    expect(validarOfn({ proceso: 'scouting', jugadores: [{ id: 1, pct: '20' }], clubes: [{ id: 2, pct: '80' }] })).toBe('');
    expect(repartoEfectivo([{ id: 1, pct: 20 }]).map(x => x.pct)).toEqual([100]);
    expect(ofnParaGuardar({ proceso: 'scouting', jugadores: [{ id: 1, nombre: 'N', pct: '20' }], clubes: [] }).jugadores[0].pct).toBeNull();
  });
});
