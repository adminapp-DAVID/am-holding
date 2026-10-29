// Edge Function "asistente" — Asistente AM Holding (fase 1: SOLO LECTURA).
//
// La app (src/AsistenteView.jsx) envía la conversación; esta función le pregunta a Claude, que
// consulta el sistema con herramientas de solo lectura. Las consultas usan el JWT del usuario
// que pregunta, así que RLS aplica igual que en la app: el asistente nunca ve más de lo que ve
// esa persona. No escribe, no borra y no toca bancos.
//
// Despliegue (una vez): Supabase → Edge Functions → Secrets: ANTHROPIC_API_KEY (no pegarla en
// el chat ni en el código). Luego desplegar esta función con el nombre "asistente".

import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

const MODELO = 'claude-opus-5-5';
// Roles (de permisos) que pueden usar el asistente — mismo criterio que ROLES_ASISTENTE en
// src/components/TopNav.jsx.
const ROLES_ASISTENTE = ['Administrador', 'Coordinadora Administrativa', 'Gerente'];
const ROLES_EQUIVALENTES: Record<string, string> = { 'Gerente Financiero': 'Coordinadora Administrativa' };
const MAX_FILAS_CONSULTA = 5000;   // filas que se traen de la base por consulta
const MAX_FILAS_A_CLAUDE = 150;    // filas que se le muestran a Claude (el resto queda para exportar)
const MAX_VUELTAS = 12;            // llamadas a Claude por pregunta

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ── Catálogo de lo que el asistente puede leer ─────────────────────────────────────────────
// Solo columnas listadas (sin datos bancarios). empresa/responsable/ceco son nombres legibles
// que vienen de las tablas relacionadas.
type Rel = { alias: string; select: string; campo: string };
const REL = {
  empresa: { alias: 'empresa', select: 'empresas', campo: 'nombre' },
  responsable: { alias: 'responsable', select: 'usuarios!responsable_id', campo: 'nombre' },
  ceco: { alias: 'ceco', select: 'cecos', campo: 'codigo' },
} satisfies Record<string, Rel>;

const TABLAS: Record<string, { columnas: string[]; rel: Rel[]; fecha?: string; desc: string }> = {
  gastos: {
    desc: 'Finanzas · salidas de dinero (gastos, pagos, traslados entre cuentas, préstamos).',
    columnas: ['id', 'fecha', 'created_at', 'tipo', 'cuenta', 'cuenta_salida', 'cuenta_destino', 'detalle', 'valor', 'valor_destino', 'valor_bruto', 'categoria', 'estado', 'observaciones', 'moneda_pago', 'neutro', 'presupuesto_item_id', 'solicitud_origen_id'],
    rel: [REL.empresa, REL.responsable, REL.ceco], fecha: 'fecha',
  },
  ingresos: {
    desc: 'Finanzas · entradas de dinero.',
    columnas: ['id', 'fecha', 'created_at', 'tipo', 'cuenta', 'detalle', 'valor', 'categoria', 'estado', 'observaciones', 'solicitud_origen_id'],
    rel: [REL.empresa, REL.responsable, REL.ceco], fecha: 'fecha',
  },
  solicitudes: {
    desc: 'Solicitudes de colaboradores (Reembolso, Anticipo, Legalización, Legalización T. Pro, Comisión, Pago a Tercero, Préstamo).',
    columnas: ['id', 'fecha', 'created_at', 'tipo', 'valor', 'total_calculado', 'estado', 'detalle', 'moneda_pago', 'tipo_anticipo', 'fecha_requerida', 'requiere_confirmacion_gerencia', 'fecha_pago_estimada', 'extemporanea', 'devuelta_limite', 'devuelta_vencida', 'legalizar_antes', 'excepcion_politica', 'excepcion_motivo', 'motivo_devolucion', 'revisado_at', 'aprobado_at', 'gasto_generado_id', 'ingreso_generado_id'],
    rel: [REL.empresa, REL.responsable], fecha: 'fecha',
  },
  cuentas_cobro: {
    desc: 'Cuentas de cobro de prestadores de servicio (mes/anio = periodo cobrado).',
    columnas: ['id', 'fecha', 'numero', 'vencimiento', 'ciudad', 'mes', 'anio', 'monto', 'funciones', 'estado'],
    rel: [REL.empresa, REL.responsable], fecha: 'fecha',
  },
  presupuesto_items: {
    desc: 'Presupuesto · conceptos mensuales (nómina, prestación de servicio, proveedores). Lo pagado de un concepto son los gastos con presupuesto_item_id = id de ese concepto.',
    columnas: ['id', 'nombre', 'tipo', 'valor_mensual', 'dia_limite_pago', 'activo', 'forma_pago'],
    rel: [REL.empresa, REL.responsable, REL.ceco],
  },
  presupuesto_overrides: {
    desc: 'Presupuesto · valor distinto para un concepto en un mes puntual (reemplaza valor_mensual ese mes).',
    columnas: ['id', 'presupuesto_item_id', 'anio', 'mes', 'valor'], rel: [],
  },
  presupuesto_anual: {
    desc: 'Presupuesto anual por empresa y CECO.',
    columnas: ['id', 'anio', 'valor_anual'], rel: [REL.empresa, REL.ceco],
  },
  cecos: { desc: 'Catálogo de centros de costo/ingreso.', columnas: ['id', 'codigo', 'nombre', 'tipo', 'activo'], rel: [] },
};

const OPERADORES = ['igual', 'distinto', 'mayor', 'mayor_igual', 'menor', 'menor_igual', 'contiene', 'en_lista', 'vacio'] as const;

type Filtro = { columna: string; operador: (typeof OPERADORES)[number]; valor?: unknown };
type ConsultaInput = {
  tabla: string; columnas?: string[]; filtros?: Filtro[];
  orden?: { columna: string; descendente?: boolean }; limite?: number;
  agrupar_por?: string[]; sumar?: string[];
};

const relDe = (tabla: string, col: string) => TABLAS[tabla].rel.find(r => r.alias === col);
const columnaValida = (tabla: string, col: string) => TABLAS[tabla].columnas.includes(col) || !!relDe(tabla, col);

// Lee filas de la base con los permisos del usuario. Devuelve filas planas (empresa/responsable/
// ceco como texto).
async function leer(sb: SupabaseClient, q: ConsultaInput) {
  const t = TABLAS[q.tabla];
  if (!t) throw new Error(`Tabla no permitida: ${q.tabla}. Usa una de: ${Object.keys(TABLAS).join(', ')}`);
  const filtros = q.filtros || [];
  const pedidas = new Set([...(q.columnas?.length ? q.columnas : [...t.columnas, ...t.rel.map(r => r.alias)]), ...(q.agrupar_por || []).filter(c => c !== 'mes'), ...(q.sumar || [])]);
  if (q.agrupar_por?.includes('mes')) pedidas.add(t.fecha || 'fecha');
  for (const c of [...pedidas, ...filtros.map(f => f.columna), ...(q.orden ? [q.orden.columna] : [])]) {
    if (!columnaValida(q.tabla, c)) throw new Error(`Columna no permitida en ${q.tabla}: ${c}`);
  }
  const filtradasRel = new Set(filtros.map(f => f.columna).filter(c => relDe(q.tabla, c)));
  const partes = [...pedidas].filter(c => !relDe(q.tabla, c));
  for (const r of t.rel) {
    if (pedidas.has(r.alias) || filtradasRel.has(r.alias) || q.orden?.columna === r.alias) partes.push(`${r.alias}:${r.select}${filtradasRel.has(r.alias) ? '!inner' : ''}(${r.campo})`);
  }

  const tope = Math.min(q.limite || MAX_FILAS_CONSULTA, MAX_FILAS_CONSULTA);
  const filas: Record<string, unknown>[] = [];
  for (let desde = 0; desde < tope; desde += 1000) {
    let consulta = sb.from(q.tabla).select(partes.join(', '));
    for (const f of filtros) {
      const rel = relDe(q.tabla, f.columna);
      const col = rel ? `${rel.alias}.${rel.campo}` : f.columna;
      const v = f.valor as string;
      switch (f.operador) {
        case 'igual': consulta = consulta.eq(col, v); break;
        case 'distinto': consulta = consulta.neq(col, v); break;
        case 'mayor': consulta = consulta.gt(col, v); break;
        case 'mayor_igual': consulta = consulta.gte(col, v); break;
        case 'menor': consulta = consulta.lt(col, v); break;
        case 'menor_igual': consulta = consulta.lte(col, v); break;
        case 'contiene': consulta = consulta.ilike(col, `%${String(v ?? '').replace(/[%_]/g, '')}%`); break;
        case 'en_lista': consulta = consulta.in(col, Array.isArray(f.valor) ? f.valor : [f.valor]); break;
        case 'vacio': consulta = f.valor === false ? consulta.not(col, 'is', null) : consulta.is(col, null); break;
        default: throw new Error(`Operador no permitido: ${f.operador}`);
      }
    }
    // Ordenar por empresa/responsable/ceco se hace abajo (PostgREST no ordena el padre por un embed).
    if (q.orden && !relDe(q.tabla, q.orden.columna)) consulta = consulta.order(q.orden.columna, { ascending: !q.orden.descendente });
    const { data, error } = await consulta.range(desde, Math.min(desde + 1000, tope) - 1);
    if (error) throw new Error(error.message);
    filas.push(...(data as unknown as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  if (q.orden && relDe(q.tabla, q.orden.columna)) {
    const r = relDe(q.tabla, q.orden.columna)!; const signo = q.orden.descendente ? -1 : 1;
    const v = (f: Record<string, unknown>) => String((f[r.alias] as Record<string, unknown> | null)?.[r.campo] ?? '');
    filas.sort((a, b) => signo * v(a).localeCompare(v(b), 'es'));
  }
  return filas.map(f => {
    const plana: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) {
      const rel = relDe(q.tabla, k);
      if (rel) { if (pedidas.has(k)) plana[k] = (v as Record<string, unknown> | null)?.[rel.campo] ?? null; }
      else plana[k] = v !== null && typeof v === 'object' ? JSON.stringify(v).slice(0, 400) : v;
    }
    return plana;
  });
}

// Agrupa y suma en la función (cifras exactas, sin que Claude tenga que sumar a mano).
function agrupar(filas: Record<string, unknown>[], por: string[], sumar: string[], colFecha = 'fecha') {
  const grupos = new Map<string, Record<string, unknown>>();
  for (const f of filas) {
    const llave = por.map(c => c === 'mes' ? String(f[colFecha] ?? '').slice(0, 7) : f[c] ?? '(vacío)');
    const k = JSON.stringify(llave);
    if (!grupos.has(k)) grupos.set(k, { ...Object.fromEntries(por.map((c, i) => [c, llave[i]])), cantidad: 0, ...Object.fromEntries(sumar.map(c => [`total_${c}`, 0])) });
    const g = grupos.get(k)!;
    g.cantidad = (g.cantidad as number) + 1;
    for (const c of sumar) g[`total_${c}`] = (g[`total_${c}`] as number) + (Number(f[c]) || 0);
  }
  return [...grupos.values()];
}

// ── Herramientas que ve Claude ──────────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: 'consultar_datos',
    description: 'Lee datos del sistema AM Holding (solo lectura, con los permisos del usuario). Devuelve un consulta_id, el total de filas y hasta 150 filas (o los grupos si se usa agrupar_por). Usa agrupar_por/sumar para totales: las sumas las hace el sistema y son exactas. Para "mes" en agrupar_por se agrupa por AAAA-MM de la fecha.',
    input_schema: {
      type: 'object',
      properties: {
        tabla: { type: 'string', enum: Object.keys(TABLAS) },
        columnas: { type: 'array', items: { type: 'string' }, description: 'Columnas a traer. Vacío = todas las permitidas.' },
        filtros: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              columna: { type: 'string' },
              operador: { type: 'string', enum: [...OPERADORES] },
              valor: { description: 'Texto, número, booleano o lista (para en_lista). Fechas en AAAA-MM-DD. Para "vacio": true = es vacío, false = no es vacío.' },
            },
            required: ['columna', 'operador'],
          },
        },
        orden: { type: 'object', properties: { columna: { type: 'string' }, descendente: { type: 'boolean' } }, required: ['columna'] },
        limite: { type: 'integer', description: `Máximo de filas a leer (hasta ${MAX_FILAS_CONSULTA}).` },
        agrupar_por: { type: 'array', items: { type: 'string' }, description: 'Columnas para agrupar (puede incluir "mes").' },
        sumar: { type: 'array', items: { type: 'string' }, description: 'Columnas numéricas a sumar por grupo.' },
      },
      required: ['tabla'],
    },
  },
  {
    name: 'mostrar_tabla',
    description: 'Muestra una tabla al usuario debajo de tu respuesta, con botones para exportarla a Excel/PDF. Úsala para todo listado o resumen con cifras. Opción A: consulta_id (de consultar_datos) + columnas a mostrar → el sistema pone TODAS las filas exactas. Opción B: encabezados + filas que tú armes (solo para resúmenes cortos calculados). Opcional: un gráfico de barras.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        consulta_id: { type: 'string' },
        columnas: { type: 'array', items: { type: 'string' }, description: 'Con consulta_id: columnas a mostrar, en orden.' },
        encabezados: { type: 'array', items: { type: 'string' } },
        filas: { type: 'array', items: { type: 'array', items: {} } },
        columnas_dinero: { type: 'array', items: { type: 'string' }, description: 'Columnas que son valores en dinero (para formatearlas).' },
        grafico: {
          type: 'object',
          description: 'Gráfico de barras: una barra por fila.',
          properties: { etiqueta: { type: 'string', description: 'Columna con el nombre de cada barra.' }, valor: { type: 'string', description: 'Columna numérica.' } },
          required: ['etiqueta', 'valor'],
        },
      },
      required: ['titulo'],
    },
  },
];

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const sistema = (nombre: string, rol: string) => `Eres el Asistente de AM Holding, dentro de la app de gestión financiera de la holding (empresas: AM SPORTS GROUP SAS, PRO INVESTMENTS GLOBAL SAS, PRONOVA CAPITAL SAS, FOR SEVEN MEDIA SAS y ARKO). Hablas con ${nombre} (rol ${rol}). Responde siempre en español de Colombia, claro y conciso.

Reglas:
- Toda cifra sale del sistema: consulta con consultar_datos antes de responder. Nunca inventes datos. Si algo no aparece o no tienes acceso, dilo.
- Para totales usa agrupar_por/sumar (sumas exactas). Para listados y resúmenes llama mostrar_tabla (el usuario podrá exportarlos a Excel o PDF); en el texto da la conclusión, no repitas la tabla.
- Eres de SOLO LECTURA: no puedes crear, aprobar, pagar, editar ni borrar nada. Si te lo piden, explica que esa acción se hace en la app (o llegará en una fase posterior).
- No tienes acceso a cuentas bancarias, contraseñas ni portales bancarios.
- Dinero: COP con separador de miles ($1.234.567); ARKO maneja USD (US$). No redondees los valores del sistema.
- Fechas en formato AAAA-MM-DD en los filtros. Hoy es ${hoyBogota()} (Bogotá). "Este mes", "el mes pasado", etc. se calculan desde hoy.

Datos disponibles (tabla → descripción):
${Object.entries(TABLAS).map(([k, t]) => `- ${k}: ${t.desc} Columnas: ${[...t.columnas, ...t.rel.map(r => r.alias)].join(', ')}.`).join('\n')}

Notas del negocio:
- En gastos, tipo 'Traslado' es movimiento entre cuentas (cuenta_salida → cuenta_destino), no es gasto real; neutro=true también indica que no cuenta como gasto. Al hablar de "gastos" exclúyelos salvo que pidan traslados.
- Estados de solicitudes: Pendiente, Aprobado, Pagado, Devuelto, Legalizado (y otros que veas en los datos).
- empresa, responsable y ceco son nombres; para filtrar por persona o empresa usa el operador "contiene".
- Si no conoces los valores posibles de una columna, consúltalos con agrupar_por esa columna.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'Falta configurar ANTHROPIC_API_KEY en los secretos de Supabase.' }, 500);
    const auth = req.headers.get('Authorization') || '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } }, auth: { persistSession: false },
    });
    const { data: { user } } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!user) return json({ error: 'Sesión no válida.' }, 401);
    const { data: yo } = await sb.from('usuarios').select('nombre, rol').eq('auth_user_id', user.id).maybeSingle();
    const rol = ROLES_EQUIVALENTES[yo?.rol] || yo?.rol;
    if (!yo || !ROLES_ASISTENTE.includes(rol)) return json({ error: 'Tu rol no tiene acceso al asistente.' }, 403);

    const body = await req.json();
    // Historial de la conversación: solo texto (las tablas no se reenvían; si hace falta, se consulta de nuevo).
    const historial = (Array.isArray(body?.mensajes) ? body.mensajes : [])
      .filter((m: { rol?: string; texto?: string }) => (m.rol === 'user' || m.rol === 'assistant') && typeof m.texto === 'string' && m.texto.trim())
      .slice(-20)
      .map((m: { rol: 'user' | 'assistant'; texto: string }) => ({ role: m.rol, content: m.texto.slice(0, 8000) }));
    if (!historial.length || historial[historial.length - 1].role !== 'user') return json({ error: 'Falta la pregunta.' }, 400);
    while (historial[0]?.role !== 'user') historial.shift();

    const client = new Anthropic({ apiKey });
    const messages: Anthropic.MessageParam[] = historial;
    const consultas = new Map<string, Record<string, unknown>[]>();
    const tablas: unknown[] = [];
    const uso = { entrada: 0, salida: 0 };
    let texto = '';

    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const resp = await client.messages.create({
        model: MODELO,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        // Caché de herramientas + instrucciones (iguales en cada vuelta de la misma pregunta).
        system: [{ type: 'text', text: sistema(yo.nombre, yo.rol), cache_control: { type: 'ephemeral' } }],
        tools,
        messages,
      });
      uso.entrada += resp.usage.input_tokens + (resp.usage.cache_read_input_tokens || 0) + (resp.usage.cache_creation_input_tokens || 0);
      uso.salida += resp.usage.output_tokens;
      texto = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n').trim() || texto;
      if (resp.stop_reason !== 'tool_use') break;

      messages.push({ role: 'assistant', content: resp.content });
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const b of resp.content) {
        if (b.type !== 'tool_use') continue;
        try {
          resultados.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(await ejecutar(b.name, b.input as Record<string, unknown>)) });
        } catch (e) {
          resultados.push({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: e instanceof Error ? e.message : String(e) });
        }
      }
      messages.push({ role: 'user', content: resultados });
    }

    return json({ texto: texto || 'No pude completar la respuesta. Intenta con una pregunta más concreta.', tablas, uso });

    async function ejecutar(nombre: string, input: Record<string, unknown>) {
      if (nombre === 'consultar_datos') {
        const q = input as unknown as ConsultaInput;
        let filas = await leer(sb, q);
        const agrupado = !!q.agrupar_por?.length;
        if (agrupado) filas = agrupar(filas, q.agrupar_por!, q.sumar || [], TABLAS[q.tabla].fecha);
        const id = `c${consultas.size + 1}`;
        consultas.set(id, filas);
        return { consulta_id: id, total_filas: filas.length, agrupado, filas: filas.slice(0, MAX_FILAS_A_CLAUDE), ...(filas.length > MAX_FILAS_A_CLAUDE ? { nota: `Solo se muestran ${MAX_FILAS_A_CLAUDE} de ${filas.length}; usa mostrar_tabla con este consulta_id para entregarlas todas.` } : {}) };
      }
      if (nombre === 'mostrar_tabla') {
        const titulo = String(input.titulo || 'Resultado');
        const dinero = Array.isArray(input.columnas_dinero) ? input.columnas_dinero.map(String) : [];
        let columnas: string[]; let filas: unknown[][];
        if (input.consulta_id) {
          const datos = consultas.get(String(input.consulta_id));
          if (!datos) throw new Error(`No existe la consulta ${input.consulta_id}.`);
          columnas = Array.isArray(input.columnas) && input.columnas.length ? input.columnas.map(String) : Object.keys(datos[0] || {});
          filas = datos.map(f => columnas.map(c => f[c] ?? ''));
        } else {
          columnas = Array.isArray(input.encabezados) ? input.encabezados.map(String) : [];
          filas = Array.isArray(input.filas) ? (input.filas as unknown[][]).filter(Array.isArray) : [];
          if (!columnas.length) throw new Error('Faltan encabezados o consulta_id.');
        }
        const g = input.grafico as { etiqueta?: string; valor?: string } | undefined;
        const grafico = g && columnas.includes(String(g.etiqueta)) && columnas.includes(String(g.valor)) ? { etiqueta: g.etiqueta, valor: g.valor } : null;
        tablas.push({ titulo, columnas, filas, columnasDinero: dinero.filter(c => columnas.includes(c)), grafico });
        return { ok: true, filas_mostradas: filas.length };
      }
      throw new Error(`Herramienta desconocida: ${nombre}`);
    }
  } catch (e) {
    console.error('asistente:', e);
    const msg = e instanceof Anthropic.APIError ? `Error del servicio de IA (${e.status}).` : (e instanceof Error ? e.message : 'Error inesperado');
    return json({ error: msg }, 500);
  }
});
