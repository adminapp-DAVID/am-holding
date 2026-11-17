import React, { useMemo, useState } from 'react';
import { RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ofnVacia, conPorcentajes, EMPRESA_OFN } from './ofn';

// Bloque "🎯 Operación Financiera Noss" del formulario de Solicitudes. `valor` = null (sin OFN) o
// { proceso, jugadores: [{id, nombre, pct}], clubes: [...], evento: {id, nombre} | null }. Las listas vienen de
// noss_catalogo (evento = Proyectos, Viajes y Competencias de Noss).

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Selector({ titulo, opciones, elegidos, onCambiar, placeholder, unico = false, extraFila = null }) {
  const [busqueda, setBusqueda] = useState('');
  const sugerencias = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (q.length < 2) return [];
    const ya = new Set(elegidos.map(e => String(e.id)));
    return opciones.filter(o => !ya.has(String(o.id)) && normalizar(`${o.nombre} ${o.detalle || ''}`).includes(q)).slice(0, 8);
  }, [busqueda, opciones, elegidos]);
  // Con un solo jugador (o club) el % no aplica: se le asigna todo el gasto.
  const cambiar = (l) => onCambiar(l.length === 1 ? l.map(x => ({ ...x, pct: '' })) : l);
  const porcentajes = conPorcentajes(elegidos);
  const suma = elegidos.reduce((t, e) => t + (parseFloat(String(e.pct ?? '').replace(',', '.')) || 0), 0);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-muted-foreground">{titulo}</span>
      {!(unico && elegidos.length) && <div className="relative">
        <Input aria-label={`Buscar ${titulo}`} placeholder={placeholder} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        {sugerencias.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-solid border-border bg-card shadow-lg">
            {sugerencias.map(o => (
              <button key={o.id} type="button" onClick={() => { cambiar([...elegidos, { id: String(o.id), nombre: o.nombre, pct: '' }]); setBusqueda(''); }}
                className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-muted">
                {o.nombre}{o.detalle ? <span className="text-xs text-muted-foreground"> · {o.detalle}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>}
      {elegidos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {elegidos.map((e, i) => (
            <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-sm">
              <span className="flex-1">{e.nombre}{e.detalle ? <span className="text-xs text-muted-foreground"> · {e.detalle}</span> : null}</span>
              {!unico && elegidos.length > 1 && <Input aria-label={`% de ${e.nombre}`} placeholder="% igual" value={e.pct ?? ''} onChange={(ev) => onCambiar(elegidos.map((x, j) => (j === i ? { ...x, pct: ev.target.value } : x)))} className="h-7 w-20 text-right text-xs" />}
              {extraFila && extraFila(e, (cambios) => onCambiar(elegidos.map((x, j) => (j === i ? { ...x, ...cambios } : x))))}
              <Button type="button" variant="ghost" size="icon" onClick={() => cambiar(elegidos.filter((_, j) => j !== i))} title="Quitar" aria-label={`Quitar ${e.nombre}`} className="size-7"><X size={14} /></Button>
            </div>
          ))}
          {!unico && <span className={`text-xs ${porcentajes && elegidos.length > 1 && Math.abs(suma - 100) > 0.01 ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
            {elegidos.length === 1 ? 'Se le asigna el 100% del gasto.'
              : porcentajes ? `Reparto manual entre ellos: ${Math.round(suma * 100) / 100}% (debe sumar 100%)`
                : `Se reparte entre ellos en partes iguales (${Math.round((100 / elegidos.length) * 100) / 100}% c/u). Escribe % para repartir distinto.`}
          </span>}
        </div>
      )}
    </div>
  );
}

export default function OperacionFinancieraNoss({ valor, onCambiar, catalogo, onActualizarCatalogo, actualizando, deshabilitado }) {
  const procesos = catalogo.filter(c => c.tipo === 'proceso').sort((a, b) => a.orden - b.orden);
  const jugadores = catalogo.filter(c => c.tipo === 'jugador');
  const clubes = catalogo.filter(c => c.tipo === 'club');
  const eventos = catalogo.filter(c => c.tipo === 'evento');
  const servicios = catalogo.filter(c => c.tipo === 'servicio').sort((a, b) => a.orden - b.orden);
  // Servicio del plan de acompañamiento del jugador (los de su plan primero).
  const selectorServicio = (e, actualizar) => {
    if (!servicios.length) return null;
    const delPlan = new Set((jugadores.find(j => String(j.id) === String(e.id))?.extra?.servicios || []).map(String));
    const orden = [...servicios].sort((a, b) => delPlan.has(String(b.id)) - delPlan.has(String(a.id)));
    return (
      <Select aria-label={`Servicio de ${e.nombre}`} value={e.servicio_id || ''} className="h-7 w-auto min-w-[150px] text-xs"
        onChange={(ev) => actualizar({ servicio_id: ev.target.value, servicio_nombre: servicios.find(s => String(s.id) === ev.target.value)?.nombre || '' })}>
        <option value="">Servicio (opcional)</option>
        {orden.map(s => <option key={s.id} value={s.id}>{s.nombre}{delPlan.has(String(s.id)) ? ' · en su plan' : ''}</option>)}
      </Select>
    );
  };
  const eventoElegido = valor?.evento?.id ? [{ ...valor.evento, detalle: eventos.find(e => String(e.id) === String(valor.evento.id))?.detalle }] : [];
  const activo = !!valor;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-solid border-primary/40 bg-primary/5 p-4">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input type="checkbox" disabled={deshabilitado} checked={activo} onChange={(e) => onCambiar(e.target.checked ? ofnVacia() : null)} />
        🎯 Operación Financiera Noss
      </label>
      <p className="m-0 text-xs text-muted-foreground">
        Márcalo si es un gasto de Noss ({EMPRESA_OFN}): queda ligado a un proceso misional, jugadores y clubes, y necesita la aprobación de Gerencia Noss antes de que Coordinación la revise.
      </p>
      {activo && (
        <>
          {!procesos.length ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Aún no se han traído las listas de Noss.
              <Button type="button" size="sm" variant="outline" disabled={actualizando} onClick={onActualizarCatalogo}><RotateCw size={14} /> {actualizando ? 'Trayendo…' : 'Traer listas de Noss'}</Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">Proceso misional *</span>
                <Select aria-label="Proceso misional" value={valor.proceso} onChange={(e) => onCambiar({ ...valor, proceso: e.target.value })}>
                  <option value="">Seleccionar</option>
                  {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </Select>
              </div>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                <Selector titulo="Jugadores (opcional)" placeholder="Escribe al menos 2 letras del jugador" opciones={jugadores} elegidos={valor.jugadores || []} onCambiar={(l) => onCambiar({ ...valor, jugadores: l })} extraFila={selectorServicio} />
                <Selector titulo="Clubes (opcional)" placeholder="Escribe al menos 2 letras del club" opciones={clubes} elegidos={valor.clubes || []} onCambiar={(l) => onCambiar({ ...valor, clubes: l })} />
              </div>
              <Selector unico titulo="Proyecto deportivo, viaje o competencia (opcional)" placeholder="Escribe al menos 2 letras del proyecto o evento" opciones={eventos} elegidos={eventoElegido}
                onCambiar={(l) => onCambiar({ ...valor, evento: l[0] ? { id: String(l[0].id), nombre: l[0].nombre } : null })} />
              {valor.evento && <p className="m-0 -mt-1 text-xs text-muted-foreground">Al pagarse, queda en el Gasto real de ese evento en Noss.</p>}
              <button type="button" onClick={onActualizarCatalogo} disabled={actualizando} className="self-start cursor-pointer border-0 bg-transparent p-0 text-xs text-[#6C63D1] underline">
                {actualizando ? 'Actualizando listas de Noss…' : '🔄 ¿No aparece? Actualizar listas de Noss'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
