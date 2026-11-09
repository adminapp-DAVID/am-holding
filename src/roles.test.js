import { describe, expect, it } from 'vitest';
import { rolDePermisos } from './roles';

describe('roles', () => {
  it('Gerente Financiero tiene los permisos de Coordinadora Administrativa', () => {
    expect(rolDePermisos('Gerente Financiero')).toBe('Coordinadora Administrativa');
    expect(rolDePermisos('Gerente Administrativo')).toBe('Administrador');
    expect(rolDePermisos('Gerente')).toBe('Gerente');
    expect(rolDePermisos(undefined)).toBeUndefined();
  });
});
