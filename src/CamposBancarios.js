import React from 'react';
import { BANCOS_ACH, CODIGO_BANCO_EXTERIOR, TIPOS_DOCUMENTO, nombreBancoPorCodigo } from './datosBancarios';

// Selectores compartidos por Mi Perfil, Colaboradores, Terceros y el panel de Datos
// Bancarios: el banco ya no se escribe a mano, se elige de la lista oficial de la plantilla
// PAB (así el exportador siempre tiene un código ACH válido).

const bancosOrdenados = [...BANCOS_ACH].sort((a, b) => a.nombre.localeCompare(b.nombre));

export const SelectBanco = ({ value, onChange, style, placeholder = 'Seleccionar banco' }) => (
  <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={style}>
    <option value="">{placeholder}</option>
    {bancosOrdenados.map(b => <option key={b.codigo} value={b.codigo}>{b.nombre}</option>)}
    <option value={CODIGO_BANCO_EXTERIOR}>🌎 Banco del exterior (no se paga por PAB)</option>
  </select>
);

export const SelectTipoDocumento = ({ value, onChange, style, placeholder = 'Tipo de documento' }) => (
  <select value={value || ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')} style={style}>
    <option value="">{placeholder}</option>
    {TIPOS_DOCUMENTO.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
  </select>
);

// Banco completo: lista oficial + (solo si es del exterior) el nombre real del banco, que no
// está en la lista ACH. onChange recibe { codigo, texto } — "texto" es lo que se guarda en la
// columna banco de siempre (PDFs, reportes) y "codigo" va a codigo_banco (PAB).
export const textoBancoPara = (codigo, textoPrevio) => {
  if (!codigo) return textoPrevio || '';
  if (codigo !== CODIGO_BANCO_EXTERIOR) return nombreBancoPorCodigo(codigo);
  const previoEsDeLista = BANCOS_ACH.some(b => b.nombre === textoPrevio);
  return previoEsDeLista ? '' : (textoPrevio || '');
};

export const CampoBanco = ({ codigo, texto, onChange, style, placeholder }) => (
  <>
    <SelectBanco value={codigo} placeholder={placeholder} style={style}
      onChange={(v) => onChange({ codigo: v, texto: textoBancoPara(v, texto) })} />
    {codigo === CODIGO_BANCO_EXTERIOR && (
      <input type="text" placeholder="Nombre del banco del exterior" value={texto || ''}
        onChange={(e) => onChange({ codigo, texto: e.target.value })} style={style} />
    )}
  </>
);
