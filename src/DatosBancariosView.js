import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { SelectBanco, SelectTipoDocumento } from './CamposBancarios';
import {
  CODIGO_BANCO_EXTERIOR, problemasDatosBancarios, limpiarNumeroCuenta, limpiarDocumento,
  nombreBancoPorCodigo
} from './datosBancarios';
import { Pencil, Plus, Check, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

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

const claseCheckbox = 'size-4 cursor-pointer accent-[#C4A747]';
// SelectBanco / SelectTipoDocumento solo aceptan `style`.
const estiloCampoCompacto = { width: '100%', height: '32px', padding: '0 0.5rem', backgroundColor: '#FFFFFF', border: '1px solid #E6E0D2', borderRadius: '8px', color: '#221E15', fontSize: '0.75rem', fontFamily: 'inherit', boxSizing: 'border-box' };
const Campo = ({ label, htmlFor, className, children }) => (
  <div className={cn('flex flex-col gap-1.5', className)}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

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

  // Elegir empresa en "Agregar": si ya tiene cuenta origen, se carga para editarla (evita duplicar
  // o mezclar datos de dos empresas); si no, NIT sugerido desde la empresa.
  const elegirEmpresa = (empresa) => {
    const existente = configs.find(c => c.empresas?.nombre === empresa);
    if (existente) { editarConfig(existente); return; }
    setForm({ ...configVacia, empresa, nitPagador: limpiarDocumento(nitEmpresas[empresa] || '', 3).replace(/\D.*$/, '') });
  };

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

  // Etapa 3 del sistema de diseño: misma lógica; solo cambia la presentación.
  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 px-0 py-6">
        <CardHeader className="sm:px-7">
          <CardTitle className="text-lg">🏦 Cuentas origen para pagos masivos (PAB)</CardTitle>
          <CardDescription>
            Datos del encabezado de la plantilla Bancolombia: NIT pagador (sin dígito de verificación), cuenta a debitar y tipo de pago por grupo.
            {!esAdmin && ' Solo el Administrador puede modificarlos.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:px-7">
          {errorConfig && <p className="m-0 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">⚠️ No se pudo cargar la configuración ({errorConfig}). ¿Ya se corrió el script SQL de datos bancarios en Supabase?</p>}

          {esAdmin && (
            <div className={cn('grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] items-end gap-3 rounded-lg border border-solid p-4', form.id ? 'border-primary bg-primary/5' : 'border-border bg-background')}>
              <Campo label="Empresa" htmlFor="db-empresa">
                <Select id="db-empresa" value={form.empresa} disabled={!!form.id} title={form.id ? 'Al editar no se cambia la empresa: cancela y elige otra' : undefined} onChange={(e) => elegirEmpresa(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {Object.keys(cuentasPorEmpresa).map(e => <option key={e} value={e}>{e}</option>)}
                </Select>
              </Campo>
              <Campo label="Cuenta" htmlFor="db-cuenta">
                <Select id="db-cuenta" value={form.nombreCuenta} onChange={(e) => setForm({ ...form, nombreCuenta: e.target.value })}>
                  <option value="">Seleccionar</option>
                  {nombresCuentas.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Campo>
              <Campo label="NIT pagador (sin DV)" htmlFor="db-nit">
                <Input id="db-nit" placeholder="Solo números" value={form.nitPagador} onChange={(e) => setForm({ ...form, nitPagador: e.target.value })} />
              </Campo>
              <Campo label="N° cuenta a debitar" htmlFor="db-numero">
                <Input id="db-numero" placeholder="6 a 11 dígitos" value={form.numeroCuenta} onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })} />
              </Campo>
              <Campo label="Tipo de cuenta" htmlFor="db-tipo">
                <Select id="db-tipo" value={form.tipoCuenta} onChange={(e) => setForm({ ...form, tipoCuenta: e.target.value })}>
                  <option value="S">S – Ahorros</option>
                  <option value="D">D – Corriente</option>
                </Select>
              </Campo>
              {[['tipoPagoNomina', 'Tipo de pago Nómina'], ['tipoPagoProveedores', 'Tipo de pago Colaboradores'], ['tipoPagoTerceros', 'Tipo de pago Terceros']].map(([k, etiqueta]) => (
                <Campo key={k} label={etiqueta} htmlFor={`db-${k}`}>
                  <Select id={`db-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}>
                    {CLASES_DE_PAGO.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                  </Select>
                </Campo>
              ))}
              <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" className={claseCheckbox} checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activa
              </label>
              <div className="flex gap-2">
                <Button disabled={guardando} onClick={handleGuardarConfig} className="flex-1">
                  {guardando ? <Loader2 className="animate-spin" /> : form.id ? <Check /> : <Plus />}
                  {form.id ? 'Guardar' : 'Agregar'}
                </Button>
                {form.id && <Button variant="outline" onClick={() => setForm(configVacia)}>Cancelar</Button>}
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-solid border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Empresa</TableHead><TableHead>Cuenta</TableHead><TableHead>NIT pagador</TableHead><TableHead>N° cuenta</TableHead><TableHead>Tipo</TableHead>
                  <TableHead><span title="Tipo de pago: Nómina / Colaboradores / Terceros">Nóm. / Colab. / Terc.</span></TableHead><TableHead>Estado</TableHead>{esAdmin && <TableHead className="w-px"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.length === 0 ? (
                  <TableRow className="hover:bg-transparent"><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Sin cuentas configuradas todavía.</TableCell></TableRow>
                ) : configs.map(c => (
                  <TableRow key={c.id} className={cn(c.activo === false && 'opacity-50', form.id === c.id && 'bg-primary/10')}>
                    <TableCell className="whitespace-nowrap">{c.empresas?.nombre}</TableCell>
                    <TableCell className="whitespace-nowrap">{c.nombre_cuenta}</TableCell>
                    <TableCell className="tabular-nums">{c.nit_pagador}</TableCell>
                    <TableCell className="tabular-nums">{c.numero_cuenta}</TableCell>
                    <TableCell>{c.tipo_cuenta === 'S' ? 'Ahorros' : 'Corriente'}</TableCell>
                    <TableCell className="tabular-nums">{c.tipo_pago_nomina} / {c.tipo_pago_proveedores} / {c.tipo_pago_terceros}</TableCell>
                    <TableCell><Badge variant={c.activo === false ? 'muted' : 'success'}>{c.activo === false ? 'Inactiva' : 'Activa'}</Badge></TableCell>
                    {esAdmin && (
                      <TableCell className="w-px">
                        <Button variant="ghost" size="icon" className="size-8 text-[#6C63D1]" onClick={() => editarConfig(c)} title="Editar" aria-label="Editar"><Pencil size={16} /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className={cn('gap-4 px-0 py-6', incompletas.length > 0 && 'border-l-4 border-l-[#C4622D]')}>
        <CardHeader className="sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg">
              {incompletas.length === 0 ? '✅ Datos bancarios completos' : `⚠️ Datos bancarios incompletos (${incompletas.length} de ${filas.length})`}
            </CardTitle>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" className={claseCheckbox} checked={mostrarCompletos} onChange={(e) => setMostrarCompletos(e.target.checked)} /> Mostrar también los completos
            </label>
          </div>
          <CardDescription>
            Sin estos datos el exportador PAB bloquea el pago. Los cambios se guardan al salir de cada campo. Documento y cuenta: solo números (NIT sin dígito de verificación).
          </CardDescription>
        </CardHeader>
        <CardContent className="sm:px-7">
          <div className="overflow-hidden rounded-lg border border-solid border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Tipo</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo doc.</TableHead><TableHead>Documento</TableHead><TableHead>Banco</TableHead><TableHead>Tipo cuenta</TableHead><TableHead>N° cuenta</TableHead><TableHead>Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.length === 0 && (
                  <TableRow className="hover:bg-transparent"><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Nada pendiente.</TableCell></TableRow>
                )}
                {visibles.map(f => (
                  <TableRow key={f.origen + f.id}>
                    <TableCell><Badge variant={f.origen === 'Tercero' ? 'info' : 'secondary'}>{f.origen === 'Tercero' ? '🤝' : '👤'} {f.origen}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{f.nombre}</TableCell>
                    <TableCell className="min-w-[140px]">
                      <SelectTipoDocumento value={f.tipoDocumento} placeholder="—" style={estiloCampoCompacto} onChange={(v) => actualizar(f, 'tipoDocumento', v || null)} />
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <Input key={f.documento} aria-label={`Documento de ${f.nombre}`} defaultValue={f.documento || ''} className="h-8 text-xs"
                        onBlur={(e) => { const v = limpiarDocumento(e.target.value.trim(), f.tipoDocumento); e.target.value = v; if (v !== (f.documento || '')) actualizar(f, 'documento', v); }} />
                    </TableCell>
                    <TableCell className="min-w-[170px]">
                      <SelectBanco value={f.codigoBanco} placeholder="—" style={estiloCampoCompacto} onChange={(v) => actualizar(f, 'codigoBanco', v)} />
                      {!f.codigoBanco && f.bancoTexto && <div className="mt-1 text-[0.7rem] text-[#C4622D]">Antes: "{f.bancoTexto}"</div>}
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <Select aria-label={`Tipo de cuenta de ${f.nombre}`} value={f.tipoCuenta || ''} className="h-8 text-xs" onChange={(e) => actualizar(f, 'tipoCuenta', e.target.value)}>
                        <option value="">—</option>
                        <option value="Ahorros">Ahorros</option>
                        <option value="Corriente">Corriente</option>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[130px]">
                      <Input key={f.numeroCuenta} aria-label={`Número de cuenta de ${f.nombre}`} defaultValue={f.numeroCuenta || ''} className="h-8 text-xs"
                        onBlur={(e) => { const v = limpiarNumeroCuenta(e.target.value.trim()); e.target.value = v; if (v !== (f.numeroCuenta || '')) actualizar(f, 'numeroCuenta', v); }} />
                    </TableCell>
                    <TableCell className={cn('min-w-[200px] text-xs', f.problemas.length ? 'text-destructive' : 'text-success')}>
                      {f.problemas.length ? f.problemas.join(' · ') : <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} /> Listo</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatosBancariosView;
