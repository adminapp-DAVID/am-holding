import { describe, it, expect } from 'vitest';
import { traerTodas, traerPorIds } from './paginar';

// Simula PostgREST: devuelve como máximo `tope` filas por consulta.
const tabla = (n, tope = 1000) => {
  const filas = Array.from({ length: n }, (_, i) => ({ id: i }));
  const consultas = [];
  const construir = (ids) => ({
    range: async (desde, hasta) => {
      consultas.push([desde, hasta]);
      const base = ids ? filas.filter(f => ids.includes(f.id)) : filas;
      return { data: base.slice(desde, Math.min(hasta + 1, desde + tope)), error: null };
    },
  });
  return { construir, consultas };
};

describe('traerTodas', () => {
  it('trae más de 1000 filas en páginas', async () => {
    const t = tabla(2350);
    const { data } = await traerTodas(() => t.construir());
    expect(data).toHaveLength(2350);
    expect(new Set(data.map(f => f.id)).size).toBe(2350);
  });
  it('funciona aunque el servidor tenga un tope menor', async () => {
    const t = tabla(1200, 500);
    const { data } = await traerTodas(() => t.construir());
    expect(data).toHaveLength(1200);
  });
  it('devuelve el error', async () => {
    const r = await traerTodas(() => ({ range: async () => ({ data: null, error: { message: 'x' } }) }));
    expect(r.error.message).toBe('x');
  });
  it('tabla vacía', async () => {
    const { data } = await traerTodas(() => tabla(0).construir());
    expect(data).toEqual([]);
  });
});

describe('traerPorIds', () => {
  it('parte los ids en bloques y junta todo', async () => {
    const t = tabla(1000);
    const ids = Array.from({ length: 400 }, (_, i) => i * 2);
    const { data } = await traerPorIds((b) => t.construir(b), ids, 150);
    expect(data.map(f => f.id).sort((a, b) => a - b)).toEqual(ids);
  });
});
