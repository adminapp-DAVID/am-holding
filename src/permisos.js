// ROLES Y PERMISOS (Administrativo → Roles y permisos, 20261113_roles_permisos.sql).
// • Cada usuario tiene un rol (usuarios.rol = roles.codigo). El rol tiene un NOMBRE visible
//   (editable) y un ROL BASE: uno de los 5 roles con los que la base de datos decide la seguridad
//   (RLS vía current_rol()). El código interno nunca se muestra.
// • La matriz guarda, por rol y módulo, un nivel: ninguno < ver < editar < aprobar. Nunca puede pasar
//   el MÁXIMO del rol base (lo que la base de datos le permite): bajar sí, subir no.

export const ROLES_BASE = ['Administrador', 'Coordinadora Administrativa', 'Gerente', 'Contadora', 'Responsable'];
export const NOMBRE_ROL_BASE = {
  Administrador: 'Administrador',
  'Coordinadora Administrativa': 'Coordinación Administrativa',
  Gerente: 'Gerente',
  Contadora: 'Contadora',
  Responsable: 'Colaborador',
};

export const NIVELES = ['ninguno', 'ver', 'editar', 'aprobar'];
export const ETIQUETA_NIVEL = { ninguno: 'Sin acceso', ver: 'Ver', editar: 'Editar', aprobar: 'Aprobar' };

// `id` = currentView de App.js / id del menú.
export const MODULOS = [
  { id: 'dashboard', label: 'Dashboard', grupo: 'Inicio' },
  { id: 'solicitudes', label: 'Solicitudes', grupo: 'Operación' },
  { id: 'cuentasCobro', label: 'Cuentas de cobro', grupo: 'Operación' },
  { id: 'liquidaciones', label: 'Liquidaciones', grupo: 'Operación' },
  { id: 'dashboardFinanciero', label: 'Dashboard financiero', grupo: 'Finanzas' },
  { id: 'finanzas', label: 'Finanzas', grupo: 'Finanzas' },
  { id: 'presupuesto', label: 'Presupuesto', grupo: 'Finanzas' },
  { id: 'pagosPAB', label: 'Pagos PAB', grupo: 'Finanzas' },
  { id: 'contabilidad', label: 'Contabilidad', grupo: 'Finanzas' },
  { id: 'responsables', label: 'Colaboradores', grupo: 'Equipo' },
  { id: 'datosBancarios', label: 'Datos bancarios', grupo: 'Equipo' },
  { id: 'asistente', label: 'Asistente', grupo: 'Asistente' },
  { id: 'auditoria', label: 'Auditoría', grupo: 'Administrativo' },
  { id: 'politicas', label: 'Políticas financieras', grupo: 'Administrativo' },
  { id: 'papelera', label: 'Papelera', grupo: 'Administrativo' },
  { id: 'roles', label: 'Roles y permisos', grupo: 'Administrativo' },
];
export const IDS_MODULOS = MODULOS.map(m => m.id);

const todos = (nivel) => Object.fromEntries(IDS_MODULOS.map(id => [id, nivel]));
// Máximo por rol base = lo que cada rol hace hoy en la app y permite la base de datos.
export const MAXIMO_POR_BASE = {
  Administrador: todos('aprobar'),
  'Coordinadora Administrativa': { ...todos('aprobar'), roles: 'ver' },
  Gerente: {
    ...todos('ninguno'),
    dashboard: 'editar', solicitudes: 'editar', cuentasCobro: 'editar', liquidaciones: 'ver',
    dashboardFinanciero: 'ver', finanzas: 'editar', presupuesto: 'ver', contabilidad: 'ver',
    asistente: 'ver', politicas: 'ver',
  },
  Contadora: {
    ...todos('ninguno'),
    dashboard: 'ver', solicitudes: 'ver', cuentasCobro: 'ver', liquidaciones: 'ver', contabilidad: 'ver', politicas: 'ver',
  },
  Responsable: {
    ...todos('ninguno'),
    dashboard: 'editar', solicitudes: 'editar', cuentasCobro: 'editar', liquidaciones: 'ver', politicas: 'ver',
  },
};

const rango = (n) => Math.max(0, NIVELES.indexOf(n));
export const nivelMaximo = (rolBase, modulo) => MAXIMO_POR_BASE[rolBase]?.[modulo] || 'ninguno';
// Niveles que se pueden elegir para un rol base en un módulo (hasta su máximo).
export const nivelesPermitidos = (rolBase, modulo) => NIVELES.slice(0, rango(nivelMaximo(rolBase, modulo)) + 1);

// Nivel real: el de la matriz (si lo hay) sin pasar el máximo del rol base. Sin dato = el máximo.
export function nivelEfectivo(rolBase, permisos, modulo) {
  const maximo = nivelMaximo(rolBase, modulo);
  const elegido = permisos && NIVELES.includes(permisos[modulo]) ? permisos[modulo] : maximo;
  return rango(elegido) <= rango(maximo) ? elegido : maximo;
}

// Respaldo si la tabla roles aún no existe (SQL sin correr).
const EQUIVALENTES_LEGADOS = {
  'Gerente Financiero': 'Coordinadora Administrativa',
  'Coordinador Administrativo': 'Coordinadora Administrativa',
  'Coordinación Administrativa': 'Coordinadora Administrativa',
  Colaborador: 'Responsable',
};

export const filaRol = (roles, codigo) => (roles || []).find(r => r.codigo === codigo) || null;
export const rolBaseDe = (codigo, roles) => filaRol(roles, codigo)?.rolBase || EQUIVALENTES_LEGADOS[codigo] || codigo;
export const nombreRol = (codigo, roles) => filaRol(roles, codigo)?.nombre || NOMBRE_ROL_BASE[codigo] || codigo || '';
// Códigos cuyo rol base es "sensible" (solo el Administrador edita esos perfiles).
export const codigosSensibles = (roles) => {
  const sensibles = ['Administrador', 'Contadora', 'Coordinadora Administrativa'];
  const legados = ['Administrador', 'Contadora', 'Coordinadora Administrativa', 'Gerente Financiero', 'Coordinador Administrativo'];
  return [...new Set([...legados, ...(roles || []).filter(r => sensibles.includes(r.rolBase)).map(r => r.codigo)])];
};

export const rolDBToLocal = (r) => ({
  codigo: r.codigo,
  nombre: r.nombre,
  rolBase: r.rol_base,
  descripcion: r.descripcion || '',
  orden: r.orden ?? 99,
  activo: r.activo !== false,
  presentaSolicitudes: !!r.presenta_solicitudes,
  permisos: r.permisos || {},
});

// Para guardar: solo los módulos que quedan por debajo del máximo (el resto sigue al rol base).
export function permisosParaGuardar(rolBase, matriz) {
  const out = {};
  for (const id of IDS_MODULOS) {
    const n = nivelEfectivo(rolBase, matriz, id);
    if (n !== nivelMaximo(rolBase, id)) out[id] = n;
  }
  return out;
}
