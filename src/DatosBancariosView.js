import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { SelectBanco, SelectTipoDocumento } from './CamposBancarios';
import {
  CODIGO_BANCO_EXTERIOR, problemasDatosBancarios, limpiarNumeroCuenta, limpiarDocumento,
  nombreBancoPorCodigo
} from './datosBancarios';

// Pantalla "🏦 Datos Bancarios" (Administrador / Coordinadora Administrativa):
//  1) Cuentas origen de cada empresa para el pago masivo PAB (solo el Administrador edita).
//  2) Colaboradores y terceros con datos bancarios incompletos, editables aquí mismo, para
//     dejar todo listo antes de exportar el primer lote.

// Hoja "Listas" (CLASESDEPAGOS) de la plantilla, con el texto de su ayuda en la celda B2.
const CLASES_DE_PAGO = [
  { codigo: 220, nombre: '220 – Pago a Proveedores' },
  { codigo: 225, nombre: '225 – Pago de Nómina' },
  { codigo: 238, nombre: '238 – Pagos a Terceros' },
  { codigo: 239, nombre: '239 – Abono Obligaciones con el Bco' },
  { codigo: 240, nombre: '240 – Pagos Cuenta Maestra' },
  { codigo: 250, nombre: '250 – Subsidios' },
  { codigo: 320, nombre: '320 – Credipago a Proveedores' },
  { codigo: 325, nombre: '325 – Credipago Nómina' },
  { codigo: 820, nombre: '820 – Pago Nómina Efectivo' },
  { codigo: 920, nombre: '920 – Pago Proveedores Efectivo' }
];

// Usuarios de relleno que no son personas a las que se les pague.
const USUARIOS_EXCLUIDOS = ['Por Definir'];

const card = { backgroundColor: '#FFFFFF', padding: '2rem', borderRadius: '10px', border: '1px solid #E6E0D2', boxShadow: '0 1px 4px rgba(34,30,21,0.05)', marginBottom: '2rem' };
const inputSm = { width: '100%', padding: '0.4rem 0.6rem', backgroundColor: '#F8F6F1', border: '1px solid #E6E0D2', borderRadius: '3px', color: '#332D1E', boxSizing: 'border-box', fontSize: '0.8rem' };
const th = { textAlign: 'left', padding: '0.6rem', color: '#C4A747', fontSize: '0.8rem' };
const td = { padding: '0.5rem', verticalAlign: 'top' };

const configVacia = { id: null, empresa: '', nombreCuenta: '', nitPagador: '', numeroCuenta: '', tipoCuenta: 'S', tipoPagoNomina: 225, tipoPagoProveedores: 220, tipoPagoTerceros: 238, activo: true };

const DatosBancariosView = ({ user, usuarios, terceros, cuentasPorEmpresa, nitEmpresas, onUsuariosCambiaron, onActualizarTercero }) => {
  const esAdmin = user?.rol === 'Administrador';
  const [configs, setConfigs] = useState([]);
  const [errorConfig, setErrorConfig] = useState('');
  const [form, setForm] = useState(configVacia);
  const [guardando, setGuardando] = useState(false);
  const [mostrarCompletos, setMostrarCompletos] = useState(false);

  const cargarConfigs = async () => {
    const { data, error } = await supabase
      .from('config_bancaria_empresa')
      .select('id, nombre_cuenta, nit_pagador, numero_cuenta, tipo_cuenta, tipo_pago_nomina, tipo_pago_proveedores, tipo_pago_terceros, activo, empresas ( nombre )')
      .order('nombre_cuenta');
    if (error) {
      console.error('Error cargando config_bancaria_empresa:', error);
      setErrorConfig(error.message);
      return;
    }
    setErrorConfig('');
    setConfigs(data || []);
  };

  useEffect(() => { cargarConfigs(); }, []);

  const handleGuardarConfig = async () => {
    const nit = limpiarDocumento(form.nitPagador, 3);
    const cuenta = limpiarNumeroCuenta(form.numeroCuenta);
    if (!form.empresa || !form.nombreCuenta) return alert('Elige la empresa y la cuenta');
    if (!/^\d{1,15}$/.test(nit)) return alert('NIT pagador: solo números, sin dígito de verificación (máx. 15)');
    if (!/^\d{6,11}$/.test(cuenta)) return alert('Número de cuenta a debitar: solo números, entre 6 y 11 dígitos (regla de la plantilla PAB)');
    setGuardando(true);
    try {
      const { data: emp, error: errEmp } = await supabase.from('empresas').select('id').eq('nombre', form.empresa).single();
      if (errEmp || !emp) return alert('❌ No se encontró la empresa: ' + (errEmp?.message || form.empresa));
      const payload = {
        empresa_id: emp.id,
        nombre_cuenta: form.nombreCuenta,
        nit_pagador: nit,
        numero_cuenta: cuenta,
        tipo_cuenta: form.tipoCuenta,
        tipo_pago_nomina: Number(form.tipoPagoNomina),
        tipo_pago_proveedores: Number(form.tipoPagoProveedores),
        tipo_pago_terceros: Number(form.tipoPagoTerceros),
        activo: form.activo,
        actualizado_por: user.id,
        actualizado_at: new Date().toISOString()
      };
      const q = form.id
        ? supabase.from('config_bancaria_empresa').update(payload).eq('id', form.id).select('id')
        : supabase.from('config_bancaria_empresa').insert(payload).select('id');
      const { data, error } = await q;
      if (error || !data || data.length === 0) {
        return alert('❌ No se pudo guardar' + (error ? ': ' + error.message : ' (sin permiso)'));
      }
      setForm(configVacia);
      await cargarConfigs();
    } finally {
      setGuardando(false);
    }
  };

  const editarConfig = (c) => setForm({
    id: c.id, empresa: c.empresas?.nombre || '', nombreCuenta: c.nombre_cuenta, nitPagador: c.nit_pagador,
    numeroCuenta: c.numero_cuenta, tipoCuenta: c.tipo_cuenta, tipoPagoNomina: c.tipo_pago_nomina,
    tipoPagoProveedores: c.tipo_pago_proveedores, tipoPagoTerceros: c.tipo_pago_terceros, activo: c.activo !== false
  });

  // ---- Beneficiarios ----
  const filas = [
    ...usuarios.filter(u => !USUARIOS_EXCLUIDOS.includes(u.nombre)).map(u => ({
      origen: 'Colaborador', id: u.id, nombre: u.nombre, tipoDocumento: u.tipoDocumento, documento: u.cedula,
      codigoBanco: u.codigoBanco, bancoTexto: u.banco, tipoCuenta: u.tipoCuentaBancaria, numeroCuenta: u.numeroCuenta
    })),
    ...terceros.filter(t => t.activo !== false).map(t => ({
      origen: 'Tercero', id: t.id, nombre: t.nombre, tipoDocumento: t.tipo_documento, documento: t.dni,
      codigoBanco: t.codigo_banco, bancoTexto: t.banco, tipoCuenta: t.tipo_cuenta, numeroCuenta: t.numero_cuenta
    }))
  ].map(f => ({ ...f, problemas: problemasDatosBancarios(f) }));
  const incompletas = filas.filter(f => f.problemas.length > 0);
  const visibles = (mostrarCompletos ? filas : incompletas).sort((a, b) => a.origen.localeCompare(b.origen) || a.nombre.localeCompare(b.nombre));

  // Campo UI -> columna real según la tabla de origen.
  const actualizar = async (fila, campo, valor) => {
    if (fila.origen === 'Tercero') {
      const campoTercero = { documento: 'dni' }[campo] || campo;
      return onActualizarTercero(fila.id, campoTercero, valor);
    }
    const columnas = { tipoDocumento: 'tipo_documento', documento: 'cedula', tipoCuenta: 'tipo_cuenta_bancaria', numeroCuenta: 'numero_cuenta' };
    const patch = campo === 'codigoBanco'
      ? { codigo_banco: valor || null, banco: valor === CODIGO_BANCO_EXTERIOR ? (fila.bancoTexto || null) : (valor ? nombreBancoPorCodigo(valor) : null) }
      : { [columnas[campo]]: valor === '' ? null : valor };
    const { data, error } = await supabase.from('usuarios').update(patch).eq('id', fila.id).select('id');
    if (error || !data || data.length === 0) {
      alert('❌ No se pudo actualizar' + (error ? ': ' + error.message : ' (sin permiso)'));
      return;
    }
    await onUsuariosCambiaron();
  };

  const nombresCuentas = form.empresa ? (cuentasPorEmpresa[form.empresa] || []) : [];

  return (
    <div>
      <div style={card}>
        <h2 style={{ color: '#C4A747', margin: '0 0 0.5rem 0' }}>🏦 Cuentas origen para pagos masivos (PAB)</h2>
        <p style={{ color: '#8F8877', fontSize: '0.8rem', margin: '0 0 1.5rem 0' }}>
          Datos del encabezado de la plantilla Bancolombia: NIT pagador (sin dígito de verificación), cuenta a debitar y tipo de pago por grupo.
          {!esAdmin && ' Solo el Administrador puede modificarlos.'}
        </p>
        {errorConfig && <p style={{ color: '#CC4B4B', fontSize: '0.85rem' }}>⚠️ No se pudo cargar la configuración ({errorConfig}). ¿Ya se corrió el script SQL de datos bancarios en Supabase?</p>}

        {esAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'end' }}>
            <select value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value, nombreCuenta: '', nitPagador: form.id ? form.nitPagador : limpiarDocumento(nitEmpresas[e.target.value] || '', 3).replace(/\D.*$/, '') })} style={inputSm}>
              <option value="">Empresa</option>
              {Object.keys(cuentasPorEmpresa).map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={form.nombreCuenta} onChange={(e) => setForm({ ...form, nombreCuenta: e.target.value })} style={inputSm}>
              <option value="">Cuenta</option>
              {nombresCuentas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="text" placeholder="NIT pagador (sin DV)" value={form.nitPagador} onChange={(e) => setForm({ ...form, nitPagador: e.target.value })} style={inputSm} />
            <input type="text" placeholder="N° cuenta a debitar" value={form.numeroCuenta} onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })} style={inputSm} />
            <select value={form.tipoCuenta} onChange={(e) => setForm({ ...form, tipoCuenta: e.target.value })} style={inputSm}>
              <option value="S">S – Ahorros</option>
              <option value="D">D – Corriente</option>
            </select>
            {[['tipoPagoNomina', 'Nómina'], ['tipoPagoProveedores', 'Colaboradores'], ['tipoPagoTerceros', 'Terceros']].map(([k, etiqueta]) => (
              <label key={k} style={{ fontSize: '0.7rem', color: '#6B6458' }}>{etiqueta}
                <select value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={inputSm}>
                  {CLASES_DE_PAGO.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                </select>
              </label>
            ))}
            <label style={{ fontSize: '0.8rem', color: '#6B6458' }}>
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activa
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={guardando} onClick={handleGuardarConfig} style={{ padding: '0.6rem 1rem', backgroundColor: '#C4A747', color: '#221E15', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>{form.id ? 'Guardar' : '+ Agregar'}</button>
              {form.id && <button onClick={() => setForm(configVacia)} style={{ padding: '0.6rem 1rem', backgroundColor: '#E6E0D2', color: '#6B6458', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>}
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead><tr style={{ borderBottom: '2px solid #C4A747' }}>
              <th style={th}>Empresa</th><th style={th}>Cuenta</th><th style={th}>NIT pagador</th><th style={th}>N° cuenta</th><th style={th}>Tipo</th><th style={th}>Nómina / Colab. / Terceros</th><th style={th}>Estado</th>{esAdmin && <th style={th}></th>}
            </tr></thead>
            <tbody>
              {configs.length === 0 ? (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#AFA897', padding: '1.5rem' }}>Sin cuentas configuradas todavía.</td></tr>
              ) : configs.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #E6E0D2', opacity: c.activo === false ? 0.5 : 1 }}>
                  <td style={td}>{c.empresas?.nombre}</td>
                  <td style={td}>{c.nombre_cuenta}</td>
                  <td style={td}>{c.nit_pagador}</td>
                  <td style={td}>{c.numero_cuenta}</td>
                  <td style={td}>{c.tipo_cuenta === 'S' ? 'Ahorros' : 'Corriente'}</td>
                  <td style={td}>{c.tipo_pago_nomina} / {c.tipo_pago_proveedores} / {c.tipo_pago_terceros}</td>
                  <td style={td}>{c.activo === false ? 'Inactiva' : 'Activa'}</td>
                  {esAdmin && <td style={td}><button onClick={() => editarConfig(c)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Editar">✏️</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ color: '#C4A747', margin: 0 }}>
            {incompletas.length === 0 ? '✅ Datos bancarios completos' : `⚠️ Datos bancarios incompletos (${incompletas.length} de ${filas.length})`}
          </h2>
          <label style={{ fontSize: '0.8rem', color: '#6B6458' }}>
            <input type="checkbox" checked={mostrarCompletos} onChange={(e) => setMostrarCompletos(e.target.checked)} /> Mostrar también los completos
          </label>
        </div>
        <p style={{ color: '#8F8877', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>
          Sin estos datos el exportador PAB bloquea el pago. Los cambios se guardan al salir de cada campo. Documento y cuenta: solo números (NIT sin dígito de verificación).
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead><tr style={{ borderBottom: '2px solid #C4A747' }}>
              <th style={th}>Tipo</th><th style={th}>Nombre</th><th style={th}>Tipo doc.</th><th style={th}>Documento</th><th style={th}>Banco</th><th style={th}>Tipo cuenta</th><th style={th}>N° cuenta</th><th style={th}>Pendiente</th>
            </tr></thead>
            <tbody>
              {visibles.map(f => (
                <tr key={f.origen + f.id} style={{ borderBottom: '1px solid #E6E0D2' }}>
                  <td style={td}>{f.origen === 'Tercero' ? '🤝' : '👤'} {f.origen}</td>
                  <td style={td}>{f.nombre}</td>
                  <td style={{ ...td, minWidth: '140px' }}>
                    <SelectTipoDocumento value={f.tipoDocumento} placeholder="—" style={inputSm} onChange={(v) => actualizar(f, 'tipoDocumento', v || null)} />
                  </td>
                  <td style={{ ...td, minWidth: '120px' }}>
                    <input key={f.documento} type="text" defaultValue={f.documento || ''} style={inputSm}
                      onBlur={(e) => { const v = limpiarDocumento(e.target.value.trim(), f.tipoDocumento); e.target.value = v; if (v !== (f.documento || '')) actualizar(f, 'documento', v); }} />
                  </td>
                  <td style={{ ...td, minWidth: '170px' }}>
                    <SelectBanco value={f.codigoBanco} placeholder="—" style={inputSm} onChange={(v) => actualizar(f, 'codigoBanco', v)} />
                    {!f.codigoBanco && f.bancoTexto && <div style={{ fontSize: '0.7rem', color: '#C4622D', marginTop: '0.2rem' }}>Antes: "{f.bancoTexto}"</div>}
                  </td>
                  <td style={{ ...td, minWidth: '110px' }}>
                    <select value={f.tipoCuenta || ''} style={inputSm} onChange={(e) => actualizar(f, 'tipoCuenta', e.target.value)}>
                      <option value="">—</option>
                      <option value="Ahorros">Ahorros</option>
                      <option value="Corriente">Corriente</option>
                    </select>
                  </td>
                  <td style={{ ...td, minWidth: '130px' }}>
                    <input key={f.numeroCuenta} type="text" defaultValue={f.numeroCuenta || ''} style={inputSm}
                      onBlur={(e) => { const v = limpiarNumeroCuenta(e.target.value.trim()); e.target.value = v; if (v !== (f.numeroCuenta || '')) actualizar(f, 'numeroCuenta', v); }} />
                  </td>
                  <td style={{ ...td, color: f.problemas.length ? '#CC4B4B' : '#2F9E52', fontSize: '0.75rem' }}>
                    {f.problemas.length ? f.problemas.join(' · ') : 'Listo'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DatosBancariosView;
