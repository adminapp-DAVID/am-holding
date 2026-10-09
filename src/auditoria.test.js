import { faltantesPerfil, cambiosAuditoria, resumenCambios, csvAuditoria } from './auditoria';

// Datos ficticios.
describe('faltantesPerfil', () => {
  test('perfil completo', () => {
    expect(faltantesPerfil({ tipoDocumento: 1, cedula: '1000000001', codigoBanco: '1007', tipoCuentaBancaria: 'Ahorros', numeroCuenta: '123' })).toEqual([]);
  });
  test('reporta cada campo faltante', () => {
    expect(faltantesPerfil({ cedula: '  ', tipoCuentaBancaria: 'Ahorros' })).toEqual(['tipo de documento', 'número de documento', 'banco', 'número de cuenta']);
    expect(faltantesPerfil(null)).toHaveLength(5);
  });
});

describe('cambios de auditoría', () => {
  const edicion = { antes: { estado: 'Aprobado', motivo_devolucion: null, updated_at: 'x' }, despues: { estado: 'Devuelto', motivo_devolucion: 'Falta factura', updated_at: 'y' } };

  test('edición: campo por campo, sin marcas de tiempo', () => {
    expect(cambiosAuditoria(edicion)).toEqual([
      { campo: 'estado', antes: 'Aprobado', despues: 'Devuelto' },
      { campo: 'motivo_devolucion', antes: '—', despues: 'Falta factura' }
    ]);
    expect(resumenCambios(edicion)).toBe('estado: Aprobado → Devuelto; motivo_devolucion: — → Falta factura');
  });

  test('creación y eliminación muestran los datos', () => {
    expect(resumenCambios({ antes: null, despues: { id: 1, detalle: 'Taxi', valor: 100 } })).toBe('detalle: Taxi; valor: 100');
    expect(resumenCambios({ antes: { detalle: 'Arriendo' }, despues: null })).toBe('detalle: Arriendo');
  });

  test('CSV con ; comillas escapadas y BOM', () => {
    const csv = csvAuditoria([{ fecha: '2026-10-09T15:00:00Z', usuario_nombre: 'Admin', rol: 'Administrador', modulo: 'Solicitudes', accion: 'Edición', tabla: 'solicitudes', registro_id: 'a1', registro: 'Taxi "aeropuerto"; ida', ...edicion }]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    const [encabezado, fila] = csv.slice(1).split('\r\n');
    expect(encabezado.split(';')).toHaveLength(9);
    expect(fila).toContain('"Taxi ""aeropuerto""; ida"');
    expect(fila).toContain('estado: Aprobado → Devuelto');
  });
});
