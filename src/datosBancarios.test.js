import {
  BANCOS_ACH, CODIGO_BANCO_EXTERIOR, inferirCodigoBanco, limpiarNumeroCuenta, limpiarDocumento,
  problemasDatosBancarios, nombreBancoPorCodigo, nombreTipoDocumento
} from './datosBancarios';

// Datos ficticios — ninguno corresponde a una persona o cuenta real.
const beneficiarioOk = {
  tipoDocumento: 1,
  documento: '1000000001',
  codigoBanco: '1007',
  tipoCuenta: 'Ahorros',
  numeroCuenta: '00012345678'
};

describe('catálogo de bancos', () => {
  test('códigos únicos de 4 dígitos', () => {
    const codigos = BANCOS_ACH.map(b => b.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    codigos.forEach(c => expect(c).toMatch(/^\d{4}$/));
  });

  test('nombre por código', () => {
    expect(nombreBancoPorCodigo('1007')).toBe('BANCOLOMBIA');
    expect(nombreBancoPorCodigo(CODIGO_BANCO_EXTERIOR)).toBe('Banco del exterior');
    expect(nombreBancoPorCodigo('9999')).toBe('');
    expect(nombreTipoDocumento(3)).toBe('NIT');
  });
});

describe('inferirCodigoBanco (textos reales del diagnóstico)', () => {
  test.each([
    ['Bancolombia', '1007'],
    ['BANCOLOMBIA', '1007'],
    ['  bancolombia ', '1007'],
    ['NU', '1809'],
    ['DAVIVIENDA', '1051'],
    ['Davibank S.a', '1019'],
    ['NEQUI', '1507'],
    ['Bank of America', CODIGO_BANCO_EXTERIOR],
    ['BANK OF AMERICA, NATIONAL ASSOCIATION', CODIGO_BANCO_EXTERIOR],
    ['CHASE Bank', CODIGO_BANCO_EXTERIOR],
    ['Banco Familiar', CODIGO_BANCO_EXTERIOR],
    ['WISE', CODIGO_BANCO_EXTERIOR]
  ])('%s → %s', (texto, codigo) => {
    expect(inferirCodigoBanco(texto)).toBe(codigo);
  });

  test('no adivina lo ambiguo o inválido', () => {
    expect(inferirCodigoBanco('Itau')).toBe('');          // 1006 o 1014: decide una persona
    expect(inferirCodigoBanco('901238053')).toBe('');     // un NIT escrito en el campo banco
    expect(inferirCodigoBanco('')).toBe('');
    expect(inferirCodigoBanco(null)).toBe('');
  });

  test('acepta el nombre exacto de la plantilla', () => {
    expect(inferirCodigoBanco('BANCO GNB SUDAMERIS')).toBe('1012');
  });
});

describe('limpieza', () => {
  test('número de cuenta: quita espacios, puntos y guiones, conserva ceros', () => {
    expect(limpiarNumeroCuenta('000-123 456.78')).toBe('00012345678');
    expect(limpiarNumeroCuenta('ES12AB')).toBe('ES12AB'); // las letras no se tocan
    expect(limpiarNumeroCuenta(null)).toBe('');
  });

  test('documento: quita puntos; en NIT descarta el DV solo si viene con guion', () => {
    expect(limpiarDocumento('1.000.000.001', 1)).toBe('1000000001');
    expect(limpiarDocumento('900.000.001-7', 3)).toBe('900000001');
    expect(limpiarDocumento('9000000017', 3)).toBe('9000000017');
    expect(limpiarDocumento('1000000001-2', 1)).toBe('1000000001-2'); // cédula: no se interpreta como DV
  });
});

describe('problemasDatosBancarios', () => {
  test('beneficiario completo no tiene problemas', () => {
    expect(problemasDatosBancarios(beneficiarioOk)).toEqual([]);
  });

  test('todo vacío reporta cada campo', () => {
    expect(problemasDatosBancarios({})).toEqual([
      'sin tipo de documento', 'sin documento', 'sin banco', 'sin tipo de cuenta', 'sin número de cuenta'
    ]);
  });

  test('formatos inválidos', () => {
    const p = problemasDatosBancarios({
      ...beneficiarioOk,
      tipoDocumento: 9,
      documento: '1.000.000.001',
      codigoBanco: '9999',
      numeroCuenta: '000-123'
    });
    expect(p).toEqual([
      'sin tipo de documento',
      'documento debe ser solo números (máx. 15)',
      'código de banco no válido',
      'cuenta debe ser solo números (máx. 17)'
    ]);
  });

  test('límites de longitud de la plantilla', () => {
    expect(problemasDatosBancarios({ ...beneficiarioOk, documento: '1'.repeat(15), numeroCuenta: '1'.repeat(17) })).toEqual([]);
    expect(problemasDatosBancarios({ ...beneficiarioOk, documento: '1'.repeat(16) })).toContain('documento debe ser solo números (máx. 15)');
    expect(problemasDatosBancarios({ ...beneficiarioOk, numeroCuenta: '1'.repeat(18) })).toContain('cuenta debe ser solo números (máx. 17)');
  });

  test('cuenta del exterior se marca como no pagable por PAB', () => {
    expect(problemasDatosBancarios({ ...beneficiarioOk, codigoBanco: CODIGO_BANCO_EXTERIOR }))
      .toEqual(['cuenta en el exterior (no se paga por PAB)']);
  });
});
