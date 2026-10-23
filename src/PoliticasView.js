import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { BookCheck, Loader2, Save, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge, estadoBadge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DIAS_SEMANA, POLITICA_POR_DEFECTO, avisosPolitica, bloquesContenido, resumenPolitica } from './politicas';

// Módulo Administrativo → 📘 Políticas Financieras. Todos leen las políticas; Administrador y
// Coordinadora Administrativa tienen además el Gestor: los valores que usa la base para calcular
// plazos y enviar las notificaciones automáticas (20261024_politicas_financieras.sql) y el
// seguimiento de lo que está corriendo plazo.

const CAMPOS_EDITABLES = Object.keys(POLITICA_POR_DEFECTO);

const Campo = ({ label, htmlFor, ayuda, className, children }) => (
  <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {ayuda && <span className="text-xs text-muted-foreground">{ayuda}</span>}
  </div>
);

const Contenido = ({ texto }) => {
  const bloques = bloquesContenido(texto);
  if (!bloques.length) return <p className="m-0 text-sm text-muted-foreground">Aún no hay texto de políticas.</p>;
  return (
    <div className="flex flex-col gap-1.5 text-sm leading-relaxed">
      {bloques.map((b, i) => {
        const partes = b.partes.map((p, j) => (p.negrilla ? <strong key={j}>{p.texto}</strong> : <React.Fragment key={j}>{p.texto}</React.Fragment>));
        if (b.tipo === 'titulo') return <h3 key={i} className={cn('m-0 text-base font-bold text-primary', i > 0 && 'mt-4 border-0 border-t border-solid border-border pt-4')}>{partes}</h3>;
        if (b.tipo === 'item') return <div key={i} className={cn('flex gap-2', b.nivel ? 'pl-8' : 'pl-2')}><span className="text-primary">{b.nivel ? '◦' : '•'}</span><span>{partes}</span></div>;
        return <p key={i} className="m-0">{partes}</p>;
      })}
    </div>
  );
};

const PoliticasView = ({ user, politica, onPoliticaGuardada, solicitudes, nombreColaborador }) => {
  const puedeGestionar = user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa';
  const [pestana, setPestana] = useState('politicas');
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (politica) setForm({ ...POLITICA_POR_DEFECTO, ...politica, corte_hora: String(politica.corte_hora || '11:00').slice(0, 5) });
  }, [politica]);

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));
  const entero = (campo, min = 0) => (e) => set(campo, Math.max(min, parseInt(e.target.value, 10) || 0));

  const guardar = async () => {
    setGuardando(true);
    const cambios = Object.fromEntries(CAMPOS_EDITABLES.map(k => [k, form[k]]));
    const { data, error } = await supabase.from('politicas_financieras')
      .update({ ...cambios, updated_at: new Date().toISOString(), updated_by: user.nombre })
      .eq('id', 1).select('*');
    setGuardando(false);
    if (error || !data?.length) {
      alert('❌ No se pudieron guardar las políticas' + (error ? ': ' + error.message : ' (sin permiso o la tabla aún no existe: corre el SQL de Políticas Financieras).'));
      return;
    }
    onPoliticaGuardada(data[0]);
    alert('✅ Políticas guardadas. Los plazos nuevos aplican a lo que se registre desde ahora.');
  };

  // Seguimiento: todo lo que hoy tiene un aviso de la política.
  const seguimiento = useMemo(() => {
    const legalizadas = new Set(solicitudes.filter(s => s.tipo === 'Legalización').flatMap(s => s.anticipoIds || []));
    return solicitudes
      .map(s => ({ s, avisos: avisosPolitica(s, { legalizada: legalizadas.has(s.id) }) }))
      .filter(x => x.avisos.length)
      .sort((a, b) => (b.avisos.some(v => v.tono === 'destructive') - a.avisos.some(v => v.tono === 'destructive')) || String(b.s.fecha).localeCompare(String(a.s.fecha)));
  }, [solicitudes]);

  if (!politica) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Cargando políticas… (si no carga, falta correr el SQL de Políticas Financieras)
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2 text-xl font-bold"><BookCheck size={20} className="text-primary" /> Políticas Financieras</h2>
        {puedeGestionar && (
          <div className="flex rounded-lg border border-solid border-border bg-card p-1">
            {[['politicas', 'Políticas'], ['gestor', 'Gestor de políticas']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setPestana(id)}
                className={cn('cursor-pointer rounded-md border-0 px-3 py-1.5 font-[inherit] text-sm font-semibold', pestana === id ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {pestana === 'politicas' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardContent className="py-5 sm:px-7"><Contenido texto={politica.contenido} /></CardContent>
          </Card>
          <Card className="self-start">
            <CardHeader><CardTitle className="text-base">Valores vigentes</CardTitle><CardDescription>Con estos valores el sistema calcula plazos y envía los avisos.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm">
              {resumenPolitica(politica).map(([k, v]) => (
                <div key={k}><div className="text-xs font-semibold text-muted-foreground">{k}</div><div>{v}</div></div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {pestana === 'gestor' && puedeGestionar && form && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Settings2 size={16} className="text-primary" /> Plazos y notificaciones</CardTitle>
              <CardDescription>Días hábiles = lunes a viernes sin festivos de Colombia.{politica.updated_by ? ` Última edición: ${politica.updated_by}.` : ''}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                <Campo label="Día de pago de reembolsos" htmlFor="pol-pago">
                  <Select id="pol-pago" value={form.pago_dia_semana} onChange={entero('pago_dia_semana', 1)}>
                    {DIAS_SEMANA.slice(0, 5).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                  </Select>
                </Campo>
                <Campo label="Día del mes que corre el pago al lunes" htmlFor="pol-dia15" ayuda="15 por defecto; 0 = no aplica">
                  <Input id="pol-dia15" type="number" min="0" max="31" value={form.dia_mes_corrido} onChange={entero('dia_mes_corrido')} />
                </Campo>
                <Campo label="Corte: día" htmlFor="pol-corte-dia">
                  <Select id="pol-corte-dia" value={form.corte_dia_semana} onChange={entero('corte_dia_semana', 1)}>
                    {DIAS_SEMANA.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                  </Select>
                </Campo>
                <Campo label="Corte: hora" htmlFor="pol-corte-hora">
                  <Input id="pol-corte-hora" type="time" value={form.corte_hora} onChange={(e) => set('corte_hora', e.target.value)} />
                </Campo>
                <Campo label="Horas para corregir devueltas" htmlFor="pol-dev">
                  <Input id="pol-dev" type="number" min="1" value={form.devolucion_horas} onChange={entero('devolucion_horas', 1)} />
                </Campo>
                <Campo label="Anticipación mínima (horas)" htmlFor="pol-ant">
                  <Input id="pol-ant" type="number" min="0" value={form.anticipo_min_horas} onChange={entero('anticipo_min_horas')} />
                </Campo>
              </div>

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                <Campo label="Legalización general (días)" htmlFor="pol-lg">
                  <div className="flex gap-2">
                    <Input id="pol-lg" type="number" min="1" value={form.legal_general_dias} onChange={entero('legal_general_dias', 1)} className="w-24" />
                    <Select aria-label="Tipo de días (general)" value={form.legal_general_habiles ? 'h' : 'c'} onChange={(e) => set('legal_general_habiles', e.target.value === 'h')}>
                      <option value="h">Hábiles</option><option value="c">Calendario</option>
                    </Select>
                  </div>
                </Campo>
                <Campo label="Legalización viaje nacional (días)" htmlFor="pol-ln">
                  <div className="flex gap-2">
                    <Input id="pol-ln" type="number" min="1" value={form.legal_nacional_dias} onChange={entero('legal_nacional_dias', 1)} className="w-24" />
                    <Select aria-label="Tipo de días (nacional)" value={form.legal_nacional_habiles ? 'h' : 'c'} onChange={(e) => set('legal_nacional_habiles', e.target.value === 'h')}>
                      <option value="h">Hábiles</option><option value="c">Calendario</option>
                    </Select>
                  </div>
                </Campo>
                <Campo label="Legalización viaje internacional: hasta el día" htmlFor="pol-li" ayuda="Del mes en que se pagó (si ya pasó, el del mes siguiente)">
                  <Input id="pol-li" type="number" min="1" max="31" value={form.legal_internacional_dia} onChange={entero('legal_internacional_dia', 1)} />
                </Campo>
                <Campo label="Recordar la legalización (días antes)" htmlFor="pol-rec">
                  <Input id="pol-rec" type="number" min="0" value={form.legal_recordar_dias_antes} onChange={entero('legal_recordar_dias_antes')} />
                </Campo>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={!!form.notificaciones_activas} onChange={(e) => set('notificaciones_activas', e.target.checked)} />
                Enviar notificaciones automáticas de las políticas
              </label>

              <Campo label="Texto de las políticas" htmlFor="pol-texto" ayuda='Formato: "# Título", "- viñeta", "  - subviñeta" y **negrilla**.'>
                <Textarea id="pol-texto" rows={14} value={form.contenido} onChange={(e) => set('contenido', e.target.value)} className="font-mono text-xs" />
              </Campo>

              <div className="flex justify-end">
                <Button onClick={guardar} disabled={guardando}>{guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar políticas</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seguimiento</CardTitle>
              <CardDescription>Solicitudes con un plazo de la política corriendo o vencido.</CardDescription>
            </CardHeader>
            <CardContent className="sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Fecha</TableHead><TableHead>Colaborador</TableHead><TableHead>Solicitud</TableHead><TableHead>Estado</TableHead><TableHead>Aviso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seguimiento.length === 0 ? (
                    <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Nada pendiente.</TableCell></TableRow>
                  ) : seguimiento.map(({ s, avisos }) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{s.fecha}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{nombreColaborador(s)}</TableCell>
                      <TableCell className="text-xs"><span className="font-bold text-primary">{s.tipo}</span> <span className="text-muted-foreground">{s.detalle}</span></TableCell>
                      <TableCell><Badge variant={estadoBadge(s.estado)}>{s.estado}</Badge></TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{avisos.map(a => <Badge key={a.clave} variant={a.tono}>{a.texto}</Badge>)}</div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default PoliticasView;
