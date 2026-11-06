import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputMoneda } from '@/components/ui/input-moneda';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import CabeceraOrdenUI from './components/CabeceraOrden';
import { TIPOS_APLICACION_MANUAL, aplicacionesDe, historialDeduccion, resumenDeduccion, ordenarPor, alternarOrden } from './deducciones';

// Historial de UNA deducción (Presupuesto → Deducciones → 📜): resumen, mes a mes (descontada /
// pagado sin descuento / sin pago / pendiente + proyección), abonos y condonaciones, y Excel.

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const nombreMes = (anio, mes) => `${MESES[mes - 1]} ${anio}`;
const ESTADOS = {
  descontada: { texto: '✅ Descontada', variante: 'success' },
  'sin descuento': { texto: '⚠️ Pagado sin descuento', variante: 'warning' },
  'sin pago': { texto: '⚠️ Sin pago', variante: 'muted' },
  pendiente: { texto: '⏳ Pendiente', variante: 'info' },
  abono: { texto: 'Abono', variante: 'default' },
};
const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

export default function DeduccionHistorial({ deduccion, nombre, aplicaciones, mesesConPago, hoy, formatMoney, puedeEditar, onRegistrar, onEliminar }) {
  const [orden, setOrden] = useState(null);
  const [form, setForm] = useState({ tipo: 'Abono extra', valor: '', fecha: hoyISO(), observaciones: '' });
  const [guardando, setGuardando] = useState(false);

  const disponible = Array.isArray(aplicaciones);
  const resumen = useMemo(() => resumenDeduccion(deduccion, aplicaciones || [], hoy), [deduccion, aplicaciones, hoy]);
  const filas = useMemo(() => historialDeduccion(deduccion, aplicaciones || [], { hoy, mesesConPago }), [deduccion, aplicaciones, hoy, mesesConPago]);
  const manuales = useMemo(() => aplicacionesDe(aplicaciones, deduccion.id).filter(a => a.tipo !== 'Cuota'), [aplicaciones, deduccion.id]);
  const esPrestamo = deduccion.tipo === 'Préstamo';

  const filasOrdenadas = useMemo(() => ordenarPor(filas, orden, (f, campo) => (
    campo === 'mes' ? f.anio * 12 + f.mes : campo === 'estado' ? f.estado : Number(f[campo]) || 0
  )), [filas, orden]);
  const ordenar = (campo) => setOrden(o => alternarOrden(o, campo, campo === 'estado' ? 'asc' : 'desc'));

  if (!disponible) {
    return <p className="m-0 text-sm text-muted-foreground">El historial real aún no está activo (falta correr el SQL <code>20261106_deduccion_aplicaciones.sql</code>). Mientras tanto el saldo se calcula por calendario.</p>;
  }

  const exportarExcel = () => {
    const datos = filas.map(f => ({
      Mes: nombreMes(f.anio, f.mes),
      Estado: ESTADOS[f.estado]?.texto.replace(/^\S+\s/, '') || f.estado,
      Descontado: f.estado === 'pendiente' ? 0 : f.valor,
      'Cuota proyectada': f.estado === 'pendiente' ? f.valor : 0,
      'Abonos / condonaciones': f.manual,
      ...(esPrestamo ? { 'Saldo después': f.saldoDespues } : {}),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(datos), 'Historial');
    if (manuales.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(manuales.map(a => ({ Fecha: a.fecha, Tipo: a.tipo, Valor: a.valor, Observaciones: a.observaciones }))), 'Abonos');
    }
    XLSX.writeFile(wb, `Deduccion_${(nombre || 'concepto').replace(/[^\w]+/g, '_')}_${deduccion.tipo.replace(/[^\w]+/g, '_')}.xlsx`);
  };

  const registrar = async () => {
    setGuardando(true);
    const ok = await onRegistrar(deduccion, form);
    setGuardando(false);
    if (ok) setForm(f => ({ ...f, valor: '', observaciones: '' }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="success">Descontado: {formatMoney(resumen.totalDescontado)}</Badge>
        <Badge variant="muted">Cuotas hechas: {resumen.cuotasHechas}{esPrestamo && resumen.cuotasTotales ? ` de ${resumen.cuotasTotales}` : ''}</Badge>
        {resumen.totalManual > 0 && <Badge variant="default">Abonos / condonaciones: {formatMoney(resumen.totalManual)}</Badge>}
        {esPrestamo && <Badge variant={resumen.pagado ? 'success' : 'info'}>Saldo real: {formatMoney(resumen.saldoReal)}</Badge>}
        {esPrestamo && !resumen.pagado && <Badge variant="info">Faltan {resumen.cuotasFaltantes} cuota{resumen.cuotasFaltantes === 1 ? '' : 's'}{resumen.finEstimado ? ` · termina ~${nombreMes(resumen.finEstimado.anio, resumen.finEstimado.mes)}` : ''}</Badge>}
        <Button size="sm" variant="outline" onClick={exportarExcel}><FileSpreadsheet size={14} /> Excel</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <CabeceraOrdenUI orden={orden} onOrdenar={ordenar} campo="mes">Mes</CabeceraOrdenUI>
            <CabeceraOrdenUI orden={orden} onOrdenar={ordenar} campo="estado">Estado</CabeceraOrdenUI>
            <CabeceraOrdenUI orden={orden} onOrdenar={ordenar} campo="valor" className="text-right" alinear="end">Cuota</CabeceraOrdenUI>
            <CabeceraOrdenUI orden={orden} onOrdenar={ordenar} campo="manual" className="text-right" alinear="end">Abonos</CabeceraOrdenUI>
            {esPrestamo && <CabeceraOrdenUI orden={orden} onOrdenar={ordenar} campo="saldoDespues" className="text-right" alinear="end">Saldo después</CabeceraOrdenUI>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filasOrdenadas.length === 0 ? (
            <TableRow className="hover:bg-transparent"><TableCell colSpan={esPrestamo ? 5 : 4} className="py-6 text-center text-muted-foreground">Sin meses para mostrar.</TableCell></TableRow>
          ) : filasOrdenadas.map(f => (
            <TableRow key={`${f.anio}-${f.mes}`} className={f.estado === 'pendiente' ? 'opacity-70' : undefined}>
              <TableCell className="whitespace-nowrap">{nombreMes(f.anio, f.mes)}</TableCell>
              <TableCell><Badge variant={ESTADOS[f.estado]?.variante || 'muted'}>{ESTADOS[f.estado]?.texto || f.estado}</Badge></TableCell>
              <TableCell className="whitespace-nowrap text-right">{f.valor > 0 ? formatMoney(f.valor) : '—'}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{f.manual > 0 ? formatMoney(f.manual) : '—'}</TableCell>
              {esPrestamo && <TableCell className="whitespace-nowrap text-right font-bold">{formatMoney(f.saldoDespues)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {manuales.length > 0 && (
        <div className="flex flex-col gap-2">
          <h5 className="m-0 text-sm font-bold">Abonos, condonaciones y ajustes</h5>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Observaciones</TableHead>
                {puedeEditar && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {manuales.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap">{a.fecha}</TableCell>
                  <TableCell>{a.tipo}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatMoney(a.valor)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.observaciones || '—'}</TableCell>
                  {puedeEditar && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onEliminar(a)} title="Eliminar" aria-label="Eliminar" className="text-destructive"><Trash2 size={16} /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {puedeEditar && (
        <div className="flex flex-wrap items-end gap-3">
          <Select aria-label="Tipo de movimiento" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-auto">
            {TIPOS_APLICACION_MANUAL.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <InputMoneda aria-label="Valor" placeholder="Valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-40" />
          <Input aria-label="Fecha" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="w-auto" />
          <Input aria-label="Observaciones" placeholder={form.tipo === 'Condonación' ? 'Motivo (obligatorio)' : 'Observaciones'} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className="min-w-[200px] flex-1" />
          <Button size="sm" onClick={registrar} disabled={guardando}><Plus size={14} /> Registrar</Button>
        </div>
      )}
      {puedeEditar && <p className="m-0 text-xs text-muted-foreground">Las cuotas se registran solas al pagar el concepto (Presupuesto, PAB, Liquidaciones o Finanzas). Un abono extra baja el saldo; el dinero recibido regístralo en Finanzas como siempre.</p>}
    </div>
  );
}
