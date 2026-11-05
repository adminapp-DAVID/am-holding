import React, { useCallback, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from './supabaseClient';
import { Calculator, Check, FileDown, Loader2, Plus, Send, Trash2, Undo2, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ESTADOS_LIQUIDACION, ESTADOS_EDITABLES, totalesLiquidacion, bloqueoPago } from './liquidaciones';

// 🧾 Liquidaciones (Operación): por colaborador, empresa que paga y mes — todo lo que se le debe
// (reembolsos, legalizaciones, anticipos, comisiones, honorarios / nómina) menos préstamos y
// descuentos = NETO A PAGAR. Administrador y Coordinadora (incluye Gerente Financiero) las arman,
// aprueban y pagan; Gerente y Contadora las ven; cada colaborador ve las suyas desde "En revisión".
// Al pagar, App.js registra en Finanzas un movimiento por concepto (pagarLiquidacion).

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const VARIANTE = { Borrador: 'muted', 'En revisión': 'warning', Aprobada: 'default', Pagada: 'success', Anulada: 'destructive' };
const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const SELECT_LIQ = 'id, numero, responsable_id, empresa_id, anio, mes, estado, total_a_favor, total_descuentos, neto, observaciones, cuenta, fecha_pago, motivo_anulacion, created_at, aprobado_at, pagado_at, empresas ( nombre )';

const leerArchivo = (file) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok({ nombre: file.name, tipo: file.type, tamaño: file.size, data: r.result });
  r.onerror = mal;
  r.readAsDataURL(file);
});

const LiquidacionesView = ({
  user, puedeGestionar, colaboradores, empresas, resolverEmpresaId, getMoneda, formatMoneyByMoneda, cuentasPorEmpresa, cecos,
  construirPropuesta, onPagar, onCambio,
}) => {
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState({ estado: '', responsable: '', anio: '' });
  const [abierta, setAbierta] = useState(null); // { liq, items }
  const [nueva, setNueva] = useState(null); // { responsableId, empresa, anio, mes, propuesta }
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');

  const nombre = useCallback((id) => colaboradores.find(c => String(c.id) === String(id))?.nombre || '—', [colaboradores]);
  const dinero = (v, empresa) => formatMoneyByMoneda(Number(v) || 0, getMoneda(empresa));

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.from('liquidaciones').select(SELECT_LIQ).order('created_at', { ascending: false }).limit(500);
    if (e) { setError(e.message.includes('liquidaciones') ? 'Falta correr el SQL de Liquidaciones (20261105_liquidaciones.sql).' : e.message); setLista([]); return; }
    setLista(data || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => (lista || []).filter(l => (!filtro.estado || l.estado === filtro.estado)
    && (!filtro.responsable || String(l.responsable_id) === filtro.responsable)
    && (!filtro.anio || String(l.anio) === filtro.anio)), [lista, filtro]);

  // ---------- Detalle ----------
  const abrir = async (liq) => {
    setError('');
    const { data, error: e } = await supabase.from('liquidacion_items').select('*').eq('liquidacion_id', liq.id).order('orden');
    if (e) { setError(e.message); return; }
    setAbierta({ liq, items: data || [] });
  };
  const refrescar = async (id) => {
    const { data } = await supabase.from('liquidaciones').select(SELECT_LIQ).eq('id', id).single();
    await cargar();
    if (data) await abrir(data);
    onCambio?.();
  };

  // Guarda los totales (a favor, descuentos, neto) según los ítems activos.
  const guardarTotales = async (liqId) => {
    const { data: items } = await supabase.from('liquidacion_items').select('signo, valor, activo').eq('liquidacion_id', liqId);
    const t = totalesLiquidacion(items || []);
    await supabase.from('liquidaciones').update({ total_a_favor: t.aFavor, total_descuentos: t.descuentos, neto: t.neto }).eq('id', liqId).select('id');
  };

  const cambiarEstado = async (liq, estado, extra = {}) => {
    setTrabajando(true);
    setError('');
    const patch = { estado, ...extra };
    if (estado === 'Aprobada') { patch.aprobado_por = user.id; patch.aprobado_at = new Date().toISOString(); }
    const { data, error: e } = await supabase.from('liquidaciones').update(patch).eq('id', liq.id).select('id');
    setTrabajando(false);
    if (e || !data?.length) { setError(e?.message || 'No tienes permiso para cambiar esta liquidación.'); return; }
    await refrescar(liq.id);
  };

  const anular = async (liq) => {
    const motivo = window.prompt(`¿Anular la liquidación #${liq.numero}? Sus conceptos quedan libres para otra liquidación.\n\nMotivo:`);
    if (!motivo?.trim()) return;
    await cambiarEstado(liq, 'Anulada', { motivo_anulacion: motivo.trim() });
  };

  const quitarItem = async (item) => {
    if (!window.confirm(`¿Quitar "${item.concepto}" de la liquidación? Queda libre para otra.`)) return;
    setTrabajando(true);
    const { error: e } = await supabase.from('liquidacion_items').delete().eq('id', item.id).select('id');
    if (e) setError(e.message);
    await guardarTotales(abierta.liq.id);
    setTrabajando(false);
    await refrescar(abierta.liq.id);
  };

  const [ajuste, setAjuste] = useState(null); // { concepto, signo, valor, ceco }
  const agregarAjuste = async () => {
    const valor = Number(String(ajuste.valor).replace(/\./g, '').replace(',', '.'));
    if (!ajuste.concepto.trim() || !(valor > 0) || !ajuste.ceco) { setError('El ajuste necesita concepto, valor mayor a cero y CECO.'); return; }
    setTrabajando(true);
    const { error: e } = await supabase.from('liquidacion_items').insert({
      liquidacion_id: abierta.liq.id, orden: abierta.items.length + 1, entidad_clave: `ajuste:${crypto.randomUUID()}`, entidad_tipo: 'ajuste',
      concepto: ajuste.concepto.trim(), signo: Number(ajuste.signo), valor, ceco: ajuste.ceco, datos: ajuste.datos || {},
    }).select('id');
    if (e) { setError(e.message); setTrabajando(false); return; }
    await guardarTotales(abierta.liq.id);
    setAjuste(null);
    setTrabajando(false);
    await refrescar(abierta.liq.id);
  };

  // ---------- Pago ----------
  const [pago, setPago] = useState(null); // { cuenta, fecha, comprobante, cecos: { itemId: ceco } }
  const pagar = async () => {
    const { liq, items } = abierta;
    const bloqueo = bloqueoPago(liq, items);
    if (bloqueo) { setError(bloqueo); return; }
    if (!pago.cuenta || !pago.fecha) { setError('Elige la cuenta y la fecha del pago.'); return; }
    if (!pago.comprobante) { setError('Adjunta el comprobante del pago.'); return; }
    const pendientesSol = items.filter(i => i.activo && !i.pagado && i.entidad_tipo === 'solicitud');
    if (pendientesSol.some(i => !pago.cecos[i.id])) { setError('Elige el CECO de cada solicitud.'); return; }
    const mesLiq = `${liq.anio}-${String(liq.mes).padStart(2, '0')}`;
    if (items.some(i => i.activo && !i.pagado && i.entidad_tipo === 'presupuesto') && pago.fecha.substring(0, 7) !== mesLiq
      && !window.confirm(`La fecha de pago (${pago.fecha}) es de otro mes que la liquidación (${mesLiq}). En Presupuesto los honorarios / nómina quedan pagados en el mes de la fecha de pago. ¿Continuar?`)) return;
    setTrabajando(true);
    setError('');
    try {
      const r = await onPagar(liq, items, pago);
      if (!r.ok) setError(r.mensaje);
      else { setPago(null); alert(`✅ ${r.mensaje}`); }
    } catch (e) {
      setError(e.message || 'Error inesperado al pagar');
    }
    setTrabajando(false);
    await refrescar(liq.id);
  };

  // ---------- Nueva ----------
  const armarPropuesta = () => {
    const { responsableId, empresa, anio, mes } = nueva;
    if (!responsableId || !empresa) { setError('Elige el colaborador y la empresa que paga.'); return; }
    setError('');
    const p = construirPropuesta(responsableId, empresa, Number(anio), Number(mes));
    const marcados = {};
    p.solicitudes.forEach(s => { marcados[s.clave] = true; });
    p.presupuesto.forEach(x => { if (!x.bloqueo) marcados[x.clave] = true; });
    setNueva(n => ({ ...n, propuesta: p, marcados }));
  };

  const crear = async () => {
    const { responsableId, empresa, anio, mes, propuesta, marcados } = nueva;
    const empresaId = await resolverEmpresaId(empresa);
    if (!empresaId) { setError('No se encontró la empresa.'); return; }
    const filas = [
      ...propuesta.solicitudes.filter(s => marcados[s.clave]).map(s => ({
        entidad_clave: s.clave, entidad_tipo: 'solicitud', entidad_id: String(s.solicitud.id), concepto: s.concepto, signo: s.signo, valor: s.valor,
        datos: { tipo: s.solicitud.tipo, fecha: s.solicitud.fecha },
      })),
      ...propuesta.presupuesto.filter(x => marcados[x.clave]).map(x => ({
        entidad_clave: x.clave, entidad_tipo: 'presupuesto', entidad_id: String(x.item.id), concepto: `${x.item.tipo || 'Concepto'} — ${x.item.nombre}`,
        signo: 1, valor: x.neto, valor_bruto: x.bruto, deducciones: x.totalDeducciones || null, ceco: x.item.ceco || null,
        datos: { anio: Number(anio), mes: Number(mes), cuotas: x.cuotas },
      })),
      ...propuesta.anticipos.filter(a => marcados[`anticipo:${a.id}`]).map(a => ({
        entidad_clave: `ajuste:anticipo-${a.id}`, entidad_tipo: 'ajuste', entidad_id: String(a.id),
        concepto: `Descuento anticipo sin legalizar (${a.fecha})${a.detalle ? ` — ${a.detalle}` : ''}`, signo: -1, valor: Number(a.valor) || 0,
        ceco: nueva.cecoAnticipos || null, datos: { anticipo_id: a.id },
      })),
    ];
    if (!filas.length) { setError('Marca al menos un concepto.'); return; }
    if (filas.some(f => f.entidad_tipo === 'ajuste' && !f.ceco)) { setError('Elige el CECO para los descuentos de anticipos.'); return; }
    setTrabajando(true);
    setError('');
    const t = totalesLiquidacion(filas);
    const { data: liq, error: e1 } = await supabase.from('liquidaciones').insert({
      responsable_id: responsableId, empresa_id: empresaId, anio: Number(anio), mes: Number(mes), creado_por: user.id,
      total_a_favor: t.aFavor, total_descuentos: t.descuentos, neto: t.neto,
    }).select(SELECT_LIQ).single();
    if (e1) { setTrabajando(false); setError(e1.message); return; }
    const { error: e2 } = await supabase.from('liquidacion_items').insert(filas.map((f, i) => ({ ...f, liquidacion_id: liq.id, orden: i + 1 })));
    if (e2) {
      // No dejar una liquidación vacía: se anula y se explica (normalmente, un concepto ya tomado por otra).
      await supabase.from('liquidaciones').update({ estado: 'Anulada', motivo_anulacion: 'No se pudieron guardar sus conceptos' }).eq('id', liq.id);
      setTrabajando(false);
      setError(e2.code === '23505' ? 'Algún concepto ya está en otra liquidación vigente. Vuelve a armarla.' : e2.message);
      return;
    }
    setTrabajando(false);
    setNueva(null);
    await cargar();
    onCambio?.();
    await abrir(liq);
  };

  // ---------- PDF ----------
  const pdf = (liq, items) => {
    const empresa = liq.empresas?.nombre || '';
    const doc = new jsPDF();
    doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text(`Liquidación #${liq.numero}`, 14, 16);
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text(`${nombre(liq.responsable_id)} · ${empresa} · ${MESES[liq.mes - 1]} ${liq.anio} · ${liq.estado}`, 14, 23);
    doc.autoTable({
      startY: 29,
      head: [['Concepto', 'Detalle', 'A favor', 'Descuento']],
      body: items.filter(i => i.activo).map(i => [
        i.concepto,
        i.entidad_tipo === 'presupuesto' && Number(i.deducciones) > 0 ? `Bruto ${dinero(i.valor_bruto, empresa)} − deducciones ${dinero(i.deducciones, empresa)}` : '',
        Number(i.signo) === 1 ? dinero(i.valor, empresa) : '',
        Number(i.signo) === -1 ? dinero(i.valor, empresa) : '',
      ]),
      foot: [['', 'Totales', dinero(liq.total_a_favor, empresa), dinero(liq.total_descuentos, empresa)], ['', 'NETO A PAGAR', dinero(liq.neto, empresa), '']],
      styles: { fontSize: 8 }, headStyles: { fillColor: [184, 146, 61] }, footStyles: { fillColor: [245, 240, 228], textColor: 20, fontStyle: 'bold' },
    });
    if (liq.fecha_pago) doc.text(`Pagada el ${liq.fecha_pago}${liq.cuenta ? ` desde ${liq.cuenta}` : ''}.`, 14, doc.lastAutoTable.finalY + 8);
    doc.save(`Liquidacion_${liq.numero}_${nombre(liq.responsable_id).replace(/\s+/g, '_')}.pdf`);
  };

  const anios = [...new Set([new Date().getFullYear(), ...(lista || []).map(l => l.anio)])].sort((a, b) => b - a);
  const liq = abierta?.liq;
  const editable = puedeGestionar && liq && ESTADOS_EDITABLES.includes(liq.estado);
  const empresaAbierta = liq?.empresas?.nombre || '';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[240px] flex-1">
            <CardTitle className="flex items-center gap-2 text-lg"><Calculator size={18} className="text-primary" /> Liquidaciones</CardTitle>
            <CardDescription>
              Por colaborador y mes: reembolsos, legalizaciones, anticipos, comisiones y honorarios / nómina, menos préstamos y descuentos = neto a pagar.
              Al pagarla se registra en Finanzas un movimiento por cada concepto, con el comprobante.
            </CardDescription>
          </div>
          {puedeGestionar && (
            <Button size="sm" onClick={() => setNueva({ responsableId: '', empresa: empresas[0] || '', anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 })}>
              <Plus size={14} /> Nueva liquidación
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:px-6">
        <div className="flex flex-wrap gap-3">
          <div className="w-44"><Select aria-label="Estado" value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })}>
            <option value="">Todos los estados</option>{ESTADOS_LIQUIDACION.map(e => <option key={e}>{e}</option>)}
          </Select></div>
          {puedeGestionar && <div className="w-56"><Select aria-label="Colaborador" value={filtro.responsable} onChange={(e) => setFiltro({ ...filtro, responsable: e.target.value })}>
            <option value="">Todos los colaboradores</option>{colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select></div>}
          <div className="w-32"><Select aria-label="Año" value={filtro.anio} onChange={(e) => setFiltro({ ...filtro, anio: e.target.value })}>
            <option value="">Todos los años</option>{anios.map(a => <option key={a}>{a}</option>)}
          </Select></div>
        </div>
        {error && !abierta && !nueva && <p className="m-0 text-sm text-destructive">❌ {error}</p>}

        {lista === null ? (
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
        ) : (
          <Table fija>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>#</TableHead><TableHead>Colaborador</TableHead><TableHead>Empresa</TableHead><TableHead>Mes</TableHead>
                <TableHead className="text-right">A favor</TableHead><TableHead className="text-right">Descuentos</TableHead><TableHead className="text-right">Neto</TableHead>
                <TableHead>Estado</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No hay liquidaciones.</TableCell></TableRow>
              ) : visibles.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs font-bold">#{l.numero}</TableCell>
                  <TableCell className="text-xs">{nombre(l.responsable_id)}</TableCell>
                  <TableCell className="text-xs">{l.empresas?.nombre}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{MESES[l.mes - 1]} {l.anio}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs text-success">{dinero(l.total_a_favor, l.empresas?.nombre)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs text-destructive">{Number(l.total_descuentos) ? `− ${dinero(l.total_descuentos, l.empresas?.nombre)}` : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs font-bold">{dinero(l.neto, l.empresas?.nombre)}</TableCell>
                  <TableCell><Badge variant={VARIANTE[l.estado] || 'muted'}>{l.estado}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => abrir(l)}>Ver</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* NUEVA LIQUIDACIÓN */}
      {nueva && (
        <Dialog open onOpenChange={(a) => { if (!a) { setNueva(null); setError(''); } }}>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
            <DialogTitle>Nueva liquidación</DialogTitle>
            <DialogDescription>Elige el colaborador, la empresa que paga y el mes; el sistema trae todo lo pendiente.</DialogDescription>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="w-60"><Select aria-label="Colaborador" value={nueva.responsableId} onChange={(e) => setNueva({ ...nueva, responsableId: e.target.value, propuesta: null })}>
                <option value="">Colaborador…</option>{colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select></div>
              <div className="w-60"><Select aria-label="Empresa que paga" value={nueva.empresa} onChange={(e) => setNueva({ ...nueva, empresa: e.target.value, propuesta: null })}>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
              </Select></div>
              <div className="w-36"><Select aria-label="Mes" value={nueva.mes} onChange={(e) => setNueva({ ...nueva, mes: e.target.value, propuesta: null })}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select></div>
              <div className="w-24"><Input aria-label="Año" type="number" value={nueva.anio} onChange={(e) => setNueva({ ...nueva, anio: e.target.value, propuesta: null })} /></div>
              <Button variant="outline" onClick={armarPropuesta}><Calculator size={14} /> Traer pendientes</Button>
            </div>
            {error && <p className="m-0 mt-2 text-sm text-destructive">❌ {error}</p>}
            {nueva.propuesta && (() => {
              const p = nueva.propuesta;
              const marcar = (clave, v) => setNueva(n => ({ ...n, marcados: { ...n.marcados, [clave]: v } }));
              const filasTotales = [
                ...p.solicitudes.filter(s => nueva.marcados[s.clave]).map(s => ({ signo: s.signo, valor: s.valor })),
                ...p.presupuesto.filter(x => nueva.marcados[x.clave]).map(x => ({ signo: 1, valor: x.neto })),
                ...p.anticipos.filter(a => nueva.marcados[`anticipo:${a.id}`]).map(a => ({ signo: -1, valor: Number(a.valor) || 0 })),
              ];
              const t = totalesLiquidacion(filasTotales);
              const fila = (clave, texto, signo, valor, detalle, deshabilitado) => (
                <TableRow key={clave} className={deshabilitado ? 'opacity-60' : ''}>
                  <TableCell className="w-8"><input type="checkbox" aria-label={texto} disabled={deshabilitado} checked={!!nueva.marcados[clave]} onChange={(e) => marcar(clave, e.target.checked)} /></TableCell>
                  <TableCell className="text-xs"><div className="font-semibold">{texto}</div>{detalle && <div className="text-muted-foreground">{detalle}</div>}</TableCell>
                  <TableCell className={`whitespace-nowrap text-right text-xs font-bold ${signo === -1 ? 'text-destructive' : 'text-success'}`}>{signo === -1 ? '− ' : '+ '}{dinero(valor, nueva.empresa)}</TableCell>
                </TableRow>
              );
              return (
                <div className="mt-3 flex flex-col gap-3">
                  <Table>
                    <TableBody>
                      {p.solicitudes.map(s => fila(s.clave, s.concepto, s.signo, s.valor, `Solicitud del ${s.solicitud.fecha} · ${s.solicitud.estado}`))}
                      {p.presupuesto.map(x => fila(x.clave, `${x.item.tipo || 'Concepto'} — ${x.item.nombre}`, 1, x.neto,
                        [x.totalDeducciones > 0 ? `Bruto ${dinero(x.bruto, nueva.empresa)} − ${x.cuotas.map(c => `${c.tipo} ${dinero(c.cuota, nueva.empresa)}`).join(', ')}` : '', x.bloqueo ? `⛔ ${x.bloqueo}` : ''].filter(Boolean).join(' · '), !!x.bloqueo))}
                      {p.anticipos.map(a => fila(`anticipo:${a.id}`, `Descuento anticipo sin legalizar (${a.fecha})`, -1, Number(a.valor) || 0, `Debía legalizarse antes del ${a.legalizarAntes}. Se registra como ingreso.`))}
                      {!p.solicitudes.length && !p.presupuesto.length && !p.anticipos.length && (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No hay nada pendiente para este colaborador en esa empresa y mes.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {p.anticipos.some(a => nueva.marcados[`anticipo:${a.id}`]) && (
                    <div className="w-72"><Select aria-label="CECO descuentos" value={nueva.cecoAnticipos || ''} onChange={(e) => setNueva({ ...nueva, cecoAnticipos: e.target.value })}>
                      <option value="">CECO para los descuentos de anticipos…</option>{cecos.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                    </Select></div>
                  )}
                  {p.excluidas.length > 0 && (
                    <details className="text-xs text-muted-foreground"><summary>{p.excluidas.length} solicitud(es) que no entran</summary>
                      <ul className="m-0 pl-4">{p.excluidas.map(x => <li key={x.solicitud.id}>{x.solicitud.tipo} del {x.solicitud.fecha}: {x.motivo}</li>)}</ul>
                    </details>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-4 text-sm">
                    <span>A favor <b className="text-success">{dinero(t.aFavor, nueva.empresa)}</b></span>
                    <span>Descuentos <b className="text-destructive">{dinero(t.descuentos, nueva.empresa)}</b></span>
                    <span>Neto <b>{dinero(t.neto, nueva.empresa)}</b></span>
                    <Button disabled={trabajando || !filasTotales.length} onClick={crear}>{trabajando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Crear borrador</Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

      {/* DETALLE */}
      {abierta && (
        <Dialog open onOpenChange={(a) => { if (!a) { setAbierta(null); setPago(null); setAjuste(null); setError(''); } }}>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Liquidación #{liq.numero} <Badge variant={VARIANTE[liq.estado] || 'muted'}>{liq.estado}</Badge>
            </DialogTitle>
            <DialogDescription>{nombre(liq.responsable_id)} · {empresaAbierta} · {MESES[liq.mes - 1]} {liq.anio}{liq.motivo_anulacion ? ` · Anulada: ${liq.motivo_anulacion}` : ''}</DialogDescription>

            <Table className="mt-3">
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Concepto</TableHead><TableHead className="text-right">Valor</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {abierta.items.filter(i => i.activo).map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">
                      <div className="font-semibold">{i.concepto}{i.pagado && <span className="ml-1 text-success">✓ en Finanzas</span>}</div>
                      {i.entidad_tipo === 'presupuesto' && Number(i.deducciones) > 0 && (
                        <div className="text-muted-foreground">Bruto {dinero(i.valor_bruto, empresaAbierta)} − {(i.datos?.cuotas || []).map(c => `${c.tipo} ${dinero(c.cuota, empresaAbierta)}`).join(', ') || `deducciones ${dinero(i.deducciones, empresaAbierta)}`}</div>
                      )}
                      {i.error && <div className="text-destructive">⚠️ {i.error}</div>}
                      {pago && i.entidad_tipo === 'solicitud' && !i.pagado && (
                        <div className="mt-1 w-72"><Select aria-label="CECO" value={pago.cecos[i.id] || ''} onChange={(e) => setPago({ ...pago, cecos: { ...pago.cecos, [i.id]: e.target.value } })}>
                          <option value="">CECO…</option>{cecos.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                        </Select></div>
                      )}
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-right text-xs font-bold ${Number(i.signo) === -1 ? 'text-destructive' : 'text-success'}`}>{Number(i.signo) === -1 ? '− ' : '+ '}{dinero(i.valor, empresaAbierta)}</TableCell>
                    <TableCell className="w-10">{editable && !i.pagado && <Button size="icon" variant="ghost" className="text-destructive" title="Quitar" aria-label="Quitar" disabled={trabajando} onClick={() => quitarItem(i)}><Trash2 size={14} /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-2 flex flex-wrap justify-end gap-4 text-sm">
              <span>A favor <b className="text-success">{dinero(liq.total_a_favor, empresaAbierta)}</b></span>
              <span>Descuentos <b className="text-destructive">{dinero(liq.total_descuentos, empresaAbierta)}</b></span>
              <span>NETO A PAGAR <b>{dinero(liq.neto, empresaAbierta)}</b></span>
            </div>
            {liq.fecha_pago && <p className="m-0 text-xs text-muted-foreground">Pagada el {liq.fecha_pago}{liq.cuenta ? ` desde ${liq.cuenta}` : ''}. El comprobante quedó en cada movimiento de Finanzas.</p>}

            {ajuste && (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-solid border-border p-3">
                <div className="min-w-[200px] flex-1"><Input aria-label="Concepto" placeholder="Concepto del ajuste" value={ajuste.concepto} onChange={(e) => setAjuste({ ...ajuste, concepto: e.target.value })} /></div>
                <div className="w-40"><Select aria-label="Tipo" value={ajuste.signo} onChange={(e) => setAjuste({ ...ajuste, signo: e.target.value })}>
                  <option value="1">+ A su favor</option><option value="-1">− Descuento</option>
                </Select></div>
                <div className="w-36"><Input aria-label="Valor" placeholder="Valor" value={ajuste.valor} onChange={(e) => setAjuste({ ...ajuste, valor: e.target.value })} /></div>
                <div className="w-60"><Select aria-label="CECO" value={ajuste.ceco} onChange={(e) => setAjuste({ ...ajuste, ceco: e.target.value })}>
                  <option value="">CECO…</option>{cecos.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                </Select></div>
                <Button size="sm" disabled={trabajando} onClick={agregarAjuste}><Check size={14} /> Agregar</Button>
                <Button size="sm" variant="ghost" onClick={() => setAjuste(null)}><X size={14} /></Button>
              </div>
            )}

            {pago && (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border-2 border-solid border-primary p-3">
                <div className="w-60"><Select aria-label="Cuenta" value={pago.cuenta} onChange={(e) => setPago({ ...pago, cuenta: e.target.value })}>
                  <option value="">Cuenta de {empresaAbierta}…</option>{(cuentasPorEmpresa[empresaAbierta] || []).map(c => <option key={c}>{c}</option>)}
                </Select></div>
                <div className="w-40"><Input aria-label="Fecha de pago" type="date" value={pago.fecha} onChange={(e) => setPago({ ...pago, fecha: e.target.value })} /></div>
                <label className="cursor-pointer text-xs">
                  <span className="block font-semibold">Comprobante</span>
                  <input type="file" accept="image/*,application/pdf" onChange={async (e) => { const f = e.target.files[0]; if (f) setPago({ ...pago, comprobante: await leerArchivo(f) }); }} />
                </label>
                <Button disabled={trabajando} onClick={pagar}>{trabajando ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />} Registrar pago de {dinero(liq.neto, empresaAbierta)}</Button>
                <Button variant="ghost" onClick={() => setPago(null)}><X size={14} /></Button>
              </div>
            )}

            {error && <p className="m-0 mt-2 text-sm text-destructive">❌ {error}</p>}

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => pdf(liq, abierta.items)}><FileDown size={14} /> PDF</Button>
              {editable && <Button size="sm" variant="outline" onClick={() => setAjuste({ concepto: '', signo: '-1', valor: '', ceco: '' })}><Plus size={14} /> Ajuste</Button>}
              {puedeGestionar && liq.estado === 'Borrador' && <Button size="sm" variant="outline" disabled={trabajando} onClick={() => cambiarEstado(liq, 'En revisión')}><Send size={14} /> Enviar a revisión</Button>}
              {puedeGestionar && ESTADOS_EDITABLES.includes(liq.estado) && <Button size="sm" disabled={trabajando} onClick={() => cambiarEstado(liq, 'Aprobada')}><Check size={14} /> Aprobar</Button>}
              {puedeGestionar && liq.estado === 'Aprobada' && !abierta.items.some(i => i.pagado) && <Button size="sm" variant="ghost" disabled={trabajando} onClick={() => cambiarEstado(liq, 'Borrador')}><Undo2 size={14} /> Reabrir</Button>}
              {puedeGestionar && liq.estado === 'Aprobada' && !pago && <Button size="sm" variant="success" onClick={() => setPago({ cuenta: (cuentasPorEmpresa[empresaAbierta] || [])[0] || '', fecha: hoyBogota(), comprobante: null, cecos: {} })}><Wallet size={14} /> Pagar</Button>}
              {puedeGestionar && !['Pagada', 'Anulada'].includes(liq.estado) && !abierta.items.some(i => i.pagado) && <Button size="sm" variant="ghost" className="text-destructive" disabled={trabajando} onClick={() => anular(liq)}><X size={14} /> Anular</Button>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default LiquidacionesView;
