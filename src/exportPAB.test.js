import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  normalizarNombrePAB, fechaPAB, valorPAB, referenciaPAB, descripcionLotePAB, secuenciaPAB,
  problemasEncabezadoPAB, construirEncabezadoPAB, construirFilaPAB, totalesPAB,
  construirCandidatosPAB, llenarHojaPAB, generarArchivoPAB
} from './exportPAB';

// Datos 100% ficticios.
const config = { id: 'cfg-1', nit_pagador: '900000001', numero_cuenta: '01234567890', tipo_cuenta: 'S', tipo_pago_nomina: 225, tipo_pago_proveedores: 220, tipo_pago_terceros: 238 };
const usuarioOk = { id: 'u1', nombre: 'Persona Ficticia Uno', titularCuenta: 'PERSONA FICTICIA ÚNO PÉREZ', tipoDocumento: 1, cedula: '1000000001', codigoBanco: '1007', tipoCuentaBancaria: 'Ahorros', numeroCuenta: '00012345678' };
const usuarioIncompleto = { id: 'u2', nombre: 'Persona Ficticia Dos', tipoDocumento: '', cedula: '1000000002', codigoBanco: '', tipoCuentaBancaria: 'Ahorros', numeroCuenta: '123' };
const terceroOk = { id: 't1', nombre: 'Empresa Ficticia SAS', tipo_documento: 3, dni: '900000002', codigo_banco: '1051', tipo_cuenta: 'Corriente', numero_cuenta: '555666777' };

describe('formatos de la plantilla', () => {
  test('nombre: mayúsculas, sin tildes ni símbolos, máx 30', () => {
    expect(normalizarNombrePAB('José Ñúñez & Cía. (Ltda)')).toBe('JOSE NUNEZ & CIA. LTDA');
    expect(normalizarNombrePAB('a'.repeat(40))).toHaveLength(30);
  });
  test('fecha AAAAMMDD', () => expect(fechaPAB('2026-10-15')).toBe('20261015'));
  test('valor: positivo, 2 decimales, máx 15 enteros', () => {
    expect(valorPAB('1500000.456')).toBe(1500000.46);
    expect(valorPAB(0)).toBeNull();
    expect(valorPAB(-5)).toBeNull();
    expect(valorPAB('1'.repeat(16))).toBeNull();
  });
  test('referencia máx 21 y descripción máx 10', () => {
    expect(referenciaPAB('REE', 'abcd-ef12-3456-7890-abcd-ef1234567890').length).toBeLessThanOrEqual(21);
    expect(descripcionLotePAB(225, 2026, 10)).toBe('NOM 1026');
    expect(descripcionLotePAB(220, 2026, 3).length).toBeLessThanOrEqual(10);
  });
  test('secuencia de envío A1..A9, B1..', () => {
    expect([0, 8, 9, 17, 18].map(secuenciaPAB)).toEqual(['A1', 'A9', 'B1', 'B9', 'C1']);
  });
});

describe('encabezado', () => {
  test('config válida', () => expect(problemasEncabezadoPAB(config)).toEqual([]));
  test('sin config o con datos malos', () => {
    expect(problemasEncabezadoPAB(null)[0]).toMatch(/no tiene cuenta origen/);
    expect(problemasEncabezadoPAB({ ...config, numero_cuenta: '123', tipo_cuenta: 'X' })).toHaveLength(2);
  });
  test('arma la fila 2', () => {
    expect(construirEncabezadoPAB({ config, tipoPago: 225, secuencia: 'A1', descripcion: 'NOM 1026' }))
      .toEqual({ nitPagador: '900000001', tipoPago: 225, aplicacion: 'I', secuencia: 'A1', cuentaDebitar: '01234567890', tipoCuentaDebitar: 'S', descripcion: 'NOM 1026' });
  });
});

describe('fila de detalle', () => {
  const beneficiario = { tipoDocumento: 1, documento: '1000000001', nombre: 'Persona Ficticia', codigoBanco: '1007', tipoCuenta: 'Corriente', numeroCuenta: '00099' };
  test('fila válida conserva ceros de la cuenta y usa 27 para corriente', () => {
    const { fila, problemas } = construirFilaPAB({ beneficiario, valor: 1000, referencia: 'REE-X', fechaAplicacion: '2026-10-15' });
    expect(problemas).toEqual([]);
    expect(fila).toMatchObject({ tipoDocumento: 1, documento: '1000000001', tipoTransaccion: 27, codigoBanco: 1007, cuenta: '00099', valor: 1000, fechaAplicacion: '20261015' });
  });
  test('bloquea valor 0 y datos bancarios incompletos', () => {
    const { problemas } = construirFilaPAB({ beneficiario: { ...beneficiario, codigoBanco: '' }, valor: 0, fechaAplicacion: '2026-10-15' });
    expect(problemas).toEqual(expect.arrayContaining(['sin banco', expect.stringMatching(/valor/)]));
  });
});

describe('candidatos', () => {
  const base = {
    empresa: 'EMPRESA FICTICIA SAS', config, anio: 2026, mes: 10, fechaAplicacion: '2026-10-15',
    usuarios: [usuarioOk, usuarioIncompleto], terceros: [terceroOk], getMoneda: () => 'COP'
  };
  const presupuestoDetalle = [
    { id: 'p1', empresa: base.empresa, tipo: 'Nómina', nombre: 'Nómina Uno', responsableId: 'u1', pagado: false, aprobado: true, netoAPagar: 2000000, requisitoCuentaCobro: { ok: true } },
    { id: 'p2', empresa: base.empresa, tipo: 'Prestación de Servicio', nombre: 'Honorario Dos', responsableId: 'u1', pagado: false, aprobado: false, netoAPagar: 1000000, requisitoCuentaCobro: { ok: false, motivo: 'Sin cuenta de cobro del mes' } },
    { id: 'p3', empresa: base.empresa, tipo: 'Servicios Públicos', nombre: 'Luz', pagado: false, aprobado: true, netoAPagar: 50000 },
    { id: 'p4', empresa: base.empresa, tipo: 'Nómina', nombre: 'Ya pagada', responsableId: 'u1', pagado: true, aprobado: true, netoAPagar: 10 }
  ];
  const solicitudes = [
    { id: 's1', empresa: base.empresa, estado: 'Aprobado', tipo: 'Reembolso', responsableId: 'u1', totalCalculado: 300000, valor: 0 },
    { id: 's2', empresa: base.empresa, estado: 'Aprobado', tipo: 'Anticipo', responsableId: 'u2', valor: 500000 },
    { id: 's3', empresa: base.empresa, estado: 'Aprobado', tipo: 'Pago a Tercero', terceroId: 't1', valor: 700000, moneda: 'COP' },
    { id: 's4', empresa: base.empresa, estado: 'Aprobado', tipo: 'Pago a Tercero', terceroId: 't1', valor: 100, moneda: 'USD' },
    { id: 's5', empresa: base.empresa, estado: 'Pendiente', tipo: 'Reembolso', responsableId: 'u1', totalCalculado: 1 },
    { id: 's6', empresa: 'OTRA', estado: 'Aprobado', tipo: 'Reembolso', responsableId: 'u1', totalCalculado: 1 }
  ];
  const lista = construirCandidatosPAB({ ...base, presupuestoDetalle, solicitudes, lotePorClave: { 'solicitud:s1': 7 } });
  const por = (clave) => lista.find(c => c.clave === clave);

  test('solo Nómina/Honorarios no pagados y solicitudes Aprobadas de la empresa', () => {
    expect(lista.map(c => c.clave).sort()).toEqual(['presupuesto:p1:2026-10', 'presupuesto:p2:2026-10', 'solicitud:s1', 'solicitud:s2', 'solicitud:s3', 'solicitud:s4'].sort());
  });
  test('tipo de pago por origen', () => {
    expect(por('presupuesto:p1:2026-10').tipoPago).toBe(225);
    expect(por('presupuesto:p2:2026-10').tipoPago).toBe(220);
    expect(por('solicitud:s2').tipoPago).toBe(220);
    expect(por('solicitud:s3').tipoPago).toBe(238);
  });
  test('bloqueos', () => {
    expect(por('presupuesto:p1:2026-10').bloqueos).toEqual([]);
    expect(por('presupuesto:p2:2026-10').bloqueos[0]).toBe('Sin cuenta de cobro del mes');
    expect(por('solicitud:s1').bloqueos[0]).toBe('ya exportado en el lote #7');
    expect(por('solicitud:s2').bloqueos).toEqual(expect.arrayContaining(['sin tipo de documento', 'sin banco']));
    expect(por('solicitud:s3').bloqueos).toEqual([]);
    expect(por('solicitud:s4').bloqueos[0]).toMatch(/USD/);
  });
  test('valores y nombre del titular', () => {
    expect(por('solicitud:s1').fila.valor).toBe(300000);
    expect(por('solicitud:s3').fila).toMatchObject({ tipoDocumento: 3, documento: '900000002', tipoTransaccion: 27, codigoBanco: 1051 });
    expect(por('presupuesto:p1:2026-10').fila.nombre).toBe('PERSONA FICTICIA UNO PEREZ');
  });
});

describe('escritura en la plantilla', () => {
  const xmlMini = '<sheetData><row r="1" spans="1:17"><c r="A1" s="5" t="s"><v>6</v></c></row>'
    + '<row r="2" spans="1:17"><c r="A2" s="1"><v>123456</v></c><c r="G2" s="1" t="s"><v>58</v></c></row>'
    + '<row r="3" spans="1:17"><c r="A3" s="8" t="s"><v>19</v></c></row>'
    + '<row r="4" spans="1:17"><c r="A4" s="1"/><c r="K4" s="11"/></row>'
    + '<row r="5" spans="1:17"/></sheetData>';
  const enc = construirEncabezadoPAB({ config, tipoPago: 220, secuencia: 'A1', descripcion: 'PROV 1026' });
  const fila = (n) => construirFilaPAB({ beneficiario: { tipoDocumento: 1, documento: `10000000${n}`, nombre: `Persona ${n} & <Co>`, codigoBanco: '1007', tipoCuenta: 'Ahorros', numeroCuenta: `000${n}` }, valor: 1000 * n + 0.5, referencia: `REF-${n}`, fechaAplicacion: '2026-10-15' }).fila;

  test('conserva estilos, ordena columnas, escapa XML y no toca filas 1 y 3', () => {
    const out = llenarHojaPAB(xmlMini, enc, [fila(1), fila(2)]);
    expect(out).toContain('<row r="1" spans="1:17"><c r="A1" s="5" t="s"><v>6</v></c></row>');
    expect(out).toContain('<row r="3" spans="1:17"><c r="A3" s="8" t="s"><v>19</v></c></row>');
    expect(out).toContain('<c r="A2" s="1" t="inlineStr"><is><t>900000001</t></is></c>');
    expect(out).toContain('<c r="K4" s="11"><v>1000.5</v></c>');
    expect(out).toContain('PERSONA 2 &amp; CO');
    expect(out).toMatch(/<row r="5" spans="1:17">.*<c r="F5" t="inlineStr"><is><t>0002<\/t><\/is><\/c>/);
    expect(out.indexOf('r="A4"')).toBeLessThan(out.indexOf('r="B4"'));
  });

  test('sobre la plantilla oficial: mismas hojas, encabezado, detalle y total cuadran', async () => {
    const plantilla = fs.readFileSync(path.join(__dirname, '..', 'public', 'plantillas', 'FORMATOPAB_CONVERSORPAGOS.xlsx'));
    const filas = [1, 2, 3].map(fila);
    const bytes = await generarArchivoPAB(JSZip, plantilla, enc, filas);

    // Mismos archivos internos que la plantilla (validaciones, comentarios, listas, etc.)
    const [zipOrig, zipNuevo] = await Promise.all([JSZip.loadAsync(plantilla), JSZip.loadAsync(bytes)]);
    const archivos = (z) => Object.values(z.files).filter(f => !f.dir).map(f => f.name).sort();
    expect(archivos(zipNuevo)).toEqual(archivos(zipOrig));

    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toEqual(['FORMATOPAB', 'CODIGOS DE BANCOS', 'Listas']);
    const ws = wb.Sheets.FORMATOPAB;
    expect(['A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2'].map(c => ws[c]?.v)).toEqual(['900000001', 220, 'I', 'A1', '01234567890', 'S', 'PROV 1026']);
    expect(ws.A3.v).toBe('Tipo Documento Beneficiario');
    expect(['A4', 'B4', 'D4', 'E4', 'F4', 'I4', 'K4', 'L4'].map(c => ws[c]?.v)).toEqual([1, '100000001', 37, 1007, '0001', 'REF-1', 1000.5, '20261015']);
    const filasLeidas = XLSX.utils.sheet_to_json(ws, { range: 2 });
    expect(filasLeidas).toHaveLength(3);
    const suma = filasLeidas.reduce((s, r) => s + r['ValorTransaccion '], 0);
    expect(Math.round(suma * 100) / 100).toBe(totalesPAB(filas).total);
  }, 30000);
});
