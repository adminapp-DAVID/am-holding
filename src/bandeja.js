// Mi Bandeja de Soportes: lógica pura (sin React ni Supabase).

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ¿El recibo nuevo ya está en la bandeja, enviado o pagado? Coincide si tiene la misma fecha y
// el mismo valor, y además el mismo NIT o el mismo "Pagado a" (si ninguno de los dos trae NIT
// ni proveedor, basta fecha + valor). Devuelve el primer recibo que coincide, o null.
export const buscarReciboDuplicado = (nuevo, recibos, parsearValor = Number) => {
  const valor = parsearValor(nuevo.valor);
  if (!nuevo.fecha || !Number.isFinite(valor)) return null;
  const nit = normalizar(nuevo.nit);
  const proveedor = normalizar(nuevo.proveedor);
  return (recibos || []).find(r => {
    if (r.fecha !== nuevo.fecha || Math.abs((parsearValor(r.valor) || 0) - valor) > 0.009) return false;
    const rNit = normalizar(r.nit);
    const rProveedor = normalizar(r.proveedor);
    if (nit && rNit) return nit === rNit;
    if (proveedor && rProveedor) return proveedor === rProveedor;
    return !nit && !proveedor && !rNit && !rProveedor;
  }) || null;
};
