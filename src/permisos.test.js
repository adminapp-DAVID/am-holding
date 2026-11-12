import { describe, it, expect } from 'vitest';
import { nivelEfectivo, nivelesPermitidos, rolBaseDe, nombreRol, codigosSensibles, permisosParaGuardar, MAXIMO_POR_BASE, IDS_MODULOS } from './permisos';

const roles = [
  { codigo: 'Responsable', nombre: 'Colaborador', rolBase: 'Responsable' },
  { codigo: 'Coordinadora Administrativa', nombre: 'Coordinación Administrativa', rolBase: 'Coordinadora Administrativa' },
  { codigo: 'Analista', nombre: 'Analista', rolBase: 'Gerente' },
];

describe('permisos', () => {
  it('cada rol base define todos los módulos', () => {
    for (const base of Object.keys(MAXIMO_POR_BASE)) expect(Object.keys(MAXIMO_POR_BASE[base]).sort()).toEqual([...IDS_MODULOS].sort());
  });
  it('sin matriz = el máximo del rol base (comportamiento actual)', () => {
    expect(nivelEfectivo('Administrador', {}, 'finanzas')).toBe('aprobar');
    expect(nivelEfectivo('Responsable', {}, 'finanzas')).toBe('ninguno');
    expect(nivelEfectivo('Gerente', null, 'presupuesto')).toBe('ver');
  });
  it('la matriz baja pero nunca sube del máximo', () => {
    expect(nivelEfectivo('Coordinadora Administrativa', { finanzas: 'ver' }, 'finanzas')).toBe('ver');
    expect(nivelEfectivo('Responsable', { finanzas: 'aprobar' }, 'finanzas')).toBe('ninguno');
    expect(nivelEfectivo('Gerente', { presupuesto: 'editar' }, 'presupuesto')).toBe('ver');
    expect(nivelEfectivo('Gerente', { presupuesto: 'xx' }, 'presupuesto')).toBe('ver');
  });
  it('niveles permitidos por módulo', () => {
    expect(nivelesPermitidos('Contadora', 'contabilidad')).toEqual(['ninguno', 'ver']);
    expect(nivelesPermitidos('Responsable', 'pagosPAB')).toEqual(['ninguno']);
  });
  it('rol base y nombre visible', () => {
    expect(rolBaseDe('Analista', roles)).toBe('Gerente');
    expect(rolBaseDe('Gerente Financiero', [])).toBe('Coordinadora Administrativa');
    expect(nombreRol('Responsable', roles)).toBe('Colaborador');
    expect(nombreRol('Responsable', [])).toBe('Colaborador');
    expect(codigosSensibles(roles)).toContain('Coordinadora Administrativa');
    expect(codigosSensibles(roles)).not.toContain('Analista');
  });
  it('guarda solo lo que baja del máximo', () => {
    expect(permisosParaGuardar('Gerente', { finanzas: 'ver', dashboard: 'editar', pagosPAB: 'aprobar' })).toEqual({ finanzas: 'ver' });
  });
});
