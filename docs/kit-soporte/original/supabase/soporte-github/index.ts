// Envía un ticket de Soporte a GitHub como issue (al aprobarlo) y cierra el issue al publicarlo o rechazarlo.
// Solo para quien tenga el permiso soporte.gestionar. El ticket se lee y se actualiza con la sesión del usuario (RLS).
//
// Secretos requeridos (Supabase → Edge Functions → Secrets):
//   GITHUB_TOKEN  token "fine-grained" con permiso Issues: Read and write sobre el repositorio
//   GITHUB_REPO   dueño/repositorio, ej. adminapp-DAVID/noss-app
//   APP_URL       (opcional) dirección de la app, ej. https://noss-app.vercel.app, para el enlace al ticket
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const ETIQUETAS: Record<string, string> = {
  Error: 'bug', Mejora: 'enhancement', 'Nueva función': 'enhancement', Duda: 'question', Datos: 'datos',
};

async function github(ruta: string, metodo: string, cuerpo?: unknown) {
  const token = Deno.env.get('GITHUB_TOKEN');
  const repo = Deno.env.get('GITHUB_REPO');
  if (!token || !repo) throw new Error('Falta configurar GITHUB_TOKEN y GITHUB_REPO en los secretos de Supabase');
  const r = await fetch(`https://api.github.com/repos/${repo}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('GitHub', r.status, datos);
    throw new Error(r.status === 401 || r.status === 403 || r.status === 404
      ? 'GitHub rechazó el token: revisa que tenga permiso de Issues sobre el repositorio'
      : `GitHub respondió ${r.status}`);
  }
  return datos;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: permisos } = await supabase.rpc('mis_permisos');
  if (!Array.isArray(permisos) || !(permisos.includes('*') || permisos.includes('soporte.gestionar'))) {
    return json({ error: 'No tienes permiso para esta acción' }, 403);
  }

  const { ticket_id, accion = 'crear' } = await req.json().catch(() => ({}));
  if (!ticket_id || !['crear', 'cerrar'].includes(accion)) return json({ error: 'Solicitud inválida' }, 400);

  const { data: t } = await supabase.from('tickets')
    .select('*, autor:creado_por(nombre), apoyos:ticket_apoyos(count)')
    .eq('id', ticket_id).maybeSingle();
  if (!t) return json({ error: 'Ticket no encontrado' }, 404);

  try {
    if (accion === 'cerrar') {
      if (!t.github_issue) return json({ ok: true });
      await github(`/issues/${t.github_issue}/comments`, 'POST', {
        body: `Ticket #${t.numero} marcado como **${t.estado}** en la app.${t.respuesta ? `\n\n${t.respuesta}` : ''}`,
      });
      await github(`/issues/${t.github_issue}`, 'PATCH', { state: 'closed', state_reason: t.estado === 'Rechazado' ? 'not_planned' : 'completed' });
      return json({ ok: true });
    }

    if (t.github_issue) return json({ ok: true, github_issue: t.github_issue, github_url: t.github_url });

    // Capturas: enlaces firmados por 30 días para poder verlas desde GitHub
    const capturas: string[] = [];
    for (const p of t.adjuntos || []) {
      const { data } = await supabase.storage.from('soporte').createSignedUrl(p, 60 * 60 * 24 * 30);
      if (data?.signedUrl) {
        const nombre = p.split('/').pop();
        capturas.push(/\.(png|jpe?g|gif|webp)$/i.test(p) ? `![${nombre}](${data.signedUrl})` : `- [${nombre}](${data.signedUrl})`);
      }
    }
    const app = Deno.env.get('APP_URL');
    const cuerpo = [
      `**Tipo:** ${t.tipo} · **Prioridad:** ${t.prioridad} · **Módulo:** ${t.modulo || '—'}`,
      `**Reportado por:** ${t.autor?.nombre || '—'} · **Apoyos:** ${t.apoyos?.[0]?.count ?? 0}`,
      t.pantalla ? `**Pantalla:** \`${t.pantalla}\`` : '',
      app ? `**Ticket en la app:** ${app.replace(/\/$/, '')}/soporte/${t.id}` : '',
      '',
      '## Descripción',
      t.descripcion || '_Sin descripción_',
      t.respuesta ? `\n## Nota de Gerencia\n${t.respuesta}` : '',
      capturas.length ? `\n## Capturas (enlaces válidos 30 días)\n${capturas.join('\n')}` : '',
    ].filter((x) => x !== '').join('\n');

    const issue = await github('/issues', 'POST', {
      title: `[Soporte #${t.numero}] ${t.titulo}`,
      body: cuerpo,
      labels: ['soporte', ETIQUETAS[t.tipo] || 'soporte'].filter((x, i, a) => a.indexOf(x) === i),
    });
    const { data: ok } = await supabase.from('tickets')
      .update({ github_issue: issue.number, github_url: issue.html_url }).eq('id', t.id).select('id');
    if (!ok?.length) return json({ error: `Se creó el issue #${issue.number} pero no se pudo guardar en el ticket` }, 500);
    return json({ ok: true, github_issue: issue.number, github_url: issue.html_url });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
