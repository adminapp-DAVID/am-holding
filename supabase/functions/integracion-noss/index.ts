// Integración con la app Noss — Operación Financiera Noss (OFN).
// Desplegar con "Verify JWT" APAGADO: esta función valida por su cuenta a cada llamador.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   INTEGRACION_AM_CLAVE  → el MISMO valor guardado en el Supabase de Noss.
//   NOSS_INTEGRACION_URL  → https://<proyecto-noss>.supabase.co/functions/v1/integracion-am
//
// Llamadas desde Noss (servidor a servidor, cabecera x-integracion-clave):
//   pendientes → solicitudes con OFN esperando a Gerencia Noss (con enlaces temporales a sus soportes).
//   decision   → { solicitud_id, decision: 'Aprobada' | 'Devuelta', por, comentario } (ofn_decidir).
// Llamadas desde la app AM Holding (usuario con sesión, cabecera Authorization):
//   actualizar_catalogo → trae de Noss procesos, jugadores y clubes y los guarda en noss_catalogo.
//   avisar_solicitud    → { solicitud_id } avisa a Noss que hay una solicitud OFN nueva o corregida.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const iguales = (a: string, b: string) => {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let dif = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) dif |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return dif === 0;
};

const SECRETO = Deno.env.get('INTEGRACION_AM_CLAVE') ?? '';

// Clave con permisos de servidor: la nueva (SUPABASE_SECRET_KEYS, sb_secret_…) si existe; si no, la heredada
// SUPABASE_SERVICE_ROLE_KEY (deja de servir si el proyecto apaga las claves heredadas).
const claveServicio = () => {
  try {
    const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    const clave = nuevas.default || Object.values(nuevas).find((v) => typeof v === 'string' && v);
    if (clave) return clave;
  } catch { /* sin claves nuevas */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
};
const NOSS_URL = Deno.env.get('NOSS_INTEGRACION_URL') ?? '';

const llamarNoss = async (cuerpo: unknown) => {
  if (!NOSS_URL) throw new Error('Falta el secreto NOSS_INTEGRACION_URL');
  const r = await fetch(NOSS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-integracion-clave': SECRETO },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((datos as { error?: string }).error || `Noss respondió ${r.status}`);
  return datos;
};

type Item = { id: string; nombre: string; estado?: string; club?: string; pais?: string; clave?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (SECRETO.length < 32) return json({ error: 'Integración sin configurar (INTEGRACION_AM_CLAVE)' }, 503);

  let cuerpo: Record<string, unknown> = {};
  try { cuerpo = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const accion = String(cuerpo.accion || '');

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, claveServicio(), { auth: { persistSession: false } });

  try {
    // ---------- Desde Noss (clave compartida) ----------
    const clave = req.headers.get('x-integracion-clave');
    if (clave !== null) {
      if (!iguales(clave, SECRETO)) return json({ error: 'No autorizado' }, 401);

      if (accion === 'pendientes') {
        const { data, error } = await sb.from('solicitudes')
          .select('id, created_at, fecha, tipo, detalle, valor, total_calculado, moneda_pago, documentos, ofn, tercero_info, usuarios!responsable_id ( nombre, email )')
          .not('ofn', 'is', null).eq('ofn_aprobacion', 'Pendiente').eq('estado', 'Pendiente')
          .order('created_at');
        if (error) throw error;
        const ids = (data || []).map((s) => String(s.id));
        const { data: sops } = ids.length
          ? await sb.from('soportes').select('entidad_id, bucket_path, nombre_original').eq('entidad_tipo', 'solicitud').in('entidad_id', ids)
          : { data: [] };
        const soportes: Record<string, { nombre: string; url: string }[]> = {};
        for (const sp of sops || []) {
          const { data: firmado } = await sb.storage.from('soportes').createSignedUrl(sp.bucket_path, 60 * 60);
          if (firmado?.signedUrl) (soportes[String(sp.entidad_id)] ||= []).push({ nombre: sp.nombre_original || 'Soporte', url: firmado.signedUrl });
        }
        return json({
          solicitudes: (data || []).map((s) => {
            const u = (s as { usuarios?: { nombre?: string; email?: string } }).usuarios;
            return {
              id: s.id, creada: s.created_at, fecha: s.fecha, tipo: s.tipo, detalle: s.detalle,
              valor: s.tipo === 'Anticipo' || s.tipo === 'Comisión' || s.tipo === 'Pago a Tercero' ? s.valor : s.total_calculado,
              moneda: s.moneda_pago || 'COP',
              items: Array.isArray(s.documentos) ? s.documentos.map((d: Record<string, unknown>) => ({ descripcion: d.descripcion || d.concepto || '', proveedor: d.proveedor || '', valor: d.valor || 0, fecha: d.fecha || '' })) : [],
              ofn: s.ofn, colaborador: u?.nombre || '', correo: u?.email || '',
              tercero: (s.tercero_info as { nombre?: string } | null)?.nombre || '',
              soportes: soportes[String(s.id)] || [],
            };
          }),
        });
      }

      if (accion === 'decision') {
        const { data, error } = await sb.rpc('ofn_decidir', {
          p_solicitud: String(cuerpo.solicitud_id || ''), p_decision: String(cuerpo.decision || ''),
          p_por: String(cuerpo.por || 'Gerencia Noss').slice(0, 120), p_comentario: cuerpo.comentario ? String(cuerpo.comentario).slice(0, 1000) : null,
        });
        if (error) throw error;
        return json({ resultado: data });
      }
      return json({ error: 'Acción no reconocida' }, 400);
    }

    // ---------- Desde la app AM Holding (usuario con sesión) ----------
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await sb.auth.getUser(token);
    if (!auth?.user) return json({ error: 'Sesión no válida' }, 401);
    const { data: yo, error: errYo } = await sb.from('usuarios').select('id, nombre').eq('auth_user_id', auth.user.id).limit(1).maybeSingle();
    if (errYo) throw new Error(`No se pudo leer el perfil: ${errYo.message}`);
    if (!yo) return json({ error: `Sin perfil en AM Holding (${auth.user.email})` }, 403);

    if (accion === 'actualizar_catalogo') {
      const cat = await llamarNoss({ accion: 'catalogo' }) as { procesos?: Item[]; jugadores?: Item[]; clubes?: Item[] };
      const ahora = new Date().toISOString();
      const filas = [
        ...(cat.procesos || []).map((p, i) => ({ tipo: 'proceso', id: String(p.clave), nombre: p.nombre, detalle: null, orden: i, activo: true, actualizado_at: ahora })),
        ...(cat.jugadores || []).map((j) => ({ tipo: 'jugador', id: String(j.id), nombre: j.nombre, detalle: [j.estado, j.club].filter(Boolean).join(' · ') || null, orden: 0, activo: true, actualizado_at: ahora })),
        ...(cat.clubes || []).map((c) => ({ tipo: 'club', id: String(c.id), nombre: c.nombre, detalle: c.pais || null, orden: 0, activo: true, actualizado_at: ahora })),
      ];
      if (!filas.length) throw new Error('Noss no devolvió datos');
      for (let i = 0; i < filas.length; i += 500) {
        const { error } = await sb.from('noss_catalogo').upsert(filas.slice(i, i + 500), { onConflict: 'tipo,id' });
        if (error) throw error;
      }
      // Lo que ya no viene de Noss queda inactivo (no se borra: puede estar en solicitudes guardadas).
      await sb.from('noss_catalogo').update({ activo: false }).lt('actualizado_at', ahora);
      return json({ procesos: cat.procesos?.length || 0, jugadores: cat.jugadores?.length || 0, clubes: cat.clubes?.length || 0 });
    }

    if (accion === 'avisar_solicitud') {
      const { data: s } = await sb.from('solicitudes').select('id, tipo, detalle, total_calculado, valor, ofn, ofn_aprobacion, responsable_id')
        .eq('id', String(cuerpo.solicitud_id || '')).maybeSingle();
      if (!s || !s.ofn || s.ofn_aprobacion !== 'Pendiente') return json({ avisado: false });
      try {
        await llamarNoss({ accion: 'aviso_solicitud', solicitud: { id: s.id, tipo: s.tipo, detalle: s.detalle, valor: s.total_calculado || s.valor, colaborador: yo.nombre } });
        return json({ avisado: true });
      } catch (e) {
        // Si Noss aún no recibe avisos, la solicitud igual aparece en su bandeja "Por aprobar".
        return json({ avisado: false, motivo: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ error: 'Acción no reconocida' }, 400);
  } catch (e) {
    console.error('integracion-noss:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
