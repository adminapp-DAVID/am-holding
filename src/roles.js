// Roles con nombre propio que en el sistema tienen los MISMOS permisos de otro rol. La app
// decide permisos con `user.rol` (el rol de permisos) y muestra `user.rolNombre`. La base hace lo
// mismo en public.current_rol() (ver 20261025_rol_gerente_financiero.sql y
// 20261102_rol_gerente_administrativo.sql).
export const ROLES_EQUIVALENTES = {
  'Gerente Financiero': 'Coordinadora Administrativa',
  'Gerente Administrativo': 'Administrador',
};

export const rolDePermisos = (rol) => ROLES_EQUIVALENTES[rol] || rol;
