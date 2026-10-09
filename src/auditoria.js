// Utilidades puras de Auditoría / Notificaciones (sin React ni Supabase, para poder probarlas).

// Perfil incompleto: los datos que exige el pago PAB. Debe coincidir con
// public.faltantes_perfil() de supabase/migrations/20261010_auditoria_notificaciones.sql.
export const faltantesPerfil = (u) => {
  const vacio = (v) => String(v ?? '').trim() === '';
  const faltan = [];
  if (vacio(u?.tipoDocumento)) faltan.push('tipo de documento');
  if (vacio(u?.cedula)) faltan.push('número de documento');
  if (vacio(u?.codigoBanco)) faltan.push('banco');
  if (vacio(u?.tipoCuentaBancaria)) faltan.push('tipo de cuenta');
  if (vacio(u?.numeroCuenta)) faltan.push('número de cuenta');
  return faltan;
};

export const MODULOS_AUDITORIA = [
  'Solicitudes', 'Cuentas de Cobro', 'Finanzas', 'Presupuesto', 'Terceros', 'Colaboradores',
  'Soportes', 'Datos Bancarios', 'Pagos PAB', 'Configuración'
];
export const ACCIONES_AUDITORIA = ['Creación', 'Edición', 'Cambio de estado', 'Eliminación'];

const CAMPOS_OCULTOS = ['id', 'created_at', 'updated_at'];

const textoValor = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// Lista de cambios legibles de una fila de auditoría: [{ campo, antes, despues }].
// Edición / Cambio de estado: campo por campo. Creación / Eliminación: los datos del registro.
export const cambiosAuditoria = (fila) => {
  const antes = fila?.antes || {};
  const despues = fila?.despues || {};
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])]
    .filter(c => !CAMPOS_OCULTOS.includes(c));
  return campos.map(campo => ({
    campo,
    antes: campo in antes ? textoValor(antes[campo]) : '',
    despues: campo in despues ? textoValor(despues[campo]) : ''
  }));
};

export const resumenCambios = (fila) => cambiosAuditoria(fila)
  .map(c => (c.antes && c.despues ? `${c.campo}: ${c.antes} → ${c.despues}` : `${c.campo}: ${c.despues || c.antes}`))
  .join('; ');

// CSV con separador ";" (Excel en español lo abre en columnas) y BOM para las tildes.
const celdaCSV = (v) => {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const csvAuditoria = (filas) => {
  const encabezado = ['Fecha', 'Usuario', 'Rol', 'Módulo', 'Acción', 'Tabla', 'ID registro', 'Registro', 'Cambios (anterior → nuevo)'];
  const lineas = filas.map(f => [
    new Date(f.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    f.usuario_nombre, f.rol || '', f.modulo, f.accion, f.tabla, f.registro_id || '', f.registro || '', resumenCambios(f)
  ].map(celdaCSV).join(';'));
  return '﻿' + [encabezado.join(';'), ...lineas].join('\r\n');
};
