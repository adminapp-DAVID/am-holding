// Supabase (PostgREST) devuelve como máximo 1.000 filas por consulta: sin paginar, Finanzas se
// quedaba en "1000 gastos" y el resto no aparecía. Estas utilidades traen TODO en páginas.

export const TAMANO_PAGINA = 1000;
// Bloque de ids por consulta .in(): más ids arman una URL demasiado larga.
export const BLOQUE_IDS = 150;

// construir() debe devolver una consulta NUEVA cada vez (con su .order(), idealmente con 'id' de
// desempate para que el orden sea estable entre páginas). Avanza según lo que llegó, así funciona
// aunque el servidor tenga un tope menor que TAMANO_PAGINA.
export async function traerTodas(construir, tam = TAMANO_PAGINA) {
  const filas = [];
  for (let desde = 0; ;) {
    const { data, error } = await construir().range(desde, desde + tam - 1);
    if (error) return { data: null, error };
    const lote = data || [];
    if (lote.length === 0) return { data: filas, error: null };
    filas.push(...lote);
    desde += lote.length;
  }
}

// Igual, para filtros .in(columna, ids) con muchos ids: construir(idsDelBloque) → consulta.
export async function traerPorIds(construir, ids, bloque = BLOQUE_IDS) {
  const bloques = [];
  for (let i = 0; i < ids.length; i += bloque) bloques.push(ids.slice(i, i + bloque));
  const resultados = await Promise.all(bloques.map(b => traerTodas(() => construir(b))));
  const conError = resultados.find(r => r.error);
  if (conError) return { data: null, error: conError.error };
  return { data: resultados.flatMap(r => r.data), error: null };
}
