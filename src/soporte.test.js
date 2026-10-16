import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabaseClient', () => ({ supabase: {} }));
const { parecidos, nombreSeguro, nombreAdjunto, moduloDeVista, ticketDeEnlace, usaSoporte, gestionaSoporte } = await import('./soporte');

describe('soporte', () => {
  it('parecidos encuentra tickets con las mismas palabras (sin tildes)', () => {
    const tickets = [
      { id: 'a', titulo: 'Finanzas no carga el historial', estado: 'Nuevo' },
      { id: 'b', titulo: 'Agregar filtro por empresa', estado: 'Publicado' },
    ];
    expect(parecidos('El historial de finanzas no carga', tickets).map((t) => t.id)).toEqual(['a']);
    expect(parecidos('El historial de finanzas', tickets, 'a')).toEqual([]);
    expect(parecidos('', tickets)).toEqual([]);
  });

  it('nombreSeguro limpia tildes, espacios y símbolos', () => {
    expect(nombreSeguro('Captura de pantalla (1) año.png')).toBe('Captura_de_pantalla_1_ano.png');
    expect(nombreSeguro('')).toBe('archivo');
    expect(nombreAdjunto('uuid/1700000000_foto.png')).toBe('foto.png');
  });

  it('módulo según la vista y enlace de notificación', () => {
    expect(moduloDeVista('cuentasCobro')).toBe('Cuentas de cobro');
    expect(moduloDeVista('otra')).toBe('General');
    expect(ticketDeEnlace('soporte/3f2b8c1e-1234-4abc-9def-0123456789ab')).toBe('3f2b8c1e-1234-4abc-9def-0123456789ab');
    expect(ticketDeEnlace('cuentasCobro')).toBeNull();
  });

  it('roles', () => {
    expect(['Administrador', 'Coordinadora Administrativa', 'Gerente', 'Colaborador'].every(usaSoporte)).toBe(true);
    expect(usaSoporte('Responsable')).toBe(false);
    expect(usaSoporte('Contadora')).toBe(false);
    expect(gestionaSoporte('Gerente')).toBe(true);
    expect(gestionaSoporte('Coordinadora Administrativa')).toBe(false);
  });
});
