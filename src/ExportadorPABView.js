import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { supabase } from './supabaseClient';
import {
  construirCandidatosPAB, construirEncabezadoPAB, problemasEncabezadoPAB, generarArchivoPAB,
  descripcionLotePAB, totalesPAB, nombreArchivoPAB, TIPOS_PAGO_PAB, nombreBancoCorto
} from './exportPAB';

// Pantalla "💸 Pagos PAB" (Administrador / Coordinadora Administrativa).
// 1) Arma, para una empresa y su cuenta origen, todo lo APROBADO que se puede pagar:
//    Presupuesto (Nómina 225 / Honorarios 220, del mes elegido) y Solicitudes (Reembolso y
//    Anticipo 220, Pago a Tercero 238 en COP). Lo que no se puede exportar sale con el motivo.
// 2) Vista previa por tipo de pago con cantidad y total; "Generar" crea un lote por grupo en la
//    BD (que bloquea pagos duplicados) y descarga el Excel con la plantilla oficial del banco.
// 3) Historial de lotes: volver a descargar, marcar pagado o anular (anular solo Administrador).
// La app NUNCA envía nada al banco: solo genera el archivo para el Conversor de pagos.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const card = { backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '10px', border: '1px solid #E6E0D2', boxShadow: '0 1px 4px rgba(34,30,21,0.05)', marginBottom: '1.5rem' };
const input = { padding: '0.6rem', backgroundColor: '#F8F6F1', border: '1px solid #E6E0D2', borderRadius: '4px', color: '#332D1E' };
const label = { display: 'block', color: '#6B6458', fontSize: '0.75rem', marginBottom: '0.3rem' };
const th = { textAlign: 'left', padding: '0.5rem', color: '#C4A747', fontSize: '0.75rem', borderBottom: '2px solid #C4A747' };
const td = { padding: '0.5rem', fontSize: '0.8rem', borderBottom: '1px solid #E6E0D2', verticalAlign: 'top' };

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const descargarBytes = (bytes, nombre) => {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
};

let plantillaCache = null;
const cargarPlantilla = async () => {
  if (plantillaCache) return plantillaCache;
  const resp = await fetch(`${process.env.PUBLIC_URL || ''}/plantillas/FORMATOPAB_CONVERSORPAGOS.xlsx`);
  if (!resp.ok) throw new Error('No se pudo cargar la plantilla oficial del banco');
  plantillaCache = await resp.arrayBuffer();
  return plantillaCache;
};

const ExportadorPABView = ({
  user, empresas, solicitudes, presupuestoDetalle, filtroPresupuesto, setFiltroPresupuesto,
  usuarios, terceros, lotes, lotePorClave, onRecargarLotes, onRecargarDatos, getMoneda, formatCOP
}) => {
  const esAdmin = user?.rol === 'Administrador';
  const [configs, setConfigs] = useState([]);
  const [errorConfigs, setErrorConfigs] = useState('');
  const [configId, setConfigId] = useState('');
  const [fechaAplicacion, setFechaAplicacion] = useState(hoyLocal());
  const [deseleccionados, setDeseleccionados] = useState([]);
  const [mostrarBloqueados, setMostrarBloqueados] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [trabajandoLote, setTrabajandoLote] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('config_bancaria_empresa')
        .select('id, nombre_cuenta, nit_pagador, numero_cuenta, tipo_cuenta, tipo_pago_nomina, tipo_pago_proveedores, tipo_pago_terceros, activo, empresas ( nombre )')
        .eq('activo', true);
      if (error) { setErrorConfigs(error.message); return; }
      setConfigs((data || []).map(c => ({ ...c, empresa: c.empresas?.nombre || '' })));
    })();
  }, []);

  const empresa = filtroPresupuesto.empresa;
  const configsEmpresa = configs.filter(c => c.empresa === empresa);
  const config = configsEmpresa.find(c => c.id === configId) || configsEmpresa[0] || null;
  const problemasConfig = problemasEncabezadoPAB(config);

  const candidatos = useMemo(() => construirCandidatosPAB({
    empresa, config, anio: filtroPresupuesto.anio, mes: filtroPresupuesto.mes, fechaAplicacion,
    presupuestoDetalle, solicitudes, usuarios, terceros, lotePorClave, getMoneda
  }), [empresa, config, filtroPresupuesto.anio, filtroPresupuesto.mes, fechaAplicacion, presupuestoDetalle, solicitudes, usuarios, terceros, lotePorClave, getMoneda]);

  const exportables = candidatos.filter(c => c.bloqueos.length === 0);
  const bloqueados = candidatos.filter(c => c.bloqueos.length > 0);
  const seleccionados = exportables.filter(c => !deseleccionados.includes(c.clave));
  const grupos = Object.entries(seleccionados.reduce((acc, c) => {
    (acc[c.tipoPago] = acc[c.tipoPago] || []).push(c);
    return acc;
  }, {})).map(([tipoPago, items]) => ({ tipoPago: Number(tipoPago), items, ...totalesPAB(items.map(i => i.fila)) }))
    .sort((a, b) => a.tipoPago - b.tipoPago);
  const totalGeneral = grupos.reduce((s, g) => s + g.total, 0);

  const cambiarFiltro = (patch) => { setDeseleccionados([]); setFiltroPresupuesto({ ...filtroPresupuesto, ...patch }); };
  const alternar = (clave) => setDeseleccionados(prev => prev.includes(clave) ? prev.filter(x => x !== clave) : [...prev, clave]);

  const handleGenerar = async () => {
    if (generando || grupos.length === 0 || problemasConfig.length > 0) return;
    if (!window.confirm(
      `Se van a generar ${grupos.length} archivo(s) PAB de ${empresa} desde ${config.nombre_cuenta}:\n\n`
      + grupos.map(g => `• ${g.tipoPago} – ${TIPOS_PAGO_PAB[g.tipoPago] || ''}: ${g.cantidad} pago(s) por ${formatCOP(g.total)}`).join('\n')
      + `\n\nFecha de aplicación: ${fechaAplicacion}\nEstos registros quedarán marcados como EXPORTADOS y no se podrán volver a exportar mientras el lote esté vigente.\n\n¿Continuar?`
    )) return;
    setGenerando(true);
    const generados = [];
    try {
      const plantilla = await cargarPlantilla();
      for (const g of grupos) {
        const encabezadoBase = construirEncabezadoPAB({ config, tipoPago: g.tipoPago, secuencia: '', descripcion: descripcionLotePAB(g.tipoPago, filtroPresupuesto.anio, filtroPresupuesto.mes) });
        const items = g.items.map((c, i) => ({
          orden: i + 1, entidad_clave: c.clave, entidad_tipo: c.entidadTipo, entidad_id: c.entidadId,
          anio: c.anio, mes: c.mes, valor: c.fila.valor, datos: c.fila
        }));
        const { data, error } = await supabase.rpc('crear_lote_pago_banco', {
          p_config_id: config.id, p_tipo_pago: g.tipoPago, p_fecha: fechaAplicacion, p_encabezado: encabezadoBase, p_items: items
        });
        if (error || !data || !data[0]) throw new Error(error?.message || 'La base de datos no devolvió el lote creado');
        const { numero, secuencia } = data[0];
        const bytes = await generarArchivoPAB(JSZip, plantilla, { ...encabezadoBase, secuencia }, g.items.map(c => c.fila));
        descargarBytes(bytes, nombreArchivoPAB({ empresa, tipoPago: g.tipoPago, fechaAplicacion, numeroLote: numero }));
        generados.push(`#${numero} (${secuencia})`);
      }
      alert(`✅ Generado(s) ${generados.length} archivo(s): lote ${generados.join(', ')}.\nPásalo(s) por el Conversor de pagos de Bancolombia y súbelo(s) a la Sucursal Virtual.`);
    } catch (e) {
      console.error('Error generando PAB:', e);
      alert(`❌ ${e.message}${generados.length ? `\n\nAlcanzaron a generarse: lote ${generados.join(', ')}.` : '\n\nNo se generó ningún archivo.'}`);
    } finally {
      setGenerando(false);
      setDeseleccionados([]);
      await onRecargarLotes();
    }
  };

  const handleRedescargar = async (lote) => {
    setTrabajandoLote(lote.id);
    try {
      const plantilla = await cargarPlantilla();
      const filas = [...(lote.lotes_pago_banco_items || [])].sort((a, b) => a.orden - b.orden).map(i => i.datos);
      const bytes = await generarArchivoPAB(JSZip, plantilla, lote.encabezado, filas);
      descargarBytes(bytes, nombreArchivoPAB({ empresa: lote.empresas?.nombre, tipoPago: lote.tipo_pago, fechaAplicacion: lote.fecha_aplicacion, numeroLote: lote.numero }));
    } catch (e) {
      alert('❌ ' + e.message);
    } finally {
      setTrabajandoLote(null);
    }
  };

  const handleCerrar = async (lote, estado) => {
    let motivo = null;
    if (estado === 'Anulado') {
      motivo = window.prompt(`Anular el lote #${lote.numero}: sus ${lote.cantidad} registro(s) quedarán libres para exportarse de nuevo. Úsalo solo si el archivo NO se pagó en el banco.\n\nMotivo:`);
      if (motivo === null) return;
    } else if (!window.confirm(`¿Marcar el lote #${lote.numero} como pagado en el banco?`)) {
      return;
    }
    setTrabajandoLote(lote.id);
    const { error } = await supabase.rpc('cerrar_lote_pago_banco', { p_lote_id: lote.id, p_estado: estado, p_motivo: motivo });
    setTrabajandoLote(null);
    if (error) { alert('❌ ' + error.message); return; }
    await onRecargarLotes();
  };

  const filaCandidato = (c, conCheck) => (
    <tr key={c.clave} style={{ opacity: c.bloqueos.length ? 0.75 : 1 }}>
      <td style={td}>{conCheck && <input type="checkbox" checked={!deseleccionados.includes(c.clave)} onChange={() => alternar(c.clave)} />}</td>
      <td style={td}>{c.origen}<div style={{ color: '#8F8877', fontSize: '0.7rem' }}>{c.etiqueta}</div></td>
      <td style={td}>{c.fila.nombre || '—'}<div style={{ color: '#8F8877', fontSize: '0.7rem' }}>{c.fila.documento}</div></td>
      <td style={td}>{nombreBancoCorto(c.fila.codigoBanco) || '—'}<div style={{ color: '#8F8877', fontSize: '0.7rem' }}>{c.fila.cuenta} {c.fila.tipoTransaccion === 37 ? '(Ahorros)' : c.fila.tipoTransaccion === 27 ? '(Corriente)' : ''}</div></td>
      <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>{formatCOP(c.fila.valor || 0)}</td>
      <td style={{ ...td, color: c.bloqueos.length ? '#CC4B4B' : '#2F9E52', fontSize: '0.72rem' }}>{c.bloqueos.length ? c.bloqueos.join(' · ') : 'Listo'}</td>
    </tr>
  );

  return (
    <div>
      <div style={card}>
        <h2 style={{ color: '#C4A747', margin: '0 0 0.25rem 0' }}>💸 Pagos masivos Bancolombia (PAB)</h2>
        <p style={{ color: '#8F8877', fontSize: '0.8rem', margin: '0 0 1.25rem 0' }}>
          Genera el Excel con la plantilla oficial del banco para pasarlo por el Conversor de pagos. Solo entra lo Aprobado; la app no envía nada al banco.
        </p>
        {errorConfigs && <p style={{ color: '#CC4B4B', fontSize: '0.85rem' }}>⚠️ No se pudo leer la configuración bancaria: {errorConfigs}</p>}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={label}>Empresa</label>
            <select value={empresa} onChange={(e) => { setConfigId(''); cambiarFiltro({ empresa: e.target.value }); }} style={input}>
              {empresas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Cuenta origen</label>
            <select value={config?.id || ''} onChange={(e) => setConfigId(e.target.value)} style={input} disabled={configsEmpresa.length === 0}>
              {configsEmpresa.length === 0 ? <option value="">Sin cuenta configurada</option> : configsEmpresa.map(c => <option key={c.id} value={c.id}>{c.nombre_cuenta} — {c.numero_cuenta}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Mes de Nómina / Honorarios</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <select value={filtroPresupuesto.mes} onChange={(e) => cambiarFiltro({ mes: Number(e.target.value) })} style={input}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <input type="number" value={filtroPresupuesto.anio} onChange={(e) => cambiarFiltro({ anio: Number(e.target.value) })} style={{ ...input, width: '90px' }} />
            </div>
          </div>
          <div>
            <label style={label}>Fecha de aplicación</label>
            <input type="date" value={fechaAplicacion} onChange={(e) => setFechaAplicacion(e.target.value)} style={input} />
          </div>
          <button onClick={onRecargarDatos} style={{ ...input, cursor: 'pointer', fontWeight: 'bold', color: '#6B6458' }}>🔄 Actualizar datos</button>
        </div>
        {problemasConfig.length > 0 && (
          <p style={{ color: '#CC4B4B', fontSize: '0.85rem', marginTop: '1rem' }}>⛔ {problemasConfig.join(' · ')}. Configúrala en 🏦 Datos Bancarios.</p>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ color: '#221E15', margin: 0 }}>Vista previa — {seleccionados.length} pago(s) por {formatCOP(totalGeneral)}</h3>
          <button disabled={generando || grupos.length === 0 || problemasConfig.length > 0} onClick={handleGenerar}
            style={{ padding: '0.75rem 1.25rem', backgroundColor: grupos.length && !problemasConfig.length ? '#2F9E52' : '#E6E0D2', color: grupos.length && !problemasConfig.length ? '#FFFFFF' : '#8F8877', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: generando ? 'wait' : 'pointer' }}>
            {generando ? '⏳ Generando…' : `⬇️ Generar ${grupos.length || ''} archivo(s) PAB`}
          </button>
        </div>
        {grupos.length === 0 && <p style={{ color: '#8F8877', fontSize: '0.85rem' }}>No hay pagos listos para exportar con estos filtros.</p>}
        {grupos.map(g => (
          <div key={g.tipoPago} style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ color: '#C4A747', margin: '0 0 0.5rem 0' }}>
              {g.tipoPago} – {TIPOS_PAGO_PAB[g.tipoPago] || 'Tipo de pago'} · {g.cantidad} pago(s) · {formatCOP(g.total)}
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}></th><th style={th}>Origen</th><th style={th}>Beneficiario</th><th style={th}>Banco / cuenta</th><th style={{ ...th, textAlign: 'right' }}>Valor</th><th style={th}>Estado</th></tr></thead>
                <tbody>{exportables.filter(c => c.tipoPago === g.tipoPago).map(c => filaCandidato(c, true))}</tbody>
              </table>
            </div>
          </div>
        ))}
        {exportables.filter(c => deseleccionados.includes(c.clave)).length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ color: '#8F8877', margin: '0 0 0.5rem 0' }}>Desmarcados (no se exportarán)</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{exportables.filter(c => deseleccionados.includes(c.clave)).map(c => filaCandidato(c, true))}</tbody></table>
          </div>
        )}
        {bloqueados.length > 0 && (
          <div>
            <button onClick={() => setMostrarBloqueados(!mostrarBloqueados)} style={{ background: 'none', border: 'none', color: '#CC4B4B', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
              {mostrarBloqueados ? '▾' : '▸'} {bloqueados.length} registro(s) que no se pueden exportar (ver motivo)
            </button>
            {mostrarBloqueados && (
              <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}></th><th style={th}>Origen</th><th style={th}>Beneficiario</th><th style={th}>Banco / cuenta</th><th style={{ ...th, textAlign: 'right' }}>Valor</th><th style={th}>Motivo</th></tr></thead>
                  <tbody>{bloqueados.map(c => filaCandidato(c, false))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ color: '#221E15', margin: '0 0 1rem 0' }}>📦 Lotes generados</h3>
        {lotes.length === 0 ? <p style={{ color: '#8F8877', fontSize: '0.85rem' }}>Todavía no hay lotes.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Lote</th><th style={th}>Empresa / cuenta</th><th style={th}>Tipo</th><th style={th}>Aplicación</th><th style={{ ...th, textAlign: 'right' }}>Pagos</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={th}>Estado</th><th style={th}></th></tr></thead>
              <tbody>
                {lotes.map(l => (
                  <tr key={l.id} style={{ opacity: l.estado === 'Anulado' ? 0.55 : 1 }}>
                    <td style={td}><strong>#{l.numero}</strong> ({l.secuencia})<div style={{ color: '#8F8877', fontSize: '0.7rem' }}>{new Date(l.created_at).toLocaleString('es-CO')}</div></td>
                    <td style={td}>{l.empresas?.nombre}<div style={{ color: '#8F8877', fontSize: '0.7rem' }}>{l.config_bancaria_empresa?.nombre_cuenta}</div></td>
                    <td style={td}>{l.tipo_pago} – {TIPOS_PAGO_PAB[l.tipo_pago] || ''}</td>
                    <td style={td}>{l.fecha_aplicacion}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.cantidad}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>{formatCOP(parseFloat(l.total) || 0)}</td>
                    <td style={{ ...td, color: l.estado === 'Pagado' ? '#2F9E52' : l.estado === 'Anulado' ? '#CC4B4B' : '#D6A419', fontWeight: 'bold' }}>
                      {l.estado}{l.motivo_anulacion && <div style={{ color: '#8F8877', fontWeight: 'normal', fontSize: '0.7rem' }}>{l.motivo_anulacion}</div>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <button disabled={trabajandoLote === l.id} onClick={() => handleRedescargar(l)} title="Volver a descargar el mismo archivo" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>⬇️</button>
                      {l.estado === 'Generado' && <button disabled={trabajandoLote === l.id} onClick={() => handleCerrar(l, 'Pagado')} title="Marcar como pagado en el banco" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✅</button>}
                      {l.estado === 'Generado' && esAdmin && <button disabled={trabajandoLote === l.id} onClick={() => handleCerrar(l, 'Anulado')} title="Anular (libera los registros)" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🚫</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ color: '#8F8877', fontSize: '0.75rem', margin: '0.75rem 0 0 0' }}>
          ✅ marca el lote como pagado en el banco (los registros siguen bloqueados para no exportarlos dos veces; su pago en la app se registra como siempre: Confirmar Pago en Solicitudes / Marcar Pagado en Presupuesto). 🚫 Anular solo si el archivo no se pagó.
        </p>
      </div>
    </div>
  );
};

export default ExportadorPABView;
