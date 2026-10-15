/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
// Faltaba este import — doc.autoTable() (usado más abajo en handleGenerarPDF, para el PDF
// individual de Legalización/Reembolso) es un plugin de jsPDF: sin esta línea, "autoTable"
// no existe en el objeto doc y la llamada lanza un error que quedaba solo en la consola
// (nunca visible para quien hace clic en el botón "📄 PDF").
import 'jspdf-autotable';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';
import logoAmHolding from './assets/logos/logo-am-holding.png';
import logoNoss from './assets/logos/logo-noss.png';
import logoProGlobal from './assets/logos/logo-pro-global.png';
import logoForSeven from './assets/logos/logo-for-seven.png';
import logoPronova from './assets/logos/logo-pronova.png';
import { supabase } from './supabaseClient';
import { SelectBanco, SelectTipoDocumento, CampoBanco, textoBancoPara } from './CamposBancarios';
import DatosBancariosView from './DatosBancariosView';
import ExportadorPABView from './ExportadorPABView';
import NotificacionesCampana from './NotificacionesCampana';
import AuditoriaView from './AuditoriaView';
import TopNav from './components/TopNav';
import { ChevronDown, ChevronRight, Paperclip, Trash2, RotateCcw, FileDown, Eye, Plus, Check, X, Pencil, Search, Loader2, FileSpreadsheet, Upload, FilePlus2, Pause, Play, LayoutDashboard, FileText, Banknote, DollarSign, Clock, Undo2, CheckCircle2, Building2, Users, ClipboardList, Archive, TrendingUp, TrendingDown, Scale, BarChart3, Trophy, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge, badgeVariants, estadoBadge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CODIGO_BANCO_EXTERIOR, inferirCodigoBanco, limpiarNumeroCuenta, limpiarDocumento } from './datosBancarios';

// Logo por empresa. Para sumar ARKO, sube el archivo a src/assets/logos/,
// agrega su import arriba y una línea aquí con el nombre exacto de la empresa.
const EMPRESA_LOGOS = {
  'AM SPORTS GROUP SAS': logoNoss,
  'PRO INVESTMENTS GLOBAL SAS': logoProGlobal,
  'FOR SEVEN MEDIA SAS': logoForSeven,
  'PRONOVA CAPITAL SAS': logoPronova,
};

const EmpresaLogo = ({ empresa, height = 20, style = {} }) => {
  const src = EMPRESA_LOGOS[empresa];
  if (!src) return null;
  return <img src={src} alt={empresa} style={{ height: `${height}px`, width: 'auto', maxWidth: `${height * 4.5}px`, objectFit: 'contain', verticalAlign: 'middle', ...style }} />;
};

// ===== Piezas compartidas de los módulos ya migrados al sistema de diseño (etapa 3) =====
// Clases para elementos nativos que no tienen componente propio (checkbox, archivo, select de estado).
const claseCheckbox = 'size-4 cursor-pointer accent-[#C4A747] disabled:cursor-not-allowed';
const claseInputArchivo = 'h-auto cursor-pointer py-2 text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:font-[inherit] file:text-xs file:font-semibold file:text-secondary-foreground';
const claseSelectEstado = 'cursor-pointer py-1 font-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';
// Presupuesto → PAB: tipo del concepto (define el beneficiario y el tipo de pago del archivo) y
// cómo se paga. Nómina / Prestación de Servicio le pagan al colaborador; "Proveedor / servicio" le
// paga al Beneficiario (tercero del catálogo). Solo los de forma de pago "PAB" entran al archivo.
const TIPOS_CONCEPTO_PRESUPUESTO = ['Nómina', 'Prestación de Servicio', 'Proveedor / servicio'];
const FORMAS_PAGO_PRESUPUESTO = ['PAB', 'Convenio / PSE', 'Débito automático', 'Tarjeta de crédito', 'Otro'];
const claseBotonMorado = 'bg-[#6C63D1] text-white hover:bg-[#6C63D1]/90';
// Para CampoBanco / SelectTipoDocumento (CamposBancarios.js), que solo reciben `style`.
const estiloCampoCompactoUI = { width: '100%', height: '32px', padding: '0 0.5rem', backgroundColor: '#FFFFFF', border: '1px solid #E6E0D2', borderRadius: '8px', color: '#221E15', fontSize: '0.8rem', fontFamily: 'inherit', boxSizing: 'border-box', minWidth: '120px' };
const estiloCampoUI = { width: '100%', height: '36px', padding: '0 0.75rem', backgroundColor: '#FFFFFF', border: '1px solid #E6E0D2', borderRadius: '8px', color: '#221E15', fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' };

// Encabezado de tabla abreviado: muestra las iniciales y, al hacer clic (o pasar el mouse),
// el nombre completo — para columnas cuyo título ocupaba más ancho que sus valores.
const EncabezadoAbreviado = ({ corto, largo }) => {
  const [completo, setCompleto] = useState(false);
  return (
    <button type="button" onClick={() => setCompleto(!completo)} title={largo} aria-label={largo}
      className="cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 font-[inherit] text-xs font-semibold uppercase tracking-wide text-muted-foreground underline decoration-dotted underline-offset-4">
      {completo ? largo : corto}
    </button>
  );
};

// Etiqueta + campo.
const CampoUI = ({ label, htmlFor, className, children }) => (
  <div className={cn('flex flex-col gap-1.5', className)}>
    {label && <Label htmlFor={htmlFor}>{label}</Label>}
    {children}
  </div>
);

// Bloque "📎 Soportes": selector de archivos + lista de los ya cargados con botón para quitar.
const ListaSoportesUI = ({ titulo, inputProps, archivos, resumen, onQuitar }) => (
  <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-background p-4">
    <Label className="text-foreground"><Paperclip size={14} /> {titulo}</Label>
    <Input type="file" aria-label={titulo} className={claseInputArchivo} {...inputProps} />
    {archivos.length > 0 && (
      <div className="mt-2 flex flex-col gap-2">
        <p className="m-0 text-xs text-muted-foreground">{resumen}</p>
        {archivos.map(soporte => (
          <div key={soporte.id} className="flex items-center justify-between gap-2 rounded-md border border-solid border-border bg-card px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-semibold">{soporte.nombre}</p>
              <p className="m-0 text-xs text-muted-foreground">{(soporte.tamaño / 1024).toFixed(2)} KB</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onQuitar(soporte.id)} className="text-destructive" title="Quitar archivo" aria-label="Quitar archivo"><Trash2 size={16} /></Button>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Contenedor común de los modales (etapa 3 del sistema de diseño): fondo oscuro + Card con
// título, descripción opcional y contenido en columna.
const ModalUI = ({ titulo, descripcion, className, children }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
    <Card className={cn('max-h-[88vh] w-full max-w-md gap-4 overflow-y-auto px-0 py-6', className)}>
      <CardHeader className="sm:px-7">
        <CardTitle className="text-lg">{titulo}</CardTitle>
        {descripcion && <CardDescription>{descripcion}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:px-7">{children}</CardContent>
    </Card>
  </div>
);

// Archivos ya elegidos en un input (comprobantes), cada uno con su botón para quitarlo.
const ArchivosElegidosUI = ({ archivos, onQuitar, compacto = false }) => archivos.length > 0 && (
  <div className={cn('flex flex-col', compacto ? 'items-end gap-0.5' : 'gap-1.5')}>
    {archivos.map(c => (
      <div key={c.id} className={cn('flex items-center justify-between gap-2', !compacto && 'rounded-md border border-solid border-border bg-background px-3 py-1.5')}>
        <span className={cn('flex min-w-0 items-center gap-1 truncate text-success', compacto ? 'text-[0.7rem]' : 'text-xs')}><Check size={compacto ? 12 : 14} className="shrink-0" /> {c.nombre}</span>
        <Button variant="ghost" size="icon" onClick={() => onQuitar(c.id)} className={cn('shrink-0 text-destructive', compacto ? 'size-6' : 'size-7')} title="Quitar archivo" aria-label="Quitar archivo"><Trash2 size={compacto ? 12 : 14} /></Button>
      </div>
    ))}
  </div>
);

// Foto de perfil del colaborador — si no tiene foto cargada, muestra sus iniciales como avatar de respaldo.
const ColaboradorAvatar = ({ foto, nombre, size = 32, style = {} }) => {
  if (foto) {
    return <img src={foto} alt={nombre || 'Colaborador'} style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', objectFit: 'cover', border: '1px solid #E6E0D2', verticalAlign: 'middle', flexShrink: 0, ...style }} />;
  }
  const iniciales = (nombre || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, borderRadius: '50%', backgroundColor: '#E6E0D2', color: '#6B6458', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${Math.max(10, size * 0.4)}px`, fontWeight: 'bold', verticalAlign: 'middle', flexShrink: 0, ...style }}>
      {iniciales}
    </div>
  );
};

// Texto largo (Concepto/Detalle en Historial de Solicitudes y Finanzas) recortado a un resumen
// con "ver más" — antes un concepto largo (ej. una solicitud copiada de un mensaje de WhatsApp)
// ensanchaba toda la fila de la tabla, empujando el resto de columnas y dificultando comparar
// varias filas de un vistazo. Se define fuera de App (no anidado) para que el estado de
// "expandido" de cada fila sea independiente y no se resetee en cada render del componente padre.
const TextoResumido = ({ texto, maxLength = 90, style = {} }) => {
  const [expandido, setExpandido] = useState(false);
  const valor = (texto || '').toString();
  if (!valor) return <span style={style}>—</span>;
  if (valor.length <= maxLength) return <span style={style}>{valor}</span>;
  return (
    <span style={style}>
      {expandido ? valor : valor.slice(0, maxLength).trimEnd() + '…'}{' '}
      <button
        onClick={(e) => { e.stopPropagation(); setExpandido(!expandido); }}
        style={{ background: 'none', border: 'none', color: '#6C63D1', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', padding: 0, textDecoration: 'underline', whiteSpace: 'nowrap' }}
      >
        {expandido ? 'ver menos' : 'ver más'}
      </button>
    </span>
  );
};

// Quita tildes/acentos y pasa a minúsculas, para comparar nombres sin depender de que estén escritos idéntico.
const normalizarTexto = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// PRESUPUESTO — candidatos para vincular un gasto a un ítem de presupuesto, ordenados por relevancia.
// Antes solo se buscaba dentro del mismo CECO del gasto, pero eso rompía la vinculación en casos como
// los "gastos fijos" (ej. TIGO OFICINA): el concepto puede estar catalogado en un CECO distinto al que
// la persona elige al registrar el pago, y entonces no aparecía ninguna opción para vincular.
// Ahora se buscan candidatos en TODA la empresa (todos los CECO) y se ordenan así:
//   1) los que coinciden por texto —comparando por PALABRAS, no texto exacto, porque el responsable/
//      proveedor escrito en el gasto ("TIGO OFICINA PRINCIPAL") rara vez es idéntico al nombre corto
//      del concepto de presupuesto ("TIGO OFICINA")— de mayor a menor coincidencia. Esto es lo que
//      resuelve el caso de asociar por responsable/proveedor, incluso si el CECO no coincide.
//   2) a igual coincidencia de texto, se prioriza el concepto del mismo CECO que el gasto.
//   3) el resto de conceptos activos de la empresa, alfabético, por si se quiere vincular manualmente
//      algo que el texto no logró emparejar.
// La persona que registra el gasto siempre puede cambiar la sugerencia antes de guardar (sugerido +
// confirmado), y también se puede vincular/desvincular manualmente después desde la tabla de Gastos.
const getPresupuestoCandidatos = (empresa, ceco, responsable, detalle, items) => {
  const candidatos = (items || []).filter(p => p.activo !== false && p.empresa === empresa);
  const textoWords = normalizarTexto(`${responsable || ''} ${detalle || ''}`).split(/\s+/).filter(Boolean);
  const textoSet = new Set(textoWords);

  const conScore = candidatos.map(p => {
    const nombreWords = normalizarTexto(p.nombre).split(/\s+/).filter(w => w.length > 2);
    let score = 0;
    if (nombreWords.length && textoSet.size) {
      const coincidencias = nombreWords.filter(w => textoSet.has(w)).length;
      const requerido = Math.min(2, nombreWords.length); // al menos 2 palabras en común (o todas, si el nombre tiene 1)
      if (coincidencias >= requerido) score = coincidencias / nombreWords.length;
    }
    return { item: p, score, mismoCeco: p.ceco === ceco };
  });

  conScore.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.mismoCeco !== b.mismoCeco) return a.mismoCeco ? -1 : 1;
    return (a.item.nombre || '').localeCompare(b.item.nombre || '');
  });

  return conScore;
};

// DEDUCCIONES — cuánto de una deducción (préstamo u otro descuento) aplica en un mes puntual, calculado
// siempre a partir de fechaInicio/valorCuota/saldoTotal (nunca se guarda un historial de "ya se aplicó
// este mes"): así el valor es siempre consistente sin importar cuándo se consulte, y no hay riesgo de
// duplicar o saltarse una cuota. mesesTranscurridos = 0 en el mes de fechaInicio (primera cuota).
const mesesTranscurridos = (fechaInicio, anio, mes) => {
  if (!fechaInicio) return -1;
  const inicio = new Date(fechaInicio + 'T00:00:00');
  return (anio - inicio.getFullYear()) * 12 + (mes - (inicio.getMonth() + 1));
};

// Cuánto se descuenta ESE mes específico. Para 'Préstamo' deja de aplicar automáticamente en cuanto el
// saldo llega a 0 (la última cuota puede ser menor si el saldo restante es menor que la cuota fija).
const getCuotaAplicada = (deduccion, anio, mes) => {
  if (deduccion.activo === false) return 0;
  const transcurridos = mesesTranscurridos(deduccion.fechaInicio, anio, mes);
  if (transcurridos < 0) return 0;
  const cuota = parseFloat(deduccion.valorCuota) || 0;
  if (deduccion.tipo === 'Préstamo') {
    const saldoAntesDeEsteMe = (parseFloat(deduccion.saldoTotal) || 0) - cuota * transcurridos;
    if (saldoAntesDeEsteMe <= 0) return 0;
    return Math.min(cuota, saldoAntesDeEsteMe);
  }
  return cuota; // 'Otro' — recurrente todos los meses mientras esté activo
};

// Saldo que le queda al préstamo DESPUÉS de aplicar la cuota de ese mes (null si no es un préstamo).
const getSaldoPendienteEnMes = (deduccion, anio, mes) => {
  if (deduccion.tipo !== 'Préstamo') return null;
  const transcurridos = mesesTranscurridos(deduccion.fechaInicio, anio, mes);
  if (transcurridos < 0) return parseFloat(deduccion.saldoTotal) || 0;
  const cuota = parseFloat(deduccion.valorCuota) || 0;
  const saldoDespues = (parseFloat(deduccion.saldoTotal) || 0) - cuota * (transcurridos + 1);
  return Math.max(0, saldoDespues);
};

// CUENTAS DE COBRO — utilidades para el PDF automático (formato "Prestación de Servicios Profesionales").
// NIT de cada empresa de la holding, para el encabezado del documento.
// Tomados de los certificados de Cámara de Comercio de Medellín para Antioquia.
// ⚠️ ARKO no tiene certificado cargado todavía — completar apenas se tenga.
// Código del CECO por defecto "Pago a Terceros" (creado por supabase_fix_terceros_finanzas_link.sql).
// Se usa en dos lugares: (1) el auto-vínculo Solicitud -> Gasto (Opción C) lo asigna cuando
// genera el gasto sin que nadie haya elegido CECO a mano, y (2) en Finanzas, elegir este CECO
// en un Gasto normal también muestra el formulario de Tercero, sin necesidad de cambiar el
// campo "Tipo" a "Pago a Tercero".
const CECO_PAGO_TERCERO = 'CECO-015-PT';

// Valor centinela para newGasto.cuentaDestino cuando un Traslado va hacia una cuenta que NO es
// de ninguna empresa de la holding (ej. pagarle a un banco/entidad externa desde la cuenta de
// una de nuestras empresas) — en vez de elegir una cuenta del desplegable normal, se digitan
// Número de cuenta y Detalle a mano. No lleva "empresa: cuenta" (sin ": ") a propósito, para
// que getEmpresaDestinoTraslado() lo trate como "misma empresa que el origen" y no dispare la
// lógica de comparación de monedas entre dos empresas de la holding (aquí no aplica).
const CUENTA_DESTINO_EXTERNA = 'Empresa Externa';

// Texto exacto de "observaciones" que se guarda en el Gasto cuando lo genera automáticamente el
// batch "Marcar Pagado" de Presupuesto (Mensual). Se usa también en Historial de Finanzas para
// mostrar "🔗 Generado desde Presupuesto" (mismo patrón que solicitudOrigenId para Solicitudes,
// pero sin columna dedicada porque presupuesto_item_id ya se usa también para vínculos manuales).
const OBSERVACIONES_GASTO_DESDE_PRESUPUESTO = 'Generado automáticamente desde Presupuesto (Mensual) al marcar pagado.';

// Prefijo fijo que se guarda en "observaciones" para cada Gasto creado por "Registrar Facturas
// de un Tercero" (ver registrarFacturasTercero) — permite mostrar la etiqueta "🧾 Factura de
// tercero (lote)" en Historial de Finanzas sin depender de texto libre que alguien pudo editar.
const OBSERVACIONES_GASTO_LOTE_TERCERO = 'Factura de tercero registrada en lote';

const NIT_EMPRESAS = {
  'AM SPORTS GROUP SAS': '901219895-5',
  'PRO INVESTMENTS GLOBAL SAS': '901821315-6',
  'PRONOVA CAPITAL SAS': '901217839-3',
  'FOR SEVEN MEDIA SAS': '901804728-2',
  'ARKO': '(pendiente)'
};

// Razón social EXACTA de Cámara de Comercio, para imprimir en el PDF de Cuenta de Cobro.
// Solo hace falta cuando difiere del nombre interno que usa el resto del sistema (dropdowns,
// reportes, etc.) — por ahora únicamente FOR SEVEN MEDIA SAS está registrada como "FOR 7 MEDIA S.A.S".
const RAZON_SOCIAL_LEGAL = {
  'FOR SEVEN MEDIA SAS': 'FOR 7 MEDIA S.A.S'
};
const getRazonSocialLegal = (empresa) => RAZON_SOCIAL_LEGAL[empresa] || empresa;

// Fecha de hoy en hora local (Colombia) como 'AAAA-MM-DD'. new Date().toISOString() da la fecha
// en UTC, que después de las 7 p. m. ya es "mañana".
const fechaHoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Convierte un entero (parte de pesos, sin decimales) a su representación en letras en español.
// Cubre hasta 999.999.999 — más que suficiente para cualquier cuenta de cobro real.
const numeroALetras = (numero) => {
  const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const DIEZ_A_DIECINUEVE = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  const trescientosNoventaYNueveOMenos = (n) => {
    if (n === 0) return '';
    if (n < 10) return UNIDADES[n];
    if (n < 20) return DIEZ_A_DIECINUEVE[n - 10];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      if (d === 2) return u === 0 ? 'veinte' : (u === 1 ? 'veintiún' : `veinti${UNIDADES[u]}`);
      return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
    }
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${trescientosNoventaYNueveOMenos(resto)}`;
  };

  const bloqueDeTres = (n, singular, plural) => {
    if (n === 0) return '';
    if (n === 1 && singular) return singular;
    return `${trescientosNoventaYNueveOMenos(n)} ${plural}`;
  };

  const entero = Math.floor(Math.abs(numero || 0));
  if (entero === 0) return 'cero';

  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const resto = entero % 1000;

  const partes = [];
  if (millones > 0) partes.push(bloqueDeTres(millones, 'un millón', 'millones'));
  if (miles > 0) partes.push(miles === 1 ? 'mil' : `${trescientosNoventaYNueveOMenos(miles)} mil`);
  if (resto > 0) partes.push(trescientosNoventaYNueveOMenos(resto));

  return partes.join(' ').replace(/\s+/g, ' ').trim();
};

// "Un millón doscientos trece mil novecientos cinco pesos" a partir de 1213905
const valorEnLetrasPesos = (valor) => {
  const texto = numeroALetras(valor);
  const capitalizado = texto.charAt(0).toUpperCase() + texto.slice(1);
  return `${capitalizado} pesos`;
};

const App = () => {
  // MONEDA POR EMPRESA — ARKO opera en dólares, el resto de la holding en pesos colombianos
  // DEBE ir primero: se usa en cálculos que aparecen más abajo en el componente.
  const getMoneda = (empresa) => empresa === 'ARKO' ? 'USD' : 'COP';

  const formatMoneyByMoneda = (valor, moneda) => {
    // Espacio irrompible ( ) entre el signo y el número: evita que las tablas angostas
    // partan la línea dejando el signo de moneda arriba y el número abajo.
    const num = parseFloat(valor) || 0;
    if (moneda === 'USD') {
      return `US$ ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$ ${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
  };

  const formatMoney = (valor, empresa) => formatMoneyByMoneda(valor, getMoneda(empresa));

  // Traslado: la Cuenta Destino se guarda como "EMPRESA: CUENTA" cuando cruza a otra empresa
  // (ver el desplegable "Cuenta Destino" del formulario), o solo el nombre de la cuenta cuando
  // el destino es la misma empresa de origen. Esta función resuelve la empresa del destino en
  // ambos casos, para poder comparar su moneda contra la de la empresa de origen.
  const getEmpresaDestinoTraslado = (cuentaDestino, empresaOrigen) =>
    (cuentaDestino && cuentaDestino.includes(': ')) ? cuentaDestino.split(': ')[0] : empresaOrigen;

  // Data - DEBE ir primero
  const rolesSensibles = ['Administrador', 'Contadora', 'Coordinadora Administrativa'];

  const empresas = ['AM SPORTS GROUP SAS', 'PRO INVESTMENTS GLOBAL SAS', 'PRONOVA CAPITAL SAS', 'FOR SEVEN MEDIA SAS', 'ARKO'];
  const estadosSolicitud = ['Pendiente', 'Aprobado', 'Devuelto', 'Pagado', 'Legalizado'];
  const tiposSolicitud = ['Anticipo', 'Legalización', 'Reembolso', 'Pago a Tercero', 'Legalización T. Pro', 'Comisión'];
  // Tipos con un solo valor digitado (no por ítems): Anticipo y Comisión.
  const esTipoValorUnico = (tipo) => tipo === 'Anticipo' || tipo === 'Comisión';
  const tiposSoporte = ['Factura/Electrónica', 'Recibo/Entradas', 'Consignación', 'Cuenta de Cobro', 'Efectivo/T.Personal', 'Otro'];

  // "Legalización T. Pro": gastos pagados con efectivo o tarjeta personal del colaborador (no hay
  // anticipo previo de la empresa). Hoy solo aplica a este colaborador — ver el botón "Usar
  // seleccionados en Legalización T. Pro" en Mi Bandeja de Soportes, que solo él ve.
  const COLABORADOR_LEGALIZACION_TPRO = 'Luis Rivas';
  // Flujo reducido a 3 estados (sin Aprobado/Pagado): el colaborador ya pagó de su bolsillo, así
  // que no hay "aprobar antes de pagar" — Administrador/Coordinadora revisan y la pasan directo a
  // "Legalizado" (eso genera el Gasto en Finanzas automáticamente, igual que "Pagado" en los
  // demás tipos).
  const estadosSolicitudLegalizacionTPro = ['Pendiente', 'Devuelto', 'Legalizado'];
  const estadosParaSolicitud = (s) => s.tipo === 'Legalización T. Pro' ? estadosSolicitudLegalizacionTPro : estadosSolicitud;

  // PRESUPUESTO — datos iniciales migrados del PDF "PRESUPUESTO PARA MIGRAR" (conceptos recurrentes mensuales).
  // Quedan como punto de partida editable desde "Gestión de Conceptos"; no se incluyó CUBO (no es una de las 5 empresas
  // del sistema todavía) ni los 2 ítems de CECO-008-TRS (Tarjeta BBVA / Capitalización — son traslados, no gasto recurrente)
  // ni "Diezmo Comunidad" (el PDF no trae un valor). CECO-005-AM se mapeó a CECO-005-OT (Otros), el código más cercano
  // que existe hoy en el sistema.
  const presupuestoSeedData = [
    { id: 1, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'ALEJANDRO MEJIA', tipo: 'Prestación de Servicio', valorMensual: 2628016, diaLimitePago: '16' },
    { id: 2, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'ARNULFO BEITAR', tipo: 'Prestación de Servicio', valorMensual: 2190800, diaLimitePago: '16' },
    { id: 3, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-002-NM', nombre: 'CRISTIAN GIRALDO', tipo: 'Nómina', valorMensual: 3352609, diaLimitePago: '16' },
    { id: 4, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'CRISTIAN TABARES', tipo: 'Prestación de Servicio', valorMensual: 2190800, diaLimitePago: '16' },
    { id: 5, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'DAVID ANDRADE', tipo: 'Prestación de Servicio', valorMensual: 672105, diaLimitePago: '16' },
    { id: 6, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'DANIEL DARIO RIOS', tipo: 'Prestación de Servicio', valorMensual: 702810, diaLimitePago: '16' },
    { id: 7, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'JAMELL RAMOS', tipo: 'Prestación de Servicio', valorMensual: 3830360, diaLimitePago: '16' },
    { id: 8, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'JOSE DAVID MARTINEZ', tipo: 'Prestación de Servicio', valorMensual: 1665300, diaLimitePago: '16' },
    { id: 9, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-002-NM', nombre: 'LUIS RIVAS', tipo: 'Nómina', valorMensual: 1859928, diaLimitePago: '16' },
    { id: 10, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'SARA COBALEDA', tipo: 'Prestación de Servicio', valorMensual: 3678500, diaLimitePago: '16' },
    { id: 11, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'WILFER ZAPATA', tipo: 'Prestación de Servicio', valorMensual: 1665300, diaLimitePago: '16' },
    { id: 12, empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-004-HR', nombre: 'JULIAN STIVEN QUEVEDO', tipo: 'Gasto de Representación', valorMensual: 300000, diaLimitePago: '16' },

    { id: 13, empresa: 'PRO INVESTMENTS GLOBAL SAS', ceco: 'CECO-004-HR', nombre: 'CAREN GARZÓN', tipo: 'Nómina', valorMensual: 2500000, diaLimitePago: '16' },
    { id: 14, empresa: 'PRO INVESTMENTS GLOBAL SAS', ceco: 'CECO-004-HR', nombre: 'SANTIAGO ESPINOSA', tipo: 'Prestación de Servicio', valorMensual: 5500000, diaLimitePago: '16' },
    { id: 15, empresa: 'PRO INVESTMENTS GLOBAL SAS', ceco: 'CECO-004-HR', nombre: 'SERGIO MEJIA', tipo: 'Prestación de Servicio', valorMensual: 1600000, diaLimitePago: '16' },
    { id: 16, empresa: 'PRO INVESTMENTS GLOBAL SAS', ceco: 'CECO-004-HR', nombre: 'SARA COBALEDA', tipo: 'Prestación de Servicio', valorMensual: 3678500, diaLimitePago: '16' },

    { id: 17, empresa: 'PRONOVA CAPITAL SAS', ceco: 'CECO-005-OT', nombre: 'ANDREI MARTINEZ', tipo: 'Prestación de Servicio', valorMensual: 20000000, diaLimitePago: '11' },
    { id: 18, empresa: 'PRONOVA CAPITAL SAS', ceco: 'CECO-004-HR', nombre: 'LUIS RIVAS', tipo: 'Prestación de Servicio', valorMensual: 2186080, diaLimitePago: '16' },
    { id: 19, empresa: 'PRONOVA CAPITAL SAS', ceco: 'CECO-003-GR', nombre: 'FLYPASS', tipo: 'Otro', valorMensual: 1000000, diaLimitePago: '11' },
    { id: 20, empresa: 'PRONOVA CAPITAL SAS', ceco: 'CECO-001-GF', nombre: 'TIGO TORRE OASIS', tipo: 'Telecomunicaciones', valorMensual: 210000, diaLimitePago: '11' },
    { id: 21, empresa: 'PRONOVA CAPITAL SAS', ceco: 'CECO-001-GF', nombre: 'TIGO OFICINA', tipo: 'Telecomunicaciones', valorMensual: 299974, diaLimitePago: '5' },
    { id: 22, empresa: 'PRONOVA CAPITAL SAS', ceco: 'CECO-001-GF', nombre: 'SUB ARRIENDO OFICINA (PAGO A CUBO)', tipo: 'Arriendo', valorMensual: 6672309, diaLimitePago: '2' },
    { id: 23, empresa: 'PRONOVA CAPITAL SAS', ceco: 'CECO-001-GF', nombre: 'EPM TORRE OASIS', tipo: 'Servicios Públicos', valorMensual: 304000, diaLimitePago: '16' },
    { id: 24, empresa: 'PRONOVA CAPITAL SAS', ceco: 'CECO-003-GR', nombre: 'UNIVERSIDAD JOSE Y LERMA (Acompañamiento Jugadores)', tipo: 'Prestación de Servicio', valorMensual: 927000, diaLimitePago: '16' },
    { id: 25, empresa: 'PRONOVA CAPITAL SAS', ceco: 'CECO-004-HR', nombre: 'DANIEL DARIO RIOS', tipo: 'Prestación de Servicio', valorMensual: 15000000, diaLimitePago: '' },

    { id: 26, empresa: 'FOR SEVEN MEDIA SAS', ceco: 'CECO-004-HR', nombre: 'SANTIAGO TARQUINO', tipo: 'Prestación de Servicio', valorMensual: 6500000, diaLimitePago: '16' },
    { id: 27, empresa: 'FOR SEVEN MEDIA SAS', ceco: 'CECO-004-HR', nombre: 'JUAN CAMILO DUARTE', tipo: 'Prestación de Servicio', valorMensual: 2102000, diaLimitePago: '16' },
    { id: 28, empresa: 'FOR SEVEN MEDIA SAS', ceco: 'CECO-004-HR', nombre: 'FABIO ANDRES GALEANO', tipo: 'Prestación de Servicio', valorMensual: 2000000, diaLimitePago: '16' },
    { id: 29, empresa: 'FOR SEVEN MEDIA SAS', ceco: 'CECO-004-HR', nombre: 'JERONIMO GIRALDO', tipo: 'Prestación de Servicio', valorMensual: 2000000, diaLimitePago: '16' },

    { id: 30, empresa: 'ARKO', ceco: 'CECO-004-HR', nombre: 'TONY', tipo: 'Prestación de Servicio', valorMensual: 300, diaLimitePago: '16' },
    { id: 31, empresa: 'ARKO', ceco: 'CECO-004-HR', nombre: 'ESTEBAN ESPINDOLA', tipo: 'Prestación de Servicio', valorMensual: 3200, diaLimitePago: '16' },
    { id: 32, empresa: 'ARKO', ceco: 'CECO-004-HR', nombre: 'NESTOR OVIDIO', tipo: 'Prestación de Servicio', valorMensual: 155.10, diaLimitePago: '11' }
  ].map(item => ({ ...item, activo: true }));
  const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  // Los CECOs YA NO son una lista fija en el código — viven en la tabla public.cecos de Supabase
  // (cargarCecos/cecosDB más abajo) para que Administrador/Coordinadora Administrativa puedan
  // crear o editar códigos a futuro desde la propia app, sin necesidad de tocar código.
  const cuentasPorEmpresa = {
    'AM SPORTS GROUP SAS': ['CUENTA BANCOLOMBIA', 'CUENTA BBVA'],
    'PRO INVESTMENTS GLOBAL SAS': ['CUENTA BANCOLOMBIA'],
    'PRONOVA CAPITAL SAS': ['CUENTA BANCOLOMBIA'],
    'FOR SEVEN MEDIA SAS': ['CUENTA BANCOLOMBIA'],
    'ARKO': ['JPMORGAN'],
    'CUBO': ['BANCOLOMBIA', 'ITAU', 'BTG', 'BBVA']
  };
  const tiposTransaccion = ['Gasto', 'Ingreso', 'Traslado'];

  // Estados
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authChecking, setAuthChecking] = useState(true); // true mientras se revisa si ya hay una sesión activa de Supabase
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // OLVIDÉ MI CONTRASEÑA — paso 1 (pantalla de login): pedir el link por correo.
  const [mostrarOlvidoPassword, setMostrarOlvidoPassword] = useState(false);
  const [emailRecuperacion, setEmailRecuperacion] = useState('');
  const [enviandoRecuperacion, setEnviandoRecuperacion] = useState(false);
  const [recuperacionEnviada, setRecuperacionEnviada] = useState(false);
  // OLVIDÉ MI CONTRASEÑA — paso 2: la persona vuelve a la app desde el link del correo. Supabase
  // agrega "type=recovery" a la URL — se detecta una sola vez, al cargar, para no dejarla entrar
  // directo a la app con la sesión del link sin antes poner una contraseña nueva.
  const [recuperandoPassword, setRecuperandoPassword] = useState(() =>
    typeof window !== 'undefined' && (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery'))
  );
  const [nuevaPasswordRecuperacion, setNuevaPasswordRecuperacion] = useState('');
  const [confirmarPasswordRecuperacion, setConfirmarPasswordRecuperacion] = useState('');
  const [guardandoPasswordRecuperacion, setGuardandoPasswordRecuperacion] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  // Solicitudes (Anticipo/Legalización/Reembolso) — conectado a Supabase (tabla public.solicitudes).
  // Los soportes de Legalización/Reembolso se siguen uniendo en un solo PDF consolidado
  // (mergeSoportesToPDF), pero ese PDF ya no se guarda embebido en la solicitud: se sube al
  // bucket Storage "soportes" con su fila en la tabla public.soportes.
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true);
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);
  // Usuarios — ya no vive en localStorage: se trae de la tabla public.usuarios de Supabase
  // (cargarUsuarios/usuarioDBToLocal más abajo). responsables/usuariosAdmin son vistas
  // derivadas de esa misma lista según el rol real, para no tener que tocar el resto del
  // código que ya las usa (dropdowns, cumpleaños, ranking del dashboard, etc.).
  const [usuariosDB, setUsuariosDB] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [subiendoDocumento, setSubiendoDocumento] = useState(null); // 'documentoCedula' | 'documentoPasaporte' | null
  // CECOs — catálogo dinámico desde public.cecos (ver comentario más abajo, junto a `cecos`).
  const [cecosDB, setCecosDB] = useState([]);
  const [cargandoCecos, setCargandoCecos] = useState(true);
  // Terceros guardados (catálogo reutilizable de personas/empresas a quienes se les hace un
  // "Pago a Tercero") — se guarda una vez y queda disponible para todos, para no volver a
  // digitar nombre/DNI/datos bancarios cada vez que se repite el pago a la misma persona.
  const [tercerosDB, setTercerosDB] = useState([]);
  // Catálogo COMPLETO de terceros (activos e inactivos) para la pantalla "Gestión de
  // Terceros" en Finanzas — a diferencia de tercerosDB (solo activos, usado en los
  // desplegables de Solicitudes/Finanzas), aquí se necesita ver también los desactivados
  // para poder reactivarlos, igual que ya pasa con Gestión de CECOs.
  const [todosTerceros, setTodosTerceros] = useState([]);
  const [mostrarGestionTerceros, setMostrarGestionTerceros] = useState(false);
  const terceroVacio = { nombre: '', dni: '', tipoDocumento: '', paisOrigen: '', banco: '', codigoBanco: '', tipoCuenta: '', numeroCuenta: '' };
  const [nuevoTercero, setNuevoTercero] = useState(terceroVacio);
  const [guardandoTercero, setGuardandoTercero] = useState(false);
  const responsables = usuariosDB.filter(u => u.rol === 'Responsable');
  const usuariosAdmin = usuariosDB.filter(u => u.rol !== 'Responsable');
  // Lista aparte para Finanzas: un Gasto/Ingreso/Traslado puede quedar a nombre de
  // CUALQUIER persona de la compañía (Gerente, Coordinadora, Contadora, Administrador),
  // no solo de quienes tienen el rol "Responsable" — a diferencia de `responsables`
  // (que sigue igual para no afectar Colaboradores, Solicitudes ni el ranking del
  // Dashboard, donde sí corresponde solo mirar ese rol).
  const personasFinanzas = usuariosDB;
  // CECOs (Centros de Costo/Ingreso) — catálogo editable en Supabase (tabla public.cecos).
  // `cecos` = catálogo completo (activos e inactivos, se usa para mostrar el nombre de CECOs
  // viejos en registros históricos). `cecosGasto`/`cecosIngreso`/`cecosTraslado` = solo los
  // activos de cada tipo, para los desplegables del formulario de Finanzas (Gasto usa
  // CECO-xxx, Ingreso usa CEIN-xxx, Traslado usa su propia categoría "Traslado").
  const cecos = cecosDB;
  const cecosGasto = cecosDB.filter(c => c.tipo === 'Gasto' && c.activo !== false).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const cecosIngreso = cecosDB.filter(c => c.tipo === 'Ingreso' && c.activo !== false).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const CECO_TRASLADO_FIJO = 'CEIN-003-ACPT';
  // Traslado tenía un único código fijo (CEIN-003-ACPT, "Traslado Recibido") sin desplegable.
  // Desde esta sesión, la persona elige entre los CECOs de la categoría "Traslado" (creados
  // desde Gestión de CECOs) — CEIN-003-ACPT se deja como una opción más, sin romper los
  // traslados históricos que ya lo usan, aunque su tipo en la base siga siendo "Ingreso".
  const cecosTraslado = [
    ...cecosDB.filter(c => c.tipo === 'Traslado' && c.activo !== false),
    ...cecosDB.filter(c => c.codigo === CECO_TRASLADO_FIJO && c.tipo !== 'Traslado'),
  ].sort((a, b) => a.codigo.localeCompare(b.codigo));
  // MI PERFIL — autoedición para cualquier rol. "miPerfil" se deriva de usuariosDB (que ya
  // trae solo la propia fila para roles no admin, gracias a la política RLS "cualquiera ve su
  // propia fila"); "miPerfilForm" es el borrador editable antes de guardar.
  const miPerfil = usuariosDB.find(u => u.id === user?.id) || null;
  const [miPerfilForm, setMiPerfilForm] = useState(null);
  const [guardandoMiPerfil, setGuardandoMiPerfil] = useState(false);
  // Cambiar mi contraseña — formulario aparte, con su propio estado (no vive en miPerfilForm
  // porque no se guarda en la tabla "usuarios": va directo a Supabase Auth).
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(false);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [subiendoMiArchivo, setSubiendoMiArchivo] = useState(null); // 'foto' | 'documentoCedula' | 'documentoPasaporte' | null
  // Vista pública limitada (public.colaboradores_publico): nombre, foto, cargo y cumpleaños de
  // TODOS los usuarios, para que cualquiera pueda ver el directorio/cumpleaños del mes sin
  // exponer cédula, banco ni documentos de nadie (eso solo lo ve Admin/Coordinadora o el dueño).
  const [colaboradoresPublico, setColaboradoresPublico] = useState([]);
  const [editingResponsableOrigen, setEditingResponsableOrigen] = useState('responsables'); // 'responsables' | 'admin' — de qué lista viene el registro que se está editando
  const [newSolicitud, setNewSolicitud] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: '', valor: '', valorAnticipoOriginal: '', anticipoIds: [], detalle: '', empresa: 'AM SPORTS GROUP SAS', documentos: [], moneda: 'COP', terceroId: '', terceroNombre: '', terceroDni: '', terceroTipoDocumento: '', terceroPaisOrigen: '', terceroBanco: '', terceroCodigoBanco: '', terceroTipoCuenta: '', terceroNumeroCuenta: '', guardarTercero: true, actualizarTercero: false });
  // Edición de una Solicitud ya guardada — solo se permite mientras está en estado Pendiente
  // (quien la creó, o Administrador/Coordinadora Administrativa). Reutiliza el mismo formulario
  // "Nueva Solicitud" de arriba: al editar, se precarga newSolicitud con los datos existentes y
  // este id queda distinto de null — handleAddSolicitud hace UPDATE en vez de INSERT. El Tipo NO
  // se deja cambiar en edición (cambiaría toda la estructura de campos/documentos).
  const [editingSolicitudId, setEditingSolicitudId] = useState(null);
  // Soportes sueltos para "completar" una solicitud ya guardada (ej. la factura que faltó subir
  // al crearla) — se suben directo como archivos independientes de esa solicitud, SIN tocar el
  // PDF consolidado que ya se generó (evita el riesgo de tener que regenerarlo).
  const [soportesAdicionalesEdicion, setSoportesAdicionalesEdicion] = useState([]);
  // Soportes de "Pago a Tercero" — archivos simples adjuntos (foto/PDF/etc.), cada uno una fila
  // propia en public.soportes (igual que los de Gasto/Ingreso), a diferencia de los de
  // Legalización/Reembolso que se unen en un solo PDF al guardar.
  const [soportesTerceroTemp, setSoportesTerceroTemp] = useState([]);
  const [generandoPDF, setGenerandoPDF] = useState(null);
  // Filtros del historial de Solicitudes: buscador de texto libre + selectores puntuales para
  // Tipo/Estado/Empresa + rango de fechas — mismo patrón que se usó en el historial de Finanzas.
  const [busquedaSolicitudes, setBusquedaSolicitudes] = useState('');
  const [filtroSolicitudesTipo, setFiltroSolicitudesTipo] = useState('Todos');
  const [filtroSolicitudesEstado, setFiltroSolicitudesEstado] = useState('Todos');
  const [filtroSolicitudesEmpresa, setFiltroSolicitudesEmpresa] = useState('Todas');
  const [filtroSolicitudesFechaInicio, setFiltroSolicitudesFechaInicio] = useState('');
  const [filtroSolicitudesFechaFin, setFiltroSolicitudesFechaFin] = useState('');
  const [editingResponsableId, setEditingResponsableId] = useState(null);
  const responsableVacio = { nombre: '', email: '', empresa: 'AM SPORTS GROUP SAS', foto: '', cedula: '', telefono: '', fechaNacimiento: '', cargo: '', fechaIngreso: '', tipoVinculacion: '', contactoEmergenciaNombre: '', contactoEmergenciaTelefono: '', eps: '', arl: '', funciones: '', banco: '', codigoBanco: '', tipoDocumento: '', tipoCuentaBancaria: '', numeroCuenta: '', titularCuenta: '', documentoCedula: null, documentoPasaporte: null };
  const [newResponsable, setNewResponsable] = useState(responsableVacio);
  const [newUserType, setNewUserType] = useState('Colaborador');
  // Cuentas de Cobro — conectado a Supabase (tabla public.cuentas_cobro). Cada archivo de
  // soporte se sube por separado al bucket "soportes" (no se unen en un solo PDF, a diferencia
  // de Solicitudes) y queda registrado en public.soportes con entidad_tipo='cuenta_cobro'.
  const [cuentasDeCobro, setCuentasDeCobro] = useState([]);
  const [cargandoCuentasCobro, setCargandoCuentasCobro] = useState(true);
  const [guardandoCuentaCobro, setGuardandoCuentaCobro] = useState(false);
  // Cuenta de Cobro ahora es semi-automática: el colaborador solo elige el mes que está
  // cobrando, el valor y (si aplica) ajusta la descripción de funciones. Nombre, cédula,
  // empresa, NIT, cargo y datos bancarios se toman de su propio perfil (Colaboradores).
  // empresa: '' hasta que el colaborador elija (o se usa user.empresa por defecto en el render/al
  // guardar) — así un mismo colaborador puede crear una Cuenta de Cobro por cada empresa de la
  // holding a la que le facture, en vez de quedar fijo a la empresa de su perfil.
  const [newCuentaCobro, setNewCuentaCobro] = useState({ mes: new Date().getMonth() + 1, anio: new Date().getFullYear(), ciudad: 'Medellín', monto: '', funciones: '', estado: 'Pendiente', empresa: '' });
  // Cuentas de Cobro solo maneja estos 3 estados (el check constraint de la tabla no admite
  // "Legalizado" — ese estado es propio de Solicitudes). No reutilizar estadosSolicitud aquí.
  const estadosCuentaCobro = ['Pendiente', 'Aprobado', 'Pagado'];
  const [filtroCuentasEstado, setFiltroCuentasEstado] = useState('Todos');
  // Administrador y Coordinadora gestionan las cuentas de cobro de todos: su propio formulario de
  // "Nueva Cuenta de Cobro" arranca plegado para no confundirlo con las cuentas de los colaboradores.
  const [mostrarNuevaCuentaCobro, setMostrarNuevaCuentaCobro] = useState(false);
  // Finanzas: el formulario "Nuevo Gasto/Ingreso" arranca plegado y se despliega con un clic.
  const [mostrarNuevoMovimientoFinanzas, setMostrarNuevoMovimientoFinanzas] = useState(false);
  const [filtroCuentasMes, setFiltroCuentasMes] = useState('Todos'); // 'Todos' | 'AAAA-M' (mes cobrado)
  const [filtroCuentasEmpresa, setFiltroCuentasEmpresa] = useState('Todas');
  // Gastos/Ingresos — conectado a Supabase (tablas public.gastos / public.ingresos). Los soportes de cada
  // registro NUEVO se suben al bucket "soportes" (uno por uno, igual que Cuentas de Cobro). Los registros
  // HISTÓRICOS migrados desde el Drive/Excel anterior no traen archivo subido — en su lugar guardan
  // soporteDriveLink (el link de Drive tal cual), que solo abre esa URL en vez de pasar por Storage.
  const [gastos, setGastos] = useState([]);
  const [ingresos, setIngresos] = useState([]);
  const [cargandoGastos, setCargandoGastos] = useState(true);
  const [cargandoIngresos, setCargandoIngresos] = useState(true);
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);
  const [newGasto, setNewGasto] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'Gasto', empresa: 'AM SPORTS GROUP SAS', responsable: '', ceco: 'CECO-001-GF', cuenta: '', detalle: '', valor: '', valorDestino: '', categoria: '', estado: 'Pendiente', observaciones: '', linkSoporte: '', cuentaSalida: '', cuentaDestino: '', cuentaDestinoExternaNumero: '', cuentaDestinoExternaDetalle: '', soportes: [], presupuestoItemId: '', aplicarDeduccion: true, moneda: 'COP', terceroId: '', terceroNombre: '', terceroDni: '', terceroTipoDocumento: '', terceroPaisOrigen: '', terceroBanco: '', terceroCodigoBanco: '', terceroTipoCuenta: '', terceroNumeroCuenta: '', guardarTercero: true, actualizarTercero: false });
  const [newIngreso, setNewIngreso] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'Ingreso', empresa: 'AM SPORTS GROUP SAS', responsable: '', ceco: 'CEIN-001-ING', detalle: '', valor: '', categoria: '', estado: 'Pagado', observaciones: '', linkSoporte: '', cuenta: '', soportes: [] });
  // Subir un soporte sobreviniente (o varios) a un Gasto/Ingreso YA guardado, directo desde la
  // fila del Historial — sin reabrir el formulario ni tocar el resto del registro. `id` guarda
  // sobre qué fila del Historial está abierto el selector de archivos ahora mismo.
  const [agregandoSoporteId, setAgregandoSoporteId] = useState(null);
  // El formulario/lógica de "Información del Tercero" en Finanzas se activa no solo eligiendo
  // el Tipo "Pago a Tercero", sino también al dejar el Tipo en "Gasto" pero elegir el CECO
  // "Pago a Terceros" (CECO_PAGO_TERCERO) — así un gasto categorizado bajo ese CECO también
  // puede quedar con los datos del tercero, sin obligar a cambiar el campo Tipo.
  const esPagoTerceroFinanzas = newGasto.tipo === 'Pago a Tercero' || (newGasto.tipo === 'Gasto' && newGasto.ceco === CECO_PAGO_TERCERO);
  // Filtros de la lista histórica unificada de Finanzas (Gastos + Ingresos + Traslados en
  // una sola tabla, en vez de las 3 tablas separadas que había antes). `filtroTipoFinanzas`
  // ya existía (pill de Todos/Gasto/Traslado/Ingreso); los demás se agregaron para poder
  // filtrar por cualquier campo del historial sin llenar la pantalla de un selector por
  // columna: un buscador de texto libre + selectores puntuales para Empresa/CECO + rango
  // de fechas propio de la tabla (distinto del que ya existía para el Dashboard de arriba).
  const [filtroTipoFinanzas, setFiltroTipoFinanzas] = useState('Todos');
  const [busquedaFinanzas, setBusquedaFinanzas] = useState('');
  const [filtroFinanzasEmpresa, setFiltroFinanzasEmpresa] = useState('Todas');
  const [filtroFinanzasCeco, setFiltroFinanzasCeco] = useState('Todos');
  const [filtroFinanzasFechaInicio, setFiltroFinanzasFechaInicio] = useState('');
  const [filtroFinanzasFechaFin, setFiltroFinanzasFechaFin] = useState('');
  // Rango de valor (mínimo/máximo) del historial — mismo patrón que el rango de fechas. Se
  // guarda como texto para aceptar lo que la gente escribe ("1.500.000", "1500000", "70,88").
  const [filtroFinanzasValorMin, setFiltroFinanzasValorMin] = useState('');
  const [filtroFinanzasValorMax, setFiltroFinanzasValorMax] = useState('');
  // FACTURAS DE UN TERCERO EN LOTE (ej. Caelum manda varias facturas de distintos colaboradores
  // y se paga todo junto con un solo comprobante del banco): un único modal — se elige el Tipo
  // "🧾 Pago a Tercero en Lote" en el formulario de Nuevo Gasto/Ingreso — pide Empresa/Cuenta/
  // Tercero/CECO una sola vez, una línea por colaborador (Colaborador + Valor + su propia
  // factura), y al final UN comprobante de pago compartido para todo el lote. Al registrar, crea
  // un Gasto YA "Pagado" por cada colaborador (con su propia factura) y refleja el mismo
  // comprobante de pago en todos (se sube una sola vez, sin duplicar el archivo en Storage —
  // mismo patrón que ya usa generarMovimientoDesdeSolicitud para copiar soportes).
  const [registrarFacturasTercero, setRegistrarFacturasTercero] = useState(null);
  const [guardandoFacturasTercero, setGuardandoFacturasTercero] = useState(false);
  // Gestión de CECOs (Administrador y Coordinadora Administrativa) — crear/editar códigos
  // sin tocar código de la app. Panel colapsable dentro de Finanzas.
  const [mostrarGestionCecos, setMostrarGestionCecos] = useState(false);
  const [nuevoCeco, setNuevoCeco] = useState({ codigo: '', nombre: '', tipo: 'Gasto' });
  const [guardandoCeco, setGuardandoCeco] = useState(false);
  const [soportesTemp, setSoportesTemp] = useState([]);
  const [soportesCuentaCobroTemp, setSoportesCuentaCobroTemp] = useState([]);
  const [soportesLegalizacionTemp, setSoportesLegalizacionTemp] = useState([]);
  // BANDEJA DE SOPORTES — cada colaborador va subiendo sus recibos/facturas a medida que le
  // llegan (con sus datos básicos), ANTES de decidir si van en una Legalización o un Reembolso.
  // Al usarlos, quedan marcados "usado" y ligados a la solicitud que los consumió (nunca se
  // borran solos) — tabla public.soportes_pendientes.
  const [soportesPendientes, setSoportesPendientes] = useState([]);
  const [cargandoSoportesPendientes, setCargandoSoportesPendientes] = useState(true);
  const [seleccionPendientes, setSeleccionPendientes] = useState([]);
  // Toggle "Ver todos" / "Ver solo el último" en Mi Bandeja de Soportes — para no tener que
  // desplazarse tanto cuando hay muchos recibos acumulados. false = ver todos (como siempre).
  const [bandejaSoloUltimo, setBandejaSoloUltimo] = useState(false);
  const nuevoSoportePendienteVacio = { fecha: new Date().toISOString().split('T')[0], proveedor: '', nit: '', descripcion: '', valor: '', tipoSoporte: '', archivo: null };
  const [nuevoSoportePendiente, setNuevoSoportePendiente] = useState(nuevoSoportePendienteVacio);
  const [subiendoSoportePendiente, setSubiendoSoportePendiente] = useState(false);
  // Edición en línea de un recibo ya guardado en la bandeja (Fecha/Pagado a/NIT/Concepto/Valor/
  // Tipo) — reemplaza la fila por inputs mientras se edita; el archivo en sí no se reemplaza
  // desde aquí (para eso hay que eliminar y volver a subir).
  const [editandoPendienteId, setEditandoPendienteId] = useState(null);
  const [pendienteEditData, setPendienteEditData] = useState(null);
  const [guardandoEdicionPendiente, setGuardandoEdicionPendiente] = useState(false);
  // Ids de la bandeja que quedaron "en uso" al prellenar el formulario de Nueva Solicitud
  // (ver handleUsarPendientesEnSolicitud) — se marcan usado=true recién cuando la solicitud
  // se guarda con éxito, nunca antes.
  const [pendientesEnUso, setPendientesEnUso] = useState([]);
  const [verSoportes, setVerSoportes] = useState(null);
  // Contexto de qué entidad está abierta en el modal "Ver Soportes" — solo se llena al abrirlo
  // desde una Solicitud (handleVerSoportesSolicitud); el resto de llamadores (Gasto, Ingreso,
  // Cuenta de Cobro, Pago a Tercero) lo dejan null, así que ahí el botón 🗑️ Eliminar no aparece
  // (se pidió puntualmente para Solicitudes). `puedeEliminar` replica el mismo criterio que ya
  // decide si se puede editar la solicitud (puedeEditarSolicitud).
  const [verSoportesContexto, setVerSoportesContexto] = useState(null);
  const [eliminandoSoporteId, setEliminandoSoporteId] = useState(null);
  // Pago a Tercero: la coordinadora administrativa necesita ver de un vistazo los datos
  // bancarios del tercero para poder pagar — este modal muestra esa ficha sin tener que
  // abrir el PDF ni "Ver Soportes". Guarda la solicitud completa (trae terceroInfo embebido).
  const [verDetalleTercero, setVerDetalleTercero] = useState(null);
  // Modal "Confirmar Pago" — al marcar una Solicitud de Pago a Tercero como "Pagado", pide
  // antes la Cuenta de la empresa usada y el comprobante del banco, antes de generar el Gasto
  // automático en Finanzas (Opción C). null = modal cerrado.
  // Modal "Confirmar Pago" (Opción C, extendida a Pago a Tercero / Anticipo / Reembolso /
  // Legalización): { solicitud, cuenta, ceco, comprobante, accion: 'gasto'|'ingreso', monto }.
  const [confirmarPagoSolicitud, setConfirmarPagoSolicitud] = useState(null);
  const [guardandoConfirmarPago, setGuardandoConfirmarPago] = useState(false);
  // Pago en Lote de Reembolsos (Administrador/Coordinadora Administrativa): permite elegir
  // varios Reembolsos "Aprobado" de la misma Empresa a la vez, adjuntar UN solo comprobante de
  // banco y marcarlos todos "Pagado" de una — cada uno genera su propio Gasto en Finanzas, pero
  // todos quedan con el mismo lote_pago_id para poder verlos agrupados después.
  const [seleccionReembolsosPago, setSeleccionReembolsosPago] = useState([]); // array de ids
  // { items: [solicitudes...], cuenta, ceco, comprobantes: [] } — null = modal cerrado.
  const [confirmarPagoLoteReembolsos, setConfirmarPagoLoteReembolsos] = useState(null);
  const [guardandoPagoLoteReembolsos, setGuardandoPagoLoteReembolsos] = useState(false);
  // "Ver Lote de Pago" — lista de solicitudes/gastos que comparten un mismo lote_pago_id.
  // { titulo, items: [{fecha, nombre, valor, empresa}] } — null = modal cerrado.
  const [verLotePago, setVerLotePago] = useState(null);
  // Modal "Devolver Solicitud" (Administrador/Coordinadora Administrativa): al pasar una
  // Solicitud a "Devuelto" pide un motivo obligatorio, para que el colaborador sepa por qué no
  // se aprobó y qué corregir. { solicitud, motivo } — null = modal cerrado.
  const [devolverSolicitud, setDevolverSolicitud] = useState(null);
  const [guardandoDevolucion, setGuardandoDevolucion] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [archivoImportacion, setArchivoImportacion] = useState(null);
  // Informe de Finanzas (vista previa + PDF) — null cuando el modal está cerrado; mientras está
  // abierto guarda { datos, graficas } ya calculados una sola vez (ver construirDatosInformeFinanzas).
  const [informeFinanzas, setInformeFinanzas] = useState(null);
  const [generandoInformePDF, setGenerandoInformePDF] = useState(false);
  // Vista previa de un soporte (PDF/imagen) antes de descargarlo — se abre desde el modal "Ver
  // Soportes" (cualquiera: Solicitudes, Gastos, Ingresos, Cuentas de Cobro, Pago a Tercero, todos
  // comparten ese mismo modal). null cuando está cerrada; { nombre, url, tipo, esObjectUrl }
  // mientras está abierta — esObjectUrl marca si `url` hay que liberarla con revokeObjectURL al
  // cerrar (los soportes en Storage se descargan como blob; los antiguos embebidos ya traen un
  // data URL que no hay que revocar).
  const [previewSoporte, setPreviewSoporte] = useState(null);
  const [cargandoPreviewSoporte, setCargandoPreviewSoporte] = useState(false);
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('2026-01-01');
  const [filtroFechaFin, setFiltroFechaFin] = useState(new Date().toISOString().split('T')[0]);
  // Progreso de "Descargar Soportes (ZIP)": null = inactivo; { hechos, total } mientras descarga.
  const [progresoZip, setProgresoZip] = useState(null);

  // PRESUPUESTO — conectado a Supabase (public.presupuesto_items, public.presupuesto_anual,
  // public.presupuesto_overrides, public.deducciones). Los `id` ahora son uuid (texto) de Postgres, ya no
  // números de Date.now() — cualquier comparación sigue funcionando igual (===), pero NUNCA hay que
  // parsear estos ids con parseInt/Number en ningún lado nuevo que se agregue.
  const [presupuestoItems, setPresupuestoItems] = useState([]);
  const [presupuestoAnual, setPresupuestoAnual] = useState([]);
  // Ajustes al valor esperado de UN mes puntual (no cambia el valor base recurrente del concepto).
  // Cada registro: { id, presupuestoItemId, anio, mes, valor }.
  const [presupuestoOverrides, setPresupuestoOverrides] = useState([]);
  // Aprobaciones mensuales de conceptos de Presupuesto (public.presupuesto_aprobaciones): un
  // concepto del mes solo se puede exportar al banco (PAB) si está aprobado y el neto aprobado
  // sigue siendo el neto actual — si alguien cambia el valor o una deducción después, la
  // aprobación queda "desactualizada" y hay que volver a aprobar.
  const [presupuestoAprobaciones, setPresupuestoAprobaciones] = useState([]);
  const [guardandoAprobacionPresupuesto, setGuardandoAprobacionPresupuesto] = useState(false);
  // Lotes de pago masivo PAB (public.lotes_pago_banco + ítems). Se cargan también fuera de la
  // pantalla del exportador para marcar en Solicitudes/Presupuesto qué ya se exportó al banco.
  const [lotesPago, setLotesPago] = useState([]);
  // Deducciones (préstamos u otros descuentos) aplicadas al valor mensual de un concepto de Nómina/Prestación
  // de Servicio. 'Préstamo' calcula su propio saldo pendiente mes a mes (sin tabla de historial, de forma
  // determinística a partir de fechaInicio/valorCuota/saldoTotal — ver mesesTranscurridos/getCuotaAplicada
  // más abajo); 'Otro' es un descuento recurrente fijo que se aplica todos los meses mientras esté activo.
  const [deducciones, setDeducciones] = useState([]);
  const [cargandoPresupuesto, setCargandoPresupuesto] = useState(true);
  const deduccionVacia = { presupuestoItemId: '', tipo: 'Préstamo', valorCuota: '', saldoTotal: '', fechaInicio: new Date().toISOString().split('T')[0], observaciones: '', activo: true };
  const [newDeduccion, setNewDeduccion] = useState(deduccionVacia);
  const [editingDeduccionId, setEditingDeduccionId] = useState(null);
  const [newPresupuestoItem, setNewPresupuestoItem] = useState({ empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-001-GF', nombre: '', valorMensual: '', diaLimitePago: '', activo: true, responsableId: '', tipo: '', formaPago: '', terceroId: '' });
  // Si tiene valor, el formulario de arriba de "Gestión de Conceptos" está editando ESTE
  // concepto (en vez de crear uno nuevo) — mismo patrón que editingDeduccionId.
  const [editingPresupuestoItemId, setEditingPresupuestoItemId] = useState(null);
  // Presupuesto -> Finanzas en lote: conceptos "Pendiente" marcados en la pestaña Mensual para
  // confirmar su pago de una sola vez (ver confirmarPagoLotePresupuesto más abajo).
  const [seleccionPresupuestoPendientes, setSeleccionPresupuestoPendientes] = useState([]);
  const [confirmarPagoLotePresupuesto, setConfirmarPagoLotePresupuesto] = useState(null);
  const [guardandoPagoLotePresupuesto, setGuardandoPagoLotePresupuesto] = useState(false);
  const [newPresupuestoAnual, setNewPresupuestoAnual] = useState({ empresa: 'AM SPORTS GROUP SAS', ceco: 'CECO-001-GF', anio: new Date().getFullYear(), valorAnual: '' });
  const [presupuestoTab, setPresupuestoTab] = useState('mensual');
  const [filtroPresupuesto, setFiltroPresupuesto] = useState({ empresa: 'AM SPORTS GROUP SAS', mes: new Date().getMonth() + 1, anio: new Date().getFullYear() });
  // Filtro extra SOLO de la tabla Mensual (Pagado/Pendiente) — acorta la lista sin tocar el
  // filtro de Empresa/Mes/Año de arriba (ese sigue afectando toda la pestaña Presupuesto). Las
  // tarjetas de totales siempre muestran el total real, sin importar este filtro.
  const [filtroEstadoMensual, setFiltroEstadoMensual] = useState('todos');
  // Gestión de Conceptos: por defecto filtra por la Empresa elegida arriba (mismo selector que
  // Mensual/Anual/Deducciones), con un botón para ver todas las empresas juntas cuando hace falta
  // una vista general.
  const [gestionConceptosTodasEmpresas, setGestionConceptosTodasEmpresas] = useState(false);

  // Convierte un dataURL (base64) leído por FileReader a bytes, para subirlo a Supabase Storage.
  const dataUrlToUint8Array = (dataUrl) => {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const uint8ArrayToDataUrl = (bytes, mimeType) => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
  };

  // Une varios soportes (PDFs + imágenes) en un solo PDF consolidado — Legalizaciones y Reembolsos.
  // Si se pasa `portada` (empresa/tipo/responsable/fecha), agrega primero una página de carátula
  // con el logo de la empresa (si existe) y los datos básicos de la solicitud.
  const mergeSoportesToPDF = async (soportes, portada = null) => {
    const mergedPdf = await PDFDocument.create();
    const omitidos = [];

    if (portada) {
      try {
        const pageWidth = 612;
        const pageHeight = 792;
        const page = mergedPdf.addPage([pageWidth, pageHeight]);
        const font = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
        const fontNormal = await mergedPdf.embedFont(StandardFonts.Helvetica);
        let y = pageHeight - 100;

        const logoSrc = EMPRESA_LOGOS[portada.empresa];
        if (logoSrc) {
          try {
            const logoBytes = await fetch(logoSrc).then(r => r.arrayBuffer());
            const logoImg = await mergedPdf.embedPng(logoBytes);
            const logoMaxW = 200, logoMaxH = 80;
            const scale = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1);
            const w = logoImg.width * scale, h = logoImg.height * scale;
            page.drawImage(logoImg, { x: (pageWidth - w) / 2, y: y - h, width: w, height: h });
            y -= h + 40;
          } catch (logoError) {
            console.warn('No se pudo insertar el logo en la carátula:', logoError);
          }
        }

        const centerText = (text, size, useFont) => {
          const width = useFont.widthOfTextAtSize(text, size);
          page.drawText(text, { x: (pageWidth - width) / 2, y, size, font: useFont, color: rgb(0.13, 0.12, 0.08) });
          y -= size + 14;
        };
        centerText(`${(portada.tipo || '').toUpperCase()} DE GASTOS`, 18, font);
        centerText(portada.empresa || '', 12, fontNormal);
        centerText(`Colaborador: ${portada.responsableNombre || ''}`, 11, fontNormal);
        centerText(`Fecha: ${portada.fecha || ''}`, 11, fontNormal);
        y -= 20;
        centerText('PAQUETE DE SOPORTES ADJUNTO', 10, fontNormal);
      } catch (portadaError) {
        console.warn('No se pudo generar la carátula del PDF consolidado:', portadaError);
      }
    }

    // Extensión del nombre de archivo — respaldo para decidir cómo tratar un soporte cuando su
    // "tipo" (mime) viene vacío o mal puesto. Esto pasa con más frecuencia de la que debería con
    // fotos tomadas DIRECTO con la cámara del celular (sobre todo en Android/webviews): el
    // navegador a veces no les pone un File.type, y antes ese soporte se descartaba de una vez
    // (caía al "else" de abajo) sin siquiera intentar incluirlo — la foto quedaba pagada/registrada
    // en la solicitud pero jamás aparecía en el PDF de soportes.
    const extensionDe = (nombre) => (nombre || '').split('.').pop().toLowerCase();

    for (const soporte of soportes) {
      try {
        const bytes = dataUrlToUint8Array(soporte.data);
        const ext = extensionDe(soporte.nombre);
        const esPDF = soporte.tipo === 'application/pdf' || ext === 'pdf';
        const esImagen = (soporte.tipo && soporte.tipo.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext);

        if (esPDF) {
          const srcPdf = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
          pages.forEach(p => mergedPdf.addPage(p));
        } else if (esImagen) {
          // Se prueba PNG y JPG sin fiarse ciegamente del "tipo" declarado — se intenta primero el
          // que sugiere el tipo/extensión, y si falla, el otro formato antes de rendirse. Esto
          // recupera fotos con mime type vacío o mal puesto (típico al tomar la foto directo con
          // la cámara). Si de verdad es un formato que pdf-lib no soporta (ej. HEIC de iPhone sin
          // convertir), sí falla aquí — y ese caso lo maneja el llamador: en vez de perder la foto,
          // la adjunta suelta a la solicitud sin meterla en el PDF combinado.
          let image;
          const esPngPorTipoOExtension = soporte.tipo === 'image/png' || ext === 'png';
          try {
            image = esPngPorTipoOExtension ? await mergedPdf.embedPng(bytes) : await mergedPdf.embedJpg(bytes);
          } catch (e) {
            image = esPngPorTipoOExtension ? await mergedPdf.embedJpg(bytes) : await mergedPdf.embedPng(bytes);
          }
          const pageWidth = 612;
          const pageHeight = 792;
          const maxWidth = pageWidth - 60;
          const maxHeight = pageHeight - 60;
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
          const drawWidth = image.width * scale;
          const drawHeight = image.height * scale;
          const page = mergedPdf.addPage([pageWidth, pageHeight]);
          page.drawImage(image, {
            x: (pageWidth - drawWidth) / 2,
            y: (pageHeight - drawHeight) / 2,
            width: drawWidth,
            height: drawHeight
          });
        } else {
          omitidos.push(soporte);
        }
      } catch (error) {
        console.warn('No se pudo unir el soporte al PDF:', soporte.nombre, error);
        omitidos.push(soporte);
      }
    }

    const mergedBytes = await mergedPdf.save();
    return {
      nombre: `Soportes_Consolidados_${Date.now()}.pdf`,
      tipo: 'application/pdf',
      data: uint8ArrayToDataUrl(mergedBytes, 'application/pdf'),
      // Soportes que NO se pudieron meter en el PDF combinado (formato que pdf-lib no soporta,
      // ej. HEIC) — el llamador los sube sueltos, uno por uno, para que la solicitud NUNCA se
      // quede sin ese archivo aunque no haya podido unirse al consolidado.
      omitidos
    };
  };

  // Sube UN soporte (ya leído como dataURL en memoria) al bucket privado "soportes" y
  // registra su metadata en public.soportes. entidadTipo/entidadId identifican a qué
  // solicitud/gasto/ingreso/cuenta de cobro pertenece (mismo patrón para las 4).
  const subirSoporteEntidad = async (soporteTemp, entidadTipo, entidadId) => {
    try {
      const bytes = dataUrlToUint8Array(soporteTemp.data);
      const blob = new Blob([bytes], { type: soporteTemp.tipo || 'application/octet-stream' });
      const nombreLimpio = (soporteTemp.nombre || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
      const rutaArchivo = `${entidadTipo}/${entidadId}/${Date.now()}_${nombreLimpio}`;

      const { error: uploadError } = await supabase.storage
        .from('soportes')
        .upload(rutaArchivo, blob, { contentType: soporteTemp.tipo || undefined, upsert: false });
      if (uploadError) {
        console.error('Error subiendo soporte a Storage:', uploadError);
        alert(`❌ No se pudo subir el archivo "${soporteTemp.nombre}": ${uploadError.message}`);
        return null;
      }

      const { error: metaError } = await supabase.from('soportes').insert({
        bucket_path: rutaArchivo,
        nombre_original: soporteTemp.nombre,
        tamano_kb: Math.round((soporteTemp.tamaño || bytes.length) / 1024),
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        subido_por: user.id
      });
      if (metaError) {
        console.error('Error guardando metadata del soporte:', metaError);
        alert(`❌ El archivo "${soporteTemp.nombre}" se subió pero no se pudo registrar: ${metaError.message}`);
        return null;
      }
      return rutaArchivo;
    } catch (error) {
      console.error('Error inesperado subiendo soporte:', error);
      alert(`❌ Error inesperado subiendo "${soporteTemp.nombre}"`);
      return null;
    }
  };

  // Borra los soportes (metadata + archivo en Storage) de una Solicitud, un Gasto o un
  // Ingreso — usada al eliminar el registro completo. IMPORTANTE: desde que el auto-vínculo
  // Solicitud → Gasto/Ingreso (Opción C) reutiliza el MISMO archivo para ambas pantallas
  // (mismo bucket_path, ver generarMovimientoDesdeSolicitud), borrar el archivo físico a
  // ciegas al eliminar cualquiera de los dos dejaría al otro con un soporte "roto" (la fila de
  // metadata seguiría existiendo, pero el archivo ya no). Por eso cada bucket_path solo se
  // borra de Storage si NINGUNA otra fila de public.soportes (de cualquier entidad) sigue
  // apuntando a él.
  const eliminarSoportesDeEntidad = async (entidadTipo, entidadId) => {
    const { data: soportesRelacionados } = await supabase
      .from('soportes')
      .select('bucket_path')
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId);

    if (soportesRelacionados && soportesRelacionados.length > 0) {
      const rutasUnicas = [...new Set(soportesRelacionados.map(r => r.bucket_path))];
      const rutasSeguras = [];
      for (const ruta of rutasUnicas) {
        const { data: otras } = await supabase
          .from('soportes')
          .select('entidad_tipo, entidad_id')
          .eq('bucket_path', ruta);
        const tieneOtroDueño = (otras || []).some(o => !(o.entidad_tipo === entidadTipo && o.entidad_id === entidadId));
        if (!tieneOtroDueño) rutasSeguras.push(ruta);
      }
      if (rutasSeguras.length > 0) {
        await supabase.storage.from('soportes').remove(rutasSeguras);
      }
      await supabase.from('soportes').delete().eq('entidad_tipo', entidadTipo).eq('entidad_id', entidadId);
    }
  };

  // Elimina UN soporte puntual desde el modal "Ver Soportes" (botón 🗑️, habilitado en
  // Solicitudes y en Gastos/Ingresos de Finanzas — ver verSoportesContexto). Antes solo se podía agregar; si algo se subió
  // por error no había forma de quitarlo sin pedirle a alguien que entrara a la base de datos.
  // Mismo cuidado de siempre con el archivo físico: solo se borra de Storage si ninguna otra
  // fila de public.soportes (de cualquier entidad, ej. el Gasto que esta misma solicitud generó
  // en Finanzas) sigue apuntándole.
  const handleEliminarUnSoporte = async (soporte) => {
    if (!soporte.id) return;
    if (!window.confirm(`¿Eliminar "${soporte.nombre}"? Esta acción no se puede deshacer.`)) return;
    setEliminandoSoporteId(soporte.id);
    try {
      const { data: otras, error: errorOtras } = await supabase
        .from('soportes')
        .select('id')
        .eq('bucket_path', soporte.bucketPath);
      if (errorOtras) {
        console.error('Error revisando si el archivo está compartido:', errorOtras);
        alert('❌ No se pudo eliminar: ' + errorOtras.message);
        return;
      }
      const esCompartido = (otras || []).some(o => o.id !== soporte.id);
      // Primero la fila (con .select para confirmar que RLS sí la borró: sin él, un bloqueo
      // devuelve error null y 0 filas) y solo después el archivo, para no dejar una fila
      // apuntando a un archivo ya borrado si la base rechaza el cambio.
      const { data: borradas, error: errorDelete } = await supabase.from('soportes').delete().eq('id', soporte.id).select('id');
      if (errorDelete || !borradas || borradas.length === 0) {
        console.error('Error eliminando soporte:', errorDelete);
        alert('❌ No se pudo eliminar: ' + (errorDelete?.message || 'no tienes permiso para borrar este soporte.'));
        return;
      }
      if (!esCompartido) {
        await supabase.storage.from('soportes').remove([soporte.bucketPath]);
      }
      setVerSoportes(prev => (prev || []).filter(s => s.id !== soporte.id));
      const ctx = verSoportesContexto;
      if (ctx?.entidadTipo === 'solicitud' || ctx?.entidadTipo === 'gasto' || ctx?.entidadTipo === 'ingreso') {
        const nuevoConteo = await contarSoportesPorEntidad(ctx.entidadTipo, [ctx.entidadId]);
        const n = nuevoConteo[ctx.entidadId] || 0;
        const actualizar = prev => prev.map(x => x.id === ctx.entidadId ? { ...x, cantidadSoportes: n } : x);
        if (ctx.entidadTipo === 'solicitud') setSolicitudes(actualizar);
        else if (ctx.entidadTipo === 'gasto') setGastos(actualizar);
        else setIngresos(actualizar);
      }
    } finally {
      setEliminandoSoporteId(null);
    }
  };

  // Fusiona TODOS los soportes ya guardados de una solicitud (el PDF consolidado original y/o
  // cualquier suelto que hubiera quedado de una edición anterior) con los soportes nuevos que se
  // acaban de agregar en esta edición, en UN SOLO PDF — y reemplaza los anteriores por éste.
  // Antes, un soporte agregado al editar quedaba suelto aparte del PDF original (para no tocar
  // lo ya subido); el usuario pidió explícitamente que al editar también quede todo fusionado en
  // un solo documento, igual que al crear la solicitud.
  const fusionarSoportesEdicion = async (solicitudId, soportesNuevos, portada) => {
    const { data: existentes, error: errorExistentes } = await supabase
      .from('soportes')
      .select('id, bucket_path, nombre_original')
      .eq('entidad_tipo', 'solicitud')
      .eq('entidad_id', solicitudId);
    if (errorExistentes) {
      console.error('Error leyendo soportes existentes para fusionar:', errorExistentes);
      alert('⚠️ No se pudieron leer los soportes ya guardados; los nuevos se subieron sueltos, sin fusionar.');
      for (const soporte of soportesNuevos) await subirSoporteEntidad(soporte, 'solicitud', solicitudId);
      return;
    }

    // Descarga cada soporte ya guardado (consolidado o suelto) y lo deja en memoria como dataURL,
    // en el mismo formato que un archivo recién leído del disco, para poder unirlo de nuevo.
    const existentesComoTemp = [];
    for (const row of (existentes || [])) {
      const { data: blob, error: errorDescarga } = await supabase.storage.from('soportes').download(row.bucket_path);
      if (errorDescarga || !blob) {
        console.warn('No se pudo descargar un soporte existente para fusionar:', row, errorDescarga);
        continue;
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      existentesComoTemp.push({ nombre: row.nombre_original, tipo: inferirMimePorExtension(row.nombre_original), data: dataUrl });
    }

    const todos = [...existentesComoTemp, ...soportesNuevos];
    let soportePDF;
    try {
      soportePDF = await mergeSoportesToPDF(todos, portada);
    } catch (mergeError) {
      console.error('Error fusionando soportes en un solo PDF:', mergeError);
      alert('⚠️ No se pudieron fusionar los soportes en un solo PDF; los nuevos se subieron sueltos, sin tocar los que ya estaban.');
      for (const soporte of soportesNuevos) await subirSoporteEntidad(soporte, 'solicitud', solicitudId);
      return;
    }

    await subirSoporteEntidad(soportePDF, 'solicitud', solicitudId);
    if (soportePDF.omitidos && soportePDF.omitidos.length > 0) {
      for (const soporteOmitido of soportePDF.omitidos) {
        await subirSoporteEntidad(soporteOmitido, 'solicitud', solicitudId);
      }
      alert(`⚠️ ${soportePDF.omitidos.length} archivo(s) no se pudieron unir al PDF consolidado (formato no compatible, ej. HEIC) — se guardaron sueltos: ${soportePDF.omitidos.map(s => s.nombre).join(', ')}`);
    }

    // Borra los soportes VIEJOS (los que ya estaban antes de esta edición) — nunca el que se
    // acaba de subir arriba, que quedó con un bucket_path nuevo. Mismo cuidado que
    // eliminarSoportesDeEntidad: un bucket_path solo se borra de Storage si ninguna otra fila
    // (ej. el Gasto que esta misma solicitud generó en Finanzas, que reutiliza el mismo archivo)
    // sigue apuntándole.
    const idsViejos = (existentes || []).map(r => r.id);
    if (idsViejos.length > 0) {
      const rutasViejas = [...new Set((existentes || []).map(r => r.bucket_path))];
      const rutasSeguras = [];
      for (const ruta of rutasViejas) {
        const { data: otras } = await supabase.from('soportes').select('id').eq('bucket_path', ruta);
        const quedanOtras = (otras || []).some(o => !idsViejos.includes(o.id));
        if (!quedanOtras) rutasSeguras.push(ruta);
      }
      if (rutasSeguras.length > 0) {
        await supabase.storage.from('soportes').remove(rutasSeguras);
      }
      await supabase.from('soportes').delete().in('id', idsViejos);
    }
  };

  // Descarga un soporte guardado en Storage (bucket "soportes") como archivo local.
  const handleDescargarSoporteStorage = async (soporte) => {
    const { data, error } = await supabase.storage.from('soportes').download(soporte.bucketPath);
    if (error || !data) {
      console.error('Error descargando soporte:', error);
      alert('❌ No se pudo descargar el archivo: ' + (error?.message || ''));
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = soporte.nombre;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Funciones Login (Supabase Auth)

  // Trae el perfil de public.usuarios (rol, empresa, datos de Talento Humano)
  // para el usuario de Authentication ya logueado, y arma el objeto `user`
  // que el resto de la app espera.
  const cargarPerfilUsuario = async (authUser) => {
    const { data: perfil, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, cargo, foto_url, cedula, telefono, funciones, banco, tipo_cuenta_bancaria, numero_cuenta, titular_cuenta, empresas ( nombre )')
      .eq('auth_user_id', authUser.id)
      .single();

    if (error || !perfil) {
      console.warn('No se encontró perfil en usuarios para', authUser.email, error);
      return null;
    }

    return {
      id: perfil.id,
      nombre: perfil.nombre,
      email: perfil.email,
      rol: perfil.rol,
      empresa: perfil.empresas?.nombre || '',
      cargo: perfil.cargo || '',
      foto: perfil.foto_url || '',
      cedula: perfil.cedula || '',
      telefono: perfil.telefono || '',
      funciones: perfil.funciones || '',
      banco: perfil.banco || '',
      tipoCuentaBancaria: perfil.tipo_cuenta_bancaria || '',
      numeroCuenta: perfil.numero_cuenta || '',
      titularCuenta: perfil.titular_cuenta || ''
    };
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setLoginError('Ingresa tu email y contraseña');
      return;
    }
    setLoginError('');
    setLoggingIn(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError || !authData?.user) {
        setLoginError('Email o contraseña incorrecto');
        return;
      }

      const perfil = await cargarPerfilUsuario(authData.user);
      if (!perfil) {
        setLoginError('Tu cuenta no tiene un perfil asignado en el sistema todavía. Contacta al administrador.');
        await supabase.auth.signOut();
        return;
      }

      setUser(perfil);
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('Error de login:', err);
      setLoginError('Hubo un error al iniciar sesión. Intenta de nuevo.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // OLVIDÉ MI CONTRASEÑA — paso 1: la persona pide el link de recuperación desde la pantalla de
  // login. Supabase le manda un correo con un link de un solo uso que la trae de vuelta a esta
  // misma app ya autenticada en modo "recovery" (ver el useEffect de sesión, abajo) para que
  // ponga una nueva. El mensaje de éxito es siempre el mismo exista o no ese email en el sistema
  // — evita que este formulario sirva para averiguar qué correos están registrados.
  const handleEnviarRecuperacion = async () => {
    if (!emailRecuperacion) {
      alert('Ingresa tu email');
      return;
    }
    setEnviandoRecuperacion(true);
    try {
      await supabase.auth.resetPasswordForEmail(emailRecuperacion, { redirectTo: window.location.origin });
      setRecuperacionEnviada(true);
    } finally {
      setEnviandoRecuperacion(false);
    }
  };

  // OLVIDÉ MI CONTRASEÑA — paso 2: ya con el link abierto (sesión "recovery" activa) define la
  // contraseña nueva. Al confirmar queda con sesión iniciada de una vez — no hace falta volver a
  // loguearse con la que acaba de poner.
  const handleGuardarNuevaPasswordRecuperacion = async () => {
    if (!nuevaPasswordRecuperacion || !confirmarPasswordRecuperacion) {
      alert('Completa los 2 campos');
      return;
    }
    if (nuevaPasswordRecuperacion.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (nuevaPasswordRecuperacion !== confirmarPasswordRecuperacion) {
      alert('La nueva contraseña y su confirmación no coinciden');
      return;
    }
    setGuardandoPasswordRecuperacion(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nuevaPasswordRecuperacion });
      if (error) {
        alert('❌ No se pudo actualizar la contraseña: ' + error.message);
        return;
      }
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const perfil = authUser ? await cargarPerfilUsuario(authUser) : null;
      if (!perfil) {
        alert('❌ Tu cuenta no tiene un perfil asignado en el sistema todavía. Contacta al administrador.');
        await supabase.auth.signOut();
        setRecuperandoPassword(false);
        return;
      }
      setUser(perfil);
      setNuevaPasswordRecuperacion('');
      setConfirmarPasswordRecuperacion('');
      setRecuperandoPassword(false);
      alert('✅ Contraseña actualizada. Ya quedaste con la sesión iniciada.');
    } finally {
      setGuardandoPasswordRecuperacion(false);
    }
  };

  // Al cargar la app: revisa si ya hay una sesión activa (evita tener que
  // loguearse otra vez al refrescar la página) y escucha cambios de sesión.
  useEffect(() => {
    let activo = true;

    // Si llegó desde el link de "Olvidé mi contraseña", Supabase agrega type=recovery a la URL.
    // Se limpia de una vez para que un refresh de página no vuelva a activar este modo (el link
    // de todas formas es de un solo uso).
    const esRecuperacion = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
    if (esRecuperacion) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // No la logueamos de una con la sesión que trae el link — primero tiene que poner la
      // contraseña nueva en la pantalla de recuperación (el estado inicial ya la muestra).
      if (esRecuperacion) {
        if (activo) setAuthChecking(false);
        return;
      }
      if (session?.user) {
        const perfil = await cargarPerfilUsuario(session.user);
        if (activo) {
          setUser(perfil);
          setAuthChecking(false);
        }
      } else if (activo) {
        setAuthChecking(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!activo) return;
      if (_event === 'PASSWORD_RECOVERY') {
        setRecuperandoPassword(true);
        setAuthChecking(false);
        return;
      }
      if (esRecuperacion) return; // ya se maneja arriba
      if (session?.user) {
        const perfil = await cargarPerfilUsuario(session.user);
        setUser(perfil);
      } else {
        setUser(null);
      }
    });

    return () => {
      activo = false;
      listener?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convierte una fila de public.usuarios (snake_case, empresa_id) al mismo formato
  // camelCase que usaba el resto de la app cuando los datos vivían en localStorage.
  // documentoCedula/documentoPasaporte: guardan la RUTA del archivo dentro del bucket
  // privado "documentos-rh" (no el archivo en sí) — se resuelve a un link temporal
  // (signed URL) solo cuando alguien le da clic a "Ver".
  const usuarioDBToLocal = (row) => ({
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    rol: row.rol,
    empresa: row.empresas?.nombre || '',
    cargo: row.cargo || '',
    foto: row.foto_url || '',
    cedula: row.cedula || '',
    telefono: row.telefono || '',
    fechaNacimiento: row.fecha_nacimiento || '',
    fechaIngreso: row.fecha_ingreso || '',
    tipoVinculacion: row.tipo_vinculacion || '',
    contactoEmergenciaNombre: row.contacto_emergencia_nombre || '',
    contactoEmergenciaTelefono: row.contacto_emergencia_telefono || '',
    eps: row.eps || '',
    arl: row.arl || '',
    funciones: row.funciones || '',
    banco: row.banco || '',
    codigoBanco: row.codigo_banco || '',
    tipoDocumento: row.tipo_documento || '',
    tipoCuentaBancaria: row.tipo_cuenta_bancaria || '',
    numeroCuenta: row.numero_cuenta || '',
    titularCuenta: row.titular_cuenta || '',
    documentoCedula: row.documento_cedula_path || null,
    documentoPasaporte: row.documento_pasaporte_path || null
  });

  const cargarUsuarios = async () => {
    setCargandoUsuarios(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, cargo, foto_url, cedula, telefono, fecha_nacimiento, fecha_ingreso, tipo_vinculacion, contacto_emergencia_nombre, contacto_emergencia_telefono, eps, arl, funciones, banco, codigo_banco, tipo_documento, tipo_cuenta_bancaria, numero_cuenta, titular_cuenta, documento_cedula_path, documento_pasaporte_path, empresas ( nombre )')
      .order('nombre');

    if (error) {
      console.error('Error cargando usuarios:', error);
      setCargandoUsuarios(false);
      return;
    }

    setUsuariosDB(data.map(usuarioDBToLocal));
    setCargandoUsuarios(false);
  };

  // Convierte una fila de public.solicitudes (con sus joins a empresas/usuarios) al
  // mismo formato con el que ya trabaja toda la UI de Solicitudes.
  const solicitudDBToLocal = (row) => ({
    id: row.id,
    fecha: row.fecha,
    tipo: row.tipo,
    valor: row.valor,
    totalCalculado: row.total_calculado,
    valorAnticipoOriginal: row.valor_anticipo_original || '',
    // "anticipo_ids" (lista) es la fuente de verdad desde que Legalización admite varios
    // Anticipos a la vez; "anticipo_id" (columna vieja, singular) se sigue leyendo como
    // respaldo por si una fila quedó sin migrar. anticipoId (singular) se mantiene también
    // por compatibilidad con reportes/lógica que solo necesitan "el primero".
    anticipoIds: (row.anticipo_ids && row.anticipo_ids.length > 0) ? row.anticipo_ids : (row.anticipo_id ? [row.anticipo_id] : []),
    anticipoId: row.anticipo_id || (row.anticipo_ids && row.anticipo_ids[0]) || '',
    revisadoPorId: row.revisado_por_id || '',
    revisadoAt: row.revisado_at || '',
    aprobadoPorId: row.aprobado_por_id || '',
    aprobadoAt: row.aprobado_at || '',
    detalle: row.detalle || '',
    empresa: row.empresas?.nombre || '',
    empresaId: row.empresa_id || '',
    responsableId: row.responsable_id,
    responsableNombre: row.usuarios?.nombre || '',
    documentos: row.documentos || [],
    estado: row.estado,
    // "Pago a Tercero": moneda propia del pago (no depende de la empresa, ver Sección 23) y
    // datos del tercero guardados en un solo JSONB (nombre, dni, paisOrigen, banco, tipoCuenta,
    // numeroCuenta) — igual que "documentos", para no sumar media docena de columnas nuevas.
    moneda: row.moneda_pago || '',
    terceroInfo: row.tercero_info || null,
    terceroId: row.tercero_id || '',
    // Opción C: si esta Solicitud ya generó su movimiento en Finanzas al pasar a "Pagado",
    // queda el id acá — evita que se genere un segundo movimiento por la misma Solicitud.
    // gastoGeneradoId: Pago a Tercero, Anticipo, Reembolso, y Legalización con diferencia a
    // favor del colaborador. ingresoGeneradoId: Legalización con diferencia en contra (el
    // colaborador debe devolver dinero) — ver calcularAccionFinanzasSolicitud.
    gastoGeneradoId: row.gasto_generado_id || '',
    ingresoGeneradoId: row.ingreso_generado_id || '',
    // Cuando esta Solicitud se pagó junto con otras en un mismo lote (Reembolsos, un solo
    // comprobante para varias), todas comparten este mismo UUID — ver "Pago en Lote".
    lotePagoId: row.lote_pago_id || '',
    // Explicación de Administrador/Coordinadora Administrativa cuando el estado es "Devuelto" —
    // se limpia al editar y reenviar (vuelve a "Pendiente").
    motivoDevolucion: row.motivo_devolucion || '',
    // Conteo real de public.soportes para esta solicitud — se completa abajo en
    // cargarSolicitudes(). Necesario porque "documentos" (arriba) solo se llena para
    // Legalización/Reembolso (el desglose de recibos de la Bandeja de Soportes); Pago a
    // Tercero (y cualquier archivo suelto subido a una solicitud) sube directo a Storage/
    // public.soportes sin pasar por "documentos", así que contarlo aparte es la única forma
    // de que la columna "Docs" refleje también esos archivos.
    cantidadSoportes: 0
  });

  const cargarSolicitudes = async () => {
    setCargandoSolicitudes(true);
    const { data, error } = await supabase
      .from('solicitudes')
      // OJO: usuarios!responsable_id — desde que "solicitudes" ganó revisado_por_id y
      // aprobado_por_id (Sección 19), hay 3 FKs de solicitudes hacia usuarios. Sin indicar
      // por cuál columna se hace el embed, PostgREST no sabe cuál usar y el select entero
      // falla con "more than one relationship was found" (deja el historial vacío).
      .select('id, fecha, tipo, valor, total_calculado, valor_anticipo_original, anticipo_id, anticipo_ids, revisado_por_id, revisado_at, aprobado_por_id, aprobado_at, detalle, estado, documentos, moneda_pago, tercero_info, tercero_id, gasto_generado_id, ingreso_generado_id, lote_pago_id, motivo_devolucion, empresa_id, responsable_id, empresas ( nombre ), usuarios!responsable_id ( nombre )')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando solicitudes:', error);
      setCargandoSolicitudes(false);
      return;
    }

    const solicitudesLocal = data.map(solicitudDBToLocal);

    // Igual que en Cuentas de Cobro: los archivos sueltos (Pago a Tercero, PDFs generados,
    // comprobantes de pago) viven en public.soportes, no en la columna "documentos" — se
    // cuentan aparte para que la columna "Docs" de la tabla también los refleje.
    if (solicitudesLocal.length > 0) {
      const { data: soportesRows, error: soportesError } = await supabase
        .from('soportes')
        .select('entidad_id')
        .eq('entidad_tipo', 'solicitud')
        .in('entidad_id', solicitudesLocal.map(s => s.id));
      if (soportesError) {
        console.error('Error contando soportes de solicitudes:', soportesError);
      } else {
        const conteo = {};
        (soportesRows || []).forEach(r => { conteo[r.entidad_id] = (conteo[r.entidad_id] || 0) + 1; });
        solicitudesLocal.forEach(s => { s.cantidadSoportes = conteo[s.id] || 0; });
      }
    }

    setSolicitudes(solicitudesLocal);
    setCargandoSolicitudes(false);
  };

  // BANDEJA DE SOPORTES — solo trae lo "sin usar" de la propia persona (RLS ya scopea por
  // dueño, pero el filtro usado=false evita traer historial viejo innecesariamente).
  const soportePendienteDBToLocal = (row) => ({
    id: row.id,
    fecha: row.fecha,
    proveedor: row.proveedor || '',
    nit: row.nit || '',
    descripcion: row.descripcion || '',
    valor: row.valor,
    tipoSoporte: row.tipo_soporte || '',
    bucketPath: row.bucket_path,
    nombre: row.nombre_original,
    tamano: row.tamano_kb || 0
  });

  const cargarSoportesPendientes = async () => {
    setCargandoSoportesPendientes(true);
    const { data, error } = await supabase
      .from('soportes_pendientes')
      .select('id, fecha, proveedor, nit, descripcion, valor, tipo_soporte, bucket_path, nombre_original, tamano_kb')
      .eq('usado', false)
      .order('fecha', { ascending: false });
    if (error) {
      console.error('Error cargando bandeja de soportes:', error);
      setCargandoSoportesPendientes(false);
      return;
    }
    setSoportesPendientes((data || []).map(soportePendienteDBToLocal));
    setCargandoSoportesPendientes(false);
  };

  // Convierte una fila de public.cuentas_cobro (con sus joins a empresas/usuarios) al mismo
  // formato con el que ya trabaja toda la UI de Cuentas de Cobro (incluyendo el PDF).
  const cuentaCobroDBToLocal = (row) => ({
    id: row.id,
    fecha: row.fecha,
    numero: row.numero,
    vencimiento: row.vencimiento || '',
    ciudad: row.ciudad || '',
    mes: row.mes,
    anio: row.anio,
    monto: row.monto,
    funciones: row.funciones || '',
    estado: row.estado,
    empresa: row.empresas?.nombre || '',
    empresaNit: row.empresa_nit || '',
    responsableId: row.responsable_id,
    responsableNombre: row.usuarios?.nombre || '',
    responsableCedula: row.responsable_cedula || '',
    responsableCargo: row.responsable_cargo || '',
    tipoDocumento: row.tipo_documento || '',
    banco: row.banco || '',
    codigoBanco: row.codigo_banco || '',
    tipoCuentaBancaria: row.tipo_cuenta_bancaria || '',
    numeroCuenta: row.numero_cuenta || '',
    titularCuenta: row.titular_cuenta || '',
    cantidadSoportes: 0 // se completa abajo con el conteo real de public.soportes
  });

  const cargarCuentasCobro = async () => {
    setCargandoCuentasCobro(true);
    const { data, error } = await supabase
      .from('cuentas_cobro')
      .select('id, fecha, numero, vencimiento, ciudad, mes, anio, monto, funciones, estado, empresa_nit, responsable_id, responsable_cedula, responsable_cargo, tipo_documento, banco, codigo_banco, tipo_cuenta_bancaria, numero_cuenta, titular_cuenta, empresas ( nombre ), usuarios ( nombre )')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando cuentas de cobro:', error);
      setCargandoCuentasCobro(false);
      return;
    }

    const cuentas = (data || []).map(cuentaCobroDBToLocal);

    // Los soportes de cada cuenta viven en public.soportes (entidad_tipo='cuenta_cobro'), no
    // embebidos en la fila — se cuenta cuántos tiene cada una solo para saber si mostrar el
    // botón "Ver soportes" en la tabla (el contenido real se trae al hacer clic).
    if (cuentas.length > 0) {
      const { data: soportesRows, error: soportesError } = await supabase
        .from('soportes')
        .select('entidad_id')
        .eq('entidad_tipo', 'cuenta_cobro')
        .in('entidad_id', cuentas.map(c => c.id));
      if (soportesError) {
        console.error('Error contando soportes de cuentas de cobro:', soportesError);
      } else {
        const conteo = {};
        (soportesRows || []).forEach(r => { conteo[r.entidad_id] = (conteo[r.entidad_id] || 0) + 1; });
        cuentas.forEach(c => { c.cantidadSoportes = conteo[c.id] || 0; });
      }
    }

    setCuentasDeCobro(cuentas);
    setCargandoCuentasCobro(false);
  };

  // ===== Presupuesto (Items, Anual, Overrides, Deducciones) y Finanzas (Gastos, Ingresos) =====
  // Conectados a Supabase. Los `id` de presupuestoItems/deducciones son uuid de Postgres — nunca
  // se deben parsear con parseInt/Number, las comparaciones siguen siendo con === igual que antes.

  const presupuestoItemDBToLocal = (row) => ({
    id: row.id,
    empresa: row.empresas?.nombre || '',
    ceco: row.cecos?.codigo || '',
    nombre: row.nombre,
    tipo: row.tipo || '',
    valorMensual: row.valor_mensual,
    diaLimitePago: row.dia_limite_pago != null ? String(row.dia_limite_pago) : '',
    activo: row.activo,
    // Vincula el concepto a un colaborador real (usuarios) — permite que el Gasto generado
    // automáticamente al "Marcar Pagado" en la pestaña Mensual quede con responsable_id
    // correcto, sin tener que emparejar por el texto libre de "nombre" cada mes.
    responsableId: row.responsable_id || '',
    responsableNombre: row.usuarios?.nombre || '',
    // Beneficiario del pago cuando NO es un colaborador (EPM, administración…) y cómo se paga.
    terceroId: row.tercero_id || '',
    formaPago: row.forma_pago || ''
  });

  const cargarPresupuestoItems = async () => {
    const { data, error } = await supabase
      .from('presupuesto_items')
      .select('id, nombre, tipo, valor_mensual, dia_limite_pago, activo, responsable_id, tercero_id, forma_pago, empresas ( nombre ), cecos ( codigo ), usuarios ( nombre )')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error cargando presupuesto_items:', error);
      return;
    }
    setPresupuestoItems((data || []).map(presupuestoItemDBToLocal));
  };

  const presupuestoAnualDBToLocal = (row) => ({
    id: row.id,
    empresa: row.empresas?.nombre || '',
    ceco: row.cecos?.codigo || '',
    anio: row.anio,
    valorAnual: row.valor_anual
  });

  const cargarPresupuestoAnual = async () => {
    const { data, error } = await supabase
      .from('presupuesto_anual')
      .select('id, anio, valor_anual, empresas ( nombre ), cecos ( codigo )')
      .order('anio', { ascending: false });
    if (error) {
      console.error('Error cargando presupuesto_anual:', error);
      return;
    }
    setPresupuestoAnual((data || []).map(presupuestoAnualDBToLocal));
  };

  const presupuestoOverrideDBToLocal = (row) => ({
    id: row.id,
    presupuestoItemId: row.presupuesto_item_id,
    anio: row.anio,
    mes: row.mes,
    valor: row.valor
  });

  const cargarPresupuestoOverrides = async () => {
    const { data, error } = await supabase
      .from('presupuesto_overrides')
      .select('id, presupuesto_item_id, anio, mes, valor');
    if (error) {
      console.error('Error cargando presupuesto_overrides:', error);
      return;
    }
    setPresupuestoOverrides((data || []).map(presupuestoOverrideDBToLocal));
  };

  const cargarLotesPago = async () => {
    if (!['Administrador', 'Coordinadora Administrativa', 'Contadora'].includes(user?.rol)) return;
    const { data, error } = await supabase
      .from('lotes_pago_banco')
      .select('id, numero, tipo_pago, secuencia, fecha_aplicacion, cantidad, total, encabezado, estado, created_at, motivo_anulacion, empresas ( nombre ), config_bancaria_empresa ( nombre_cuenta ), lotes_pago_banco_items ( entidad_clave, entidad_tipo, entidad_id, anio, mes, valor, activo, orden, datos, resultado, motivo_rechazo )')
      .order('numero', { ascending: false })
      .limit(200);
    if (error) {
      console.error('Error cargando lotes de pago:', error);
      return;
    }
    setLotesPago(data || []);
  };

  const cargarPresupuestoAprobaciones = async () => {
    const { data, error } = await supabase
      .from('presupuesto_aprobaciones')
      .select('id, presupuesto_item_id, anio, mes, valor_neto, aprobado_por, aprobado_at');
    if (error) {
      console.error('Error cargando presupuesto_aprobaciones:', error);
      return;
    }
    setPresupuestoAprobaciones((data || []).map(row => ({
      id: row.id,
      presupuestoItemId: row.presupuesto_item_id,
      anio: row.anio,
      mes: row.mes,
      valorNeto: parseFloat(row.valor_neto) || 0,
      aprobadoPor: row.aprobado_por,
      aprobadoAt: row.aprobado_at
    })));
  };

  const deduccionDBToLocal = (row) => ({
    id: row.id,
    presupuestoItemId: row.presupuesto_item_id,
    tipo: row.tipo,
    valorCuota: row.valor_cuota,
    saldoTotal: row.saldo_total != null ? row.saldo_total : '',
    fechaInicio: row.fecha_inicio,
    observaciones: row.observaciones || '',
    activo: row.activo
  });

  const cargarDeducciones = async () => {
    const { data, error } = await supabase
      .from('deducciones')
      .select('id, presupuesto_item_id, tipo, valor_cuota, saldo_total, fecha_inicio, observaciones, activo')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error cargando deducciones:', error);
      return;
    }
    setDeducciones((data || []).map(deduccionDBToLocal));
  };

  const cargarPresupuesto = async () => {
    setCargandoPresupuesto(true);
    await Promise.all([cargarPresupuestoItems(), cargarPresupuestoAnual(), cargarPresupuestoOverrides(), cargarPresupuestoAprobaciones(), cargarDeducciones()]);
    setCargandoPresupuesto(false);
  };

  // Cuenta cuántos soportes reales (public.soportes) tiene cada fila de un conjunto de gastos/ingresos.
  const contarSoportesPorEntidad = async (entidadTipo, ids) => {
    if (ids.length === 0) return {};
    const { data, error } = await supabase
      .from('soportes')
      .select('entidad_id')
      .eq('entidad_tipo', entidadTipo)
      .in('entidad_id', ids);
    if (error) {
      console.error(`Error contando soportes de ${entidadTipo}:`, error);
      return {};
    }
    const conteo = {};
    (data || []).forEach(r => { conteo[r.entidad_id] = (conteo[r.entidad_id] || 0) + 1; });
    return conteo;
  };

  const gastoDBToLocal = (row) => ({
    id: row.id,
    fecha: row.fecha,
    createdAt: row.created_at || null,
    tipo: row.tipo,
    empresa: row.empresas?.nombre || '',
    responsable: row.usuarios?.nombre || '',
    responsableNombre: row.usuarios?.nombre || '',
    // `usuarios ( nombre )` viene vacío cuando quien consulta no tiene permiso de RLS para leer
    // la fila de OTRA persona en public.usuarios (le pasa a Contadora y Gerente, que solo pueden
    // leer su propia fila) — responsableId permite resolver el nombre/foto por colaboradores_publico
    // en el render, que sí es legible por cualquier rol autenticado (ver historial de Finanzas).
    responsableId: row.responsable_id || '',
    ceco: row.cecos?.codigo || '',
    cuenta: row.cuenta || '',
    cuentaSalida: row.cuenta_salida || '',
    cuentaDestino: row.cuenta_destino || '',
    detalle: row.detalle || '',
    valor: row.valor,
    valorDestino: row.valor_destino,
    valorBruto: row.valor_bruto,
    deduccionAplicada: row.deduccion_aplicada,
    categoria: row.categoria || '',
    estado: row.estado,
    observaciones: row.observaciones || '',
    presupuestoItemId: row.presupuesto_item_id,
    soporteDriveLink: row.soporte_drive_link || '',
    // "Pago a Tercero" registrado directo en Finanzas (Opción B) o generado automáticamente
    // al marcar una Solicitud como Pagada (Opción C) — mismo formato de moneda/tercero_info
    // que ya usan las Solicitudes, así el modal "Ver Detalle del Tercero" se reutiliza tal cual.
    moneda: row.moneda_pago || '',
    terceroInfo: row.tercero_info || null,
    terceroId: row.tercero_id || '',
    solicitudOrigenId: row.solicitud_origen_id || '',
    // Mismo lote_pago_id que la Solicitud que originó este Gasto, cuando se pagó junto con
    // otras (ver "Pago en Lote" en Solicitudes/Finanzas).
    lotePagoId: row.lote_pago_id || '',
    // Gasto Neutro: queda registrado (en COP, con soportes) pero NO suma como gasto de la empresa.
    neutro: !!row.neutro,
    cantidadSoportes: 0
  });

  const cargarGastos = async () => {
    setCargandoGastos(true);
    const { data, error } = await supabase
      .from('gastos')
      .select('id, created_at, fecha, tipo, cuenta, cuenta_salida, cuenta_destino, detalle, valor, valor_destino, valor_bruto, deduccion_aplicada, categoria, estado, observaciones, presupuesto_item_id, soporte_drive_link, responsable_id, moneda_pago, tercero_info, tercero_id, solicitud_origen_id, lote_pago_id, neutro, empresas ( nombre ), usuarios ( nombre ), cecos ( codigo )')
      .order('fecha', { ascending: false });
    if (error) {
      console.error('Error cargando gastos:', error);
      setCargandoGastos(false);
      return;
    }
    const lista = (data || []).map(gastoDBToLocal);
    if (lista.length > 0) {
      const conteo = await contarSoportesPorEntidad('gasto', lista.map(g => g.id));
      lista.forEach(g => { g.cantidadSoportes = conteo[g.id] || 0; });
    }
    setGastos(lista);
    setCargandoGastos(false);
  };

  const ingresoDBToLocal = (row) => ({
    id: row.id,
    fecha: row.fecha,
    createdAt: row.created_at || null,
    tipo: row.tipo,
    empresa: row.empresas?.nombre || '',
    responsable: row.usuarios?.nombre || '',
    responsableNombre: row.usuarios?.nombre || '',
    responsableId: row.responsable_id || '',
    ceco: row.cecos?.codigo || '',
    cuenta: row.cuenta || '',
    detalle: row.detalle || '',
    valor: row.valor,
    categoria: row.categoria || '',
    estado: row.estado,
    observaciones: row.observaciones || '',
    soporteDriveLink: row.soporte_drive_link || '',
    // Opción C extendida: si este Ingreso se generó automáticamente desde una Legalización con
    // diferencia a favor de la empresa (el colaborador debe devolver dinero), queda acá el id
    // de la Solicitud que lo originó — mismo patrón que gastos.solicitud_origen_id.
    solicitudOrigenId: row.solicitud_origen_id || '',
    cantidadSoportes: 0
  });

  const cargarIngresos = async () => {
    setCargandoIngresos(true);
    const { data, error } = await supabase
      .from('ingresos')
      .select('id, created_at, fecha, tipo, cuenta, detalle, valor, categoria, estado, observaciones, soporte_drive_link, responsable_id, solicitud_origen_id, empresas ( nombre ), usuarios ( nombre ), cecos ( codigo )')
      .order('fecha', { ascending: false });
    if (error) {
      console.error('Error cargando ingresos:', error);
      setCargandoIngresos(false);
      return;
    }
    const lista = (data || []).map(ingresoDBToLocal);
    if (lista.length > 0) {
      const conteo = await contarSoportesPorEntidad('ingreso', lista.map(i => i.id));
      lista.forEach(i => { i.cantidadSoportes = conteo[i.id] || 0; });
    }
    setIngresos(lista);
    setCargandoIngresos(false);
  };

  // Catálogo de CECOs (Centros de Costo/Ingreso) — tabla public.cecos. Reemplaza el array fijo
  // que vivía antes en el código: Administrador/Coordinadora Administrativa pueden crear o editar
  // CECOs desde la pantalla de Gestión de CECOs en Finanzas, y esto se refleja al instante (vía
  // Realtime) en los desplegables de todos los que tengan la app abierta.
  const cargarCecos = async () => {
    setCargandoCecos(true);
    const { data, error } = await supabase
      .from('cecos')
      .select('id, codigo, nombre, tipo, activo')
      .order('codigo');
    if (error) {
      console.error('Error cargando CECOs:', error);
      setCargandoCecos(false);
      return;
    }
    setCecosDB((data || []).map(c => ({ ...c, activo: c.activo !== false })));
    setCargandoCecos(false);
  };

  // Directorio público limitado (nombre/foto/cargo/cumpleaños de TODOS) para el widget de
  // cumpleaños del mes en Mi Perfil, visible para cualquier rol sin exponer datos sensibles.
  const cargarColaboradoresPublico = async () => {
    const { data, error } = await supabase.from('colaboradores_publico').select('*');
    if (error) {
      console.error('Error cargando colaboradores_publico:', error);
      return;
    }
    setColaboradoresPublico(data || []);
  };

  // Catálogo de Terceros guardados, para el selector "Tercero guardado" del formulario de
  // Pago a Tercero — solo los activos (uno "eliminado" queda desactivado, nunca se borra, para
  // no romper el vínculo con los Pagos a Tercero históricos que ya lo usaron).
  const cargarTerceros = async () => {
    const { data, error } = await supabase
      .from('terceros')
      .select('id, nombre, dni, tipo_documento, pais_origen, banco, codigo_banco, tipo_cuenta, numero_cuenta, activo')
      .eq('activo', true)
      .order('nombre');
    if (error) {
      console.error('Error cargando terceros:', error);
      return;
    }
    setTercerosDB(data || []);
  };

  // Igual que cargarTerceros, pero SIN el filtro de activo=true — alimenta la pantalla
  // "Gestión de Terceros" en Finanzas, donde Admin/Coordinadora necesitan ver también los
  // desactivados para poder reactivarlos o solo consultar su historial.
  const cargarTodosTerceros = async () => {
    const { data, error } = await supabase
      .from('terceros')
      .select('id, nombre, dni, tipo_documento, pais_origen, banco, codigo_banco, tipo_cuenta, numero_cuenta, activo')
      .order('nombre');
    if (error) {
      console.error('Error cargando el catálogo completo de terceros:', error);
      return;
    }
    setTodosTerceros(data || []);
  };

  // Elimina un tercero del catálogo reutilizable — borrado lógico (activo=false), nunca se
  // borra la fila, para no romper el vínculo con los Pagos a Tercero ya hechos a esa persona
  // (tercero_id queda apuntando a una fila que sigue existiendo, solo que ya no sale en el
  // desplegable "Tercero guardado" de aquí en adelante). Restringido en la UI a Admin/
  // Coordinadora Administrativa, los mismos roles que ya pueden editar terceros según la RLS.
  const handleEliminarTercero = async (id) => {
    if (!window.confirm('¿Eliminar este tercero del catálogo? Ya no aparecerá en el desplegable para futuros pagos — los pagos que ya se le hicieron no se ven afectados.')) return;
    const { error } = await supabase.from('terceros').update({ activo: false }).eq('id', id);
    if (error) {
      console.error('Error eliminando tercero del catálogo:', error);
      alert('❌ No se pudo eliminar el tercero del catálogo: ' + error.message);
      return;
    }
    // Si era el que estaba elegido en el formulario, se limpia para no dejarlo "seleccionado"
    // apuntando a un tercero que ya no está en la lista.
    if (newSolicitud.terceroId === id) {
      setNewSolicitud({...newSolicitud, terceroId: '', terceroNombre: '', terceroDni: '', terceroTipoDocumento: '', terceroPaisOrigen: '', terceroBanco: '', terceroCodigoBanco: '', terceroTipoCuenta: '', terceroNumeroCuenta: '', guardarTercero: true, actualizarTercero: false});
    }
    // Mismo cuidado si el tercero eliminado era el elegido en el formulario de Finanzas
    // (Nuevo Gasto/Ingreso -> Pago a Tercero), que usa su propio juego de campos en newGasto.
    if (newGasto.terceroId === id) {
      setNewGasto({...newGasto, terceroId: '', terceroNombre: '', terceroDni: '', terceroTipoDocumento: '', terceroPaisOrigen: '', terceroBanco: '', terceroCodigoBanco: '', terceroTipoCuenta: '', terceroNumeroCuenta: '', guardarTercero: true, actualizarTercero: false});
    }
    await Promise.all([cargarTerceros(), cargarTodosTerceros()]);
  };

  // Crea un tercero directo desde la pantalla "Gestión de Terceros" de Finanzas — sin pasar
  // por un Pago a Tercero, para poder precargar el catálogo (proveedores conocidos, etc.)
  // antes de que a alguien le toque pagarle.
  const handleAddTerceroFinanzas = async () => {
    if (!nuevoTercero.nombre.trim() || !nuevoTercero.dni.trim()) {
      alert('Nombre y documento son obligatorios');
      return;
    }
    setGuardandoTercero(true);
    try {
      const { error } = await supabase.from('terceros').insert({
        nombre: nuevoTercero.nombre.trim(),
        dni: limpiarDocumento(nuevoTercero.dni.trim(), nuevoTercero.tipoDocumento),
        tipo_documento: nuevoTercero.tipoDocumento ? Number(nuevoTercero.tipoDocumento) : null,
        pais_origen: nuevoTercero.paisOrigen || null,
        banco: nuevoTercero.banco || null,
        codigo_banco: nuevoTercero.codigoBanco || null,
        tipo_cuenta: nuevoTercero.tipoCuenta || null,
        numero_cuenta: limpiarNumeroCuenta(nuevoTercero.numeroCuenta) || null,
        activo: true,
        creado_por: user.id
      });
      if (error) {
        console.error('Error creando tercero desde Finanzas:', error);
        alert('❌ No se pudo crear el tercero: ' + error.message);
        return;
      }
      await Promise.all([cargarTerceros(), cargarTodosTerceros()]);
      setNuevoTercero(terceroVacio);
    } finally {
      setGuardandoTercero(false);
    }
  };

  // Edición en línea de un tercero desde "Gestión de Terceros" (incluye reactivar/desactivar
  // con el checkbox "Activo") — mismo patrón que handleUpdateCeco.
  const handleUpdateTercero = async (id, campoUI, valor) => {
    const columnaDB = { paisOrigen: 'pais_origen', tipoCuenta: 'tipo_cuenta', numeroCuenta: 'numero_cuenta', tipoDocumento: 'tipo_documento', codigoBanco: 'codigo_banco' }[campoUI] || campoUI;
    // El banco se guarda como código ACH (para el PAB) + su nombre en texto (para PDFs y
    // reportes que ya leen "banco"), siempre los dos juntos.
    const patch = columnaDB === 'codigo_banco'
      ? { codigo_banco: valor || null, banco: textoBancoPara(valor, todosTerceros.find(t => t.id === id)?.banco) || null }
      : { [columnaDB]: valor };
    const anteriores = todosTerceros;
    setTodosTerceros(todosTerceros.map(t => t.id === id ? { ...t, ...patch } : t));
    // .select('id'): si la RLS bloquea el UPDATE, Supabase devuelve error null con 0 filas.
    const { data, error } = await supabase.from('terceros').update(patch).eq('id', id).select('id');
    if (error || !data || data.length === 0) {
      console.error('Error actualizando tercero:', error);
      alert('❌ No se pudo actualizar el tercero' + (error ? ': ' + error.message : ' (sin permiso)'));
      setTodosTerceros(anteriores);
      return;
    }
    await cargarTerceros();
  };

  // Trae el listado de usuarios y de solicitudes apenas hay sesión activa (login o restauración de sesión).
  useEffect(() => {
    if (user) {
      cargarUsuarios();
      cargarSolicitudes();
      cargarCuentasCobro();
      cargarColaboradoresPublico();
      cargarGastos();
      cargarIngresos();
      cargarPresupuesto();
      cargarSoportesPendientes();
      cargarCecos();
      cargarTerceros();
      cargarTodosTerceros();
    } else {
      setUsuariosDB([]);
      setSolicitudes([]);
      setCuentasDeCobro([]);
      setColaboradoresPublico([]);
      setGastos([]);
      setIngresos([]);
      setPresupuestoItems([]);
      setPresupuestoAnual([]);
      setPresupuestoOverrides([]);
      setDeducciones([]);
      setSoportesPendientes([]);
      setCecosDB([]);
      setTercerosDB([]);
      setTodosTerceros([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // TIEMPO REAL (Supabase Realtime): cuando alguien crea/edita/borra un registro en
  // cualquiera de estos módulos, todos los que tengan la app abierta lo ven reflejado al
  // instante, sin salir y volver a entrar. Un solo canal con una suscripción por tabla —
  // cada evento simplemente vuelve a llamar al mismo "cargarXxx" que ya se usa al iniciar
  // sesión, para no duplicar la lógica de mapeo. Requiere haber corrido la Sección 20 de
  // supabase_patch_v2.sql (activa Realtime para estas tablas en el proyecto de Supabase).
  useEffect(() => {
    if (!user) return;

    const canalRealtime = supabase
      .channel('am-holding-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes' }, () => cargarSolicitudes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas_cobro' }, () => cargarCuentasCobro())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => cargarGastos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingresos' }, () => cargarIngresos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuesto_items' }, () => cargarPresupuestoItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuesto_anual' }, () => cargarPresupuestoAnual())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuesto_overrides' }, () => cargarPresupuestoOverrides())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuesto_aprobaciones' }, () => cargarPresupuestoAprobaciones())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lotes_pago_banco' }, () => cargarLotesPago())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deducciones' }, () => cargarDeducciones())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'soportes_pendientes' }, () => cargarSoportesPendientes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cecos' }, () => cargarCecos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'terceros' }, () => { cargarTerceros(); cargarTodosTerceros(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => { cargarUsuarios(); cargarColaboradoresPublico(); })
      // Si el canal se cae (red inestable, la pestaña estuvo en segundo plano un rato largo,
      // etc.) y luego reconecta, "SUBSCRIBED" se dispara de nuevo — aprovechamos ese momento
      // para volver a traer todo. Así, aunque se haya perdido algún evento mientras el canal
      // estaba caído, el usuario nunca se queda viendo datos desactualizados sin saberlo.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          cargarSolicitudes();
          cargarCuentasCobro();
          cargarGastos();
          cargarIngresos();
          cargarPresupuestoItems();
          cargarPresupuestoAnual();
          cargarPresupuestoOverrides();
          cargarPresupuestoAprobaciones();
          cargarLotesPago();
          cargarDeducciones();
          cargarSoportesPendientes();
          cargarCecos();
          cargarTerceros();
          cargarUsuarios();
          cargarColaboradoresPublico();
        }
      });

    return () => {
      supabase.removeChannel(canalRealtime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Refuerzo además del Tiempo Real: cada vez que se entra a un módulo, se refresca su
  // información desde Supabase. Así, si por lo que sea el canal de Tiempo Real se perdió un
  // evento (p. ej. otro colaborador guardó algo mientras esta pestaña estaba en segundo
  // plano), con solo hacer clic en el módulo ya se ve lo último — sin depender 100% del socket.
  useEffect(() => {
    if (!user) return;
    if (currentView === 'solicitudes') cargarSolicitudes();
    if (currentView === 'cuentasCobro') cargarCuentasCobro();
    if (currentView === 'finanzas' || currentView === 'dashboardFinanciero') { cargarGastos(); cargarIngresos(); }
    // Al entrar a Finanzas el formulario de registro siempre arranca plegado.
    if (currentView === 'finanzas') setMostrarNuevoMovimientoFinanzas(false);
    if (currentView === 'presupuesto') { cargarTodosTerceros(); cargarPresupuestoItems(); cargarPresupuestoAnual(); cargarPresupuestoOverrides(); cargarPresupuestoAprobaciones(); cargarCuentasCobro(); }
    if (currentView === 'responsables') { cargarUsuarios(); cargarColaboradoresPublico(); }
    if (currentView === 'datosBancarios' || currentView === 'auditoria') { cargarUsuarios(); cargarTodosTerceros(); }
    if (currentView === 'pagosPAB') { cargarUsuarios(); cargarTodosTerceros(); cargarSolicitudes(); cargarCuentasCobro(); cargarPresupuestoItems(); cargarPresupuestoOverrides(); cargarPresupuestoAprobaciones(); cargarLotesPago(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  // Limpia la selección de "Marcar Pagado en lote" de Presupuesto al cambiar de Empresa/Mes/Año
  // — evita arrastrar ids marcados en un mes hacia otro por accidente (seleccionPresupuestoValida
  // ya los filtra igual, esto solo evita la confusión de ver casillas premarcadas al cambiar filtro).
  useEffect(() => {
    setSeleccionPresupuestoPendientes([]);
  }, [filtroPresupuesto.empresa, filtroPresupuesto.mes, filtroPresupuesto.anio]);

  // Al entrar a "Mi Perfil" se refresca el borrador con los datos más recientes guardados.
  useEffect(() => {
    if (currentView === 'mi-perfil' && miPerfil) {
      setMiPerfilForm(miPerfil);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, miPerfil]);

  // Agregar documento (línea de gasto/soporte) — se agrega AL INICIO de la lista (no al final):
  // con muchos ítems ya cargados, el usuario tenía que bajar hasta el fondo del formulario cada
  // vez que daba "+ Agregar" para llegar a la fila nueva vacía. Así la fila a llenar siempre
  // aparece arriba, justo debajo del botón.
  const handleAddDocumento = () => {
    setNewSolicitud({
      ...newSolicitud,
      documentos: [{ fecha: newSolicitud.fecha, proveedor: '', nit: '', descripcion: '', valor: '', tipoSoporte: '' }, ...newSolicitud.documentos]
    });
  };

  // Eliminar documento
  const handleDeleteDocumento = (idx) => {
    setNewSolicitud({
      ...newSolicitud,
      documentos: newSolicitud.documentos.filter((_, i) => i !== idx)
    });
  };

  // Soportes consolidados (Legalización / Reembolso) — se unen en un solo PDF al guardar,
  // y ese PDF único es el que sube al bucket "soportes" de Supabase.
  const handleAddSoporteLegalizacion = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const nuevoSoporte = {
          id: Date.now() + Math.random(),
          nombre: file.name,
          tipo: file.type,
          tamaño: file.size,
          data: event.target.result
        };
        setSoportesLegalizacionTemp(prev => [...prev, nuevoSoporte]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveSoporteLegalizacion = (id) => {
    setSoportesLegalizacionTemp(soportesLegalizacionTemp.filter(s => s.id !== id));
  };

  // Soportes de "Pago a Tercero" — a diferencia de Legalización/Reembolso, NO se unen en un
  // solo PDF: cada archivo (foto, PDF, etc.) queda como su propio soporte, igual que en Gasto.
  const handleAddSoporteTercero = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const nuevoSoporte = {
          id: Date.now() + Math.random(),
          nombre: file.name,
          tipo: file.type,
          tamaño: file.size,
          data: event.target.result
        };
        setSoportesTerceroTemp(prev => [...prev, nuevoSoporte]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveSoporteTercero = (id) => {
    setSoportesTerceroTemp(soportesTerceroTemp.filter(s => s.id !== id));
  };

  // Fotos tomadas DIRECTO con la cámara del celular a veces llegan al navegador sin
  // File.type (sobre todo en Android/webviews) — sin esto, ese archivo se guardaba en Storage
  // como "application/octet-stream" y, al usarse luego en una Legalización/Reembolso, el PDF
  // consolidado lo descartaba sin avisar porque no lo reconocía como imagen. Se infiere el tipo
  // real por la extensión del nombre como respaldo cuando el navegador no lo trae.
  const inferirMimePorExtension = (nombre) => {
    const ext = (nombre || '').split('.').pop().toLowerCase();
    const mapa = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', pdf: 'application/pdf', heic: 'image/heic', heif: 'image/heif' };
    return mapa[ext] || '';
  };

  // BANDEJA DE SOPORTES — lee el archivo elegido a memoria (igual que el resto de uploads)
  // y lo deja listo en el formulario cortico de "agregar a la bandeja" (todavía no sube nada).
  const handleSeleccionarArchivoPendiente = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const tipo = file.type || inferirMimePorExtension(file.name);
      setNuevoSoportePendiente(prev => ({ ...prev, archivo: { nombre: file.name, tipo, tamaño: file.size, data: event.target.result } }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Sube el archivo al bucket "soportes" (carpeta "pendiente/<usuario>/...") y guarda su fila
  // en public.soportes_pendientes con los datos que la persona diligenció.
  const handleAgregarSoportePendiente = async () => {
    if (!nuevoSoportePendiente.archivo) {
      alert('Selecciona el archivo del recibo/factura');
      return;
    }
    if (!nuevoSoportePendiente.fecha || !nuevoSoportePendiente.valor) {
      alert('Fecha y valor son obligatorios');
      return;
    }
    if (!(nuevoSoportePendiente.descripcion || '').trim()) {
      alert('Escribe "Por concepto de" (es obligatorio)');
      return;
    }
    setSubiendoSoportePendiente(true);
    try {
      const archivo = nuevoSoportePendiente.archivo;
      const bytes = dataUrlToUint8Array(archivo.data);
      const blob = new Blob([bytes], { type: archivo.tipo || 'application/octet-stream' });
      const nombreLimpio = (archivo.nombre || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
      const rutaArchivo = `pendiente/${user.id}/${Date.now()}_${nombreLimpio}`;

      const { error: uploadError } = await supabase.storage
        .from('soportes')
        .upload(rutaArchivo, blob, { contentType: archivo.tipo || undefined, upsert: false });
      if (uploadError) {
        console.error('Error subiendo recibo a la bandeja:', uploadError);
        alert('❌ No se pudo subir el archivo: ' + uploadError.message);
        return;
      }

      const { error } = await supabase.from('soportes_pendientes').insert({
        usuario_id: user.id,
        fecha: nuevoSoportePendiente.fecha,
        proveedor: nuevoSoportePendiente.proveedor || null,
        nit: nuevoSoportePendiente.nit || null,
        descripcion: nuevoSoportePendiente.descripcion.trim(),
        valor: parseFloat(nuevoSoportePendiente.valor) || 0,
        tipo_soporte: nuevoSoportePendiente.tipoSoporte || null,
        bucket_path: rutaArchivo,
        nombre_original: archivo.nombre,
        tamano_kb: Math.round((archivo.tamaño || bytes.length) / 1024)
      });
      if (error) {
        console.error('Error guardando recibo en la bandeja:', error);
        alert('❌ Se subió el archivo pero no se pudo registrar: ' + error.message);
        return;
      }

      await cargarSoportesPendientes();
      setNuevoSoportePendiente(nuevoSoportePendienteVacio);
      alert('✅ Recibo agregado a tu bandeja');
    } finally {
      setSubiendoSoportePendiente(false);
    }
  };

  const handleEliminarSoportePendiente = async (item) => {
    if (!window.confirm('¿Eliminar este recibo de tu bandeja?')) return;
    await supabase.storage.from('soportes').remove([item.bucketPath]);
    const { error } = await supabase.from('soportes_pendientes').delete().eq('id', item.id);
    if (error) {
      console.error('Error eliminando recibo de la bandeja:', error);
      alert('❌ No se pudo eliminar: ' + error.message);
      return;
    }
    setSoportesPendientes(soportesPendientes.filter(s => s.id !== item.id));
    setSeleccionPendientes(seleccionPendientes.filter(id => id !== item.id));
  };

  const toggleSeleccionPendiente = (id) => {
    setSeleccionPendientes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Editar un recibo ya guardado en la bandeja: la fila se vuelve inputs con los datos actuales.
  const handleIniciarEdicionPendiente = (item) => {
    setEditandoPendienteId(item.id);
    setPendienteEditData({ fecha: item.fecha, proveedor: item.proveedor, nit: item.nit, descripcion: item.descripcion, valor: item.valor, tipoSoporte: item.tipoSoporte });
  };

  const handleCancelarEdicionPendiente = () => {
    setEditandoPendienteId(null);
    setPendienteEditData(null);
  };

  const handleGuardarEdicionPendiente = async (id) => {
    if (!pendienteEditData.fecha || !pendienteEditData.valor) {
      alert('Fecha y valor son obligatorios');
      return;
    }
    if (!(pendienteEditData.descripcion || '').trim()) {
      alert('El Concepto es obligatorio');
      return;
    }
    setGuardandoEdicionPendiente(true);
    try {
      const { error } = await supabase
        .from('soportes_pendientes')
        .update({
          fecha: pendienteEditData.fecha,
          proveedor: pendienteEditData.proveedor || null,
          nit: pendienteEditData.nit || null,
          descripcion: pendienteEditData.descripcion.trim(),
          valor: parseFloat(pendienteEditData.valor) || 0,
          tipo_soporte: pendienteEditData.tipoSoporte || null
        })
        .eq('id', id);
      if (error) {
        console.error('Error editando recibo de la bandeja:', error);
        alert('❌ No se pudo guardar la edición: ' + error.message);
        return;
      }
      await cargarSoportesPendientes();
      setEditandoPendienteId(null);
      setPendienteEditData(null);
    } finally {
      setGuardandoEdicionPendiente(false);
    }
  };

  // Toma los recibos marcados en la bandeja y prellena el formulario de "Nueva Solicitud" de
  // arriba (tipo, tabla de Ítems del Gasto, y los archivos ya descargados listos para unirse en
  // el PDF consolidado) — la persona solo revisa/completa y le da Guardar, igual que siempre.
  // Los recibos quedan marcados "usado" recién cuando esa solicitud se guarda con éxito.
  const handleUsarPendientesEnSolicitud = async (tipo) => {
    const seleccionados = soportesPendientes.filter(s => seleccionPendientes.includes(s.id));
    if (seleccionados.length === 0) {
      alert('Selecciona al menos un recibo de tu bandeja');
      return;
    }
    // Recibos subidos antes de que el Concepto fuera obligatorio: hay que completarlo (✏️) primero.
    const sinConcepto = seleccionados.filter(s => !(s.descripcion || '').trim());
    if (sinConcepto.length > 0) {
      alert(`Completa el Concepto (✏️) de estos recibos antes de usarlos:\n• ${sinConcepto.map(s => `${s.fecha} — ${s.proveedor || 'sin proveedor'}`).join('\n• ')}`);
      return;
    }
    setCargandoSoportesPendientes(true);
    try {
      const archivosDescargados = [];
      for (const item of seleccionados) {
        const { data, error } = await supabase.storage.from('soportes').download(item.bucketPath);
        if (error || !data) {
          console.error('Error descargando recibo de la bandeja:', item, error);
          continue;
        }
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(data);
        });
        archivosDescargados.push({ id: item.id, nombre: item.nombre, tipo: data.type, tamaño: (item.tamano || 0) * 1024, data: dataUrl });
      }

      setSoportesLegalizacionTemp(archivosDescargados);
      setNewSolicitud(prev => ({
        ...prev,
        tipo,
        documentos: seleccionados.map(s => ({ fecha: s.fecha, proveedor: s.proveedor, nit: s.nit, descripcion: s.descripcion, valor: s.valor, tipoSoporte: s.tipoSoporte }))
      }));
      setPendientesEnUso(seleccionados.map(s => s.id));
      setSeleccionPendientes([]);
      alert(`✅ Se cargaron ${seleccionados.length} recibo(s) en el formulario de Nueva Solicitud, debajo. Revisa y completa el Concepto antes de guardar.`);
    } finally {
      setCargandoSoportesPendientes(false);
    }
  };

  // Puede editar una Solicitud mientras esté Pendiente o Devuelto: quien la creó, o
  // Administrador/Coordinadora Administrativa (los mismos roles que ya gestionan todo el flujo).
  // Una vez Aprobada/Pagada/Legalizada ya no se puede editar — solo mientras es corregible sin
  // afectar nada que ya se haya movido en Finanzas. Excepción: "Legalización T. Pro" ya
  // Legalizada SÍ se puede seguir editando, pero solo por Administrador/Coordinadora
  // Administrativa (ej. corregir un dato después de haberla revisado).
  const puedeEditarSolicitud = (s) => {
    if (isReadOnly) return false;
    if (s.estado === 'Pendiente' || s.estado === 'Devuelto') return s.responsableId === user.id || canApprove;
    if (s.tipo === 'Legalización T. Pro' && s.estado === 'Legalizado') return canApprove;
    return false;
  };

  // Puede eliminar: igual que siempre para el resto de tipos (sin restricción de estado, como ya
  // funcionaba) — con una excepción nueva: una "Legalización T. Pro" ya Legalizada solo la puede
  // eliminar Administrador/Coordinadora Administrativa.
  const puedeEliminarSolicitud = (s) => {
    if (s.tipo === 'Legalización T. Pro' && s.estado === 'Legalizado') return canApprove;
    return true;
  };

  // Carga una Solicitud existente en el formulario "Nueva Solicitud" de arriba (mismo formulario,
  // ahora en modo edición) y hace scroll hasta allá. El Tipo queda fijo — cambiarlo cambiaría toda
  // la estructura de campos/documentos de la solicitud ya guardada.
  const handleIniciarEdicionSolicitud = (s) => {
    if (!puedeEditarSolicitud(s)) return;
    setEditingSolicitudId(s.id);
    setNewSolicitud({
      fecha: s.fecha,
      tipo: s.tipo,
      valor: s.valor || '',
      valorAnticipoOriginal: s.valorAnticipoOriginal || '',
      anticipoIds: s.anticipoIds || [],
      detalle: s.detalle || '',
      empresa: s.empresa || 'AM SPORTS GROUP SAS',
      documentos: s.documentos || [],
      moneda: s.moneda || 'COP',
      terceroId: s.terceroId || '',
      terceroNombre: s.terceroInfo?.nombre || '',
      terceroDni: s.terceroInfo?.dni || '',
      terceroTipoDocumento: s.terceroInfo?.tipoDocumento || '',
      terceroPaisOrigen: s.terceroInfo?.paisOrigen || '',
      terceroBanco: s.terceroInfo?.banco || '',
      terceroCodigoBanco: s.terceroInfo?.codigoBanco || inferirCodigoBanco(s.terceroInfo?.banco),
      terceroTipoCuenta: s.terceroInfo?.tipoCuenta || '',
      terceroNumeroCuenta: s.terceroInfo?.numeroCuenta || '',
      guardarTercero: false,
      actualizarTercero: false
    });
    setSoportesAdicionalesEdicion([]);
    setTimeout(() => {
      document.getElementById('form-nueva-solicitud')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const handleCancelarEdicionSolicitud = () => {
    setEditingSolicitudId(null);
    setSoportesAdicionalesEdicion([]);
    setSoportesLegalizacionTemp([]);
    setSoportesTerceroTemp([]);
    setNewSolicitud({
      fecha: new Date().toISOString().split('T')[0],
      tipo: '',
      valor: '',
      valorAnticipoOriginal: '',
      anticipoIds: [],
      detalle: '',
      empresa: 'AM SPORTS GROUP SAS',
      documentos: [],
      moneda: 'COP',
      terceroId: '',
      terceroNombre: '',
      terceroDni: '',
      terceroTipoDocumento: '',
      terceroPaisOrigen: '',
      terceroBanco: '',
      terceroCodigoBanco: '',
      terceroTipoCuenta: '',
      terceroNumeroCuenta: '',
      guardarTercero: true,
      actualizarTercero: false
    });
  };

  // Soportes sueltos para completar una solicitud ya guardada (ej. la factura que faltó al
  // crearla) — se leen a memoria igual que el resto de uploads y se suben recién al Guardar,
  // cada uno como su propia fila en public.soportes, sin tocar nada que ya estuviera subido.
  const handleSeleccionarSoporteAdicionalEdicion = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const tipo = file.type || inferirMimePorExtension(file.name);
        const nuevo = { id: Date.now() + Math.random(), nombre: file.name, tipo, tamaño: file.size, data: event.target.result };
        setSoportesAdicionalesEdicion(prev => [...prev, nuevo]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleQuitarSoporteAdicionalEdicion = (id) => {
    setSoportesAdicionalesEdicion(prev => prev.filter(s => s.id !== id));
  };

  // Guardar solicitud — en modo creación inserta en public.solicitudes y, si hay soportes
  // cargados, los une en un solo PDF consolidado (como antes) y sube ESE PDF único al bucket
  // "soportes" con su fila en public.soportes (queda registrado en Supabase, no en localStorage).
  // En modo edición (editingSolicitudId) actualiza esa misma fila en vez de crear una nueva, y
  // solo sube soportes sueltos adicionales — no vuelve a generar el PDF consolidado ni la ficha
  // de Pago a Tercero, para no duplicar lo que ya se subió al crearla.
  const handleAddSolicitud = async () => {
    if (!newSolicitud.tipo) {
      alert('Selecciona un tipo');
      return;
    }

    // Concepto obligatorio en TODOS los tipos: es el detalle con el que el pago queda en Finanzas.
    if (!(newSolicitud.detalle || '').trim()) {
      alert('Escribe el Concepto de la solicitud (es obligatorio y es el detalle con el que queda en Finanzas)');
      return;
    }

    if (esTipoValorUnico(newSolicitud.tipo) && !newSolicitud.valor) {
      alert(newSolicitud.tipo === 'Comisión' ? 'Ingresa el valor de la comisión' : 'Ingresa valor solicitado');
      return;
    }

    if (esTipoValorUnico(newSolicitud.tipo) && parseFloat(newSolicitud.valor) <= 0) {
      alert(newSolicitud.tipo === 'Comisión' ? 'El valor de la comisión debe ser mayor a cero' : 'El valor solicitado debe ser mayor a cero');
      return;
    }

    // Comisión: el soporte (cuenta de cobro, factura, liquidación…) es obligatorio al crearla.
    if (newSolicitud.tipo === 'Comisión' && !editingSolicitudId && soportesLegalizacionTemp.length === 0) {
      alert('Adjunta al menos un soporte de la comisión');
      return;
    }

    if ((newSolicitud.tipo === 'Legalización' || newSolicitud.tipo === 'Reembolso' || newSolicitud.tipo === 'Legalización T. Pro') && newSolicitud.documentos.length === 0) {
      alert('Agrega al menos un documento');
      return;
    }

    // Cada Ítem del Gasto también necesita su "Por concepto de".
    const itemsSinConcepto = newSolicitud.documentos.filter(d => !(d.descripcion || '').trim()).length;
    if (itemsSinConcepto > 0) {
      alert(`Falta "Por concepto de" en ${itemsSinConcepto} ítem(s) del gasto`);
      return;
    }

    if (newSolicitud.tipo === 'Pago a Tercero') {
      if (!newSolicitud.terceroNombre || !newSolicitud.terceroDni) {
        alert('Nombre y DNI/Documento del tercero son obligatorios');
        return;
      }
      if (!newSolicitud.valor || parseFloat(newSolicitud.valor) <= 0) {
        alert('El valor a pagar debe ser mayor a cero');
        return;
      }
      if (!newSolicitud.moneda) {
        alert('Selecciona la moneda del pago');
        return;
      }
    }

    const totalCalculado = newSolicitud.documentos.reduce((sum, doc) => sum + (parseFloat(doc.valor) || 0), 0);
    // Pago a Tercero es la excepción: ahí SÍ se respeta la Empresa elegida en el formulario aunque
    // quien crea sea Responsable/Gerente (puede pagarse desde una empresa distinta a la suya, ej.
    // ARKO en USD) — para los demás tipos, la Empresa de un Responsable/Gerente sigue siendo
    // siempre la propia, sin excepción.
    const empresaNombre = (newSolicitud.tipo !== 'Pago a Tercero' && user.rol === 'Responsable') ? user.empresa : newSolicitud.empresa;

    setGuardandoSolicitud(true);
    try {
      let empresaId = null;
      if (empresaNombre) {
        const { data: empresaRow, error: empresaError } = await supabase
          .from('empresas')
          .select('id')
          .eq('nombre', empresaNombre)
          .single();
        if (empresaError) console.error('Error buscando empresa:', empresaError);
        empresaId = empresaRow?.id || null;
      }

      // Legalización ligada de verdad a las Solicitudes de Anticipo que le dieron origen (si se
      // eligió al menos una — ahora se pueden elegir varias): valor_anticipo_original queda
      // como la SUMA de todos los anticipos elegidos (respaldo/compatibilidad con reportes que
      // ya lo leían así), y anticipo_ids es la lista real para saber cuáles quedaron vinculados.
      const anticiposVinculados = newSolicitud.tipo === 'Legalización' && newSolicitud.anticipoIds.length > 0
        ? newSolicitud.anticipoIds.map(id => solicitudes.find(a => a.id === id)).filter(Boolean)
        : [];

      // Pago a Tercero: la moneda es la que se elige en el formulario (independiente de la
      // empresa que paga — puede ser una empresa en COP pagando a alguien en USD, o al revés),
      // y los datos del tercero van en un solo JSONB para no sumar media docena de columnas.
      const terceroInfoFinal = newSolicitud.tipo === 'Pago a Tercero' ? {
        nombre: newSolicitud.terceroNombre,
        dni: limpiarDocumento(newSolicitud.terceroDni, newSolicitud.terceroTipoDocumento),
        tipoDocumento: newSolicitud.terceroTipoDocumento ? Number(newSolicitud.terceroTipoDocumento) : null,
        paisOrigen: newSolicitud.terceroPaisOrigen || null,
        banco: newSolicitud.terceroBanco || null,
        codigoBanco: newSolicitud.terceroCodigoBanco || null,
        tipoCuenta: newSolicitud.terceroTipoCuenta || null,
        numeroCuenta: limpiarNumeroCuenta(newSolicitud.terceroNumeroCuenta) || null,
      } : null;

      // Catálogo reutilizable de terceros (public.terceros): si se eligió "Nuevo tercero" y
      // quedó marcado "Guardar", se crea ahí para que la próxima vez que se le pague a la
      // misma persona baste con elegirlo del desplegable y digitar solo el Valor. Si se eligió
      // uno ya guardado y se marcó "Actualizar", se sincronizan sus datos con lo editado aquí.
      // Ninguna de las dos cosas bloquea el guardado del pago si falla — el pago igual se
      // registra, solo que el tercero no queda (o no se actualiza) en el catálogo.
      let terceroIdFinal = newSolicitud.terceroId || null;
      if (newSolicitud.tipo === 'Pago a Tercero') {
        if (!terceroIdFinal && newSolicitud.guardarTercero) {
          const { data: nuevoTercero, error: terceroError } = await supabase
            .from('terceros')
            .insert({
              nombre: newSolicitud.terceroNombre,
              dni: limpiarDocumento(newSolicitud.terceroDni, newSolicitud.terceroTipoDocumento),
              tipo_documento: newSolicitud.terceroTipoDocumento ? Number(newSolicitud.terceroTipoDocumento) : null,
              pais_origen: newSolicitud.terceroPaisOrigen || null,
              banco: newSolicitud.terceroBanco || null,
              codigo_banco: newSolicitud.terceroCodigoBanco || null,
              tipo_cuenta: newSolicitud.terceroTipoCuenta || null,
              numero_cuenta: limpiarNumeroCuenta(newSolicitud.terceroNumeroCuenta) || null,
              // Explícito y no solo confiado al DEFAULT de la columna: si esta fila queda con
              // activo = null (p. ej. porque la tabla se creó sin default en esa columna),
              // cargarTerceros() la filtra con .eq('activo', true) y el tercero nunca aparece
              // en el desplegable "Tercero guardado" — aunque el insert haya funcionado bien.
              activo: true,
              creado_por: user.id
            })
            .select('id')
            .single();
          if (terceroError) {
            console.error('Error guardando el tercero para reutilizar:', terceroError);
            alert('⚠️ La solicitud se guardó, pero el tercero NO quedó guardado para futuros pagos: ' + terceroError.message);
          } else {
            terceroIdFinal = nuevoTercero.id;
          }
        } else if (terceroIdFinal && newSolicitud.actualizarTercero) {
          const { error: updateError } = await supabase
            .from('terceros')
            .update({
              nombre: newSolicitud.terceroNombre,
              dni: limpiarDocumento(newSolicitud.terceroDni, newSolicitud.terceroTipoDocumento),
              tipo_documento: newSolicitud.terceroTipoDocumento ? Number(newSolicitud.terceroTipoDocumento) : null,
              pais_origen: newSolicitud.terceroPaisOrigen || null,
              banco: newSolicitud.terceroBanco || null,
              codigo_banco: newSolicitud.terceroCodigoBanco || null,
              tipo_cuenta: newSolicitud.terceroTipoCuenta || null,
              numero_cuenta: limpiarNumeroCuenta(newSolicitud.terceroNumeroCuenta) || null,
            })
            .eq('id', terceroIdFinal);
          if (updateError) {
            console.error('Error actualizando los datos guardados del tercero:', updateError);
            alert('⚠️ La solicitud se guardó, pero no se pudieron actualizar los datos guardados del tercero: ' + updateError.message);
          }
        }
      }

      // Campos comunes a INSERT (solicitud nueva) y UPDATE (edición de una Pendiente/Devuelto) —
      // lo único que NUNCA se toca en edición es responsable_id (una edición no puede cambiar de
      // dueño). "estado" y "motivo_devolucion" SÍ se tocan a propósito: si se estaba editando una
      // solicitud "Devuelto" (corrigiendo lo que motivó la devolución), guardar la reenvía a
      // "Pendiente" y borra el motivo — vuelve a quedar en la cola de revisión. Si ya estaba
      // "Pendiente" (la otra única editable), esto es un no-op.
      // Excepción: una "Legalización T. Pro" ya Legalizada que Administrador/Coordinadora edita
      // (ver puedeEditarSolicitud) NO se reenvía a "Pendiente" — se queda Legalizada, porque el
      // Gasto en Finanzas ya se generó y reabrirla como si nada se hubiera aprobado sería
      // confuso.
      const solicitudOriginalEnEdicion = editingSolicitudId ? solicitudes.find(s => s.id === editingSolicitudId) : null;
      const estadoAlGuardar = (solicitudOriginalEnEdicion && solicitudOriginalEnEdicion.tipo === 'Legalización T. Pro' && solicitudOriginalEnEdicion.estado === 'Legalizado')
        ? 'Legalizado'
        : 'Pendiente';
      const camposSolicitud = {
        fecha: newSolicitud.fecha,
        valor: (esTipoValorUnico(newSolicitud.tipo) || newSolicitud.tipo === 'Pago a Tercero') ? (parseFloat(newSolicitud.valor) || 0) : 0,
        total_calculado: totalCalculado,
        detalle: newSolicitud.detalle.trim(),
        empresa_id: empresaId,
        documentos: newSolicitud.documentos,
        // anticipo_id (singular, columna vieja) se sigue llenando con el primero elegido, solo
        // por compatibilidad con cualquier reporte/consulta externa que todavía la use.
        anticipo_id: anticiposVinculados.length > 0 ? anticiposVinculados[0].id : null,
        anticipo_ids: anticiposVinculados.map(a => a.id),
        valor_anticipo_original: newSolicitud.tipo === 'Legalización' ? (parseFloat(newSolicitud.valorAnticipoOriginal) || null) : null,
        moneda_pago: newSolicitud.tipo === 'Pago a Tercero' ? newSolicitud.moneda : null,
        tercero_info: terceroInfoFinal,
        tercero_id: terceroIdFinal,
        estado: estadoAlGuardar,
        motivo_devolucion: null
      };

      let solicitudId;
      if (editingSolicitudId) {
        // Importante: pedimos .select('id') en vez de solo comprobar "error". Si una política de
        // RLS (o una sesión vencida: auth.uid() nulo) impide la actualización, Supabase NO
        // lanza error — simplemente actualiza 0 filas y responde como si hubiera ido bien. Sin
        // este chequeo, la app mostraba "✅ Solicitud actualizada" aunque nada se hubiera guardado.
        const { data: filasActualizadas, error: updateError } = await supabase
          .from('solicitudes')
          .update(camposSolicitud)
          .eq('id', editingSolicitudId)
          .select('id');
        if (updateError) {
          console.error('Error editando solicitud:', updateError);
          alert('❌ No se pudo guardar la edición: ' + updateError.message);
          return;
        }
        if (!filasActualizadas || filasActualizadas.length === 0) {
          console.error('UPDATE de solicitud no afectó ninguna fila (posible sesión vencida o permiso insuficiente).');
          alert('❌ No se pudo guardar: tu sesión puede haber vencido. Por favor cierra sesión, vuelve a entrar e inténtalo de nuevo.');
          return;
        }
        solicitudId = editingSolicitudId;
      } else {
        const { data: inserted, error } = await supabase
          .from('solicitudes')
          .insert({ ...camposSolicitud, tipo: newSolicitud.tipo, responsable_id: user.id, estado: 'Pendiente' })
          .select('id')
          .single();
        if (error) {
          console.error('Error creando solicitud:', error);
          alert('❌ No se pudo guardar la solicitud: ' + error.message);
          return;
        }
        solicitudId = inserted.id;
      }

      // Soportes agregados durante una EDICIÓN (ej. los recibos de los ítems nuevos, o algo que
      // faltó subir al crear la solicitud) — se fusionan con TODO lo que ya estaba subido en un
      // solo PDF consolidado, que reemplaza a los anteriores (ver fusionarSoportesEdicion).
      if (editingSolicitudId && soportesAdicionalesEdicion.length > 0) {
        try {
          await fusionarSoportesEdicion(solicitudId, soportesAdicionalesEdicion, {
            empresa: empresaNombre,
            tipo: newSolicitud.tipo,
            responsableNombre: colaboradoresPublico.find(c => c.id === solicitudOriginalEnEdicion?.responsableId)?.nombre || solicitudOriginalEnEdicion?.responsableNombre || '',
            fecha: newSolicitud.fecha
          });
        } catch (fusionError) {
          console.error('Error fusionando soportes en la edición:', fusionError);
          alert('⚠️ La solicitud se guardó, pero hubo un error fusionando los soportes en un solo PDF.');
        }
      }

      // Lo que sigue (unir soportes de la Bandeja en un PDF, subir soportes de Pago a Tercero,
      // generar la ficha automática, marcar recibos de la bandeja como usados) es exclusivo de
      // CREAR una solicitud nueva — en edición no se repite para no duplicar lo ya generado.
      // Los soportes de Legalización/Reembolso se unen en un solo PDF (con portada de la
      // empresa) y ese PDF único se sube al bucket "soportes" (una sola fila en public.soportes
      // por solicitud).
      if (!editingSolicitudId && soportesLegalizacionTemp.length > 0) {
        try {
          const soportePDF = await mergeSoportesToPDF(soportesLegalizacionTemp, {
            empresa: empresaNombre,
            tipo: newSolicitud.tipo,
            responsableNombre: user.nombre,
            fecha: newSolicitud.fecha
          });
          await subirSoporteEntidad(soportePDF, 'solicitud', solicitudId);

          // Los soportes que no se pudieron unir al PDF (ej. una foto en un formato que pdf-lib
          // no soporta) NUNCA se pierden: se suben sueltos, cada uno como su propia fila en
          // public.soportes de esta misma solicitud, para que sigan visibles en "Ver Soportes"
          // aunque no queden dentro del PDF consolidado.
          if (soportePDF.omitidos && soportePDF.omitidos.length > 0) {
            for (const soporteOmitido of soportePDF.omitidos) {
              await subirSoporteEntidad(soporteOmitido, 'solicitud', solicitudId);
            }
            alert(`⚠️ ${soportePDF.omitidos.length} archivo(s) no se pudieron unir al PDF consolidado (formato no compatible, ej. HEIC) — se guardaron sueltos, cada uno por su cuenta: ${soportePDF.omitidos.map(s => s.nombre).join(', ')}`);
          }
        } catch (mergeError) {
          console.error('Error uniendo soportes a PDF:', mergeError);
          alert('⚠️ La solicitud se guardó, pero hubo un error uniendo los soportes en un solo PDF.');
        }
      }

      // Soportes de Pago a Tercero: cada archivo queda como su propia fila en public.soportes
      // (sin unirse en un PDF), igual que en Gasto/Ingreso.
      if (!editingSolicitudId && soportesTerceroTemp.length > 0) {
        for (const soporte of soportesTerceroTemp) {
          await subirSoporteEntidad(soporte, 'solicitud', solicitudId);
        }
      }

      // Pago a Tercero: se genera automáticamente la ficha PDF (datos de la solicitud + del
      // tercero + cuenta bancaria) y se sube a "Ver Soportes" junto a los adjuntos del
      // colaborador — así la Coordinadora Administrativa tiene TODO lo que necesita para
      // ejecutar el pago en un solo lugar, sin depender de que alguien lo pida aparte.
      if (!editingSolicitudId && newSolicitud.tipo === 'Pago a Tercero') {
        try {
          const pdfDoc = construirPDFPagoTercero({
            empresa: empresaNombre,
            empresaNit: NIT_EMPRESAS[empresaNombre] || '',
            fecha: newSolicitud.fecha,
            responsableNombre: user.nombre,
            detalle: newSolicitud.detalle,
            valor: parseFloat(newSolicitud.valor) || 0,
            moneda: newSolicitud.moneda,
            tercero: terceroInfoFinal || {},
            estado: 'Pendiente'
          });
          await subirSoporteEntidad({
            nombre: `Pago_a_Tercero_${(newSolicitud.terceroNombre || 'tercero').replace(/\s+/g, '_')}.pdf`,
            tipo: 'application/pdf',
            data: pdfDoc.output('datauristring')
          }, 'solicitud', solicitudId);
        } catch (pdfError) {
          console.error('Error generando el PDF de Pago a Tercero:', pdfError);
          alert('⚠️ La solicitud se guardó, pero hubo un error generando el PDF automático.');
        }
      }

      // Los recibos de la bandeja que se usaron para prellenar este formulario quedan marcados
      // "usado" y ligados a esta solicitud — recién ahora que se guardó con éxito.
      if (!editingSolicitudId && pendientesEnUso.length > 0) {
        const { error: errorMarcar } = await supabase
          .from('soportes_pendientes')
          .update({ usado: true, solicitud_id: solicitudId })
          .in('id', pendientesEnUso);
        if (errorMarcar) console.error('Error marcando recibos de la bandeja como usados:', errorMarcar);
        setPendientesEnUso([]);
        await cargarSoportesPendientes();
      }

      await cargarSolicitudes();
      if (newSolicitud.tipo === 'Pago a Tercero' && (newSolicitud.guardarTercero || newSolicitud.actualizarTercero)) {
        await cargarTerceros();
      }

      const eraEdicion = !!editingSolicitudId;
      handleCancelarEdicionSolicitud();
      alert(eraEdicion ? '✅ Solicitud actualizada' : '✅ Solicitud creada');
    } finally {
      setGuardandoSolicitud(false);
    }
  };

  // Cambiar estado (Admin/Coordinadora aprueban, pagan o legalizan). Además de guardar el
  // estado, registra automáticamente quién hizo cada paso: quien mueve la solicitud a
  // "Aprobado" queda como revisor, y quien la mueve a "Pagado"/"Legalizado" (el paso final)
  // queda como quien aprobó — sin ningún campo ni paso nuevo que alguien tenga que diligenciar.
  const handleChangeEstado = async (id, nuevoEstado, opciones = {}) => {
    const anteriores = solicitudes;
    const ahora = new Date().toISOString();
    const patch = { estado: nuevoEstado, updated_at: ahora };
    if (nuevoEstado === 'Aprobado' || nuevoEstado === 'Devuelto') {
      patch.revisado_por_id = user.id;
      patch.revisado_at = ahora;
    } else if (nuevoEstado === 'Pagado' || nuevoEstado === 'Legalizado') {
      patch.aprobado_por_id = user.id;
      patch.aprobado_at = ahora;
    }
    // "Devuelto": guarda la explicación de por qué no se pudo aprobar (obligatoria, validada
    // antes de llamar a esta función desde el modal "Devolver Solicitud").
    if (nuevoEstado === 'Devuelto') {
      patch.motivo_devolucion = opciones.motivoDevolucion || null;
    }
    // Pago en lote (Reembolsos, Anticipos o Pagos a Tercero, desde "Confirmar Pago en Lote"): todas las Solicitudes
    // pagadas juntas con un mismo comprobante quedan con el mismo lote_pago_id.
    if (nuevoEstado === 'Pagado' && opciones.loteId) {
      patch.lote_pago_id = opciones.loteId;
    }

    setSolicitudes(solicitudes.map(s => s.id === id ? {
      ...s,
      estado: nuevoEstado,
      ...(patch.revisado_por_id ? { revisadoPorId: patch.revisado_por_id, revisadoAt: ahora } : {}),
      ...(patch.aprobado_por_id ? { aprobadoPorId: patch.aprobado_por_id, aprobadoAt: ahora } : {}),
      ...(patch.lote_pago_id ? { lotePagoId: patch.lote_pago_id } : {}),
      ...(nuevoEstado === 'Devuelto' ? { motivoDevolucion: patch.motivo_devolucion || '' } : {})
    } : s));

    const { error } = await supabase
      .from('solicitudes')
      .update(patch)
      .eq('id', id);

    if (error) {
      console.error('Error actualizando estado:', error);
      alert('❌ No se pudo actualizar el estado: ' + error.message);
      setSolicitudes(anteriores);
      return;
    }

    // Opción C (arquitectura Terceros/Finanzas aprobada, extendida a Anticipo/Reembolso/
    // Legalización): al marcar la Solicitud como "Pagado", se registra SOLO — sin que nadie
    // tenga que volver a digitarlo — el Gasto o Ingreso correspondiente en Finanzas, con sus
    // soportes visibles desde ambas pantallas. No bloquea nada si falla: el cambio de estado
    // ya quedó guardado arriba.
    // "Legalización T. Pro" no pasa por "Pagado" (su flujo salta directo de Pendiente/Devuelto a
    // Legalizado) — para ese tipo, "Legalizado" es el estado que dispara el registro automático
    // en Finanzas, igual que "Pagado" en los demás tipos.
    const solicitudQueCambia = anteriores.find(s => s.id === id);
    const disparaFinanzas = nuevoEstado === 'Pagado' || (nuevoEstado === 'Legalizado' && solicitudQueCambia?.tipo === 'Legalización T. Pro');
    if (disparaFinanzas) {
      const solicitud = solicitudQueCambia;
      if (solicitud && !solicitud.gastoGeneradoId && !solicitud.ingresoGeneradoId) {
        const { accion, monto } = calcularAccionFinanzasSolicitud(solicitud);
        if (accion !== 'ninguno') {
          await generarMovimientoDesdeSolicitud(solicitud, { cuentaPago: opciones.cuentaPago || null, cecoCodigo: opciones.cecoCodigo || null, accion, monto, loteId: opciones.loteId || null, fechaPago: opciones.fechaPago || null, neutro: opciones.neutro || null, detalle: opciones.detalle || null });
        }
      }
    }
  };

  // Determina qué movimiento de Finanzas corresponde generar automáticamente al marcar una
  // Solicitud como "Pagado" (Opción C). 'ninguno' es el caso de una Legalización cuadrada
  // (soportes == anticipo original): no hay plata que mueva la empresa, así que no debe pedir
  // Cuenta/Comprobante ni generar nada en Finanzas — solo queda "Pagado".
  // Pago en Lote (Solicitudes): tipos que se pueden pagar juntos con un solo comprobante.
  // Reembolsos y Anticipos son pagos a colaboradores y SÍ se pueden combinar en un lote; los
  // Pagos a Tercero van siempre en un lote aparte (otra moneda/beneficiario externo).
  const TIPOS_PAGO_LOTE_SOLICITUD = ['Reembolso', 'Anticipo', 'Comisión', 'Pago a Tercero'];
  const grupoPagoLote = (tipo) => (tipo === 'Pago a Tercero' ? 'terceros' : 'colaboradores');
  // Etiqueta para una lista de solicitudes del lote: "reembolsos", "anticipos", "pagos a
  // tercero" o, si se combinan, "reembolsos y anticipos".
  const etiquetaTipoLote = (tipos, plural) => {
    const unicos = [...new Set([].concat(tipos).filter(Boolean))];
    const nombre = { Reembolso: ['reembolso', 'reembolsos'], Anticipo: ['anticipo', 'anticipos'], Comisión: ['comisión', 'comisiones'], 'Pago a Tercero': ['pago a tercero', 'pagos a tercero'] };
    if (unicos.length > 1) return unicos.includes('Comisión') ? 'pagos a colaboradores' : 'reembolsos y anticipos';
    return (nombre[unicos[0]] || ['solicitud', 'solicitudes'])[plural ? 1 : 0];
  };

  // POLÍTICA "GASTO NEUTRO": un Pago a Tercero en USD de FOR SEVEN MEDIA con CECO-012-PUB se
  // paga en COP y se registra en Finanzas como Gasto Neutro (en COP, con sus soportes, pero sin
  // sumar como gasto de la empresa). Se aplica siempre que se cumplan las tres condiciones.
  const CECO_GASTO_NEUTRO = 'CECO-012-PUB';
  const esEmpresaForSeven = (empresa) => String(empresa || '').toUpperCase().replace(/\s+/g, ' ').includes('FOR SEVEN');
  const esPagoTerceroNeutro = (s, cecoCodigo) => !!s && s.tipo === 'Pago a Tercero'
    && (s.moneda || getMoneda(s.empresa)) === 'USD' && esEmpresaForSeven(s.empresa) && cecoCodigo === CECO_GASTO_NEUTRO;

  const calcularAccionFinanzasSolicitud = (s) => {
    if (s.tipo === 'Pago a Tercero') return { accion: 'gasto', monto: parseFloat(s.valor) || 0 };
    if (esTipoValorUnico(s.tipo)) return { accion: 'gasto', monto: parseFloat(s.valor) || 0 };
    if (s.tipo === 'Reembolso') return { accion: 'gasto', monto: s.totalCalculado || 0 };
    if (s.tipo === 'Legalización T. Pro') return { accion: 'gasto', monto: s.totalCalculado || 0 };
    if (s.tipo === 'Legalización') {
      const diferencia = (s.totalCalculado || 0) - (parseFloat(s.valorAnticipoOriginal) || 0);
      if (diferencia > 0) return { accion: 'gasto', monto: diferencia }; // hay que reembolsar la diferencia
      if (diferencia < 0) return { accion: 'ingreso', monto: Math.abs(diferencia) }; // el colaborador debe devolver
      return { accion: 'ninguno', monto: 0 };
    }
    return { accion: 'ninguno', monto: 0 };
  };

  // Genera el Gasto o Ingreso en Finanzas para una Solicitud que acaba de pasar a "Pagado"
  // (Opción C). Reglas acordadas con el usuario: (1) no se duplica el registro financiero — se
  // relee gasto_generado_id/ingreso_generado_id justo antes de insertar, por si esta función se
  // disparó dos veces para la misma solicitud; (2) los soportes quedan visibles desde AMBAS
  // pantallas sin duplicar el archivo en Storage — se copian solo las filas de metadata en
  // public.soportes apuntando al mismo bucket_path; (3) no se tocan permisos/roles existentes,
  // esto solo agrega una fila más al mismo Finanzas que ya ven Admin/Coordinadora. Anticipo y
  // Reembolso quedan vinculados al Responsable de la solicitud (no llevan Tercero); Pago a
  // Tercero sigue llevando también los datos del tercero.
  const generarMovimientoDesdeSolicitud = async (solicitud, { cuentaPago = null, cecoCodigo = null, accion, monto, loteId = null, fechaPago = null, neutro = null, detalle = null } = {}) => {
    try {
      const { data: solActual, error: errorLectura } = await supabase
        .from('solicitudes')
        .select('gasto_generado_id, ingreso_generado_id')
        .eq('id', solicitud.id)
        .single();
      if (errorLectura) {
        // ANTES: esto se rendía en silencio (solo console.error) — si esta relectura de seguridad
        // fallaba por lo que fuera (permiso, red, PostgREST), la solicitud quedaba "Pagado" pero
        // el Gasto NUNCA se generaba y nadie se enteraba, porque el resto de la función sí avisa
        // con alert() en cada error menos en este. Corregido para que avise igual que el resto.
        console.error('Error releyendo la solicitud antes de generar el movimiento automático:', errorLectura);
        alert('⚠️ La solicitud quedó en "Pagado", pero no se pudo verificar en Finanzas antes de generar el registro automático: ' + errorLectura.message + '. Avísale a David para revisarlo — probablemente haya que registrarlo a mano.');
        return;
      }
      if (solActual.gasto_generado_id || solActual.ingreso_generado_id) return; // ya se generó antes, no duplicar

      // Todos los tipos (incluido Pago a Tercero) usan el CECO que se eligió en el modal
      // "Confirmar Pago". Antes Pago a Tercero quedaba fijo en CECO-015-PT, que no dice en qué
      // se gastó la plata y obligaba a corregirlo a mano después.
      const cecoId = await resolverCecoId(cecoCodigo);

      const tabla = accion === 'ingreso' ? 'ingresos' : 'gastos';
      const columnaVinculo = accion === 'ingreso' ? 'ingreso_generado_id' : 'gasto_generado_id';
      const observacionesPorTipo = {
        'Pago a Tercero': 'Generado automáticamente al marcar la Solicitud de Pago a Tercero como Pagado.',
        'Anticipo': 'Generado automáticamente al marcar la Solicitud de Anticipo como Pagado.',
        'Reembolso': 'Generado automáticamente al marcar la Solicitud de Reembolso como Pagado.',
        'Comisión': 'Generado automáticamente al marcar la Solicitud de Comisión como Pagado.',
        'Legalización': accion === 'ingreso'
          ? 'Generado automáticamente: la Legalización quedó por debajo del anticipo original (el colaborador debe devolver la diferencia).'
          : 'Generado automáticamente: la Legalización superó el anticipo original (diferencia a reembolsar).'
      };

      const payload = {
        // En Finanzas manda la fecha en que se PAGÓ (la que se elige al confirmar el pago), no
        // la fecha en que se creó la solicitud. Sin fecha elegida (p. ej. Legalización T. Pro,
        // que no abre el modal), se usa la de hoy.
        fecha: fechaPago || fechaHoyLocal(),
        tipo: solicitud.tipo === 'Pago a Tercero' ? 'Pago a Tercero' : (accion === 'ingreso' ? 'Ingreso' : 'Gasto'),
        empresa_id: solicitud.empresaId || null,
        responsable_id: solicitud.responsableId || null,
        ceco_id: cecoId,
        cuenta: cuentaPago || null,
        // Nunca vacío en Finanzas: solicitudes viejas sin Concepto quedan como "Tipo — Colaborador".
        // `detalle` llega solo si se corrigió al registrar el pago de un lote PAB (no cambia la solicitud).
        detalle: (detalle || '').trim() || (solicitud.detalle || '').trim() || `${solicitud.tipo} — ${solicitud.responsableNombre || 'sin colaborador'}`,
        valor: monto,
        estado: 'Pagado',
        observaciones: observacionesPorTipo[solicitud.tipo] || 'Generado automáticamente desde Solicitudes.',
        solicitud_origen_id: solicitud.id,
        lote_pago_id: loteId || null
      };
      if (solicitud.tipo === 'Pago a Tercero') {
        payload.moneda_pago = solicitud.moneda || null;
        payload.tercero_id = solicitud.terceroId || null;
        payload.tercero_info = solicitud.terceroInfo || null;
      }
      // Gasto Neutro: queda en COP con el valor realmente pagado y el concepto ajustado en el modal.
      if (neutro) {
        payload.neutro = true;
        payload.valor = neutro.valorCOP;
        payload.moneda_pago = 'COP';
        payload.detalle = neutro.detalle;
        payload.observaciones = `Gasto Neutro (no suma en gastos de la empresa). Solicitud original en USD por ${monto}.`;
      }

      const { data: nuevoMovimiento, error: errorMovimiento } = await supabase
        .from(tabla)
        .insert(payload)
        .select('id')
        .single();

      if (errorMovimiento) {
        console.error('Error generando el movimiento automático desde la solicitud:', errorMovimiento);
        alert('⚠️ La solicitud quedó en "Pagado", pero no se pudo registrar automáticamente en Finanzas: ' + errorMovimiento.message + '. Regístralo a mano si hace falta.');
        return;
      }

      // Vínculo en ambos sentidos: junto con la relectura de arriba, evita que un segundo
      // cambio de estado (o un doble clic) vuelva a generar otro movimiento para esta solicitud.
      const { error: errorVinculo } = await supabase
        .from('solicitudes')
        .update({ [columnaVinculo]: nuevoMovimiento.id })
        .eq('id', solicitud.id);
      if (errorVinculo) console.error(`Error guardando el vínculo solicitud → ${tabla}:`, errorVinculo);

      // Copia la METADATA de los soportes ya subidos a la solicitud (ficha PDF + adjuntos del
      // colaborador) hacia el movimiento recién creado, apuntando al MISMO bucket_path — el
      // archivo no se vuelve a subir ni se duplica en Storage, solo queda visible también desde
      // "Ver Soportes" del gasto/ingreso en Finanzas.
      const { data: soportesOrigen, error: errorSoportes } = await supabase
        .from('soportes')
        .select('bucket_path, nombre_original, tamano_kb')
        .eq('entidad_tipo', 'solicitud')
        .eq('entidad_id', solicitud.id);
      if (errorSoportes) {
        console.error('Error leyendo soportes de la solicitud para reflejarlos en el movimiento:', errorSoportes);
      } else if (soportesOrigen && soportesOrigen.length > 0) {
        const filasMovimiento = soportesOrigen.map(sp => ({
          bucket_path: sp.bucket_path,
          nombre_original: sp.nombre_original,
          tamano_kb: sp.tamano_kb,
          entidad_tipo: accion === 'ingreso' ? 'ingreso' : 'gasto',
          entidad_id: nuevoMovimiento.id,
          subido_por: user.id
        }));
        const { error: errorCopiaSoportes } = await supabase.from('soportes').insert(filasMovimiento);
        if (errorCopiaSoportes) console.error('Error reflejando los soportes en el movimiento generado:', errorCopiaSoportes);
      }

      await Promise.all([cargarGastos(), cargarIngresos(), cargarSolicitudes()]);
    } catch (errorInesperado) {
      console.error('Error inesperado generando el movimiento automático desde la solicitud:', errorInesperado);
      alert('⚠️ La solicitud quedó en "Pagado", pero hubo un error inesperado registrándola en Finanzas. Regístralo a mano si hace falta.');
    }
  };

  // Modal "Confirmar Pago": lee los comprobantes elegidos (uno o varios — ej. la factura Y el
  // soporte de pago del banco) y los deja listos en memoria dentro de confirmarPagoSolicitud,
  // acumulándolos; se suben a Storage recién al confirmar, no aquí.
  const handleSeleccionarComprobantePago = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const nuevoComprobante = { id: Date.now() + Math.random(), nombre: file.name, tipo: file.type, data: event.target.result };
        // Actualización funcional: con varios archivos elegidos a la vez, cada FileReader
        // termina de leer en un momento distinto, y partir del estado más reciente evita que
        // se pisen entre sí (mismo motivo que handleAddSoporte).
        setConfirmarPagoSolicitud(prev => prev ? { ...prev, comprobantes: [...(prev.comprobantes || []), nuevoComprobante] } : prev);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleQuitarComprobantePago = (id) => {
    setConfirmarPagoSolicitud(prev => prev ? { ...prev, comprobantes: (prev.comprobantes || []).filter(c => c.id !== id) } : prev);
  };

  // Confirma el pago desde el modal: sube cada comprobante como soporte de la SOLICITUD (antes
  // de cambiar el estado, para que generarMovimientoDesdeSolicitud los encuentre y los refleje
  // también en el Gasto/Ingreso) y recién ahí marca "Pagado" con la cuenta y el CECO elegidos.
  // "Devolver Solicitud" — Administrador/Coordinadora Administrativa explican por qué una
  // Solicitud (Anticipo, Reembolso, Legalización o Pago a Tercero) no pudo aprobarse tal como
  // está. El motivo es obligatorio: sin él, el colaborador no sabría qué corregir.
  const handleAbrirDevolverSolicitud = (s) => {
    setDevolverSolicitud({ solicitud: s, motivo: '' });
  };

  const handleConfirmarDevolucion = async () => {
    if (!devolverSolicitud) return;
    const { solicitud, motivo } = devolverSolicitud;
    if (!motivo || !motivo.trim()) {
      alert('Escribe el motivo de la devolución — el colaborador lo verá para saber qué corregir');
      return;
    }
    setGuardandoDevolucion(true);
    try {
      await handleChangeEstado(solicitud.id, 'Devuelto', { motivoDevolucion: motivo.trim() });
      setDevolverSolicitud(null);
    } finally {
      setGuardandoDevolucion(false);
    }
  };

  const handleConfirmarPagoSolicitud = async () => {
    if (!confirmarPagoSolicitud) return;
    const { solicitud, cuenta, ceco, comprobantes, fechaPago } = confirmarPagoSolicitud;
    if (!fechaPago) {
      alert('Indica la fecha en que se hizo el pago');
      return;
    }
    if (!cuenta) {
      alert('Elige con qué cuenta de la empresa se hizo el pago');
      return;
    }
    if (!ceco) {
      alert('Elige el CECO para este movimiento');
      return;
    }
    if (!comprobantes || !comprobantes.length) {
      alert('Adjunta al menos el comprobante de pago del banco');
      return;
    }
    // Política Gasto Neutro: concepto y valor en COP obligatorios, y al menos 2 soportes.
    let neutro = null;
    if (esPagoTerceroNeutro(solicitud, ceco)) {
      const detalleNeutro = String(confirmarPagoSolicitud.detalleNeutro ?? solicitud.detalle ?? '').trim();
      const valorCOP = parseFloat(String(confirmarPagoSolicitud.valorCOP || '').replace(/[^\d,]/g, '').replace(',', '.'));
      if (!detalleNeutro) { alert('Escribe el concepto del Gasto Neutro'); return; }
      if (!valorCOP || valorCOP <= 0) { alert('Escribe el valor pagado en COP'); return; }
      if (comprobantes.length < 2) { alert('Para un Gasto Neutro adjunta al menos 2 soportes (ej. factura y comprobante de pago)'); return; }
      neutro = { detalle: detalleNeutro, valorCOP };
    }
    setGuardandoConfirmarPago(true);
    try {
      for (const comprobante of comprobantes) {
        await subirSoporteEntidad(comprobante, 'solicitud', solicitud.id);
      }
      const nuevoEstadoFinal = solicitud.tipo === 'Legalización T. Pro' ? 'Legalizado' : 'Pagado';
      await handleChangeEstado(solicitud.id, nuevoEstadoFinal, { cuentaPago: cuenta, cecoCodigo: ceco || null, fechaPago, neutro });
      setConfirmarPagoSolicitud(null);
    } finally {
      setGuardandoConfirmarPago(false);
    }
  };

  // ============================================================
  // PAGO EN LOTE DE REEMBOLSOS — seleccionar varios Reembolsos "Aprobado" de la misma Empresa,
  // adjuntar UN solo comprobante de banco y marcarlos todos "Pagado" de una sola vez.
  // ============================================================

  const handleToggleSeleccionReembolso = (id) => {
    setSeleccionReembolsosPago(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAbrirPagoLoteReembolsos = () => {
    const items = solicitudesUsuario.filter(s => seleccionReembolsosPago.includes(s.id));
    if (items.length === 0) return;
    setConfirmarPagoLoteReembolsos({ items, cuenta: '', ceco: '', comprobantes: [], fechaPago: fechaHoyLocal() });
  };

  const handleSeleccionarComprobantePagoLoteReembolsos = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const nuevo = { id: Date.now() + Math.random(), nombre: file.name, tipo: file.type, data: event.target.result };
        setConfirmarPagoLoteReembolsos(prev => prev ? { ...prev, comprobantes: [...(prev.comprobantes || []), nuevo] } : prev);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleQuitarComprobantePagoLoteReembolsos = (id) => {
    setConfirmarPagoLoteReembolsos(prev => prev ? { ...prev, comprobantes: (prev.comprobantes || []).filter(c => c.id !== id) } : prev);
  };

  // Sube el/los comprobante(s) UNA sola vez (al primer Reembolso del lote) y los refleja como
  // metadata en los demás, apuntando al mismo bucket_path — mismo patrón que "Pago a Tercero en
  // Lote" (handleGuardarFacturasTercero), así no se duplica el archivo en Storage. Como
  // generarMovimientoDesdeSolicitud ya copia los soportes de CADA solicitud a su propio Gasto,
  // cada Gasto generado queda con el comprobante sin ningún paso extra.
  const handleConfirmarPagoLoteReembolsos = async () => {
    if (!confirmarPagoLoteReembolsos) return;
    const { items, cuenta, ceco, comprobantes, fechaPago } = confirmarPagoLoteReembolsos;
    if (!fechaPago) {
      alert('Indica la fecha en que se hizo el pago');
      return;
    }
    if (!items || items.length === 0) return;
    if (!cuenta) {
      alert('Elige con qué cuenta de la empresa se hizo el pago');
      return;
    }
    if (!ceco) {
      alert('Elige el CECO para este lote de pago');
      return;
    }
    if (!comprobantes || !comprobantes.length) {
      alert('Adjunta el comprobante de pago del banco (aplica a todo el lote)');
      return;
    }
    // Los Gastos Neutros llevan su propio valor en COP y concepto: se pagan uno por uno.
    const neutrosEnLote = items.filter(it => esPagoTerceroNeutro(it, ceco));
    if (neutrosEnLote.length > 0) {
      alert(`Con ${CECO_GASTO_NEUTRO} estos pagos de FOR SEVEN en USD son Gasto Neutro y se registran uno por uno (con su valor en COP). Págalos individualmente con "Pagado".`);
      return;
    }

    setGuardandoPagoLoteReembolsos(true);
    try {
      const rutasComprobantes = [];
      for (const comprobante of comprobantes) {
        const ruta = await subirSoporteEntidad(comprobante, 'solicitud', items[0].id);
        if (ruta) {
          rutasComprobantes.push({ ruta, nombre: comprobante.nombre, tamanoKb: Math.round(dataUrlToUint8Array(comprobante.data).length / 1024) });
        }
      }
      for (const solicitud of items.slice(1)) {
        for (const rc of rutasComprobantes) {
          const { error: errorSoporte } = await supabase.from('soportes').insert({
            bucket_path: rc.ruta,
            nombre_original: rc.nombre,
            tamano_kb: rc.tamanoKb,
            entidad_tipo: 'solicitud',
            entidad_id: solicitud.id,
            subido_por: user.id
          });
          if (errorSoporte) console.error('Error reflejando el comprobante compartido en un reembolso del lote:', errorSoporte);
        }
      }

      const loteId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let pagados = 0;
      const fallidos = [];
      for (const solicitud of items) {
        try {
          // Releer el estado antes de pagar: evita marcar "Pagado" dos veces si alguien más ya
          // lo hizo (u otra pestaña) mientras este modal seguía abierto.
          const { data: solActual, error: errorLectura } = await supabase.from('solicitudes').select('estado').eq('id', solicitud.id).single();
          if (errorLectura) throw errorLectura;
          if (solActual.estado !== 'Aprobado') {
            fallidos.push(`${solicitud.responsableNombre || solicitud.detalle || solicitud.id} (ya no estaba en Aprobado)`);
            continue;
          }
          await handleChangeEstado(solicitud.id, 'Pagado', { cuentaPago: cuenta, cecoCodigo: ceco, loteId, fechaPago });
          pagados++;
        } catch (errorItem) {
          console.error('Error pagando un reembolso del lote:', solicitud.id, errorItem);
          fallidos.push(`${solicitud.responsableNombre || solicitud.detalle || solicitud.id}: ${errorItem.message || 'error inesperado'}`);
        }
      }

      setSeleccionReembolsosPago([]);
      setConfirmarPagoLoteReembolsos(null);
      const etiquetaTipo = etiquetaTipoLote(items.map(x => x.tipo), true);
      alert(fallidos.length > 0
        ? `✅ ${pagados} ${etiquetaTipo} pagados en lote.\n⚠️ No se pudieron pagar: ${fallidos.join('; ')}`
        : `✅ ${pagados} ${etiquetaTipo} marcados como Pagados con el mismo comprobante.`);
    } finally {
      setGuardandoPagoLoteReembolsos(false);
    }
  };

  // "Ver Lote de Pago" — desde Solicitudes o desde Finanzas, muestra qué otros Reembolsos (o
  // Gastos) se pagaron junto con este, en el mismo comprobante. Todo se arma en memoria a partir
  // de lo ya cargado (solicitudes / gastos), sin ninguna consulta nueva.
  const handleVerLotePagoSolicitudes = (lotePagoId) => {
    const items = solicitudesUsuario
      .filter(s => s.lotePagoId === lotePagoId)
      .map(s => ({ fecha: s.fecha, nombre: colaboradoresPublico.find(c => c.id === s.responsableId)?.nombre || s.responsableNombre || '—', valor: formatMoney(s.totalCalculado || 0, s.empresa), empresa: s.empresa }));
    setVerLotePago({ titulo: `🔗 Reembolsos pagados en este lote (${items.length})`, items });
  };

  const handleVerLotePagoGastos = (lotePagoId) => {
    const items = gastos
      .filter(g => g.lotePagoId === lotePagoId)
      .map(g => ({ fecha: g.fecha, nombre: colaboradoresPublico.find(c => c.id === g.responsableId)?.nombre || g.responsable || '—', valor: formatMoney(g.valor || 0, g.empresa), empresa: g.empresa }));
    setVerLotePago({ titulo: `🔗 Gastos pagados en este lote (${items.length})`, items });
  };

  // Filtrar solicitudes por rol. Colaborador, Responsable y Gerente solo ven (y el Dashboard
  // solo resume) las solicitudes propias, no las de toda la empresa.
  // Administrador y Coordinadora gestionan todas las solicitudes pero no crean las suyas.
  const gestionaSolicitudes = user?.rol === 'Administrador' || user?.rol === 'Coordinadora Administrativa';
  const soloPropias = ['Colaborador', 'Responsable', 'Gerente'].includes(user?.rol);
  const solicitudesUsuario = soloPropias
    ? solicitudes.filter(s => s.responsableId === user.id)
    : user?.rol === 'Contadora'
    ? solicitudes.filter(s => ['Aprobado', 'Pagado', 'Legalizado'].includes(s.estado))
    : solicitudes;

  // Filtros del historial de Solicitudes (buscador + Tipo/Estado/Empresa + rango de fechas) —
  // se aplican solo sobre la tabla del historial, nunca sobre `solicitudesUsuario` en sí (el
  // Dashboard, los totales y las referencias cruzadas como "legalización vinculada" siguen
  // viendo todas las solicitudes, filtradas solo por permiso de rol, no por este filtro de UI).
  const solicitudesFiltradas = solicitudesUsuario.filter(s => {
    if (filtroSolicitudesTipo !== 'Todos' && s.tipo !== filtroSolicitudesTipo) return false;
    if (filtroSolicitudesEstado !== 'Todos' && s.estado !== filtroSolicitudesEstado) return false;
    if (filtroSolicitudesEmpresa !== 'Todas' && s.empresa !== filtroSolicitudesEmpresa) return false;
    if (filtroSolicitudesFechaInicio && s.fecha < filtroSolicitudesFechaInicio) return false;
    if (filtroSolicitudesFechaFin && s.fecha > filtroSolicitudesFechaFin) return false;
    if (busquedaSolicitudes.trim()) {
      const q = busquedaSolicitudes.trim().toLowerCase();
      // Igual que en Finanzas: s.responsableNombre viene vacío para Contadora en solicitudes
      // que no son suyas (RLS de public.usuarios), así que también se busca por
      // colaboradores_publico, que sí es legible por cualquier rol.
      const nombreColaborador = colaboradoresPublico.find(c => c.id === s.responsableId)?.nombre || s.responsableNombre;
      const campos = [s.detalle, nombreColaborador, s.empresa, s.tipo, s.estado, s.terceroInfo?.nombre, s.terceroInfo?.dni].filter(Boolean).join(' ').toLowerCase();
      if (!campos.includes(q)) return false;
    }
    return true;
  });

  // Estadísticas Dashboard
  const statsEstado = {
    Pendiente: solicitudesUsuario.filter(s => s.estado === 'Pendiente').length,
    Aprobado: solicitudesUsuario.filter(s => s.estado === 'Aprobado').length,
    Devuelto: solicitudesUsuario.filter(s => s.estado === 'Devuelto').length,
    Pagado: solicitudesUsuario.filter(s => s.estado === 'Pagado').length,
    Legalizado: solicitudesUsuario.filter(s => s.estado === 'Legalizado').length
  };

  const totalSolicitudes = solicitudesUsuario.length;
  const montoSolicitud = (s) => (esTipoValorUnico(s.tipo) || s.tipo === 'Pago a Tercero') ? parseFloat(s.valor) || 0 : s.totalCalculado || 0;
  // Montos separados por moneda: sumar pesos y dólares directamente daría un número sin sentido.
  // "Pago a Tercero" tiene su propia moneda (independiente de la empresa que paga), así que se
  // agrupa por esa moneda en vez de la de la empresa.
  const monedaSolicitud = (s) => s.tipo === 'Pago a Tercero' ? (s.moneda || getMoneda(s.empresa)) : getMoneda(s.empresa);
  const totalMontoCOP = solicitudesUsuario.filter(s => monedaSolicitud(s) === 'COP').reduce((sum, s) => sum + montoSolicitud(s), 0);
  const totalMontoUSD = solicitudesUsuario.filter(s => monedaSolicitud(s) === 'USD').reduce((sum, s) => sum + montoSolicitud(s), 0);

  const statsPorEmpresa = empresas.map(emp => ({
    empresa: emp,
    cantidad: solicitudesUsuario.filter(s => s.empresa === emp).length,
    monto: solicitudesUsuario.filter(s => s.empresa === emp).reduce((sum, s) => sum + montoSolicitud(s), 0)
  })).filter(s => s.cantidad > 0);

  // Antes se armaba iterando `responsables` (= usuariosDB filtrado a rol Responsable), pero
  // usuariosDB se carga leyendo public.usuarios directo — RLS solo deja a Administrador/
  // Coordinadora leer TODAS las filas; para Contadora `responsables` quedaba vacío (solo puede
  // leer su propia fila, que no es rol Responsable) y el widget completo desaparecía. Ahora se
  // arma agrupando `solicitudesUsuario` por responsableId (que sí ve completo) y resolviendo
  // nombre/empresa contra colaboradores_publico, legible por cualquier rol — mismo patrón que
  // el fix de la columna Colaborador en Finanzas/Solicitudes. Efecto colateral menor: ya no se
  // filtra estrictamente a rol Responsable, sino a quien haya creado solicitudes (con Gerente
  // creando las suyas propias desde el rediseño de permisos, tiene sentido que también cuente).
  const topResponsables = Object.values(
    solicitudesUsuario.reduce((acc, s) => {
      if (!s.responsableId) return acc;
      if (!acc[s.responsableId]) {
        const cp = colaboradoresPublico.find(c => c.id === s.responsableId);
        acc[s.responsableId] = { nombre: cp?.nombre || s.responsableNombre || '—', empresa: cp?.empresa || s.empresa, cantidad: 0, monto: 0 };
      }
      acc[s.responsableId].cantidad += 1;
      acc[s.responsableId].monto += montoSolicitud(s);
      return acc;
    }, {})
  )
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  const ultimasSolicitudes = [...solicitudesUsuario].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);

  // Generar PDF
  const handleGenerarPDF = async (s) => {
    setGenerandoPDF(s.id);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      doc.setFontSize(16);
      doc.text(s.tipo === 'Anticipo' ? 'SOLICITUD DE ANTICIPO' : s.tipo === 'Comisión' ? 'SOLICITUD DE COMISIÓN' : s.tipo === 'Legalización' ? 'LEGALIZACIÓN DE ANTICIPO' : s.tipo === 'Legalización T. Pro' ? 'LEGALIZACIÓN EFECTIVO/TARJETA PERSONAL' : 'REPORTE DE REEMBOLSO', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      doc.setFontSize(10);
      doc.text(`Fecha: ${s.fecha}`, 20, yPos);
      doc.text(`Colaborador: ${s.responsableNombre}`, pageWidth / 2, yPos);
      yPos += 8;
      doc.text(`Empresa: ${s.empresa}`, 20, yPos);
      doc.text(`Concepto: ${s.detalle}`, pageWidth / 2, yPos);
      yPos += 12;

      if (!esTipoValorUnico(s.tipo)) {
        if (s.documentos && s.documentos.length > 0) {
          doc.setFontSize(11);
          doc.text('DOCUMENTOS', 20, yPos);
          yPos += 8;
          doc.setFontSize(9);

          const tableData = s.documentos.map(d => [d.fecha || '-', d.proveedor, d.nit, d.descripcion, formatMoneyByMoneda(d.valor, getMoneda(s.empresa)), d.tipoSoporte || '-']);
          doc.autoTable({
            startY: yPos,
            head: [['Fecha', 'Pagado a', 'NIT', 'Concepto', 'Valor', 'Tipo Soporte']],
            body: tableData,
            margin: 20,
            theme: 'grid'
          });
          yPos = doc.lastAutoTable.finalY + 10;
        }

        if (s.tipo === 'Legalización' && s.valorAnticipoOriginal) {
          doc.setFontSize(10);
          doc.text(`Anticipo Original: ${formatMoneyByMoneda(s.valorAnticipoOriginal, getMoneda(s.empresa))}`, 20, yPos);
          yPos += 10;
        }
      }

      yPos += 5;
      doc.setFontSize(11);
      const totalLabel = esTipoValorUnico(s.tipo) ? 'TOTAL SOLICITADO' : 'TOTAL';
      const totalValue = esTipoValorUnico(s.tipo) ? formatMoneyByMoneda(s.valor, getMoneda(s.empresa)) : formatMoneyByMoneda(s.totalCalculado, getMoneda(s.empresa));
      doc.text(`${totalLabel}: ${totalValue}`, 20, yPos);

      doc.save(`${s.tipo}-${s.id}.pdf`);
    } catch (error) {
      // Antes este error quedaba solo en la consola del navegador — quien hacía clic en
      // "📄 PDF" no se enteraba de que había fallado. Ahora se avisa siempre.
      console.error('Error PDF:', error);
      alert('❌ No se pudo generar el PDF: ' + error.message);
    }
    setGenerandoPDF(null);
  };

  // Ficha PDF de "Pago a Tercero" — pensada para que la coordinadora administrativa tenga en
  // un solo documento TODO lo que necesita para ejecutar el pago (quién solicita, a quién se le
  // paga, cuánto, y a qué cuenta bancaria consignar). Devuelve el jsPDF ya diligenciado; quien
  // llama decide si lo descarga (doc.save) o lo sube a Storage (doc.output('datauristring')) —
  // así se reutiliza tanto para el adjunto automático al guardar como para el botón de descarga.
  const construirPDFPagoTercero = (datos) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margen = 15;
    const alto = 200;
    let y = margen + 12;

    doc.setDrawColor(196, 167, 71);
    doc.setLineWidth(0.8);
    doc.rect(margen, margen, pageWidth - margen * 2, alto);

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('SOLICITUD DE PAGO A TERCERO', pageWidth / 2, y, { align: 'center' });
    y += 9;
    doc.setLineWidth(0.3);
    doc.line(margen + 5, y, pageWidth - margen - 5, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Empresa que paga: ${datos.empresa || '—'}${datos.empresaNit ? ' — NIT ' + datos.empresaNit : ''}`, margen + 5, y);
    y += 7;
    doc.text(`Fecha: ${datos.fecha || '—'}`, margen + 5, y);
    doc.text(`Solicitado por: ${datos.responsableNombre || '—'}`, pageWidth / 2 - 10, y);
    y += 10;

    doc.setFont(undefined, 'bold');
    doc.text('Concepto', margen + 5, y);
    y += 6;
    doc.setFont(undefined, 'normal');
    const concepto = doc.splitTextToSize(datos.detalle || '—', pageWidth - margen * 2 - 10);
    doc.text(concepto, margen + 5, y);
    y += concepto.length * 5.5 + 6;

    doc.setFont(undefined, 'bold');
    doc.text('Valor a pagar:', margen + 5, y);
    doc.setFontSize(12);
    doc.setTextColor(47, 158, 82);
    doc.text(formatMoneyByMoneda(datos.valor, datos.moneda), margen + 42, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    y += 12;

    doc.setFont(undefined, 'bold');
    doc.text('Datos del tercero', margen + 5, y);
    y += 7;
    doc.setFont(undefined, 'normal');
    doc.text(`Nombre: ${datos.tercero.nombre || '—'}`, margen + 5, y);
    y += 6;
    doc.text(`DNI / Documento: ${datos.tercero.dni || '—'}`, margen + 5, y);
    doc.text(`País de origen: ${datos.tercero.paisOrigen || '—'}`, pageWidth / 2 - 10, y);
    y += 10;

    doc.setFont(undefined, 'bold');
    doc.text('Datos bancarios para el pago', margen + 5, y);
    y += 7;
    doc.setFont(undefined, 'normal');
    doc.text(`Banco: ${datos.tercero.banco || '—'}`, margen + 5, y);
    y += 6;
    doc.text(`Tipo de cuenta: ${datos.tercero.tipoCuenta || '—'}`, margen + 5, y);
    y += 6;
    doc.text(`Número de cuenta: ${datos.tercero.numeroCuenta || '—'}`, margen + 5, y);
    y += 12;

    doc.setFont(undefined, 'bold');
    doc.text(`Estado: ${datos.estado || 'Pendiente'}`, margen + 5, y);

    return doc;
  };

  // Botón "📄 PDF" del historial — vuelve a generar y descargar la misma ficha (la solicitud
  // ya trae terceroInfo embebido, no hace falta ninguna consulta adicional).
  const handleGenerarPDFPagoTercero = (s) => {
    const doc = construirPDFPagoTercero({
      empresa: s.empresa,
      empresaNit: NIT_EMPRESAS[s.empresa] || '',
      fecha: s.fecha,
      responsableNombre: s.responsableNombre,
      detalle: s.detalle,
      valor: parseFloat(s.valor) || 0,
      moneda: s.moneda || getMoneda(s.empresa),
      tercero: s.terceroInfo || {},
      estado: s.estado
    });
    doc.save(`Pago_a_Tercero_${(s.terceroInfo?.nombre || 'tercero').replace(/\s+/g, '_')}_${s.id}.pdf`);
  };

  // Trae los soportes (archivos) de una solicitud desde public.soportes y abre el modal
  // "Ver Soportes" ya existente (mismo que usan Gastos/Ingresos) para verlos/descargarlos.
  const handleVerSoportesSolicitud = async (s) => {
    const { data, error } = await supabase
      .from('soportes')
      .select('id, bucket_path, nombre_original, tamano_kb')
      .eq('entidad_tipo', 'solicitud')
      .eq('entidad_id', s.id)
      .order('created_at');

    if (error) {
      console.error('Error cargando soportes:', error);
      alert('❌ No se pudieron cargar los soportes: ' + error.message);
      return;
    }

    setVerSoportes((data || []).map(r => ({
      id: r.id,
      nombre: r.nombre_original,
      tamaño: (r.tamano_kb || 0) * 1024,
      bucketPath: r.bucket_path
    })));
    // Borrar un soporte mal subido no toca ningún dato financiero de la solicitud, así que no
    // debe depender de puedeEditarSolicitud (que solo permite editar en Pendiente/Devuelto, o
    // Legalizado si es Legalización T. Pro) — eso dejaba a Coordinadora Administrativa sin el
    // botón en solicitudes ya Aprobadas/Pagadas, aunque tiene el mismo rol de gestión que
    // Administrador. Administrador y Coordinadora pueden eliminar soportes en cualquier estado;
    // el responsable dueño de la solicitud también puede, mientras siga en un estado editable.
    setVerSoportesContexto({ entidadTipo: 'solicitud', entidadId: s.id, puedeEliminar: canApprove || puedeEditarSolicitud(s) });
  };

  // Generar Excel con el mismo formato del control de pagos (Fecha, Pagado a, NIT, Concepto, Valor, Tipo de Soporte)
  // Reporte Excel de Legalización/Reembolso — formato calcado del modelo real que se usaba a
  // mano (encabezado formal, párrafo narrativo automático con los datos bancarios del
  // colaborador, resumen de anticipo/reembolso, y Revisado/Aprobado tomados de quien realmente
  // movió el estado en el sistema, nunca escritos a mano).
  const handleGenerarExcel = (s) => {
    const moneda = getMoneda(s.empresa);
    const responsable = usuariosDB.find(u => u.id === s.responsableId);
    // Puede haber varios Anticipos vinculados a una misma Legalización — se suman los valores y
    // se listan todas las fechas separadas por coma.
    const anticiposVinculados = (s.anticipoIds || []).map(id => solicitudes.find(a => a.id === id)).filter(Boolean);
    const valorAnticipo = anticiposVinculados.length > 0
      ? anticiposVinculados.reduce((sum, a) => sum + (parseFloat(a.valor) || 0), 0)
      : (parseFloat(s.valorAnticipoOriginal) || 0);
    const fechaAnticipo = anticiposVinculados.length > 0 ? anticiposVinculados.map(a => a.fecha).join(', ') : '';
    const revisadoPor = s.revisadoPorId ? (usuariosDB.find(u => u.id === s.revisadoPorId)?.nombre || '') : '';
    const aprobadoPor = s.aprobadoPorId ? (usuariosDB.find(u => u.id === s.aprobadoPorId)?.nombre || '') : '';

    const esLegalizacion = s.tipo === 'Legalización';
    const esLegalizacionTPro = s.tipo === 'Legalización T. Pro';
    const tituloFormato = esLegalizacion ? 'FORMATO LEGALIZACIÓN DE ANTICIPO' : esLegalizacionTPro ? 'FORMATO LEGALIZACIÓN EFECTIVO/TARJETA PERSONAL' : 'FORMATO REEMBOLSO DE GASTOS';
    const accionTexto = esLegalizacion ? 'LA LEGALIZACIÓN DEL GASTO' : esLegalizacionTPro ? 'LA LEGALIZACIÓN DEL GASTO PAGADO CON EFECTIVO/TARJETA PERSONAL' : 'LA SOLICITUD DE REEMBOLSO DEL GASTO';
    const conceptosUnicos = [...new Set((s.documentos || []).map(d => (d.descripcion || '').trim()).filter(Boolean))];
    const conceptoResumen = (conceptosUnicos.join(', ') || s.detalle || '').toUpperCase();
    const datosCuenta = responsable && responsable.numeroCuenta
      ? `FAVOR CONSIGNAR A LA CUENTA ${(responsable.tipoCuentaBancaria || '').toUpperCase()} ${(responsable.banco || '').toUpperCase()} N° ${responsable.numeroCuenta} A NOMBRE ${(responsable.titularCuenta || s.responsableNombre || '').toUpperCase()} CC ${responsable.cedula || ''}`
      : '';
    const parrafo = `SE PRESENTA ${accionTexto} DEL SEÑOR(A) ${(s.responsableNombre || '').toUpperCase()} CC ${responsable?.cedula || ''} POR CONCEPTO ${conceptoResumen}. SE ADJUNTA DETALLES. ${datosCuenta}`.replace(/\s+/g, ' ').trim();

    const rows = [];
    rows.push([tituloFormato]);
    rows.push([parrafo]);
    rows.push([]);
    rows.push(['Empresa: ', s.empresa]);
    rows.push(['NIT: ', NIT_EMPRESAS[s.empresa] || '']);
    rows.push([(esLegalizacion || esLegalizacionTPro) ? 'Fecha legalización' : 'Fecha reembolso', new Date().toISOString().split('T')[0]]);
    rows.push([]);

    if (esLegalizacion) {
      if (fechaAnticipo) rows.push([`${anticiposVinculados.length > 1 ? 'Fechas de las solicitudes de anticipo' : 'Fecha de la solicitud de anticipo'}: ${fechaAnticipo}`]);
      rows.push([]);
      const totalGastos = s.totalCalculado || 0;
      const diferencia = totalGastos - valorAnticipo;
      const etiquetaDiferencia = diferencia >= 0 ? 'a Reembolsar:' : 'a Devolver:';
      rows.push(['', 'Valor Legalizado de Anticipo previo', valorAnticipo, etiquetaDiferencia, Math.abs(diferencia)]);
      rows.push([]);
    }

    rows.push([`Detalle de los pagos realizados por los cuales se solicita ${(esLegalizacion || esLegalizacionTPro) ? 'la legalización' : 'el reembolso'}`]);
    rows.push([]);
    rows.push(['Fecha del Gasto', 'Pagado a', 'NIT/CC', `Valor pagado (${moneda})`, 'Tipo de soporte', 'Por concepto de']);
    (s.documentos || []).forEach(d => {
      rows.push([d.fecha || '', d.proveedor || '', d.nit || '', parseFloat(d.valor) || 0, d.tipoSoporte || '', d.descripcion || '']);
    });
    rows.push([]);
    rows.push(['Elaborado por', 'Revisado:', 'Aprobado:', s.totalCalculado || 0]);
    rows.push([s.responsableNombre || '', revisadoPor || '(pendiente)', aprobadoPor || '(pendiente)']);
    rows.push([]);
    rows.push(['Estado', s.estado || '']);
    rows.push(['', '', '', '', 'SOPORTES:', 'Ver PDF consolidado adjunto a esta solicitud']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 32 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, s.tipo.substring(0, 30));
    XLSX.writeFile(wb, `${s.tipo}_${s.responsableNombre}_${s.fecha}.xlsx`);
  };

  // Eliminar solicitud — borra también sus soportes (metadata + archivos en Storage)
  const handleDeleteSolicitud = async (id) => {
    if (!window.confirm('¿Eliminar solicitud?')) return;

    await eliminarSoportesDeEntidad('solicitud', id);

    const { error } = await supabase.from('solicitudes').delete().eq('id', id);
    if (error) {
      console.error('Error eliminando solicitud:', error);
      alert('❌ No se pudo eliminar la solicitud: ' + error.message);
      return;
    }

    setSolicitudes(solicitudes.filter(s => s.id !== id));
  };

  // USUARIOS CRUD (conectado a Supabase — tabla public.usuarios)
  // COLABORADORES / TALENTO HUMANO — este formulario ya SOLO EDITA personas que ya
  // tienen cuenta de acceso (creada a mano en Supabase → Authentication, como hasta
  // ahora). Crear una persona nueva sigue siendo un paso manual fuera de la app
  // (decisión del usuario): primero su cuenta en Authentication, luego vincularla
  // con un pequeño INSERT en usuarios — la app no crea cuentas de Authentication
  // porque eso requiere una llave que nunca debe vivir en el navegador.
  // El rol no se puede cambiar desde acá (el <select> queda deshabilitado mientras
  // se edita) para no complicar a qué "vista" (responsables/usuariosAdmin) pertenece.
  const handleSaveResponsable = async () => {
    if (!editingResponsableId) return;

    if (!newResponsable.nombre || !newResponsable.email) {
      alert('Nombre y email son obligatorios');
      return;
    }

    if (rolesSensibles.includes(newUserType) && user?.rol !== 'Administrador') {
      alert('Solo el Administrador puede editar este perfil');
      return;
    }

    const existeEmail = usuariosDB.some(u => u.email === newResponsable.email && u.id !== editingResponsableId);
    if (existeEmail) {
      alert('Ese email ya está en uso por otro usuario');
      return;
    }

    let empresaId = null;
    if (newResponsable.empresa) {
      const { data: empresaRow, error: empresaError } = await supabase
        .from('empresas')
        .select('id')
        .eq('nombre', newResponsable.empresa)
        .single();
      if (empresaError) {
        console.error('Error buscando empresa:', empresaError);
      }
      empresaId = empresaRow?.id || null;
    }

    const { data: guardados, error } = await supabase
      .from('usuarios')
      .update({
        nombre: newResponsable.nombre,
        cargo: newResponsable.cargo || null,
        empresa_id: empresaId,
        foto_url: newResponsable.foto || null,
        cedula: limpiarDocumento(newResponsable.cedula, newResponsable.tipoDocumento) || null,
        tipo_documento: newResponsable.tipoDocumento ? Number(newResponsable.tipoDocumento) : null,
        telefono: newResponsable.telefono || null,
        fecha_nacimiento: newResponsable.fechaNacimiento || null,
        fecha_ingreso: newResponsable.fechaIngreso || null,
        tipo_vinculacion: newResponsable.tipoVinculacion || null,
        contacto_emergencia_nombre: newResponsable.contactoEmergenciaNombre || null,
        contacto_emergencia_telefono: newResponsable.contactoEmergenciaTelefono || null,
        eps: newResponsable.eps || null,
        arl: newResponsable.arl || null,
        funciones: newResponsable.funciones || null,
        banco: newResponsable.banco || null,
        codigo_banco: newResponsable.codigoBanco || null,
        tipo_cuenta_bancaria: newResponsable.tipoCuentaBancaria || null,
        numero_cuenta: limpiarNumeroCuenta(newResponsable.numeroCuenta) || null,
        titular_cuenta: newResponsable.titularCuenta || null
      })
      .eq('id', editingResponsableId)
      .select('id');

    if (error || !guardados || guardados.length === 0) {
      console.error('Error guardando usuario:', error);
      alert('❌ No se pudo guardar' + (error ? ': ' + error.message : ' (sin permiso o usuario no encontrado)'));
      return;
    }

    alert('✅ Usuario actualizado');
    await cargarUsuarios();
    setEditingResponsableId(null);
    setEditingResponsableOrigen('responsables');
    setNewResponsable(responsableVacio);
  };

  const handleOpenEditResponsable = (r, origen) => {
    if (origen === 'admin' && rolesSensibles.includes(r.rol) && user?.rol !== 'Administrador') {
      alert('Solo el Administrador puede editar este usuario');
      return;
    }
    setNewUserType(origen === 'admin' ? r.rol : 'Colaborador');
    setEditingResponsableId(r.id);
    setEditingResponsableOrigen(origen);
    setNewResponsable({ ...responsableVacio, ...r });
  };

  const handleCancelEditResponsable = () => {
    setEditingResponsableId(null);
    setEditingResponsableOrigen('responsables');
    setNewResponsable(responsableVacio);
  };

  const handleDeleteResponsable = async (id, origen) => {
    if (origen === 'admin') {
      const target = usuariosAdmin.find(u => u.id === id);
      if (target && rolesSensibles.includes(target.rol) && user?.rol !== 'Administrador') {
        alert('Solo el Administrador puede eliminar este usuario');
        return;
      }
    }
    if (!window.confirm('¿Eliminar usuario? Su cuenta de acceso (Authentication) NO se borra, pero al quedar sin perfil ya no podrá entrar al sistema. Las solicitudes y gastos ya registrados se mantienen.')) {
      return;
    }

    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) {
      console.error('Error eliminando usuario:', error);
      alert('❌ No se pudo eliminar: ' + error.message);
      return;
    }

    await cargarUsuarios();
    if (editingResponsableId === id) handleCancelEditResponsable();
  };

  // Foto de perfil y documentos (cédula/pasaporte) del colaborador — un solo archivo cada uno, igual patrón que los soportes.
  const handleColaboradorFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setNewResponsable(prev => ({ ...prev, foto: event.target.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Documentos (Cédula/Pasaporte) — a diferencia de la foto, estos NO se guardan como texto
  // en la fila: se suben al bucket privado "documentos-rh" (Storage) y en usuarios solo se
  // guarda la ruta del archivo. Se sube de inmediato al elegir el archivo (no espera al botón
  // "Guardar Cambios" general) para no perder el documento si algo más del formulario falla.
  const DOCUMENTO_COLUMNA = { documentoCedula: 'documento_cedula_path', documentoPasaporte: 'documento_pasaporte_path' };
  const DOCUMENTO_ETIQUETA = { documentoCedula: 'cedula', documentoPasaporte: 'pasaporte' };

  const handleColaboradorDocumento = async (e, campo) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !editingResponsableId) return;

    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
    const ruta = `${editingResponsableId}/${DOCUMENTO_ETIQUETA[campo]}.${extension}`;

    setSubiendoDocumento(campo);
    const { error: uploadError } = await supabase.storage
      .from('documentos-rh')
      .upload(ruta, file, { upsert: true });

    if (uploadError) {
      console.error('Error subiendo documento:', uploadError);
      alert('❌ No se pudo subir el archivo: ' + uploadError.message);
      setSubiendoDocumento(null);
      return;
    }

    const { error: dbError } = await supabase
      .from('usuarios')
      .update({ [DOCUMENTO_COLUMNA[campo]]: ruta })
      .eq('id', editingResponsableId);

    setSubiendoDocumento(null);

    if (dbError) {
      console.error('Error guardando ruta del documento:', dbError);
      alert('❌ El archivo se subió pero no se pudo vincular al usuario: ' + dbError.message);
      return;
    }

    setNewResponsable(prev => ({ ...prev, [campo]: ruta }));
    await cargarUsuarios();
  };

  // Abre el documento en una pestaña nueva vía signed URL (el bucket es privado — no tiene link público fijo).
  const handleColaboradorVerDocumento = async (ruta) => {
    const { data, error } = await supabase.storage.from('documentos-rh').createSignedUrl(ruta, 60);
    if (error || !data?.signedUrl) {
      alert('❌ No se pudo abrir el documento: ' + (error?.message || 'error desconocido'));
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleColaboradorEliminarDocumento = async (campo) => {
    const ruta = newResponsable[campo];
    if (!ruta || !editingResponsableId) return;
    if (!window.confirm('¿Eliminar este documento?')) return;

    await supabase.storage.from('documentos-rh').remove([ruta]);
    const { error } = await supabase
      .from('usuarios')
      .update({ [DOCUMENTO_COLUMNA[campo]]: null })
      .eq('id', editingResponsableId);

    if (error) {
      console.error('Error eliminando documento:', error);
      alert('❌ No se pudo eliminar: ' + error.message);
      return;
    }

    setNewResponsable(prev => ({ ...prev, [campo]: null }));
    await cargarUsuarios();
  };

  const handleColaboradorRemoveArchivo = (campo) => {
    setNewResponsable(prev => ({ ...prev, [campo]: campo === 'foto' ? '' : null }));
  };

  // MI PERFIL — autoedición: cualquier rol edita SOLO su propia fila, nunca la de otro.
  // A propósito NO se hace un UPDATE directo a "usuarios" aquí (esa tabla solo admite UPDATE
  // de Administrador/Coordinadora por RLS) — en su lugar se usan las funciones RPC
  // actualizar_mi_perfil/actualizar_mi_archivo, que ni siquiera reciben "rol" o "empresa_id"
  // como parámetro, así que es imposible tocarlos desde aquí aunque alguien llame a la API directo.
  const handleGuardarMiPerfil = async () => {
    if (!miPerfilForm) return;
    setGuardandoMiPerfil(true);
    const { error } = await supabase.rpc('actualizar_mi_perfil', {
      p_telefono: miPerfilForm.telefono || null,
      p_fecha_nacimiento: miPerfilForm.fechaNacimiento || null,
      p_cedula: limpiarDocumento(miPerfilForm.cedula, miPerfilForm.tipoDocumento) || null,
      p_contacto_emergencia_nombre: miPerfilForm.contactoEmergenciaNombre || null,
      p_contacto_emergencia_telefono: miPerfilForm.contactoEmergenciaTelefono || null,
      p_eps: miPerfilForm.eps || null,
      p_arl: miPerfilForm.arl || null,
      p_funciones: miPerfilForm.funciones || null,
      p_banco: miPerfilForm.banco || null,
      p_tipo_cuenta_bancaria: miPerfilForm.tipoCuentaBancaria || null,
      p_numero_cuenta: limpiarNumeroCuenta(miPerfilForm.numeroCuenta) || null,
      p_titular_cuenta: miPerfilForm.titularCuenta || null
    });
    // Tipo de documento y código de banco (para el pago PAB) van en una RPC aparte con el
    // mismo blindaje: solo toca la fila propia y solo esas dos columnas.
    const { error: errorBancario } = error ? { error: null } : await supabase.rpc('actualizar_mi_perfil_bancario', {
      p_tipo_documento: miPerfilForm.tipoDocumento ? Number(miPerfilForm.tipoDocumento) : null,
      p_codigo_banco: miPerfilForm.codigoBanco || null
    });
    setGuardandoMiPerfil(false);
    if (error || errorBancario) {
      console.error('Error guardando mi perfil:', error || errorBancario);
      alert('❌ No se pudo guardar: ' + (error || errorBancario).message);
      return;
    }
    await cargarUsuarios();
    alert('✅ Perfil actualizado');
  };

  // CAMBIAR MI CONTRASEÑA — cada quien cambia solo la suya. Antes de aplicar la nueva se
  // reautentica con la actual (signInWithPassword) para confirmar que quien está frente a la
  // pantalla realmente la conoce; esto evita que una sesión abierta y desatendida alcance para
  // cambiarla. El cambio en sí se hace con supabase.auth.updateUser, que solo puede tocar la
  // cuenta de la sesión activa (no hace falta tabla ni política nueva).
  const handleCambiarPassword = async () => {
    if (!passwordActual || !passwordNueva || !passwordConfirmar) {
      alert('Completa los 3 campos');
      return;
    }
    if (passwordNueva.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (passwordNueva !== passwordConfirmar) {
      alert('La nueva contraseña y su confirmación no coinciden');
      return;
    }
    setCambiandoPassword(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: passwordActual });
      if (authError) {
        alert('❌ La contraseña actual no es correcta');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: passwordNueva });
      if (error) {
        alert('❌ No se pudo cambiar la contraseña: ' + error.message);
        return;
      }
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordConfirmar('');
      setMostrarCambiarPassword(false);
      alert('✅ Contraseña actualizada. La próxima vez que inicies sesión, usa la nueva.');
    } finally {
      setCambiandoPassword(false);
    }
  };

  const handleMiPerfilFoto = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const ruta = `${user.id}/foto.${extension}`;

    setSubiendoMiArchivo('foto');
    const { error: uploadError } = await supabase.storage.from('avatars').upload(ruta, file, { upsert: true });
    if (uploadError) {
      console.error('Error subiendo foto:', uploadError);
      alert('❌ No se pudo subir la foto: ' + uploadError.message);
      setSubiendoMiArchivo(null);
      return;
    }

    // El bucket "avatars" es público, así que guardamos la URL pública directamente en
    // foto_url (mismo campo que usa ColaboradorAvatar en todas partes de la app).
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(ruta);
    const { error: rpcError } = await supabase.rpc('actualizar_mi_archivo', { p_campo: 'foto_url', p_valor: publicUrlData.publicUrl });
    setSubiendoMiArchivo(null);
    if (rpcError) {
      console.error('Error guardando foto:', rpcError);
      alert('❌ La foto se subió pero no se pudo guardar: ' + rpcError.message);
      return;
    }
    await cargarUsuarios();
  };

  const handleMiPerfilQuitarFoto = async () => {
    if (!window.confirm('¿Quitar tu foto?')) return;
    const { error } = await supabase.rpc('actualizar_mi_archivo', { p_campo: 'foto_url', p_valor: null });
    if (error) {
      console.error('Error quitando foto:', error);
      alert('❌ No se pudo quitar: ' + error.message);
      return;
    }
    await cargarUsuarios();
  };

  const MI_DOCUMENTO_COLUMNA = { documentoCedula: 'documento_cedula_path', documentoPasaporte: 'documento_pasaporte_path' };
  const MI_DOCUMENTO_ETIQUETA = { documentoCedula: 'cedula', documentoPasaporte: 'pasaporte' };

  const handleMiPerfilDocumento = async (e, campo) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
    const ruta = `${user.id}/${MI_DOCUMENTO_ETIQUETA[campo]}.${extension}`;

    setSubiendoMiArchivo(campo);
    const { error: uploadError } = await supabase.storage.from('documentos-rh').upload(ruta, file, { upsert: true });
    if (uploadError) {
      console.error('Error subiendo documento:', uploadError);
      alert('❌ No se pudo subir el archivo: ' + uploadError.message);
      setSubiendoMiArchivo(null);
      return;
    }

    const { error: rpcError } = await supabase.rpc('actualizar_mi_archivo', { p_campo: MI_DOCUMENTO_COLUMNA[campo], p_valor: ruta });
    setSubiendoMiArchivo(null);
    if (rpcError) {
      console.error('Error guardando documento:', rpcError);
      alert('❌ El archivo se subió pero no se pudo registrar: ' + rpcError.message);
      return;
    }
    await cargarUsuarios();
  };

  const handleMiPerfilVerDocumento = async (ruta) => {
    const { data, error } = await supabase.storage.from('documentos-rh').createSignedUrl(ruta, 60);
    if (error) {
      console.error('Error generando link:', error);
      alert('❌ No se pudo abrir el documento: ' + error.message);
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleMiPerfilEliminarDocumento = async (campo) => {
    const ruta = miPerfil?.[campo];
    if (!ruta) return;
    if (!window.confirm('¿Quitar este documento?')) return;

    await supabase.storage.from('documentos-rh').remove([ruta]);
    const { error } = await supabase.rpc('actualizar_mi_archivo', { p_campo: MI_DOCUMENTO_COLUMNA[campo], p_valor: null });
    if (error) {
      console.error('Error quitando documento:', error);
      alert('❌ No se pudo quitar: ' + error.message);
      return;
    }
    await cargarUsuarios();
  };

  // CUENTAS DE COBRO CRUD (conectado a Supabase — tabla public.cuentas_cobro)
  const handleAddCuentaCobro = async () => {
    if (!newCuentaCobro.monto || parseFloat(newCuentaCobro.monto) <= 0) {
      alert('Ingresa un valor mayor a cero');
      return;
    }
    if (!user.cedula || !user.cargo) {
      alert('Antes de crear tu Cuenta de Cobro, completa tu Cédula y Cargo en tu perfil (módulo Colaboradores).');
      return;
    }
    const funcionesFinal = newCuentaCobro.funciones || user.funciones || '';
    if (!funcionesFinal) {
      alert('Falta la descripción de funciones. Complétala aquí o guárdala una vez en tu perfil (módulo Colaboradores).');
      return;
    }

    // Empresa de ESTA cuenta de cobro: la que el colaborador eligió en el formulario, o la de su
    // perfil por defecto si no tocó el selector — así puede facturarle a más de una empresa de la
    // holding sin que su perfil (empresa "de base") cambie.
    const empresaCuenta = newCuentaCobro.empresa || user.empresa;
    if (!empresaCuenta) {
      alert('Elige a qué empresa de la holding le estás facturando');
      return;
    }

    setGuardandoCuentaCobro(true);
    try {
      // Consecutivo por colaborador: cuenta cuántas cuentas de cobro ya tiene esta persona (en
      // cualquier empresa — el número de cuenta de cobro es correlativo a la persona, no a la
      // empresa que factura).
      const numeroConsecutivo = cuentasDeCobro.filter(c => c.responsableId === user.id).length + 1;
      const hoy = new Date();
      const fechaISO = hoy.toISOString().split('T')[0];
      const vencimiento = new Date(hoy.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monto = parseFloat(newCuentaCobro.monto) || 0;
      const numero = String(numeroConsecutivo).padStart(2, '0');

      let empresaId = null;
      if (empresaCuenta) {
        const { data: empresaRow, error: empresaError } = await supabase
          .from('empresas')
          .select('id')
          .eq('nombre', empresaCuenta)
          .single();
        if (empresaError) console.error('Error buscando empresa:', empresaError);
        empresaId = empresaRow?.id || null;
      }

      // Snapshot de los datos bancarios al momento de crear la cuenta — si el colaborador
      // los actualiza después en su perfil, esta cuenta ya emitida no cambia retroactivamente.
      // Se toman de miPerfil (recargado desde la BD) y no de "user" (armado al iniciar sesión),
      // para que un cambio hecho en Mi Perfil durante la misma sesión sí quede en la cuenta.
      const perfilPago = miPerfil || user;
      const { data: inserted, error } = await supabase
        .from('cuentas_cobro')
        .insert({
          fecha: fechaISO,
          numero,
          vencimiento,
          ciudad: newCuentaCobro.ciudad || 'Medellín',
          mes: newCuentaCobro.mes,
          anio: newCuentaCobro.anio,
          monto,
          funciones: funcionesFinal,
          estado: 'Pendiente',
          empresa_id: empresaId,
          empresa_nit: NIT_EMPRESAS[empresaCuenta] || '(pendiente)',
          responsable_id: user.id,
          responsable_cedula: perfilPago.cedula,
          responsable_cargo: user.cargo,
          tipo_documento: perfilPago.tipoDocumento ? Number(perfilPago.tipoDocumento) : null,
          banco: perfilPago.banco || '',
          codigo_banco: perfilPago.codigoBanco || null,
          tipo_cuenta_bancaria: perfilPago.tipoCuentaBancaria || '',
          numero_cuenta: perfilPago.numeroCuenta || '',
          titular_cuenta: perfilPago.titularCuenta || user.nombre
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creando cuenta de cobro:', error);
        alert('❌ No se pudo guardar la cuenta de cobro: ' + error.message);
        return;
      }

      // A diferencia de Solicitudes, aquí cada archivo sube por separado (no se unen en un PDF).
      for (const soporte of soportesCuentaCobroTemp) {
        await subirSoporteEntidad(soporte, 'cuenta_cobro', inserted.id);
      }

      await cargarCuentasCobro();

      // El PDF se genera con los datos que ya tenemos en memoria — no hace falta esperar
      // a que vuelva a cargar desde Supabase.
      handleGenerarPDFCuentaCobro({
        numero,
        fecha: fechaISO,
        vencimiento,
        ciudad: newCuentaCobro.ciudad || 'Medellín',
        mes: newCuentaCobro.mes,
        anio: newCuentaCobro.anio,
        monto,
        funciones: funcionesFinal,
        empresa: empresaCuenta,
        empresaNit: NIT_EMPRESAS[empresaCuenta] || '(pendiente)',
        responsableNombre: user.nombre,
        responsableCedula: perfilPago.cedula,
        responsableCargo: user.cargo,
        banco: perfilPago.banco || '',
        tipoCuentaBancaria: perfilPago.tipoCuentaBancaria || '',
        numeroCuenta: perfilPago.numeroCuenta || '',
        titularCuenta: perfilPago.titularCuenta || user.nombre
      });

      setNewCuentaCobro({ mes: new Date().getMonth() + 1, anio: new Date().getFullYear(), ciudad: 'Medellín', monto: '', funciones: '', estado: 'Pendiente', empresa: empresaCuenta });
      setSoportesCuentaCobroTemp([]);
      alert('✅ Cuenta de cobro creada — el PDF se descargó automáticamente (también puedes volver a descargarlo desde la tabla).');
    } finally {
      setGuardandoCuentaCobro(false);
    }
  };

  // Genera el PDF de la Cuenta de Cobro con el formato "Prestación de Servicios Profesionales".
  const handleGenerarPDFCuentaCobro = (c) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margen = 15;
    const centro = pageWidth / 2;

    doc.setDrawColor(0, 0, 200);
    doc.setLineWidth(0.8);
    doc.rect(margen, margen, pageWidth - margen * 2, pageHeight - margen * 2);

    const fechaEmision = new Date(c.fecha + 'T00:00:00');
    const fechaVenc = new Date(c.vencimiento + 'T00:00:00');
    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    let y = margen + 15;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`${MESES_ES[fechaEmision.getMonth()].charAt(0).toUpperCase()}${MESES_ES[fechaEmision.getMonth()].slice(1)}, ${fechaEmision.getDate()} de ${fechaEmision.getFullYear()}`, margen + 5, y);

    y += 15;
    doc.setFontSize(14);
    doc.text('PRESTACIÓN DE SERVICIOS PROFESIONALES', centro, y, { align: 'center' });

    y += 8;
    doc.setLineWidth(0.3);
    doc.line(margen + 5, y, pageWidth - margen - 5, y);

    y += 15;
    doc.setFontSize(11);
    doc.text(`Cuenta de cobro No: ${c.numero}`, centro, y, { align: 'center' });

    y += 12;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Ciudad y Fecha  : ${c.ciudad}, ${fmt(fechaEmision)}`, centro - 35, y);
    y += 8;
    doc.text(`Vencimiento     : ${fmt(fechaVenc)}`, centro - 35, y);

    y += 14;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(getRazonSocialLegal(c.empresa), centro, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('NIT:', centro - 8, y, { align: 'right' });
    doc.setFont(undefined, 'bold');
    doc.text(c.empresaNit, centro - 4, y);

    y += 12;
    doc.setFont(undefined, 'normal');
    doc.text('Debe a:', centro, y, { align: 'center' });

    y += 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(c.responsableNombre.toUpperCase(), centro, y, { align: 'center' });

    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`C.C ${c.responsableCedula}`, centro, y, { align: 'center' });

    y += 14;
    const valorTexto = `${valorEnLetrasPesos(c.monto)} (COP$${new Intl.NumberFormat('es-CO').format(c.monto)}) por concepto de prestación de servicios profesionales como ${c.responsableCargo}, (${c.funciones}) en el mes de ${MESES_ES[c.mes - 1]} del ${c.anio}.`;
    const parrafo = doc.splitTextToSize(`La suma de ${valorTexto}`, pageWidth - margen * 2 - 16);
    doc.text(parrafo, margen + 8, y);
    y += parrafo.length * 5.5 + 10;

    doc.text(`Se firma en ${c.ciudad}, a los (${fechaEmision.getDate()}) días del mes de ${MESES_ES[fechaEmision.getMonth()]} de ${fechaEmision.getFullYear()}`, margen + 8, y);

    if (c.banco || c.numeroCuenta) {
      y += 14;
      doc.setFont(undefined, 'bold');
      doc.text('Datos para consignación:', margen + 8, y);
      doc.setFont(undefined, 'normal');
      y += 7;
      doc.text(`Banco: ${c.banco || '—'}    Tipo de cuenta: ${c.tipoCuentaBancaria || '—'}    No. Cuenta: ${c.numeroCuenta || '—'}`, margen + 8, y);
      y += 7;
      doc.text(`Titular: ${c.titularCuenta || c.responsableNombre}`, margen + 8, y);
    }

    y += 20;
    doc.text('Aceptada', pageWidth - margen - 45, y);

    y += 22;
    const firmaIzqX = margen + 10;
    const firmaDerX = centro + 15;
    doc.line(firmaIzqX, y, firmaIzqX + 60, y);
    doc.line(firmaDerX, y, firmaDerX + 60, y);
    y += 6;
    doc.text(c.responsableNombre, firmaIzqX, y);
    doc.text('Encargado', firmaDerX, y);
    y += 6;
    doc.text(`C.C  ${c.responsableCedula}`, firmaIzqX, y);
    doc.text('C.C', firmaDerX, y);

    doc.save(`Cuenta_de_Cobro_${c.numero}_${c.responsableNombre.replace(/\s+/g, '_')}.pdf`);
  };

  // Solo se usa hoy para cambiar "estado" (Admin/Coordinadora aprueban/pagan) — campo ya
  // coincide 1:1 con el nombre de la columna en Supabase, así que no necesita mapeo.
  const handleUpdateCuentaCobro = async (id, campo, valor) => {
    const anteriores = cuentasDeCobro;
    setCuentasDeCobro(cuentasDeCobro.map(c => c.id === id ? {...c, [campo]: valor} : c));

    const { error } = await supabase.from('cuentas_cobro').update({ [campo]: valor }).eq('id', id);
    if (error) {
      console.error('Error actualizando cuenta de cobro:', error);
      alert('❌ No se pudo actualizar: ' + error.message);
      setCuentasDeCobro(anteriores);
    }
  };

  // Eliminar cuenta de cobro — borra también sus soportes (metadata + archivos en Storage)
  // Eliminar cuenta de cobro: va por la función eliminar_cuenta_cobro (Supabase), que valida el
  // permiso (Admin/Coordinadora: cualquiera; el dueño: solo las suyas en Pendiente) y borra la
  // cuenta y sus soportes en una sola transacción. Antes era un delete directo que, si RLS lo
  // bloqueaba, "funcionaba" solo en pantalla y el colaborador la seguía viendo.
  const puedeEliminarCuentaCobro = (c) => user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa'
    || (c.responsableId === user.id && c.estado === 'Pendiente');

  const handleDeleteCuentaCobro = async (c) => {
    if (!window.confirm(`¿Eliminar la cuenta de cobro${c.numero ? ` N° ${c.numero}` : ''}? También se borran sus soportes y desaparece para todos.`)) return;
    const { data: rutas, error } = await supabase.rpc('eliminar_cuenta_cobro', { p_id: String(c.id) });
    if (error) {
      console.error('Error eliminando cuenta de cobro:', error);
      alert('❌ No se pudo eliminar la cuenta de cobro: ' + error.message);
      return;
    }
    if (rutas && rutas.length > 0) {
      const { error: errorStorage } = await supabase.storage.from('soportes').remove(rutas);
      if (errorStorage) console.error('La cuenta se eliminó, pero no se pudieron borrar sus archivos de Storage:', errorStorage);
    }
    setCuentasDeCobro(prev => prev.filter(x => x.id !== c.id));
    await cargarCuentasCobro();
  };

  // Colaborador, Responsable y Gerente: solo sus propias Cuentas de Cobro.
  const cuentasCobroUsuario = soloPropias
    ? cuentasDeCobro.filter(c => c.responsableId === user.id)
    : cuentasDeCobro;
  // Filtros de la lista: Mes cobrado y Empresa primero (los conteos por estado se calculan sobre
  // ese resultado), luego Estado.
  const mesesCuentasCobro = [...new Set(cuentasCobroUsuario.filter(c => c.mes && c.anio).map(c => `${c.anio}-${c.mes}`))]
    .sort((a, b) => { const [ay, am] = a.split('-').map(Number); const [by, bm] = b.split('-').map(Number); return by - ay || bm - am; });
  const empresasCuentasCobro = [...new Set(cuentasCobroUsuario.map(c => c.empresa).filter(Boolean))].sort();
  const cuentasCobroPorMesEmpresa = cuentasCobroUsuario.filter(c =>
    (filtroCuentasMes === 'Todos' || `${c.anio}-${c.mes}` === filtroCuentasMes) &&
    (filtroCuentasEmpresa === 'Todas' || c.empresa === filtroCuentasEmpresa));
  const cuentasCobroFiltradas = cuentasCobroPorMesEmpresa.filter(c => filtroCuentasEstado === 'Todos' || c.estado === filtroCuentasEstado);

  // GASTOS E INGRESOS CRUD
  // Resuelve nombre de empresa / código de CECO a sus id de Supabase (mismo patrón usado en
  // Cuentas de Cobro/Solicitudes). empresas/cecos son constantes locales que reflejan el seed
  // de Supabase, así que solo hace falta esta consulta puntual al guardar.
  const resolverEmpresaId = async (nombreEmpresa) => {
    if (!nombreEmpresa) return null;
    const { data, error } = await supabase.from('empresas').select('id').eq('nombre', nombreEmpresa).single();
    if (error) { console.error('Error buscando empresa:', error); return null; }
    return data?.id || null;
  };

  const resolverCecoId = async (codigoCeco) => {
    if (!codigoCeco) return null;
    const { data, error } = await supabase.from('cecos').select('id').eq('codigo', codigoCeco).single();
    if (error) { console.error('Error buscando CECO:', error); return null; }
    return data?.id || null;
  };

  // MIGRACIÓN ÚNICA: rescata el Presupuesto (Conceptos, Techos Anuales, Ajustes por mes y
  // Deducciones) que haya quedado guardado en localStorage de una versión anterior de la app
  // (100% local, antes de esta conexión a Supabase) y lo sube a las tablas reales. Solo tiene
  // sentido correrla UNA vez, desde el mismo navegador donde se cargaron esos datos — por eso
  // el botón que la dispara solo aparece si presupuestoItems (Supabase) sigue vacío.
  const handleMigrarPresupuestoLocal = async () => {
    if (presupuestoItems.length > 0) {
      alert('Ya hay conceptos de Presupuesto cargados en Supabase — no se debe volver a migrar (se duplicarían). Si necesitas repetir la migración, primero elimina los conceptos actuales.');
      return;
    }

    let itemsLocal, anualLocal, overridesLocal, deduccionesLocal;
    try {
      itemsLocal = JSON.parse(localStorage.getItem('amPresupuestoItems') || '[]');
      anualLocal = JSON.parse(localStorage.getItem('amPresupuestoAnual') || '[]');
      overridesLocal = JSON.parse(localStorage.getItem('amPresupuestoOverrides') || '[]');
      deduccionesLocal = JSON.parse(localStorage.getItem('amDeducciones') || '[]');
    } catch (e) {
      alert('❌ No se pudo leer el Presupuesto guardado localmente en este navegador.');
      return;
    }

    if (itemsLocal.length === 0 && anualLocal.length === 0) {
      alert('No se encontró Presupuesto guardado localmente en este navegador (localStorage). Si lo cargaste en otro computador/navegador, no va a estar aquí.');
      return;
    }

    if (!window.confirm(`Se van a migrar a Supabase: ${itemsLocal.length} conceptos, ${anualLocal.length} techos anuales, ${overridesLocal.length} ajustes por mes y ${deduccionesLocal.length} deducciones.\n\n¿Continuar?`)) {
      return;
    }

    setCargandoPresupuesto(true);
    try {
      const empresaCache = {};
      const cecoCache = {};
      const resolverEmpresaCached = async (nombre) => {
        if (!(nombre in empresaCache)) empresaCache[nombre] = await resolverEmpresaId(nombre);
        return empresaCache[nombre];
      };
      const resolverCecoCached = async (codigo) => {
        if (!(codigo in cecoCache)) cecoCache[codigo] = await resolverCecoId(codigo);
        return cecoCache[codigo];
      };

      // 1) Conceptos — se insertan uno por uno (en vez de en lote) para poder mapear el id viejo
      //    (numérico, de Date.now()) al id nuevo (uuid de Postgres) y así poder migrar después,
      //    con ese mapa, los Ajustes por mes y las Deducciones que apuntan a estos conceptos.
      const mapaIds = {};
      let erroresConceptos = 0;
      for (const item of itemsLocal) {
        const [empresaId, cecoId] = await Promise.all([resolverEmpresaCached(item.empresa), resolverCecoCached(item.ceco)]);
        const { data, error } = await supabase.from('presupuesto_items').insert({
          empresa_id: empresaId,
          ceco_id: cecoId,
          nombre: item.nombre,
          tipo: item.tipo || null,
          valor_mensual: item.valorMensual,
          dia_limite_pago: item.diaLimitePago ? parseInt(item.diaLimitePago) : null,
          activo: item.activo !== false
        }).select('id').single();
        if (error) { console.error('Error migrando concepto de presupuesto:', item, error); erroresConceptos++; continue; }
        mapaIds[item.id] = data.id;
      }

      // 2) Techos anuales
      let erroresAnual = 0;
      for (const anual of anualLocal) {
        const [empresaId, cecoId] = await Promise.all([resolverEmpresaCached(anual.empresa), resolverCecoCached(anual.ceco)]);
        const { error } = await supabase.from('presupuesto_anual').insert({
          empresa_id: empresaId, ceco_id: cecoId, anio: anual.anio, valor_anual: anual.valorAnual
        });
        if (error) { console.error('Error migrando techo anual:', anual, error); erroresAnual++; }
      }

      // 3) Ajustes por mes — usan el mapaIds del paso 1 para apuntar al concepto ya migrado
      let erroresOverrides = 0;
      for (const ov of overridesLocal) {
        const nuevoItemId = mapaIds[ov.presupuestoItemId];
        if (!nuevoItemId) { erroresOverrides++; continue; }
        const { error } = await supabase.from('presupuesto_overrides').insert({
          presupuesto_item_id: nuevoItemId, anio: ov.anio, mes: ov.mes, valor: ov.valor
        });
        if (error) { console.error('Error migrando ajuste de mes:', ov, error); erroresOverrides++; }
      }

      // 4) Deducciones — también usan mapaIds
      let erroresDeducciones = 0;
      for (const d of deduccionesLocal) {
        const nuevoItemId = mapaIds[d.presupuestoItemId];
        if (!nuevoItemId) { erroresDeducciones++; continue; }
        const { error } = await supabase.from('deducciones').insert({
          presupuesto_item_id: nuevoItemId,
          tipo: d.tipo,
          valor_cuota: d.valorCuota,
          saldo_total: d.tipo === 'Préstamo' ? d.saldoTotal : null,
          fecha_inicio: d.fechaInicio,
          observaciones: d.observaciones || null,
          activo: d.activo !== false
        });
        if (error) { console.error('Error migrando deducción:', d, error); erroresDeducciones++; }
      }

      await cargarPresupuesto();

      const totalErrores = erroresConceptos + erroresAnual + erroresOverrides + erroresDeducciones;
      if (totalErrores > 0) {
        alert(`⚠️ Migración terminada con ${totalErrores} registro(s) que no se pudieron migrar (revisa la consola del navegador para el detalle). El resto ya quedó en Supabase.`);
      } else {
        alert('✅ Presupuesto migrado a Supabase. Revisa la tabla para confirmar que todo quedó correcto.');
      }
    } finally {
      setCargandoPresupuesto(false);
    }
  };

  // Agregar uno o varios soportes sobrevinientes a un Gasto/Ingreso YA guardado, directo desde
  // el Historial (Administrador/Coordinadora Administrativa) — sin tocar ningún otro dato del
  // registro. Cada archivo se sube de una vez, igual que subirSoporteEntidad ya lo hace para los
  // soportes que se cargan al crear el registro.
  const handleAgregarSoporteHistorial = async (r, fileList) => {
    if (!(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa')) return;
    const files = Array.from(fileList);
    if (!files.length) return;
    const entidadTipo = r._origen === 'ingreso' ? 'ingreso' : 'gasto';
    setAgregandoSoporteId(r.id);
    try {
      for (const file of files) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const tipo = file.type || inferirMimePorExtension(file.name);
        await subirSoporteEntidad({ nombre: file.name, tipo, tamaño: file.size, data: dataUrl }, entidadTipo, r.id);
      }
      const conteo = await contarSoportesPorEntidad(entidadTipo, [r.id]);
      const nuevoConteo = conteo[r.id] || 0;
      if (entidadTipo === 'ingreso') {
        setIngresos(prev => prev.map(i => i.id === r.id ? { ...i, cantidadSoportes: nuevoConteo } : i));
      } else {
        setGastos(prev => prev.map(g => g.id === r.id ? { ...g, cantidadSoportes: nuevoConteo } : g));
      }
      alert(`✅ ${files.length > 1 ? 'Soportes agregados' : 'Soporte agregado'} correctamente.`);
    } finally {
      setAgregandoSoporteId(null);
    }
  };

  const handleAddGasto = async () => {
    if (!newGasto.detalle || !newGasto.valor) {
      alert('Detalle y valor son obligatorios');
      return;
    }

    if (parseFloat(newGasto.valor) <= 0) {
      alert('El valor debe ser mayor a cero');
      return;
    }

    if (newGasto.tipo === 'Traslado') {
      if (!newGasto.cuentaSalida || !newGasto.cuentaDestino) {
        alert('Cuenta salida y cuenta destino son obligatorios para traslados');
        return;
      }
      if (!newGasto.ceco) {
        alert('CECO es obligatorio para traslados');
        return;
      }
      if (newGasto.cuentaDestino === CUENTA_DESTINO_EXTERNA && (!newGasto.cuentaDestinoExternaNumero || !newGasto.cuentaDestinoExternaDetalle)) {
        alert('Número de cuenta y Detalle son obligatorios para un traslado a Empresa Externa');
        return;
      }
      // Traslado entre monedas distintas (hoy en la práctica: ARKO en USD hacia/desde el resto
      // de la holding en COP) — el valor que sale (campo "Valor") y el valor que entra a la
      // cuenta destino ("Valor en Cuenta Destino") son montos distintos en monedas distintas,
      // no la misma cifra convertida sola. Se piden los dos por separado.
      const empresaDestinoTraslado = getEmpresaDestinoTraslado(newGasto.cuentaDestino, newGasto.empresa);
      if (getMoneda(newGasto.empresa) !== getMoneda(empresaDestinoTraslado)) {
        if (!newGasto.valorDestino || parseFloat(newGasto.valorDestino) <= 0) {
          alert(`El valor en la cuenta destino (${getMoneda(empresaDestinoTraslado)}) es obligatorio para traslados entre monedas distintas`);
          return;
        }
      }
    } else if (!newGasto.cuenta) {
      alert('Cuenta es obligatoria');
      return;
    }

    if (esPagoTerceroFinanzas && (!newGasto.terceroNombre || !newGasto.terceroDni)) {
      alert('Nombre y DNI/Documento del tercero son obligatorios');
      return;
    }

    setGuardandoGasto(true);
    try {
      // Pago a Tercero registrado directo en Finanzas (Opción B) — sea porque el Tipo es
      // "Pago a Tercero" o porque el Tipo quedó en "Gasto" pero se eligió el CECO "Pago a
      // Terceros" (esPagoTerceroFinanzas cubre ambos casos): mismo manejo del catálogo
      // reutilizable de terceros que ya usa Solicitudes — crea o actualiza public.terceros
      // según lo que se marcó, sin bloquear el guardado del gasto si esto falla.
      const terceroInfoFinal = esPagoTerceroFinanzas ? {
        nombre: newGasto.terceroNombre,
        dni: limpiarDocumento(newGasto.terceroDni, newGasto.terceroTipoDocumento),
        tipoDocumento: newGasto.terceroTipoDocumento ? Number(newGasto.terceroTipoDocumento) : null,
        paisOrigen: newGasto.terceroPaisOrigen || null,
        banco: newGasto.terceroBanco || null,
        codigoBanco: newGasto.terceroCodigoBanco || null,
        tipoCuenta: newGasto.terceroTipoCuenta || null,
        numeroCuenta: limpiarNumeroCuenta(newGasto.terceroNumeroCuenta) || null,
      } : null;

      let terceroIdFinal = newGasto.terceroId || null;
      if (esPagoTerceroFinanzas) {
        if (!terceroIdFinal && newGasto.guardarTercero) {
          const { data: nuevoTercero, error: terceroError } = await supabase
            .from('terceros')
            .insert({
              nombre: newGasto.terceroNombre,
              dni: limpiarDocumento(newGasto.terceroDni, newGasto.terceroTipoDocumento),
              tipo_documento: newGasto.terceroTipoDocumento ? Number(newGasto.terceroTipoDocumento) : null,
              pais_origen: newGasto.terceroPaisOrigen || null,
              banco: newGasto.terceroBanco || null,
              codigo_banco: newGasto.terceroCodigoBanco || null,
              tipo_cuenta: newGasto.terceroTipoCuenta || null,
              numero_cuenta: limpiarNumeroCuenta(newGasto.terceroNumeroCuenta) || null,
              activo: true,
              creado_por: user.id
            })
            .select('id')
            .single();
          if (terceroError) {
            console.error('Error guardando el tercero para reutilizar:', terceroError);
            alert('⚠️ El pago se guardó, pero el tercero NO quedó guardado para futuros pagos: ' + terceroError.message);
          } else {
            terceroIdFinal = nuevoTercero.id;
          }
        } else if (terceroIdFinal && newGasto.actualizarTercero) {
          const { error: updateError } = await supabase
            .from('terceros')
            .update({
              nombre: newGasto.terceroNombre,
              dni: limpiarDocumento(newGasto.terceroDni, newGasto.terceroTipoDocumento),
              tipo_documento: newGasto.terceroTipoDocumento ? Number(newGasto.terceroTipoDocumento) : null,
              pais_origen: newGasto.terceroPaisOrigen || null,
              banco: newGasto.terceroBanco || null,
              codigo_banco: newGasto.terceroCodigoBanco || null,
              tipo_cuenta: newGasto.terceroTipoCuenta || null,
              numero_cuenta: limpiarNumeroCuenta(newGasto.terceroNumeroCuenta) || null,
            })
            .eq('id', terceroIdFinal);
          if (updateError) {
            console.error('Error actualizando los datos guardados del tercero:', updateError);
            alert('⚠️ El pago se guardó, pero no se pudieron actualizar los datos guardados del tercero: ' + updateError.message);
          }
        }
      }

      // Solo se vincula a un concepto de Presupuesto si la persona lo eligió a propósito en el
      // desplegable "Vincular a Presupuesto" — la sugerencia por texto ya NO se aplica sola al
      // guardar (antes sí, y eso además arrastraba un cambio silencioso de CECO, ver abajo).
      const presupuestoItemIdFinal = newGasto.tipo === 'Gasto' ? (newGasto.presupuestoItemId || '') : '';

      // El CECO que se guarda es siempre el que la persona eligió en el formulario — nunca se
      // reemplaza en silencio por el del concepto de Presupuesto vinculado, aunque sean distintos
      // (antes sí se ajustaba automáticamente; a pedido del usuario, el CECO manual manda siempre).
      // Desde esta sesión, Traslado también elige su propio CECO en el formulario (categoría
      // "Traslado" en Gestión de CECOs) — antes quedaba fijo siempre en CEIN-003-ACPT.
      const cecoFinal = newGasto.ceco;

      // Si el gasto queda vinculado a un concepto de Presupuesto con deducciones activas ese mes
      // (préstamo u otro descuento), el valor bruto ingresado se convierte en Neto a Pagar: el
      // "Valor" que queda guardado (y que alimenta Ejecutado/Dashboard/Presupuesto) es el neto real.
      let valorFinal = newGasto.valor;
      let valorBrutoFinal = null;
      let deduccionAplicadaFinal = null;

      // Traslado entre monedas distintas: el valor que entra a la cuenta destino se guarda
      // aparte (columna valor_destino) — es el que alimenta el lado "entrada" del historial.
      // Si origen y destino comparten moneda, no aplica y queda null (el lado "entrada" usa el
      // mismo valor de siempre, ver registrosFinanzasTodos).
      const empresaDestinoTraslado = newGasto.tipo === 'Traslado' ? getEmpresaDestinoTraslado(newGasto.cuentaDestino, newGasto.empresa) : null;
      const valorDestinoFinal = (newGasto.tipo === 'Traslado' && getMoneda(newGasto.empresa) !== getMoneda(empresaDestinoTraslado))
        ? newGasto.valorDestino
        : null;
      if (newGasto.tipo === 'Gasto' && presupuestoItemIdFinal && newGasto.aplicarDeduccion !== false) {
        const [anioGasto, mesGasto] = (newGasto.fecha || '').split('-').map(n => parseInt(n));
        if (anioGasto && mesGasto) {
          const totalDeduccion = deducciones
            .filter(d => d.presupuestoItemId === presupuestoItemIdFinal)
            .reduce((sum, d) => sum + getCuotaAplicada(d, anioGasto, mesGasto), 0);
          if (totalDeduccion > 0) {
            const bruto = parseFloat(newGasto.valor) || 0;
            valorBrutoFinal = bruto;
            deduccionAplicadaFinal = totalDeduccion;
            valorFinal = Math.max(0, bruto - totalDeduccion);
          }
        }
      }

      const [empresaId, cecoId] = await Promise.all([resolverEmpresaId(newGasto.empresa), resolverCecoId(cecoFinal)]);
      const responsableId = personasFinanzas.find(r => r.nombre === newGasto.responsable)?.id || null;

      // "cuenta_destino" es solo texto en la base de datos — para un traslado a Empresa Externa
      // no hay una cuenta propia que elegir, así que se guarda el Número de cuenta y el Detalle
      // digitados, en un texto legible (en vez del valor centinela CUENTA_DESTINO_EXTERNA solo).
      const cuentaDestinoFinal = newGasto.cuentaDestino === CUENTA_DESTINO_EXTERNA
        ? `Empresa Externa — Cta: ${newGasto.cuentaDestinoExternaNumero} — ${newGasto.cuentaDestinoExternaDetalle}`
        : (newGasto.cuentaDestino || null);

      const payloadGasto = {
        fecha: newGasto.fecha,
        tipo: newGasto.tipo,
        empresa_id: empresaId,
        responsable_id: responsableId,
        ceco_id: cecoId,
        cuenta: newGasto.cuenta || null,
        cuenta_salida: newGasto.cuentaSalida || null,
        cuenta_destino: cuentaDestinoFinal,
        detalle: newGasto.detalle,
        valor: valorFinal,
        valor_destino: valorDestinoFinal,
        valor_bruto: valorBrutoFinal,
        deduccion_aplicada: deduccionAplicadaFinal,
        categoria: newGasto.categoria || null,
        estado: newGasto.estado,
        observaciones: newGasto.observaciones || null,
        presupuesto_item_id: presupuestoItemIdFinal || null,
        moneda_pago: esPagoTerceroFinanzas ? newGasto.moneda : null,
        tercero_info: terceroInfoFinal,
        tercero_id: terceroIdFinal
      };

      const { data: inserted, error } = await supabase.from('gastos').insert(payloadGasto).select('id').single();
      if (error) {
        console.error('Error creando gasto:', error);
        alert('❌ No se pudo guardar la transacción: ' + error.message);
        return;
      }
      const gastoId = inserted.id;

      for (const soporte of soportesTemp) {
        await subirSoporteEntidad(soporte, 'gasto', gastoId);
      }

      // Igual que en Solicitudes: se genera automáticamente la ficha PDF del pago (datos del
      // tercero + cuenta bancaria) y se sube junto a los demás soportes de este gasto.
      if (esPagoTerceroFinanzas) {
        try {
          const pdfDoc = construirPDFPagoTercero({
            empresa: newGasto.empresa,
            empresaNit: NIT_EMPRESAS[newGasto.empresa] || '',
            fecha: newGasto.fecha,
            responsableNombre: user.nombre,
            detalle: newGasto.detalle,
            valor: parseFloat(newGasto.valor) || 0,
            moneda: newGasto.moneda,
            tercero: terceroInfoFinal || {},
            estado: newGasto.estado
          });
          await subirSoporteEntidad({
            nombre: `Pago_a_Tercero_${(newGasto.terceroNombre || 'tercero').replace(/\s+/g, '_')}.pdf`,
            tipo: 'application/pdf',
            data: pdfDoc.output('datauristring')
          }, 'gasto', gastoId);
        } catch (pdfError) {
          console.error('Error generando el PDF de Pago a Tercero:', pdfError);
          alert('⚠️ El pago se guardó, pero hubo un error generando el PDF automático.');
        }
      }

      await cargarGastos();
      if (esPagoTerceroFinanzas && (newGasto.guardarTercero || newGasto.actualizarTercero)) {
        await Promise.all([cargarTerceros(), cargarTodosTerceros()]);
      }

      setNewGasto({
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'Gasto',
        empresa: 'AM SPORTS GROUP SAS',
        responsable: '',
        ceco: 'CECO-001-GF',
        cuenta: '',
        detalle: '',
        valor: '',
        valorDestino: '',
        categoria: '',
        estado: 'Pendiente',
        observaciones: '',
        linkSoporte: '',
        cuentaSalida: '',
        cuentaDestino: '',
        cuentaDestinoExternaNumero: '',
        cuentaDestinoExternaDetalle: '',
        soportes: [],
        presupuestoItemId: '',
        aplicarDeduccion: true,
        moneda: 'COP',
        terceroId: '',
        terceroNombre: '',
        terceroDni: '',
        terceroTipoDocumento: '',
        terceroPaisOrigen: '',
        terceroBanco: '',
        terceroCodigoBanco: '',
        terceroTipoCuenta: '',
        terceroNumeroCuenta: '',
        guardarTercero: true,
        actualizarTercero: false
      });
      setSoportesTemp([]);
      setMostrarNuevoMovimientoFinanzas(false); // el formulario se vuelve a plegar tras registrar
      alert('✅ Transacción agregada con soportes');
    } finally {
      setGuardandoGasto(false);
    }
  };

  const handleAddIngreso = async () => {
    if (!newIngreso.detalle || !newIngreso.valor) {
      alert('Detalle y valor son obligatorios');
      return;
    }

    if (parseFloat(newIngreso.valor) <= 0) {
      alert('El valor debe ser mayor a cero');
      return;
    }

    if (!newIngreso.cuenta) {
      alert('Cuenta es obligatoria');
      return;
    }

    setGuardandoIngreso(true);
    try {
      const [empresaId, cecoId] = await Promise.all([resolverEmpresaId(newIngreso.empresa), resolverCecoId(newIngreso.ceco)]);
      const responsableId = personasFinanzas.find(r => r.nombre === newIngreso.responsable)?.id || null;

      const payloadIngreso = {
        fecha: newIngreso.fecha,
        tipo: newIngreso.tipo,
        empresa_id: empresaId,
        responsable_id: responsableId,
        ceco_id: cecoId,
        cuenta: newIngreso.cuenta || null,
        detalle: newIngreso.detalle,
        valor: newIngreso.valor,
        categoria: newIngreso.categoria || null,
        estado: newIngreso.estado,
        observaciones: newIngreso.observaciones || null
      };

      const { data: inserted, error } = await supabase.from('ingresos').insert(payloadIngreso).select('id').single();
      if (error) {
        console.error('Error creando ingreso:', error);
        alert('❌ No se pudo guardar el ingreso: ' + error.message);
        return;
      }
      const ingresoId = inserted.id;

      for (const soporte of soportesTemp) {
        await subirSoporteEntidad(soporte, 'ingreso', ingresoId);
      }

      await cargarIngresos();

      setNewIngreso({
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'Ingreso',
        empresa: 'AM SPORTS GROUP SAS',
        responsable: '',
        ceco: 'CEIN-001-ING',
        detalle: '',
        valor: '',
        categoria: '',
        estado: 'Pagado',
        observaciones: '',
        linkSoporte: '',
        cuenta: '',
        soportes: []
      });
      setSoportesTemp([]);
      setMostrarNuevoMovimientoFinanzas(false); // el formulario se vuelve a plegar tras registrar
      alert('✅ Ingreso agregado con soportes');
    } finally {
      setGuardandoIngreso(false);
    }
  };

  // GESTIÓN DE CECOs (Administrador y Coordinadora Administrativa) — crear un CECO nuevo o
  // editar uno existente (nombre, tipo, activo). No se borran nunca: un CECO usado en registros
  // viejos se "apaga" (activo=false) para que desaparezca de los desplegables sin romper el
  // historial que ya lo referencia.
  const handleAddCeco = async () => {
    const codigo = nuevoCeco.codigo.trim().toUpperCase();
    if (!codigo || !nuevoCeco.nombre.trim()) {
      alert('Código y nombre son obligatorios');
      return;
    }
    setGuardandoCeco(true);
    try {
      const { error } = await supabase.from('cecos').insert({ codigo, nombre: nuevoCeco.nombre.trim(), tipo: nuevoCeco.tipo, activo: true });
      if (error) {
        console.error('Error creando CECO:', error);
        alert('❌ No se pudo crear el CECO: ' + error.message);
        return;
      }
      await cargarCecos();
      setNuevoCeco({ codigo: '', nombre: '', tipo: 'Gasto' });
    } finally {
      setGuardandoCeco(false);
    }
  };

  const handleUpdateCeco = async (id, campo, valor) => {
    const anteriores = cecosDB;
    setCecosDB(cecosDB.map(c => c.id === id ? { ...c, [campo]: valor } : c));
    const { error } = await supabase.from('cecos').update({ [campo]: valor }).eq('id', id);
    if (error) {
      console.error('Error actualizando CECO:', error);
      alert('❌ No se pudo actualizar el CECO: ' + error.message);
      setCecosDB(anteriores);
    }
  };

  // Editar Fecha, CECO, Concepto y Valor de un registro de Finanzas — Administrador, Coordinadora y
  // Gerente. No toca la Solicitud ni el concepto de Presupuesto de origen; el cambio queda en Auditoría.
  const puedeEditarConceptoFinanzas = ['Administrador', 'Coordinadora Administrativa', 'Gerente'].includes(user?.rol);
  // "🔗 Generado desde Solicitudes" (Finanzas): abre la Solicitud original. Administrador y
  // Coordinadora pueden corregir su concepto desde ahí: se actualiza la Solicitud y también el
  // detalle del Gasto/Ingreso que generó, para que ambos digan lo mismo.
  const [verSolicitudOrigen, setVerSolicitudOrigen] = useState(null); // { solicitud, concepto, guardando }
  const puedeGestionarSolicitudOrigen = user?.rol === 'Administrador' || user?.rol === 'Coordinadora Administrativa';

  const handleVerSolicitudOrigen = async (solicitudId) => {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('id, fecha, tipo, valor, total_calculado, valor_anticipo_original, anticipo_id, anticipo_ids, revisado_por_id, revisado_at, aprobado_por_id, aprobado_at, detalle, estado, documentos, moneda_pago, tercero_info, tercero_id, gasto_generado_id, ingreso_generado_id, lote_pago_id, motivo_devolucion, empresa_id, responsable_id, empresas ( nombre ), usuarios!responsable_id ( nombre )')
      .eq('id', solicitudId)
      .maybeSingle();
    if (error) { console.error('Error cargando la solicitud de origen:', error); alert('❌ No se pudo abrir la solicitud: ' + error.message); return; }
    if (!data) { alert('La solicitud de origen ya no existe (o tu rol no puede verla).'); return; }
    const solicitud = solicitudDBToLocal(data);
    setVerSolicitudOrigen({ solicitud, concepto: solicitud.detalle || '', guardando: false });
  };

  const handleGuardarConceptoSolicitudOrigen = async () => {
    const actual = verSolicitudOrigen;
    if (!actual || !puedeGestionarSolicitudOrigen) return;
    const detalle = (actual.concepto || '').trim();
    if (!detalle) { alert('El concepto no puede quedar vacío'); return; }
    if (detalle === (actual.solicitud.detalle || '').trim()) { setVerSolicitudOrigen(null); return; }
    setVerSolicitudOrigen({ ...actual, guardando: true });
    try {
      const { data, error } = await supabase.from('solicitudes').update({ detalle }).eq('id', actual.solicitud.id).select('id');
      if (error || !data || data.length === 0) {
        alert('❌ No se pudo actualizar la solicitud: ' + (error?.message || 'tu rol no tiene permiso para editarla.'));
        setVerSolicitudOrigen({ ...actual, guardando: false });
        return;
      }
      // Mismo concepto en los movimientos de Finanzas que salieron de esta solicitud.
      const [rg, ri] = await Promise.all([
        supabase.from('gastos').update({ detalle }).eq('solicitud_origen_id', actual.solicitud.id).select('id'),
        supabase.from('ingresos').update({ detalle }).eq('solicitud_origen_id', actual.solicitud.id).select('id'),
      ]);
      if (rg.error || ri.error) console.error('Error actualizando el concepto en Finanzas:', rg.error || ri.error);
      setSolicitudes(prev => prev.map(x => (x.id === actual.solicitud.id ? { ...x, detalle } : x)));
      setGastos(prev => prev.map(g => (g.solicitudOrigenId === actual.solicitud.id ? { ...g, detalle } : g)));
      setIngresos(prev => prev.map(i => (i.solicitudOrigenId === actual.solicitud.id ? { ...i, detalle } : i)));
      setVerSolicitudOrigen(null);
    } catch (e) {
      console.error(e);
      setVerSolicitudOrigen({ ...actual, guardando: false });
    }
  };

  // Al eliminar en Finanzas un Gasto/Ingreso generado desde una Solicitud, la Solicitud vuelve a
  // "Pendiente" y pierde el vínculo (gasto/ingreso_generado_id y lote), para que se pueda corregir
  // y pagar de nuevo — antes quedaba en "Pagado" sin ningún movimiento en Finanzas.
  const devolverSolicitudOrigenAPendiente = async (solicitudId, columnaVinculo) => {
    const { data, error } = await supabase
      .from('solicitudes')
      .update({ estado: 'Pendiente', [columnaVinculo]: null, lote_pago_id: null })
      .eq('id', solicitudId)
      .select('id');
    if (error || !data || data.length === 0) {
      console.error('No se pudo devolver la solicitud a Pendiente:', error);
      alert('⚠️ El registro se eliminó, pero la solicitud de origen no se pudo devolver a Pendiente: ' + (error?.message || 'sin permiso') + '. Cámbiala a mano en Solicitudes.');
      return false;
    }
    setSolicitudes(prev => prev.map(x => (x.id === solicitudId ? { ...x, estado: 'Pendiente', [columnaVinculo === 'gasto_generado_id' ? 'gastoGeneradoId' : 'ingresoGeneradoId']: '', lotePagoId: '' } : x)));
    return true;
  };

  const [editandoConceptoFinanzas, setEditandoConceptoFinanzas] = useState(null); // { tabla, id, texto, fecha, ceco, valor, valorDestino }
  const [guardandoConceptoFinanzas, setGuardandoConceptoFinanzas] = useState(false);
  const handleGuardarConceptoFinanzas = async () => {
    const { tabla, id, texto, fecha, ceco, valor: valorTexto, valorDestino: valorDestinoTexto, tieneValorDestino, permiteNeutro, neutro, moneda, monedaOriginal, permiteVinculo, presupuestoItemId, presupuestoItemIdOriginal } = editandoConceptoFinanzas || {};
    // Moneda real del pago (solo Gastos): Neutro siempre queda en COP; si no, se guarda la elegida
    // en el editor, pero solo cuando cambió — para no escribir moneda_pago en registros que nunca la tuvieron.
    const monedaFinal = permiteNeutro ? (neutro ? 'COP' : moneda) : null;
    const cambiaMoneda = permiteNeutro && (neutro || monedaFinal !== monedaOriginal);
    const valor = parseValorFiltro(valorTexto);
    const valorDestino = tieneValorDestino ? parseValorFiltro(valorDestinoTexto) : null;
    if (!valor || valor <= 0) { alert('El valor debe ser mayor a cero'); return; }
    if (tieneValorDestino && (!valorDestino || valorDestino <= 0)) { alert('El valor destino debe ser mayor a cero'); return; }
    const detalle = (texto || '').trim();
    if (!detalle) { alert('El concepto no puede quedar vacío'); return; }
    if (!fecha) { alert('La fecha no puede quedar vacía'); return; }
    if (!ceco) { alert('Elige un CECO'); return; }
    setGuardandoConceptoFinanzas(true);
    try {
      const cecoId = await resolverCecoId(ceco);
      if (!cecoId) { alert('❌ No se encontró el CECO ' + ceco); return; }
      // Vínculo a Presupuesto (mismas reglas que tenía la columna del historial): solo si cambió; al vincular a un concepto con Colaborador
      // asignado, el gasto queda también con ese responsable.
      const cambiaVinculo = !!permiteVinculo && (presupuestoItemId || '') !== (presupuestoItemIdOriginal || '');
      const conceptoVinculo = cambiaVinculo && presupuestoItemId ? presupuestoItems.find(p => p.id === presupuestoItemId) : null;
      const vinculoPatch = cambiaVinculo ? { presupuesto_item_id: presupuestoItemId || null, ...(conceptoVinculo?.responsableId ? { responsable_id: conceptoVinculo.responsableId } : {}) } : {};
      const { data, error } = await supabase.from(tabla).update({ detalle, fecha, ceco_id: cecoId, valor, ...(tieneValorDestino ? { valor_destino: valorDestino } : {}), ...(permiteNeutro ? { neutro: !!neutro } : {}), ...(cambiaMoneda ? { moneda_pago: monedaFinal } : {}), ...vinculoPatch }).eq('id', id).select('id');
      if (error) { alert('❌ No se pudo guardar: ' + error.message); return; }
      if (!data || data.length === 0) { alert('❌ No se pudo guardar: tu rol no tiene permiso para editar este registro.'); return; }
      const cambios = { detalle, fecha, ceco, valor, ...(tieneValorDestino ? { valorDestino } : {}), ...(permiteNeutro ? { neutro: !!neutro } : {}), ...(cambiaMoneda ? { moneda: monedaFinal } : {}), ...(cambiaVinculo ? { presupuestoItemId: presupuestoItemId || null, ...(conceptoVinculo?.responsableId ? { responsableId: conceptoVinculo.responsableId } : {}) } : {}) };
      if (tabla === 'ingresos') setIngresos(prev => prev.map(i => (i.id === id ? { ...i, ...cambios } : i)));
      else setGastos(prev => prev.map(g => (g.id === id ? { ...g, ...cambios } : g)));
      setEditandoConceptoFinanzas(null);
    } finally {
      setGuardandoConceptoFinanzas(false);
    }
  };

  const handleUpdateGasto = async (id, campo, valor) => {
    const columnaDB = { estado: 'estado' }[campo] || campo;
    const anteriores = gastos;
    setGastos(gastos.map(g => g.id === id ? {...g, [campo]: valor} : g));
    const { error } = await supabase.from('gastos').update({ [columnaDB]: valor }).eq('id', id);
    if (error) {
      console.error('Error actualizando gasto:', error);
      alert('❌ No se pudo actualizar: ' + error.message);
      setGastos(anteriores);
    }
  };

  const handleDeleteGasto = async (id) => {
    const origen = gastos.find(g => g.id === id)?.solicitudOrigenId || '';
    if (!window.confirm(origen
      ? '¿Eliminar gasto?\n\nSe generó desde una Solicitud: al eliminarlo, esa Solicitud vuelve a "Pendiente" para corregirla y pagarla de nuevo.'
      : '¿Eliminar gasto?')) return;
    await eliminarSoportesDeEntidad('gasto', id);
    const { data, error } = await supabase.from('gastos').delete().eq('id', id).select('id');
    if (error || !data || data.length === 0) {
      console.error('Error eliminando gasto:', error);
      alert('❌ No se pudo eliminar el gasto: ' + (error?.message || 'tu rol no tiene permiso.'));
      return;
    }
    setGastos(prev => prev.filter(g => g.id !== id));
    if (origen) await devolverSolicitudOrigenAPendiente(origen, 'gasto_generado_id');
  };

  const handleDeleteIngreso = async (id) => {
    const origen = ingresos.find(i => i.id === id)?.solicitudOrigenId || '';
    if (!window.confirm(origen
      ? '¿Eliminar ingreso?\n\nSe generó desde una Solicitud: al eliminarlo, esa Solicitud vuelve a "Pendiente" para corregirla y pagarla de nuevo.'
      : '¿Eliminar ingreso?')) return;
    // Desde que una Legalización con diferencia en contra genera automáticamente un Ingreso
    // que reutiliza el MISMO archivo (bucket_path) del soporte ya subido a la Solicitud (Opción
    // C extendida), hay que usar el borrado seguro — igual que Gasto/Solicitud — para no
    // destruir un archivo que la Solicitud todavía necesita.
    await eliminarSoportesDeEntidad('ingreso', id);
    const { data, error } = await supabase.from('ingresos').delete().eq('id', id).select('id');
    if (error || !data || data.length === 0) {
      console.error('Error eliminando ingreso:', error);
      alert('❌ No se pudo eliminar el ingreso: ' + (error?.message || 'tu rol no tiene permiso.'));
      return;
    }
    setIngresos(prev => prev.filter(i => i.id !== id));
    if (origen) await devolverSolicitudOrigenAPendiente(origen, 'ingreso_generado_id');
  };

  // PRESUPUESTO — CRUD de conceptos recurrentes mensuales y techos anuales por CECO
  // Un solo formulario/handler para Crear y Editar, igual que Deducciones (editingDeduccionId):
  // si editingPresupuestoItemId tiene valor, este mismo botón actualiza ESE concepto en vez de
  // crear uno nuevo. Ojo: "activo" NO se toca acá — sigue siendo la casilla de la tabla, para
  // no reactivar/desactivar un concepto por accidente solo por editar sus demás datos.
  const handleAddPresupuestoItem = async () => {
    if (!newPresupuestoItem.nombre || !newPresupuestoItem.valorMensual) {
      alert('Nombre/Concepto y valor mensual son obligatorios');
      return;
    }
    if (parseFloat(newPresupuestoItem.valorMensual) <= 0) {
      alert('El valor mensual debe ser mayor a cero');
      return;
    }
    if (newPresupuestoItem.formaPago === 'PAB' && newPresupuestoItem.tipo === 'Proveedor / servicio' && !newPresupuestoItem.terceroId) {
      alert('Para pagarlo por PAB elige el Beneficiario (tercero) — a él se le transfiere.');
      return;
    }
    const [empresaId, cecoId] = await Promise.all([resolverEmpresaId(newPresupuestoItem.empresa), resolverCecoId(newPresupuestoItem.ceco)]);
    const payload = {
      empresa_id: empresaId,
      ceco_id: cecoId,
      nombre: newPresupuestoItem.nombre,
      valor_mensual: newPresupuestoItem.valorMensual,
      dia_limite_pago: newPresupuestoItem.diaLimitePago ? parseInt(newPresupuestoItem.diaLimitePago) : null,
      responsable_id: newPresupuestoItem.responsableId || null,
      tipo: newPresupuestoItem.tipo || null,
      forma_pago: newPresupuestoItem.formaPago || null,
      tercero_id: newPresupuestoItem.terceroId || null
    };

    if (editingPresupuestoItemId) {
      const { error } = await supabase.from('presupuesto_items').update(payload).eq('id', editingPresupuestoItemId);
      if (error) {
        console.error('Error actualizando concepto de presupuesto:', error);
        alert('❌ No se pudo actualizar: ' + error.message);
        return;
      }
      alert('✅ Concepto actualizado');
    } else {
      const { error } = await supabase.from('presupuesto_items').insert({ ...payload, activo: true });
      if (error) {
        console.error('Error creando concepto de presupuesto:', error);
        alert('❌ No se pudo guardar: ' + error.message);
        return;
      }
      alert('✅ Concepto creado');
    }
    await cargarPresupuestoItems();
    setEditingPresupuestoItemId(null);
    setNewPresupuestoItem({ empresa: newPresupuestoItem.empresa, ceco: newPresupuestoItem.ceco, nombre: '', valorMensual: '', diaLimitePago: '', activo: true, responsableId: '', tipo: '', formaPago: '', terceroId: '' });
  };

  // Carga el concepto elegido en el formulario de arriba para editarlo (igual que
  // handleEditDeduccion) — el botón "+ Agregar" pasa a decir "Guardar Cambios" mientras tanto.
  const handleEditPresupuestoItem = (item) => {
    setEditingPresupuestoItemId(item.id);
    setNewPresupuestoItem({
      empresa: item.empresa,
      ceco: item.ceco,
      nombre: item.nombre,
      valorMensual: item.valorMensual,
      diaLimitePago: item.diaLimitePago || '',
      activo: item.activo !== false,
      responsableId: item.responsableId || '',
      tipo: item.tipo || '',
      formaPago: item.formaPago || '',
      terceroId: item.terceroId || ''
    });
  };

  const handleCancelEditPresupuestoItem = () => {
    setEditingPresupuestoItemId(null);
    setNewPresupuestoItem({ empresa: newPresupuestoItem.empresa, ceco: newPresupuestoItem.ceco, nombre: '', valorMensual: '', diaLimitePago: '', activo: true, responsableId: '', tipo: '', formaPago: '', terceroId: '' });
  };

  const handleUpdatePresupuestoItem = async (id, campo, valor) => {
    const anteriores = presupuestoItems;
    setPresupuestoItems(presupuestoItems.map(p => p.id === id ? { ...p, [campo]: valor } : p));
    const { error } = await supabase.from('presupuesto_items').update({ [campo]: valor }).eq('id', id);
    if (error) {
      console.error('Error actualizando concepto de presupuesto:', error);
      alert('❌ No se pudo actualizar: ' + error.message);
      setPresupuestoItems(anteriores);
    }
  };

  // El Responsable vive en dos columnas distintas entre el estado local (responsableId) y la
  // fila de Supabase (responsable_id) — a diferencia de "activo", que se llama igual en ambos
  // lados y por eso puede reusar handleUpdatePresupuestoItem tal cual — así que necesita su
  // propio handler para no confundir el nombre de columna al hacer el update.
  const handleUpdatePresupuestoItemResponsable = async (id, responsableId) => {
    const anteriores = presupuestoItems;
    const responsableNombre = personasFinanzas.find(u => u.id === responsableId)?.nombre || '';
    setPresupuestoItems(presupuestoItems.map(p => p.id === id ? { ...p, responsableId, responsableNombre } : p));
    const { error } = await supabase.from('presupuesto_items').update({ responsable_id: responsableId || null }).eq('id', id);
    if (error) {
      console.error('Error actualizando el responsable del concepto de presupuesto:', error);
      alert('❌ No se pudo actualizar el responsable: ' + error.message);
      setPresupuestoItems(anteriores);
    }
  };

  const handleDeletePresupuestoItem = async (id) => {
    if (!window.confirm('¿Eliminar este concepto de presupuesto? Los gastos ya vinculados a él no se borran.')) return;
    const { error } = await supabase.from('presupuesto_items').delete().eq('id', id);
    if (error) {
      console.error('Error eliminando concepto de presupuesto:', error);
      alert('❌ No se pudo eliminar: ' + error.message);
      return;
    }
    setPresupuestoItems(presupuestoItems.filter(p => p.id !== id));
  };

  // PRESUPUESTO -> FINANZAS EN LOTE: mismo espíritu que la Opción C de Solicitudes (Confirmar
  // Pago pide Cuenta + Comprobante y genera el Gasto solo), pero pensado para el día de pago
  // masivo (ej. nómina del 16): se eligen varios conceptos "Pendiente" del mes, se confirma una
  // sola Cuenta y Fecha para todos, y cada uno lleva su propio comprobante (con la opción de
  // aplicar el mismo archivo a todos de una vez si el banco entregó un solo comprobante para
  // todo el lote).

  // Aplica uno o varios comprobantes a TODOS los conceptos seleccionados de una vez — para cuando
  // el banco entrega un solo extracto/comprobante (o un extracto + un soporte adicional) que
  // cubre todo el lote de pagos. Reemplaza lo que cada concepto tuviera cargado individualmente.
  const handleSeleccionarComprobantePresupuestoTodos = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    let pendientes = files.length;
    const archivos = [];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        archivos.push({ id: Date.now() + Math.random(), nombre: file.name, tipo: file.type, data: event.target.result });
        pendientes -= 1;
        if (pendientes === 0) {
          setConfirmarPagoLotePresupuesto(prev => prev ? { ...prev, comprobantes: Object.fromEntries(prev.items.map(it => [it.id, archivos])) } : prev);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // Comprobante(s) de un concepto puntual dentro del lote — se ACUMULAN (ej. factura + soporte
  // de pago), y sobrescriben lo que se haya aplicado a todos si el pago de ESE concepto en
  // particular vino en comprobantes aparte.
  const handleSeleccionarComprobantePresupuestoItem = (itemId, e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const nuevoArchivo = { id: Date.now() + Math.random(), nombre: file.name, tipo: file.type, data: event.target.result };
        setConfirmarPagoLotePresupuesto(prev => prev ? { ...prev, comprobantes: { ...prev.comprobantes, [itemId]: [...(prev.comprobantes[itemId] || []), nuevoArchivo] } } : prev);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleQuitarComprobantePresupuestoItem = (itemId, fileId) => {
    setConfirmarPagoLotePresupuesto(prev => prev ? { ...prev, comprobantes: { ...prev.comprobantes, [itemId]: (prev.comprobantes[itemId] || []).filter(c => c.id !== fileId) } } : prev);
  };

  // Confirma el lote: valida Cuenta/Fecha/comprobantes, y genera un Gasto por cada concepto
  // (releyendo justo antes de insertar si ya quedó pagado ese mes, por si alguien más lo generó
  // mientras el modal estaba abierto — no duplica). Sigue con el resto aunque uno falle, y al
  // final informa cuántos se lograron y cuáles no.
  const handleConfirmarPagoLotePresupuesto = async () => {
    if (!confirmarPagoLotePresupuesto) return;
    const { items, cuenta, fecha, comprobantes } = confirmarPagoLotePresupuesto;
    if (!cuenta) {
      alert('Elige con qué cuenta de la empresa se pagó');
      return;
    }
    if (!fecha) {
      alert('Elige la fecha del pago');
      return;
    }
    const faltantes = items.filter(it => !(comprobantes[it.id] && comprobantes[it.id].length));
    if (faltantes.length > 0) {
      alert('Falta el comprobante de: ' + faltantes.map(f => f.nombre).join(', '));
      return;
    }

    setGuardandoPagoLotePresupuesto(true);
    try {
      const empresaId = await resolverEmpresaId(filtroPresupuesto.empresa);
      const mesStr = `${filtroPresupuesto.anio}-${String(filtroPresupuesto.mes).padStart(2, '0')}`;
      let generados = 0;
      const fallidos = [];

      for (const item of items) {
        try {
          // Releer en vez de confiar en el estado local: evita duplicar si el concepto ya
          // quedó pagado (otra persona, u otra pestaña) mientras este modal seguía abierto.
          const { data: gastosDelConcepto, error: errorLectura } = await supabase
            .from('gastos')
            .select('id, fecha')
            .eq('presupuesto_item_id', item.id);
          if (errorLectura) throw errorLectura;
          if ((gastosDelConcepto || []).some(g => g.fecha && g.fecha.substring(0, 7) === mesStr)) {
            fallidos.push(`${item.nombre} (ya estaba pagado este mes)`);
            continue;
          }

          const cecoId = await resolverCecoId(item.ceco);
          const { data: nuevoGasto, error: errorGasto } = await supabase
            .from('gastos')
            .insert({
              fecha,
              tipo: 'Gasto',
              empresa_id: empresaId,
              responsable_id: item.responsableId || null,
              ceco_id: cecoId,
              cuenta,
              detalle: item.nombre,
              valor: item.netoAPagar,
              valor_bruto: item.valorEsperado,
              deduccion_aplicada: item.totalDeducciones > 0 ? item.totalDeducciones : null,
              estado: 'Pagado',
              observaciones: OBSERVACIONES_GASTO_DESDE_PRESUPUESTO,
              presupuesto_item_id: item.id
            })
            .select('id')
            .single();
          if (errorGasto) throw errorGasto;

          for (const comprobante of comprobantes[item.id]) {
            await subirSoporteEntidad(comprobante, 'gasto', nuevoGasto.id);
          }
          generados++;
        } catch (errorItem) {
          console.error(`Error registrando en Finanzas el concepto "${item.nombre}":`, errorItem);
          fallidos.push(`${item.nombre}: ${errorItem.message || 'error inesperado'}`);
        }
      }

      await cargarGastos();
      setSeleccionPresupuestoPendientes([]);
      setConfirmarPagoLotePresupuesto(null);
      alert(fallidos.length > 0
        ? `✅ ${generados} concepto(s) registrados en Finanzas.\n⚠️ No se pudieron registrar: ${fallidos.join('; ')}`
        : `✅ ${generados} concepto(s) registrados en Finanzas.`);
    } finally {
      setGuardandoPagoLotePresupuesto(false);
    }
  };

  // ============================================================
  // LOTE PAB PAGADO (pantalla 💸 Pagos PAB → ✅): registra en Finanzas cada pago del lote con
  // los MISMOS pasos de siempre — Solicitudes: "Pagado" vía handleChangeEstado (genera su
  // Gasto); Presupuesto: el mismo Gasto que crea "Marcar Pagado". Soportes: Bancolombia da uno
  // por cada pago (ajustes[clave].comprobante); el comprobante general del lote es opcional y, si
  // viene, se sube una vez y se enlaza (mismo bucket_path) a todos los registros.
  // Además:
  //  • rechazados: pagos que el banco no hizo (cuenta errada, etc.) → quedan libres para otro lote.
  //  • ajustes[clave]: CECO, concepto y comprobante individual (opcional) de cada pago.
  //  • costos: comisión bancaria y 4x1000 del lote → un Gasto aparte por cada uno.
  // Es re-ejecutable: lo que ya quedó pagado se salta. El lote solo se cierra si todos sus
  // registros quedaron registrados ("Pagado parcial" si hubo rechazos).
  // ============================================================
  const registrarPagoLotePAB = async (lote, { fechaPago, comprobante, ajustes = {}, rechazados = [], costos = {} }) => {
    const cuenta = lote.config_bancaria_empresa?.nombre_cuenta || '';
    const fallidos = [];
    let registrados = 0;
    let saltados = 0;

    // 0) Rechazos del banco primero: así esos pagos no se registran y quedan libres.
    if (rechazados.length) {
      const { error } = await supabase.rpc('rechazar_items_lote_pago_banco', { p_lote_id: lote.id, p_items: rechazados });
      if (error) throw error;
    }
    const clavesRechazadas = new Set(rechazados.map(r => r.entidad_clave));
    const items = [...(lote.lotes_pago_banco_items || [])]
      .filter(i => i.activo !== false && !clavesRechazadas.has(i.entidad_clave))
      .sort((a, b) => a.orden - b.orden);
    const itemsSolicitud = items.filter(i => i.entidad_tipo === 'solicitud');
    const itemsPresupuesto = items.filter(i => i.entidad_tipo === 'presupuesto');

    // 1) Estado actual (releído) de lo que falta pagar, para no duplicar.
    const { data: solActuales, error: errorSol } = itemsSolicitud.length
      ? await supabase.from('solicitudes').select('id, estado').in('id', itemsSolicitud.map(i => i.entidad_id))
      : { data: [], error: null };
    if (errorSol) throw errorSol;
    const estadoSol = Object.fromEntries((solActuales || []).map(s => [String(s.id), s.estado]));
    const solPendientes = itemsSolicitud.filter(i => estadoSol[String(i.entidad_id)] !== 'Pagado');
    saltados += itemsSolicitud.length - solPendientes.length;

    const presPendientes = [];
    for (const it of itemsPresupuesto) {
      const mesStr = `${it.anio}-${String(it.mes).padStart(2, '0')}`;
      const { data: gastosDelConcepto, error } = await supabase.from('gastos').select('id, fecha').eq('presupuesto_item_id', it.entidad_id);
      if (error) throw error;
      if ((gastosDelConcepto || []).some(g => g.fecha && g.fecha.substring(0, 7) === mesStr)) saltados++;
      else presPendientes.push(it);
    }

    // 2) Comprobante único: se sube una vez y se enlaza a cada registro.
    let rutaComprobante = null;
    const enlazarComprobante = async (entidadTipo, entidadId) => {
      if (!comprobante) return;
      if (!rutaComprobante) {
        rutaComprobante = await subirSoporteEntidad(comprobante, entidadTipo, entidadId);
        if (!rutaComprobante) throw new Error('No se pudo subir el comprobante');
        return;
      }
      const { error } = await supabase.from('soportes').insert({
        bucket_path: rutaComprobante, nombre_original: comprobante.nombre,
        tamano_kb: Math.round(dataUrlToUint8Array(comprobante.data).length / 1024),
        entidad_tipo: entidadTipo, entidad_id: entidadId, subido_por: user.id
      });
      if (error) throw error;
    };
    const subirComprobanteIndividual = async (it, entidadTipo, entidadId) => {
      const archivo = ajustes[it.entidad_clave]?.comprobante;
      if (archivo && !(await subirSoporteEntidad(archivo, entidadTipo, entidadId))) throw new Error('No se pudo subir su comprobante individual');
    };

    // 3) Solicitudes: los comprobantes se enlazan ANTES de pagar para que el Gasto generado los copie.
    for (const it of solPendientes) {
      const solicitud = solicitudes.find(s => String(s.id) === String(it.entidad_id));
      const nombre = it.datos?.nombre || solicitud?.detalle || it.entidad_id;
      const ajuste = ajustes[it.entidad_clave] || {};
      try {
        if (estadoSol[String(it.entidad_id)] !== 'Aprobado') throw new Error(`está en "${estadoSol[String(it.entidad_id)] || 'no encontrada'}", no en Aprobado`);
        if (!solicitud) throw new Error('no está cargada en la app (pulsa 🔄 Actualizar datos)');
        if (!ajuste.ceco) throw new Error('falta el CECO');
        await enlazarComprobante('solicitud', solicitud.id);
        await subirComprobanteIndividual(it, 'solicitud', solicitud.id);
        await handleChangeEstado(solicitud.id, 'Pagado', { cuentaPago: cuenta, cecoCodigo: ajuste.ceco, loteId: lote.id, fechaPago, detalle: ajuste.detalle });
        registrados++;
      } catch (e) {
        console.error('Error pagando solicitud del lote PAB:', it.entidad_id, e);
        fallidos.push(`${nombre}: ${e.message || 'error inesperado'}`);
      }
    }

    // 4) Presupuesto: mismo Gasto que "Marcar Pagado" (presupuesto_item_id + mes).
    const empresaId = await resolverEmpresaId(lote.empresas?.nombre);
    for (const it of presPendientes) {
      const concepto = presupuestoItems.find(p => String(p.id) === String(it.entidad_id));
      const meta = it.datos?.meta || { nombre: concepto?.nombre, ceco: concepto?.ceco, responsableId: concepto?.responsableId };
      const ajuste = ajustes[it.entidad_clave] || {};
      const nombre = meta.nombre || it.datos?.nombre || it.entidad_id;
      try {
        const valor = parseFloat(it.valor) || 0;
        const { data: nuevoGasto, error } = await supabase.from('gastos').insert({
          fecha: fechaPago,
          tipo: 'Gasto',
          empresa_id: empresaId,
          responsable_id: meta.responsableId || null,
          ceco_id: await resolverCecoId(ajuste.ceco || meta.ceco),
          cuenta,
          detalle: (ajuste.detalle || '').trim() || nombre,
          valor,
          valor_bruto: meta.valorBruto || valor,
          deduccion_aplicada: meta.deduccion > 0 ? meta.deduccion : null,
          estado: 'Pagado',
          observaciones: OBSERVACIONES_GASTO_DESDE_PRESUPUESTO,
          presupuesto_item_id: it.entidad_id,
          tercero_id: meta.terceroId || null,
          lote_pago_id: lote.id
        }).select('id').single();
        if (error) throw error;
        await enlazarComprobante('gasto', nuevoGasto.id);
        await subirComprobanteIndividual(it, 'gasto', nuevoGasto.id);
        registrados++;
      } catch (e) {
        console.error('Error registrando concepto del lote PAB:', it.entidad_id, e);
        fallidos.push(`${nombre}: ${e.message || 'error inesperado'}`);
      }
    }

    // 5) Costos bancarios del lote (comisión y 4x1000): un Gasto por cada uno, sin duplicar.
    const costosLote = [
      ['comision', `Comisión bancaria — lote PAB #${lote.numero}`],
      ['gmf', `GMF 4x1000 — lote PAB #${lote.numero}`]
    ].filter(([k]) => (parseFloat(costos[k]) || 0) > 0);
    if (costosLote.length) {
      const { data: yaRegistrados, error } = await supabase.from('gastos').select('detalle').eq('lote_pago_id', lote.id);
      if (error) throw error;
      const cecoCostosId = await resolverCecoId(costos.ceco);
      for (const [k, detalle] of costosLote) {
        if ((yaRegistrados || []).some(g => g.detalle === detalle)) { saltados++; continue; }
        try {
          const { data: gastoCosto, error: errorCosto } = await supabase.from('gastos').insert({
            fecha: fechaPago, tipo: 'Gasto', empresa_id: empresaId, responsable_id: null, ceco_id: cecoCostosId,
            cuenta, detalle, valor: parseFloat(costos[k]), estado: 'Pagado',
            observaciones: `Costo bancario del lote PAB #${lote.numero}.`, lote_pago_id: lote.id
          }).select('id').single();
          if (errorCosto) throw errorCosto;
          await enlazarComprobante('gasto', gastoCosto.id);
          registrados++;
        } catch (e) {
          console.error('Error registrando costo bancario del lote PAB:', k, e);
          fallidos.push(`${detalle}: ${e.message || 'error inesperado'}`);
        }
      }
    }

    await Promise.all([cargarSolicitudes(), cargarGastos()]);

    // 6) Verificación final: todas las solicitudes pagadas deben haber quedado en Pagado.
    if (itemsSolicitud.length) {
      const { data: verif } = await supabase.from('solicitudes').select('id, estado').in('id', itemsSolicitud.map(i => i.entidad_id));
      const noPagadas = (verif || []).filter(s => s.estado !== 'Pagado').length;
      if (noPagadas > 0 && fallidos.length === 0) fallidos.push(`${noPagadas} solicitud(es) no quedaron en Pagado`);
    }
    const cerrado = fallidos.length === 0 ? await cerrarLotePagado(lote) : false;
    return { registrados, saltados, rechazados: rechazados.length, fallidos, cerrado };
  };

  const cerrarLotePagado = async (lote) => {
    const { error } = await supabase.rpc('cerrar_lote_pago_banco', { p_lote_id: lote.id, p_estado: 'Pagado', p_motivo: null });
    if (error) throw error;
    await cargarLotesPago();
    return true;
  };

  // ============================================================
  // PAGO A TERCERO EN LOTE (ej. Caelum manda varias facturas de distintos colaboradores para un
  // solo pago) — UN modal: Empresa/Cuenta/Tercero/CECO una sola vez, una línea por colaborador
  // (Colaborador + Valor + su propia factura), y un comprobante de pago compartido al final.
  // ============================================================

  const nuevaLineaFacturaTercero = () => ({ id: Date.now() + Math.random(), responsable: '', numeroFactura: '', valor: '', retencion: '', factura: null });
  // Valor de la factura (bruto), retención en la fuente y neto realmente pagado de una línea del lote.
  const montosLineaFacturaTercero = (l) => {
    const bruto = parseFloat(l.valor) || 0;
    const retencion = parseFloat(l.retencion) || 0;
    return { bruto, retencion, neto: bruto - retencion };
  };

  const handleAbrirRegistrarFacturasTercero = () => {
    setRegistrarFacturasTercero({
      terceroId: '',
      terceroNombre: '',
      empresa: filtroFinanzasEmpresa !== 'Todas' ? filtroFinanzasEmpresa : (user.empresa || empresas[0] || ''),
      cuenta: '',
      ceco: '',
      lineas: [nuevaLineaFacturaTercero()],
      comprobantesPago: []
    });
  };

  const handleAgregarLineaFacturaTercero = () => {
    setRegistrarFacturasTercero(prev => prev ? { ...prev, lineas: [...prev.lineas, nuevaLineaFacturaTercero()] } : prev);
  };

  const handleQuitarLineaFacturaTercero = (id) => {
    setRegistrarFacturasTercero(prev => prev ? { ...prev, lineas: prev.lineas.filter(l => l.id !== id) } : prev);
  };

  const handleCambiarLineaFacturaTercero = (id, campo, valor) => {
    setRegistrarFacturasTercero(prev => prev ? { ...prev, lineas: prev.lineas.map(l => l.id === id ? { ...l, [campo]: valor } : l) } : prev);
  };

  const handleSeleccionarFacturaLinea = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const factura = { nombre: file.name, tipo: file.type, data: event.target.result };
      setRegistrarFacturasTercero(prev => prev ? { ...prev, lineas: prev.lineas.map(l => l.id === id ? { ...l, factura } : l) } : prev);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Soporte de pago compartido (el recibo único del banco para todo el lote) — se acumula igual
  // que los demás campos de "varios archivos" del sistema, aunque normalmente sea uno solo.
  const handleSeleccionarComprobantePagoTercero = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const nuevo = { id: Date.now() + Math.random(), nombre: file.name, tipo: file.type, data: event.target.result };
        setRegistrarFacturasTercero(prev => prev ? { ...prev, comprobantesPago: [...(prev.comprobantesPago || []), nuevo] } : prev);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleQuitarComprobantePagoTercero = (id) => {
    setRegistrarFacturasTercero(prev => prev ? { ...prev, comprobantesPago: (prev.comprobantesPago || []).filter(c => c.id !== id) } : prev);
  };

  // ===== EDITAR UN PAGO A TERCERO EN LOTE YA REGISTRADO =====
  // Los gastos de un lote se reconocen por lote_pago_id (lotes nuevos) o, en los registrados antes
  // de guardarlo, por la marca en observaciones + mismo tercero, empresa y fecha.
  const terceroDeObservacionesLote = (obs) => (String(obs || '').match(/^Factura de tercero registrada en lote \(([^)]*)\)/) || [])[1] || '';
  const gastosDelLoteTercero = (g) => {
    if (g.lotePagoId) return gastos.filter(x => x.lotePagoId === g.lotePagoId);
    const tercero = terceroDeObservacionesLote(g.observaciones);
    return gastos.filter(x => !x.lotePagoId && (x.observaciones || '').startsWith(OBSERVACIONES_GASTO_LOTE_TERCERO)
      && terceroDeObservacionesLote(x.observaciones) === tercero && x.empresa === g.empresa && x.fecha === g.fecha);
  };

  const handleAbrirEditarLoteTercero = (g) => {
    const miembros = gastosDelLoteTercero(g);
    if (!miembros.length) return;
    const terceroNombre = terceroDeObservacionesLote(g.observaciones);
    setRegistrarFacturasTercero({
      modo: 'editar',
      loteId: g.lotePagoId || '',
      gastoIds: miembros.map(m => m.id),
      fecha: g.fecha,
      terceroId: g.terceroId || '',
      terceroNombre,
      empresa: g.empresa,
      cuenta: g.cuenta || '',
      ceco: g.ceco || '',
      lineas: miembros.map(m => ({
        id: m.id,
        gastoId: m.id,
        responsable: colaboradoresPublico.find(c => c.id === m.responsableId)?.nombre || personasFinanzas.find(p => p.id === m.responsableId)?.nombre || m.responsableNombre || '',
        // N° de factura: lo que va entre "Factura " y el nombre del tercero en el detalle.
        numeroFactura: (String(m.detalle || '').match(new RegExp(`^Factura (.+?) ${terceroNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — `)) || [])[1] || '',
        valor: String(m.valorBruto != null ? m.valorBruto : (m.valor ?? '')),
        retencion: m.deduccionAplicada ? String(m.deduccionAplicada) : '',
        factura: null,
        facturaExistente: true,
      })),
      comprobantesPago: [],
    });
  };

  const handleGuardarEdicionLoteTercero = async () => {
    const lt = registrarFacturasTercero;
    const { terceroId, terceroNombre, empresa, cuenta, ceco, lineas, comprobantesPago, fecha } = lt;
    if (!cuenta) { alert('Elige la Cuenta con la que se pagó'); return; }
    if (!terceroNombre.trim()) { alert('Escribe o elige el Tercero'); return; }
    if (!ceco) { alert('Elige el CECO para estas facturas'); return; }
    const invalidas = lineas.filter(l => !l.responsable || !l.valor || parseFloat(l.valor) <= 0 || (!l.facturaExistente && !l.factura));
    if (invalidas.length > 0) { alert('Cada línea necesita Colaborador, Valor mayor a cero y (si es nueva) su Soporte de Factura'); return; }
    const retencionInvalida = lineas.find(l => { const m = montosLineaFacturaTercero(l); return m.retencion < 0 || m.neto <= 0; });
    if (retencionInvalida) { alert(`La retención de ${retencionInvalida.responsable} no puede ser negativa ni mayor o igual al valor de la factura`); return; }

    setGuardandoFacturasTercero(true);
    try {
      const [empresaId, cecoId] = await Promise.all([resolverEmpresaId(empresa), resolverCecoId(ceco)]);
      const loteId = lt.loteId || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const camposLinea = (linea) => {
        const montos = montosLineaFacturaTercero(linea);
        return {
          responsable_id: personasFinanzas.find(r => r.nombre === linea.responsable)?.id || colaboradoresPublico.find(c => c.nombre === linea.responsable)?.id || null,
          ceco_id: cecoId,
          cuenta,
          detalle: `Factura ${linea.numeroFactura ? `${linea.numeroFactura.trim()} ` : ''}${terceroNombre} — ${linea.responsable}`,
          valor: montos.neto,
          valor_bruto: montos.retencion > 0 ? montos.bruto : null,
          deduccion_aplicada: montos.retencion > 0 ? montos.retencion : null,
          observaciones: `${OBSERVACIONES_GASTO_LOTE_TERCERO} (${terceroNombre})${linea.numeroFactura ? ` — ${linea.numeroFactura.trim()}` : ''}${montos.retencion > 0 ? ` — RTE ${formatMoney(montos.retencion, empresa)}` : ''}.`,
          tercero_id: terceroId || null,
          lote_pago_id: loteId,
        };
      };

      // Comprobante(s) de pago ya compartido(s) por el lote: los archivos que tienen TODOS los
      // gastos existentes (con un solo gasto no se puede distinguir de la factura → no se copia).
      let comprobantesCompartidos = [];
      if ((lt.gastoIds || []).length > 1) {
        const { data: sop } = await supabase.from('soportes').select('entidad_id, bucket_path, nombre_original, tamano_kb').eq('entidad_tipo', 'gasto').in('entidad_id', lt.gastoIds);
        const porRuta = {};
        (sop || []).forEach(r => { (porRuta[r.bucket_path] = porRuta[r.bucket_path] || { ...r, ids: new Set() }).ids.add(r.entidad_id); });
        comprobantesCompartidos = Object.values(porRuta).filter(r => r.ids.size === lt.gastoIds.length);
      }

      const fallidos = [];
      const idsLote = [];
      for (const linea of lineas) {
        try {
          if (linea.gastoId) {
            const { data, error } = await supabase.from('gastos').update(camposLinea(linea)).eq('id', linea.gastoId).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('sin permiso para editar este gasto');
            if (linea.factura) await subirSoporteEntidad(linea.factura, 'gasto', linea.gastoId);
            idsLote.push(linea.gastoId);
          } else {
            const { data: nuevo, error } = await supabase.from('gastos')
              .insert({ fecha, tipo: 'Gasto', empresa_id: empresaId, estado: 'Pagado', ...camposLinea(linea) })
              .select('id').single();
            if (error) throw error;
            await subirSoporteEntidad(linea.factura, 'gasto', nuevo.id);
            for (const rc of comprobantesCompartidos) {
              await supabase.from('soportes').insert({ bucket_path: rc.bucket_path, nombre_original: rc.nombre_original, tamano_kb: rc.tamano_kb, entidad_tipo: 'gasto', entidad_id: nuevo.id, subido_por: user.id });
            }
            idsLote.push(nuevo.id);
          }
        } catch (errorLinea) {
          console.error(`Error guardando la línea de ${linea.responsable}:`, errorLinea);
          fallidos.push(`${linea.responsable || '(sin colaborador)'}: ${errorLinea.message || 'error inesperado'}`);
        }
      }

      // Comprobante(s) nuevo(s) agregado(s) en la edición: se sube una vez y se refleja en todos.
      if (idsLote.length > 0 && (comprobantesPago || []).length > 0) {
        for (const comprobante of comprobantesPago) {
          const ruta = await subirSoporteEntidad(comprobante, 'gasto', idsLote[0]);
          if (!ruta) continue;
          const tamanoKb = Math.round(dataUrlToUint8Array(comprobante.data).length / 1024);
          for (const gastoId of idsLote.slice(1)) {
            await supabase.from('soportes').insert({ bucket_path: ruta, nombre_original: comprobante.nombre, tamano_kb: tamanoKb, entidad_tipo: 'gasto', entidad_id: gastoId, subido_por: user.id });
          }
        }
      }

      await cargarGastos();
      if (fallidos.length === 0) {
        setRegistrarFacturasTercero(null);
        alert(`✅ Lote actualizado: ${idsLote.length} factura(s).`);
      } else {
        alert(`Se guardaron ${idsLote.length} de ${lineas.length}.\n⚠️ No se pudieron guardar: ${fallidos.join('; ')}`);
      }
    } finally {
      setGuardandoFacturasTercero(false);
    }
  };

  // Crea un Gasto YA "Pagado" por cada línea (colaborador + valor + su propia factura), con la
  // misma Cuenta elegida arriba, y refleja el mismo comprobante de pago compartido en todos —
  // se sube UNA sola vez (al primer Gasto creado) y a los demás se les copia la metadata
  // apuntando al mismo bucket_path, sin duplicar el archivo en Storage (mismo patrón que usa
  // generarMovimientoDesdeSolicitud para copiar soportes entre Solicitud y Gasto/Ingreso).
  const handleGuardarFacturasTercero = async () => {
    if (!registrarFacturasTercero) return;
    if (registrarFacturasTercero.modo === 'editar') { await handleGuardarEdicionLoteTercero(); return; }
    const { terceroId, terceroNombre, empresa, cuenta, ceco, lineas, comprobantesPago } = registrarFacturasTercero;
    if (!empresa) { alert('Elige la Empresa'); return; }
    if (!cuenta) { alert('Elige la Cuenta con la que se pagó'); return; }
    if (!terceroNombre.trim()) { alert('Escribe o elige el Tercero que envía las facturas (ej. Caelum)'); return; }
    if (!ceco) { alert('Elige el CECO para estas facturas'); return; }
    const invalidas = lineas.filter(l => !l.responsable || !l.valor || parseFloat(l.valor) <= 0 || !l.factura);
    if (invalidas.length > 0) { alert('Cada línea necesita Colaborador, Valor mayor a cero y su Soporte de Factura'); return; }
    const retencionInvalida = lineas.find(l => { const m = montosLineaFacturaTercero(l); return m.retencion < 0 || m.neto <= 0; });
    if (retencionInvalida) { alert(`La retención de ${retencionInvalida.responsable} no puede ser negativa ni mayor o igual al valor de la factura`); return; }
    if (!comprobantesPago || !comprobantesPago.length) { alert('Adjunta el soporte de pago (el recibo único del banco para todo el lote)'); return; }

    // Este modal registra SOLO un gasto por colaborador — nunca uno por el total. Si ya hay en
    // Finanzas un gasto de esta empresa, de los últimos 45 días, por el total del lote (neto o
    // bruto, ±1 peso), probablemente es ese mismo pago registrado a mano: se avisa antes de duplicarlo.
    const totalNetoLote = lineas.reduce((sum, l) => sum + montosLineaFacturaTercero(l).neto, 0);
    const totalBrutoLote = lineas.reduce((sum, l) => sum + montosLineaFacturaTercero(l).bruto, 0);
    const hace45 = new Date(Date.now() - 45 * 864e5).toISOString().split('T')[0];
    const posibleTotal = gastos.find(g => g.empresa === empresa && g.fecha >= hace45 &&
      [totalNetoLote, totalBrutoLote].some(t => Math.abs((parseFloat(g.valor) || 0) - t) <= 1));
    if (posibleTotal && !window.confirm(`⚠️ Ya existe en Finanzas un gasto del ${posibleTotal.fecha} por ${formatMoney(posibleTotal.valor, empresa)} ("${posibleTotal.detalle}"), igual al total de este lote.\n\nSi es este mismo pago registrado por el total, elimínalo: el lote ya registra cada factura por separado.\n\n¿Registrar el lote de todas formas?`)) return;

    setGuardandoFacturasTercero(true);
    try {
      const fecha = new Date().toISOString().split('T')[0];
      const [empresaId, cecoId] = await Promise.all([resolverEmpresaId(empresa), resolverCecoId(ceco)]);
      const loteId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const idsCreados = [];
      const fallidos = [];
      for (const linea of lineas) {
        try {
          const responsableId = personasFinanzas.find(r => r.nombre === linea.responsable)?.id || null;
          const montos = montosLineaFacturaTercero(linea);
          const { data: nuevoGasto, error: errorGasto } = await supabase
            .from('gastos')
            .insert({
              fecha,
              tipo: 'Gasto',
              empresa_id: empresaId,
              responsable_id: responsableId,
              ceco_id: cecoId,
              cuenta,
              detalle: `Factura ${linea.numeroFactura ? `${linea.numeroFactura.trim()} ` : ''}${terceroNombre} — ${linea.responsable}`,
              // Valor = lo que realmente salió del banco (neto). Si hubo retención, el valor de la
              // factura y la retención quedan en valor_bruto / deduccion_aplicada (mismas columnas
              // que usan las deducciones de Presupuesto; el historial las muestra como "Bruto · −").
              valor: montos.neto,
              ...(montos.retencion > 0 ? { valor_bruto: montos.bruto, deduccion_aplicada: montos.retencion } : {}),
              estado: 'Pagado',
              lote_pago_id: loteId,
              observaciones: `${OBSERVACIONES_GASTO_LOTE_TERCERO} (${terceroNombre})${linea.numeroFactura ? ` — ${linea.numeroFactura.trim()}` : ''}${montos.retencion > 0 ? ` — RTE ${formatMoney(montos.retencion, empresa)}` : ''}.`,
              tercero_id: terceroId || null
            })
            .select('id')
            .single();
          if (errorGasto) throw errorGasto;
          await subirSoporteEntidad(linea.factura, 'gasto', nuevoGasto.id);
          idsCreados.push(nuevoGasto.id);
        } catch (errorLinea) {
          console.error(`Error registrando la factura de ${linea.responsable}:`, errorLinea);
          fallidos.push(`${linea.responsable || '(sin colaborador)'}: ${errorLinea.message || 'error inesperado'}`);
        }
      }

      // El comprobante de pago compartido se sube UNA sola vez (al primer Gasto creado) y se
      // refleja como una fila de metadata más en cada uno de los demás, apuntando al mismo
      // archivo — así "Ver Soportes" de cualquiera de los Gastos del lote lo muestra, sin
      // duplicar el PDF/foto en Storage.
      if (idsCreados.length > 0) {
        const rutasComprobantes = [];
        for (const comprobante of comprobantesPago) {
          const ruta = await subirSoporteEntidad(comprobante, 'gasto', idsCreados[0]);
          if (ruta) {
            rutasComprobantes.push({
              ruta,
              nombre: comprobante.nombre,
              tamanoKb: Math.round(dataUrlToUint8Array(comprobante.data).length / 1024)
            });
          }
        }
        for (const gastoId of idsCreados.slice(1)) {
          for (const rc of rutasComprobantes) {
            const { error: errorSoporte } = await supabase.from('soportes').insert({
              bucket_path: rc.ruta,
              nombre_original: rc.nombre,
              tamano_kb: rc.tamanoKb,
              entidad_tipo: 'gasto',
              entidad_id: gastoId,
              subido_por: user.id
            });
            if (errorSoporte) console.error('Error reflejando el comprobante de pago compartido en un gasto del lote:', errorSoporte);
          }
        }
      }

      await cargarGastos();
      if (fallidos.length === 0) {
        setRegistrarFacturasTercero(null);
        alert(`✅ Se registraron ${idsCreados.length} factura(s) como Pagadas en Finanzas, cada una en la fila de su colaborador, con su factura y el comprobante de pago compartido.`);
      } else {
        alert(`Se registraron ${idsCreados.length} de ${lineas.length}.\n⚠️ No se pudieron registrar: ${fallidos.join('; ')}`);
      }
    } finally {
      setGuardandoFacturasTercero(false);
    }
  };

  const handleAddPresupuestoAnual = async () => {
    if (!newPresupuestoAnual.valorAnual || parseFloat(newPresupuestoAnual.valorAnual) <= 0) {
      alert('El valor anual es obligatorio y debe ser mayor a cero');
      return;
    }
    const [empresaId, cecoId] = await Promise.all([resolverEmpresaId(newPresupuestoAnual.empresa), resolverCecoId(newPresupuestoAnual.ceco)]);
    const existente = presupuestoAnual.find(p => p.empresa === newPresupuestoAnual.empresa && p.ceco === newPresupuestoAnual.ceco && String(p.anio) === String(newPresupuestoAnual.anio));
    let error;
    if (existente) {
      ({ error } = await supabase.from('presupuesto_anual').update({ valor_anual: newPresupuestoAnual.valorAnual }).eq('id', existente.id));
    } else {
      ({ error } = await supabase.from('presupuesto_anual').insert({ empresa_id: empresaId, ceco_id: cecoId, anio: newPresupuestoAnual.anio, valor_anual: newPresupuestoAnual.valorAnual }));
    }
    if (error) {
      console.error('Error guardando techo anual:', error);
      alert('❌ No se pudo guardar: ' + error.message);
      return;
    }
    await cargarPresupuestoAnual();
    setNewPresupuestoAnual({ empresa: newPresupuestoAnual.empresa, ceco: newPresupuestoAnual.ceco, anio: newPresupuestoAnual.anio, valorAnual: '' });
  };

  const handleDeletePresupuestoAnual = async (id) => {
    if (!window.confirm('¿Eliminar este techo anual?')) return;
    const { error } = await supabase.from('presupuesto_anual').delete().eq('id', id);
    if (error) {
      console.error('Error eliminando techo anual:', error);
      alert('❌ No se pudo eliminar: ' + error.message);
      return;
    }
    setPresupuestoAnual(presupuestoAnual.filter(p => p.id !== id));
  };

  // Ajustar el valor esperado de UN concepto para el mes que se está viendo en el filtro (sin tocar
  // el valor base recurrente). Dejar el campo vacío quita el ajuste y vuelve a usar el valor base.
  // Se guarda contra public.presupuesto_overrides, que tiene unique(presupuesto_item_id, anio, mes).
  // Aprueba uno o varios conceptos del mes filtrado guardando el NETO a pagar de hoy. Un upsert
  // por (concepto, año, mes): reaprobar un concepto "desactualizado" reemplaza la aprobación vieja.
  const handleAprobarPresupuesto = async (items) => {
    const bloqueados = items.filter(i => !i.pagado && i.netoAPagar > 0 && !i.requisitoCuentaCobro?.ok);
    const aAprobar = items.filter(i => !i.pagado && i.netoAPagar > 0 && i.requisitoCuentaCobro?.ok !== false);
    if (aAprobar.length === 0) {
      if (bloqueados.length > 0) alert(`No se puede aprobar: ${bloqueados.map(i => `${i.nombre} — ${i.requisitoCuentaCobro.motivo}`).join('\n')}`);
      return;
    }
    const { mes, anio } = filtroPresupuesto;
    if (aAprobar.length > 1) {
      const total = aAprobar.reduce((sum, i) => sum + i.netoAPagar, 0);
      const avisoBloqueados = bloqueados.length > 0
        ? `\n\n⚠️ ${bloqueados.length} de honorarios NO se aprobarán porque su cuenta de cobro del mes no está aprobada:\n${bloqueados.slice(0, 10).map(i => `• ${i.nombre} — ${i.requisitoCuentaCobro.motivo}`).join('\n')}`
        : '';
      if (!window.confirm(`¿Aprobar ${aAprobar.length} concepto(s) de ${MESES_ES[mes - 1]} ${anio} por un neto total de ${formatMoney(total, filtroPresupuesto.empresa)}?${avisoBloqueados}`)) return;
    }
    setGuardandoAprobacionPresupuesto(true);
    try {
      const filas = aAprobar.map(i => ({
        presupuesto_item_id: i.id,
        anio,
        mes,
        valor_neto: i.netoAPagar,
        aprobado_por: user.id,
        aprobado_at: new Date().toISOString()
      }));
      const { data, error } = await supabase
        .from('presupuesto_aprobaciones')
        .upsert(filas, { onConflict: 'presupuesto_item_id,anio,mes' })
        .select('id');
      if (error || !data || data.length !== filas.length) {
        console.error('Error aprobando presupuesto:', error);
        alert('❌ No se pudo aprobar' + (error ? ': ' + error.message : ' (sin permiso)'));
        return;
      }
      await cargarPresupuestoAprobaciones();
    } finally {
      setGuardandoAprobacionPresupuesto(false);
    }
  };

  const handleQuitarAprobacionPresupuesto = async (item) => {
    if (!item.aprobacion) return;
    if (!window.confirm(`¿Quitar la aprobación de "${item.nombre}"? No se podrá exportar al banco hasta aprobarlo de nuevo.`)) return;
    const { data, error } = await supabase.from('presupuesto_aprobaciones').delete().eq('id', item.aprobacion.id).select('id');
    if (error || !data || data.length === 0) {
      alert('❌ No se pudo quitar la aprobación' + (error ? ': ' + error.message : ' (sin permiso)'));
      return;
    }
    await cargarPresupuestoAprobaciones();
  };

  const handleEditarValorMes = async (item) => {
    const { anio, mes } = filtroPresupuesto;
    const actual = getValorEsperado(item.id, anio, mes);
    const input = window.prompt(
      `Valor esperado de "${item.nombre}" para ${mes}/${anio}.\nDeja vacío para volver al valor base (${formatMoney(item.valorMensual, item.empresa)}).`,
      actual
    );
    if (input === null) return; // canceló

    const overrideExistente = presupuestoOverrides.find(o => o.presupuestoItemId === item.id && o.anio === anio && o.mes === mes);

    if (input.trim() === '') {
      if (!overrideExistente) return;
      const { error } = await supabase.from('presupuesto_overrides').delete().eq('id', overrideExistente.id);
      if (error) { console.error('Error quitando ajuste:', error); alert('❌ No se pudo quitar el ajuste: ' + error.message); return; }
      setPresupuestoOverrides(presupuestoOverrides.filter(o => o.id !== overrideExistente.id));
      return;
    }
    const valor = parseFloat(input);
    if (isNaN(valor) || valor <= 0) {
      alert('Valor inválido');
      return;
    }
    if (overrideExistente) {
      const { error } = await supabase.from('presupuesto_overrides').update({ valor }).eq('id', overrideExistente.id);
      if (error) { console.error('Error actualizando ajuste:', error); alert('❌ No se pudo guardar: ' + error.message); return; }
      setPresupuestoOverrides(presupuestoOverrides.map(o => o.id === overrideExistente.id ? { ...o, valor } : o));
    } else {
      const { data, error } = await supabase.from('presupuesto_overrides').insert({ presupuesto_item_id: item.id, anio, mes, valor }).select('id').single();
      if (error) { console.error('Error guardando ajuste:', error); alert('❌ No se pudo guardar: ' + error.message); return; }
      setPresupuestoOverrides([...presupuestoOverrides, { id: data.id, presupuestoItemId: item.id, anio, mes, valor }]);
    }
  };

  // DEDUCCIONES — CRUD. Ligadas a un concepto de presupuesto (presupuestoItemId) para calcular, en la
  // vista Mensual, el Neto a Pagar = valor esperado del mes − deducciones activas ese mes.
  const handleAddDeduccion = async () => {
    if (!newDeduccion.presupuestoItemId) {
      alert('Selecciona a qué concepto (persona) aplica la deducción');
      return;
    }
    if (!newDeduccion.valorCuota || parseFloat(newDeduccion.valorCuota) <= 0) {
      alert('La cuota debe ser mayor a cero');
      return;
    }
    if (newDeduccion.tipo === 'Préstamo' && (!newDeduccion.saldoTotal || parseFloat(newDeduccion.saldoTotal) <= 0)) {
      alert('Ingresa el saldo total del préstamo');
      return;
    }

    const payload = {
      presupuesto_item_id: newDeduccion.presupuestoItemId,
      tipo: newDeduccion.tipo,
      valor_cuota: newDeduccion.valorCuota,
      saldo_total: newDeduccion.tipo === 'Préstamo' ? newDeduccion.saldoTotal : null,
      fecha_inicio: newDeduccion.fechaInicio,
      observaciones: newDeduccion.observaciones || null
    };

    if (editingDeduccionId) {
      const { error } = await supabase.from('deducciones').update(payload).eq('id', editingDeduccionId);
      if (error) { console.error('Error actualizando deducción:', error); alert('❌ No se pudo actualizar: ' + error.message); return; }
      await cargarDeducciones();
      alert('✅ Deducción actualizada');
    } else {
      const { error } = await supabase.from('deducciones').insert({ ...payload, activo: true });
      if (error) { console.error('Error creando deducción:', error); alert('❌ No se pudo guardar: ' + error.message); return; }
      await cargarDeducciones();
      alert('✅ Deducción agregada');
    }
    setEditingDeduccionId(null);
    setNewDeduccion(deduccionVacia);
  };

  const handleEditDeduccion = (d) => {
    setEditingDeduccionId(d.id);
    setNewDeduccion({ presupuestoItemId: d.presupuestoItemId, tipo: d.tipo, valorCuota: d.valorCuota, saldoTotal: d.saldoTotal || '', fechaInicio: d.fechaInicio, observaciones: d.observaciones || '', activo: d.activo !== false });
  };

  const handleCancelEditDeduccion = () => {
    setEditingDeduccionId(null);
    setNewDeduccion(deduccionVacia);
  };

  const handleToggleDeduccionActivo = async (id) => {
    const actual = deducciones.find(d => d.id === id);
    const nuevoActivo = actual ? actual.activo === false : true;
    const anteriores = deducciones;
    setDeducciones(deducciones.map(d => d.id === id ? { ...d, activo: nuevoActivo } : d));
    const { error } = await supabase.from('deducciones').update({ activo: nuevoActivo }).eq('id', id);
    if (error) {
      console.error('Error actualizando deducción:', error);
      alert('❌ No se pudo actualizar: ' + error.message);
      setDeducciones(anteriores);
    }
  };

  const handleDeleteDeduccion = async (id) => {
    if (!window.confirm('¿Eliminar esta deducción?')) return;
    const { error } = await supabase.from('deducciones').delete().eq('id', id);
    if (error) {
      console.error('Error eliminando deducción:', error);
      alert('❌ No se pudo eliminar: ' + error.message);
      return;
    }
    setDeducciones(deducciones.filter(d => d.id !== id));
    if (editingDeduccionId === id) handleCancelEditDeduccion();
  };

  // MANEJO DE SOPORTES (ARCHIVOS)
  const handleAddSoporte = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const nuevoSoporte = {
          id: Date.now() + Math.random(),
          nombre: file.name,
          tipo: file.type,
          tamaño: file.size,
          data: event.target.result
        };
        // Actualización funcional (prev => ...) y no "[...soportesTemp, nuevoSoporte]": al
        // elegir varios archivos a la vez, cada FileReader termina de leer en un momento
        // distinto (son asíncronos), y con la variable soportesTemp de este cierre (el valor
        // que tenía cuando se disparó el evento) cada actualización pisaba a las demás —
        // terminaba quedando solo el último archivo leído en vez de todos. La forma funcional
        // siempre parte del estado más reciente, así que los archivos sí se acumulan todos.
        setSoportesTemp(prev => [...prev, nuevoSoporte]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveSoporte = (id) => {
    setSoportesTemp(soportesTemp.filter(s => s.id !== id));
  };

  // MANEJO DE SOPORTES (ARCHIVOS) — Cuentas de Cobro (reemplaza el link de Drive)
  const handleAddSoporteCuentaCobro = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const nuevoSoporte = {
          id: Date.now() + Math.random(),
          nombre: file.name,
          tipo: file.type,
          tamaño: file.size,
          data: event.target.result
        };
        setSoportesCuentaCobroTemp(prev => [...prev, nuevoSoporte]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveSoporteCuentaCobro = (id) => {
    setSoportesCuentaCobroTemp(soportesCuentaCobroTemp.filter(s => s.id !== id));
  };

  // Trae los soportes de una Cuenta de Cobro ya guardada desde public.soportes y abre el
  // mismo modal "Ver Soportes" que usan Solicitudes/Gastos/Ingresos.
  const handleVerSoportesCuentaCobro = async (c) => {
    const { data, error } = await supabase
      .from('soportes')
      .select('bucket_path, nombre_original, tamano_kb')
      .eq('entidad_tipo', 'cuenta_cobro')
      .eq('entidad_id', c.id)
      .order('created_at');

    if (error) {
      console.error('Error cargando soportes:', error);
      alert('❌ No se pudieron cargar los soportes: ' + error.message);
      return;
    }

    setVerSoportes((data || []).map(r => ({
      nombre: r.nombre_original,
      tamaño: (r.tamano_kb || 0) * 1024,
      bucketPath: r.bucket_path
    })));
  };

  // Botón "🔍" en cada Cuenta de Cobro — vista rápida del soporte que subió el colaborador, sin
  // pasar primero por "📎 Ver soportes". Si solo hay un archivo (el caso normal: un PDF o una
  // foto de la cuenta de cobro), lo previsualiza directo con handlePreviewSoporte. Si hay varios,
  // abre igual el modal "Ver Soportes" (mismo que 📎) para elegir cuál ver.
  const handleVistaRapidaCuentaCobro = async (c) => {
    const { data, error } = await supabase
      .from('soportes')
      .select('bucket_path, nombre_original, tamano_kb')
      .eq('entidad_tipo', 'cuenta_cobro')
      .eq('entidad_id', c.id)
      .order('created_at');

    if (error) {
      console.error('Error cargando soportes:', error);
      alert('❌ No se pudieron cargar los soportes: ' + error.message);
      return;
    }

    const soportes = (data || []).map(r => ({ nombre: r.nombre_original, tamaño: (r.tamano_kb || 0) * 1024, bucketPath: r.bucket_path }));
    if (!soportes.length) {
      alert('Esta cuenta de cobro no tiene soportes cargados.');
      return;
    }
    if (soportes.length === 1) {
      await handlePreviewSoporte(soportes[0]);
      return;
    }
    setVerSoportes(soportes);
  };

  const handleDownloadSoporte = (soporte) => {
    // Soportes de Solicitudes viven en Supabase Storage (bucketPath); los de
    // Gastos/Ingresos siguen embebidos en base64 (soporte.data) por ahora.
    if (soporte.bucketPath) {
      handleDescargarSoporteStorage(soporte);
      return;
    }
    const link = document.createElement('a');
    link.href = soporte.data;
    link.download = soporte.nombre;
    link.click();
  };

  // Determina cómo previsualizar un soporte por su extensión — el nombre del archivo es lo
  // único disponible (no se guarda el mime type en public.soportes), así que se infiere de ahí.
  const inferirTipoPreviewSoporte = (nombre) => {
    const ext = (nombre || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'imagen';
    return 'otro';
  };

  // Abre la vista previa de un soporte (PDF o imagen) SIN descargarlo primero — mismo modal
  // "Ver Soportes" de siempre, ahora con un botón "👁️ Ver" además de "⬇️ Descargar". Los
  // soportes en Storage (bucketPath) se traen como blob y se muestran con un object URL; los
  // antiguos embebidos en base64 (soporte.data) ya son un data URL usable directo.
  const handlePreviewSoporte = async (soporte) => {
    const tipo = inferirTipoPreviewSoporte(soporte.nombre);
    if (tipo === 'otro') {
      alert('No hay vista previa disponible para este tipo de archivo — descárgalo para verlo.');
      return;
    }

    if (!soporte.bucketPath) {
      setPreviewSoporte({ nombre: soporte.nombre, url: soporte.data, tipo, esObjectUrl: false });
      return;
    }

    setCargandoPreviewSoporte(true);
    try {
      const { data, error } = await supabase.storage.from('soportes').download(soporte.bucketPath);
      if (error || !data) {
        console.error('Error cargando vista previa:', error);
        alert('❌ No se pudo cargar la vista previa: ' + (error?.message || ''));
        return;
      }
      const url = URL.createObjectURL(data);
      setPreviewSoporte({ nombre: soporte.nombre, url, tipo, esObjectUrl: true });
    } finally {
      setCargandoPreviewSoporte(false);
    }
  };

  // Cierra la vista previa y libera el object URL si se creó uno (evita fugas de memoria con
  // archivos grandes vistos varias veces seguidas).
  const handleCerrarPreviewSoporte = () => {
    if (previewSoporte?.esObjectUrl) URL.revokeObjectURL(previewSoporte.url);
    setPreviewSoporte(null);
  };

  // IMPORTAR GASTOS DESDE JSON
  // IMPORTAR GASTOS EN LOTE (histórico Drive mes a mes) — cada objeto del JSON usa los mismos campos
  // que el formulario de Gasto (fecha, tipo, empresa, responsable, ceco, cuenta/cuentaSalida/
  // cuentaDestino, detalle, valor, categoria, estado, observaciones) más, opcionalmente,
  // soporteDriveLink para dejar el registro enlazado al soporte histórico en Drive en vez de subirlo
  // a Storage. Cachea las búsquedas de empresa/CECO/responsable para no repetir consultas por fila.
  const handleImportarGastos = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const gastosAImportar = JSON.parse(event.target.result);

        if (!Array.isArray(gastosAImportar)) {
          alert('❌ El archivo no contiene un array válido');
          return;
        }

        const empresaCache = {};
        const cecoCache = {};
        const filasAInsertar = [];

        for (const g of gastosAImportar) {
          if (!(g.empresa in empresaCache)) empresaCache[g.empresa] = await resolverEmpresaId(g.empresa);
          // Traslado ya elige su propio CECO en el formulario (categoría "Traslado"); si el JSON
          // histórico no trae `ceco` para un Traslado, se respalda en el código fijo de siempre.
          const cecoFinal = g.tipo === 'Traslado' ? (g.ceco || CECO_TRASLADO_FIJO) : g.ceco;
          if (cecoFinal && !(cecoFinal in cecoCache)) cecoCache[cecoFinal] = await resolverCecoId(cecoFinal);
          const responsableId = personasFinanzas.find(r => r.nombre === g.responsable)?.id || null;

          filasAInsertar.push({
            fecha: g.fecha,
            tipo: g.tipo || 'Gasto',
            empresa_id: empresaCache[g.empresa] || null,
            responsable_id: responsableId,
            ceco_id: cecoFinal ? (cecoCache[cecoFinal] || null) : null,
            cuenta: g.cuenta || null,
            cuenta_salida: g.cuentaSalida || null,
            cuenta_destino: g.cuentaDestino || null,
            detalle: g.detalle || '',
            valor: g.valor,
            valor_destino: g.valorDestino || null,
            valor_bruto: g.valorBruto || null,
            deduccion_aplicada: g.deduccionAplicada || null,
            categoria: g.categoria || null,
            estado: g.estado || 'Pendiente',
            observaciones: g.observaciones || null,
            presupuesto_item_id: g.presupuestoItemId || null,
            soporte_drive_link: g.soporteDriveLink || null
          });
        }

        const { error } = await supabase.from('gastos').insert(filasAInsertar);
        if (error) {
          console.error('Error importando gastos:', error);
          alert('❌ No se pudieron importar los registros: ' + error.message);
          return;
        }

        await cargarGastos();
        setMostrarImportar(false);
        setArchivoImportacion(null);
        alert(`✅ Se importaron ${filasAInsertar.length} registros exitosamente!`);
      } catch (error) {
        alert('❌ Error al procesar el archivo: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  // Plantilla en blanco para el importador combinado de abajo — mismas columnas que espera
  // handleImportarExcel, con una fila de ejemplo de cada tipo de movimiento. Se la entrega a
  // quien vaya a convertir un extracto bancario (a mano, o pidiéndole a Claude que lo haga) para
  // que sepa exactamente en qué formato dejar el resultado antes de subirlo.
  const handleDescargarPlantillaImportacion = () => {
    const encabezados = ['Movimiento', 'Fecha', 'Empresa', 'Responsable', 'CECO', 'Cuenta', 'Cuenta Salida', 'Cuenta Destino', 'Detalle', 'Valor', 'Valor Destino', 'Categoria', 'Estado', 'Observaciones', 'Soporte (link)'];
    const ejemplos = [
      ['Gasto', '2026-01-15', 'AM SPORTS GROUP SAS', '', '', 'Bancolombia Ahorros', '', '', 'Pago proveedor X', 350000, '', 'Operativo', 'Pendiente', '', 'https://drive.google.com/file/d/EJEMPLO/view'],
      ['Ingreso', '2026-01-16', 'AM SPORTS GROUP SAS', '', '', 'Bancolombia Ahorros', '', '', 'Pago cliente Y', 1200000, '', 'Ventas', 'Pendiente', '', ''],
      ['Traslado', '2026-01-17', 'ARKO', '', '', '', 'Cuenta USD ARKO', 'AM SPORTS GROUP SAS: Bancolombia Ahorros', 'Traslado de fondos', 500, 2000000, '', 'Pendiente', '', '']
    ];
    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...ejemplos]);
    ws['!cols'] = encabezados.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_importar_finanzas.xlsx');
  };

  // Importa Gastos, Ingresos y Traslados desde UN SOLO archivo Excel/CSV — la columna
  // "Movimiento" decide a qué tabla va cada fila. Pensado para el flujo: se lee un extracto
  // bancario (a mano, o pidiéndole a Claude que lo convierta) y el resultado se sube aquí tal
  // cual, ya en las columnas de handleDescargarPlantillaImportacion. El importador JSON de
  // arriba (handleImportarGastos) sigue funcionando aparte, para quien ya tenga archivos en ese
  // formato de una migración anterior.
  // Valida TODO el archivo antes de insertar cualquier fila — si algo no cuadra, no se guarda
  // nada (para no dejar la contabilidad a medias) y se muestra la lista completa de errores.
  const handleImportarExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const wb = XLSX.read(event.target.result, { type: 'array', cellDates: true });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

        if (filas.length === 0) {
          alert('❌ El archivo no tiene filas de datos.');
          return;
        }

        const formatearFecha = (valor) => {
          if (valor instanceof Date) return valor.toISOString().split('T')[0];
          return String(valor || '').trim();
        };

        const errores = [];
        const filasValidas = filas.map((fila, idx) => {
          const numFila = idx + 2; // +2: la fila 1 de Excel es el encabezado
          const movimiento = String(fila['Movimiento'] || '').trim();
          const movimientoNorm = movimiento.charAt(0).toUpperCase() + movimiento.slice(1).toLowerCase();
          const fecha = formatearFecha(fila['Fecha']);
          const empresa = String(fila['Empresa'] || '').trim();
          const valor = parseFloat(fila['Valor']);

          if (!['Gasto', 'Ingreso', 'Traslado'].includes(movimientoNorm)) {
            errores.push(`Fila ${numFila}: "Movimiento" debe ser Gasto, Ingreso o Traslado (llegó "${movimiento}")`);
          }
          if (!fecha) errores.push(`Fila ${numFila}: falta la Fecha`);
          if (!empresa || !empresas.includes(empresa)) {
            errores.push(`Fila ${numFila}: "Empresa" no coincide con ninguna empresa de la holding (llegó "${empresa}")`);
          }
          if (!fila['Valor'] || isNaN(valor) || valor <= 0) {
            errores.push(`Fila ${numFila}: "Valor" debe ser un número mayor a cero`);
          }
          if (movimientoNorm === 'Traslado' && !String(fila['Cuenta Salida'] || '').trim()) {
            errores.push(`Fila ${numFila}: un Traslado necesita "Cuenta Salida"`);
          }
          if (movimientoNorm === 'Traslado' && !String(fila['Cuenta Destino'] || '').trim()) {
            errores.push(`Fila ${numFila}: un Traslado necesita "Cuenta Destino"`);
          }
          if (movimientoNorm !== 'Traslado' && !String(fila['Cuenta'] || '').trim()) {
            errores.push(`Fila ${numFila}: falta "Cuenta"`);
          }

          const responsableNombre = String(fila['Responsable'] || '').trim();
          if (responsableNombre && !personasFinanzas.some(r => r.nombre === responsableNombre)) {
            errores.push(`Fila ${numFila}: el Responsable "${responsableNombre}" no existe en el sistema — déjalo vacío o corrige el nombre exacto`);
          }
          // Soporte histórico que vive en Drive: se guarda el link tal cual (el botón 📎 del
          // historial lo abre). Solo https — cualquier otra cosa (p. ej. "javascript:") se
          // rechaza, porque ese valor termina en un window.open.
          const soporteLink = String(fila['Soporte (link)'] || '').trim();
          if (soporteLink && !/^https:\/\/\S+$/i.test(soporteLink)) {
            errores.push(`Fila ${numFila}: "Soporte (link)" debe ser un link que empiece por https:// (llegó "${soporteLink.slice(0, 60)}")`);
          }
          const cecoCodigo = String(fila['CECO'] || '').trim();
          if (cecoCodigo && !cecosDB.some(c => c.codigo === cecoCodigo)) {
            errores.push(`Fila ${numFila}: el CECO "${cecoCodigo}" no existe en el catálogo — déjalo vacío o corrige el código exacto`);
          }

          return {
            numFila, movimiento: movimientoNorm, fecha, empresa, responsableNombre, cecoCodigo,
            cuenta: String(fila['Cuenta'] || '').trim() || null,
            cuentaSalida: String(fila['Cuenta Salida'] || '').trim() || null,
            cuentaDestino: String(fila['Cuenta Destino'] || '').trim() || null,
            detalle: String(fila['Detalle'] || '').trim(),
            valor,
            valorDestino: fila['Valor Destino'] ? parseFloat(fila['Valor Destino']) : null,
            categoria: String(fila['Categoria'] || '').trim() || null,
            estado: String(fila['Estado'] || '').trim() || 'Pendiente',
            observaciones: String(fila['Observaciones'] || '').trim() || null,
            soporteLink: soporteLink || null
          };
        });

        if (errores.length > 0) {
          alert(`❌ No se importó nada — corrige estos ${errores.length} problema(s) en el archivo y vuelve a intentar:\n\n${errores.slice(0, 25).join('\n')}${errores.length > 25 ? `\n… y ${errores.length - 25} más.` : ''}`);
          return;
        }

        // Todas las filas son válidas: recién ahora se resuelven los ids de Supabase y se
        // separan por tabla destino (mismo patrón de caché que handleImportarGastos, para no
        // repetir la misma consulta de empresa/CECO fila tras fila).
        const empresaCache = {};
        const cecoCache = {};
        const filasGastos = [];
        const filasIngresos = [];

        for (const f of filasValidas) {
          if (!(f.empresa in empresaCache)) empresaCache[f.empresa] = await resolverEmpresaId(f.empresa);
          const cecoFinal = f.movimiento === 'Traslado' ? (f.cecoCodigo || CECO_TRASLADO_FIJO) : f.cecoCodigo;
          if (cecoFinal && !(cecoFinal in cecoCache)) cecoCache[cecoFinal] = await resolverCecoId(cecoFinal);
          const responsableId = f.responsableNombre ? (personasFinanzas.find(r => r.nombre === f.responsableNombre)?.id || null) : null;
          const empresaId = empresaCache[f.empresa] || null;
          const cecoId = cecoFinal ? (cecoCache[cecoFinal] || null) : null;

          if (f.movimiento === 'Ingreso') {
            filasIngresos.push({
              fecha: f.fecha, tipo: 'Ingreso', empresa_id: empresaId, responsable_id: responsableId,
              ceco_id: cecoId, cuenta: f.cuenta, detalle: f.detalle, valor: f.valor,
              categoria: f.categoria, estado: f.estado, observaciones: f.observaciones,
              soporte_drive_link: f.soporteLink
            });
          } else {
            filasGastos.push({
              fecha: f.fecha, tipo: f.movimiento, empresa_id: empresaId, responsable_id: responsableId,
              ceco_id: cecoId, cuenta: f.cuenta, cuenta_salida: f.cuentaSalida, cuenta_destino: f.cuentaDestino,
              detalle: f.detalle, valor: f.valor, valor_destino: f.valorDestino, valor_bruto: null,
              deduccion_aplicada: null, categoria: f.categoria, estado: f.estado,
              observaciones: f.observaciones, presupuesto_item_id: null, soporte_drive_link: f.soporteLink
            });
          }
        }

        // Anti-duplicados: si una fila ya existe en la BD (misma fecha, empresa, tipo, valor y
        // detalle) casi seguro es el mismo archivo importado dos veces. No se bloquea del todo
        // — dos cobros iguales el mismo día pueden ser reales — pero se avisa y hay que confirmar.
        const claveMovimiento = (r) => [r.fecha, r.empresa_id, r.tipo, Number(r.valor), String(r.detalle || '').trim().toUpperCase()].join('|');
        const fechasImportadas = filasValidas.map(f => f.fecha).sort();
        const buscarExistentes = async (tabla) => {
          const { data, error } = await supabase
            .from(tabla)
            .select('fecha, empresa_id, tipo, valor, detalle')
            .gte('fecha', fechasImportadas[0])
            .lte('fecha', fechasImportadas[fechasImportadas.length - 1]);
          if (error) throw new Error(`No se pudo revisar duplicados en ${tabla}: ${error.message}`);
          return new Set((data || []).map(claveMovimiento));
        };
        const [existentesGastos, existentesIngresos] = await Promise.all([
          filasGastos.length > 0 ? buscarExistentes('gastos') : new Set(),
          filasIngresos.length > 0 ? buscarExistentes('ingresos') : new Set()
        ]);
        const repetidas = [
          ...filasGastos.filter(r => existentesGastos.has(claveMovimiento(r))),
          ...filasIngresos.filter(r => existentesIngresos.has(claveMovimiento(r)))
        ];
        if (repetidas.length > 0) {
          const lista = repetidas.slice(0, 15).map(r => `• ${r.fecha} · ${r.tipo} · ${r.detalle} · ${Number(r.valor).toLocaleString('es-CO')}`).join('\n');
          const seguir = window.confirm(
            `⚠️ ${repetidas.length} fila(s) de este archivo YA EXISTEN en Finanzas (misma fecha, empresa, tipo, valor y detalle) — probablemente este archivo ya se importó:\n\n${lista}${repetidas.length > 15 ? `\n… y ${repetidas.length - 15} más.` : ''}\n\nAceptar = importar TODO de todos modos (quedarán duplicadas).\nCancelar = no importar nada.`
          );
          if (!seguir) return;
        }

        if (filasGastos.length > 0) {
          const { error } = await supabase.from('gastos').insert(filasGastos);
          if (error) {
            console.error('Error importando gastos/traslados desde Excel:', error);
            alert('❌ No se pudieron importar los Gastos/Traslados: ' + error.message);
            return;
          }
        }
        if (filasIngresos.length > 0) {
          const { error } = await supabase.from('ingresos').insert(filasIngresos);
          if (error) {
            console.error('Error importando ingresos desde Excel:', error);
            alert('❌ No se pudieron importar los Ingresos: ' + error.message);
            return;
          }
        }

        await Promise.all([cargarGastos(), cargarIngresos()]);
        setMostrarImportar(false);
        alert(`✅ Importados ${filasGastos.length} Gasto(s)/Traslado(s) y ${filasIngresos.length} Ingreso(s).`);
      } catch (error) {
        console.error('Error procesando el Excel:', error);
        alert('❌ Error al procesar el archivo: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleViewSoportes = (soportes) => {
    setVerSoportes(soportes);
  };

  // Ver soportes de un Gasto/Ingreso: si es un registro histórico con link de Drive, se abre
  // directamente esa URL; si tiene soportes reales subidos a Storage, se abre el modal compartido.
  const handleVerSoportesGasto = async (g) => {
    if (g.soporteDriveLink) { window.open(g.soporteDriveLink, '_blank'); return; }
    const { data, error } = await supabase
      .from('soportes')
      .select('id, bucket_path, nombre_original, tamano_kb')
      .eq('entidad_tipo', 'gasto')
      .eq('entidad_id', g.id)
      .order('created_at');
    if (error) { console.error('Error cargando soportes:', error); alert('❌ No se pudieron cargar los soportes: ' + error.message); return; }
    setVerSoportesContexto({ entidadTipo: 'gasto', entidadId: g.id, puedeEliminar: user?.rol === 'Administrador' || user?.rol === 'Coordinadora Administrativa' });
    setVerSoportes((data || []).map(r => ({ id: r.id, nombre: r.nombre_original, tamaño: (r.tamano_kb || 0) * 1024, bucketPath: r.bucket_path })));
  };

  const handleVerSoportesIngreso = async (i) => {
    if (i.soporteDriveLink) { window.open(i.soporteDriveLink, '_blank'); return; }
    const { data, error } = await supabase
      .from('soportes')
      .select('id, bucket_path, nombre_original, tamano_kb')
      .eq('entidad_tipo', 'ingreso')
      .eq('entidad_id', i.id)
      .order('created_at');
    if (error) { console.error('Error cargando soportes:', error); alert('❌ No se pudieron cargar los soportes: ' + error.message); return; }
    setVerSoportesContexto({ entidadTipo: 'ingreso', entidadId: i.id, puedeEliminar: user?.rol === 'Administrador' || user?.rol === 'Coordinadora Administrativa' });
    setVerSoportes((data || []).map(r => ({ id: r.id, nombre: r.nombre_original, tamaño: (r.tamano_kb || 0) * 1024, bucketPath: r.bucket_path })));
  };

  // Filtrar gastos e ingresos
  const gastosUsuario = user?.rol === 'Responsable' 
    ? gastos.filter(g => g.responsableNombre === user.nombre)
    : gastos;

  const ingresosUsuario = user?.rol === 'Responsable'
    ? ingresos.filter(i => i.responsableNombre === user.nombre)
    : ingresos;

  // Historial unificado de Finanzas: Gastos, Traslados (ambos viven en la tabla "gastos",
  // por eso ya vienen juntos en gastosUsuario) e Ingresos, todos en una sola lista ordenada
  // por fecha. `filtroTipoFinanzas` ('Todos' | 'Gasto' | 'Traslado' | 'Ingreso') permite
  // aislar un tipo cuando se necesita, sin perder la vista conjunta por defecto.
  // Un Traslado es UN SOLO registro en la base de datos (cuentaSalida/cuentaDestino), pero en
  // el historial se muestra como DOS líneas con la misma fecha: la salida de la cuenta/empresa
  // de origen y la entrada a la cuenta/empresa de destino — así se lee como un movimiento real
  // entre dos cuentas, no como una sola fila ambigua. `cuentaDestino` viene en formato
  // "EMPRESA: CUENTA" cuando el destino es de otra empresa (así se arma en el desplegable del
  // formulario); si no trae ese formato, se asume la misma empresa de origen.
  const registrosFinanzasTodos = [
    ...gastosUsuario.flatMap(g => {
      if (g.tipo !== 'Traslado') return [{ ...g, _origen: 'gasto' }];
      const [empresaDestino, cuentaDestinoNombre] = g.cuentaDestino && g.cuentaDestino.includes(': ')
        ? g.cuentaDestino.split(': ')
        : [g.empresa, g.cuentaDestino];
      // Cuando el traslado cruza de moneda (hoy en la práctica: ARKO en USD hacia/desde el
      // resto de la holding en COP), el valor que entra a la cuenta destino (valorDestino, en
      // la moneda del destino) es distinto del que sale (valor, en la moneda de origen) — el
      // lado "entrada" debe mostrar valorDestino, no el mismo número reetiquetado. Si el
      // traslado es entre cuentas de la misma moneda (o es un registro histórico sin
      // valorDestino), se usa el mismo valor de siempre.
      const valorEntrada = (g.valorDestino !== null && g.valorDestino !== undefined && g.valorDestino !== '')
        ? g.valorDestino
        : g.valor;
      return [
        { ...g, _origen: 'gasto', _ladoTraslado: 'salida', empresa: g.empresa, cuenta: g.cuentaSalida },
        { ...g, _origen: 'gasto', _ladoTraslado: 'entrada', empresa: empresaDestino, cuenta: cuentaDestinoNombre, valor: valorEntrada },
      ];
    }),
    ...ingresosUsuario.map(i => ({ ...i, tipo: 'Ingreso', _origen: 'ingreso' })),
  // Del más reciente CREADO al más antiguo (fecha y hora de creación); los registros viejos sin
  // created_at quedan al final, ordenados por fecha del movimiento.
  ].sort((a, b) => (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) || (new Date(b.fecha) - new Date(a.fecha)) || ((b.id || 0) - (a.id || 0)));

  // "1.500.000" / "1500000" / "70,88" → número (formato colombiano: punto de miles, coma
  // decimal). Vacío o inválido → null (= sin límite).
  const parseValorFiltro = (texto) => {
    const limpio = String(texto || '').replace(/[^\d,]/g, '').replace(',', '.');
    if (!limpio) return null;
    const n = parseFloat(limpio);
    return isNaN(n) ? null : n;
  };
  const valorMinFinanzas = parseValorFiltro(filtroFinanzasValorMin);
  const valorMaxFinanzas = parseValorFiltro(filtroFinanzasValorMax);

  const registrosFinanzas = registrosFinanzasTodos.filter(r => {
    // El filtro "🤝 Pago a Tercero" también debe traer los Gastos normales que quedaron con
    // datos de tercero adjuntos (Tipo "Gasto" + CECO "Pago a Terceros", ver esPagoTerceroFinanzas
    // en el formulario) — su columna tipo en la base de datos sigue siendo 'Gasto', así que
    // compararlos solo por tipo los dejaba invisibles al filtrar por "Pago a Tercero".
    if (filtroTipoFinanzas === 'Pago a Tercero') {
      if (r.tipo !== 'Pago a Tercero' && !r.terceroInfo) return false;
    } else if (filtroTipoFinanzas !== 'Todos' && r.tipo !== filtroTipoFinanzas) {
      return false;
    }
    if (filtroFinanzasEmpresa !== 'Todas' && r.empresa !== filtroFinanzasEmpresa) return false;
    if (filtroFinanzasCeco !== 'Todos' && r.ceco !== filtroFinanzasCeco) return false;
    if (filtroFinanzasFechaInicio && r.fecha < filtroFinanzasFechaInicio) return false;
    if (filtroFinanzasFechaFin && r.fecha > filtroFinanzasFechaFin) return false;
    // Se compara contra el valor que muestra la fila (en un Traslado, el lado "entrada" usa
    // el valor destino), en la moneda de esa fila.
    const valorFila = parseFloat(r.valor) || 0;
    if (valorMinFinanzas !== null && valorFila < valorMinFinanzas) return false;
    if (valorMaxFinanzas !== null && valorFila > valorMaxFinanzas) return false;
    if (busquedaFinanzas.trim()) {
      const q = busquedaFinanzas.trim().toLowerCase();
      // El nombre del colaborador se busca también por colaboradores_publico, no solo por
      // r.responsableNombre — ese último viene vacío para Contadora/Gerente en filas que no
      // son propias (ver nota junto al <td> de Colaborador más abajo).
      const nombreColaborador = colaboradoresPublico.find(c => c.id === r.responsableId)?.nombre || r.responsableNombre;
      const campos = [r.detalle, nombreColaborador, r.empresa, r.ceco, r.cuenta, r.observaciones].filter(Boolean).join(' ').toLowerCase();
      if (!campos.includes(q)) return false;
    }
    return true;
  });

  // ============================================================
  // INFORME DE FINANZAS (PDF con vista previa) — construido a partir del filtro actualmente
  // aplicado al Historial (`registrosFinanzas`). Una sola función arma TODOS los datos y
  // gráficas, y la usan tanto "Ver Informe" (vista previa en pantalla) como la descarga del
  // PDF — así nunca pueden mostrar cosas distintas entre sí.
  // ============================================================
  const LIMITE_FILAS_TABLA_INFORME = 150;
  const COLOR_INGRESO_INFORME = '#2F9E52';
  const COLOR_GASTO_INFORME = '#CC4B4B';
  const COLORES_CATEGORIA_INFORME = ['#C4A747', '#6C63D1', '#3B72D9', '#2F9E52', '#CC4B4B', '#8F8877', '#D4A5A5', '#7FB3B0'];

  // Dibuja una gráfica de barras (una o más series) sobre un <canvas> creado en memoria — sin
  // depender de ninguna librería de gráficas — y devuelve el PNG como data URL, listo para
  // mostrarse en la vista previa (<img>) o insertarse en el PDF (doc.addImage).
  const dibujarGraficaBarras = (labels, series, opciones = {}) => {
    const ancho = opciones.ancho || 700;
    const alto = opciones.alto || 320;
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, ancho, alto);

    const margenIzq = 85, margenDer = 20, margenSup = 34, margenInf = 50;
    const areaAncho = ancho - margenIzq - margenDer;
    const areaAlto = alto - margenSup - margenInf;
    const formatoValor = opciones.formatoValor || ((v) => Math.round(v).toLocaleString('es-CO'));

    const todosValores = series.flatMap(s => s.valores);
    const maxValor = Math.max(...todosValores, 1);

    ctx.strokeStyle = '#E6E0D2';
    ctx.fillStyle = '#8F8877';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    const pasos = 4;
    for (let i = 0; i <= pasos; i++) {
      const yLinea = margenSup + areaAlto - (areaAlto * i / pasos);
      const valor = maxValor * i / pasos;
      ctx.beginPath();
      ctx.moveTo(margenIzq, yLinea);
      ctx.lineTo(ancho - margenDer, yLinea);
      ctx.stroke();
      ctx.fillText(formatoValor(valor), margenIzq - 8, yLinea + 4);
    }

    if (labels.length === 0) {
      ctx.fillStyle = '#AFA897';
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos para este filtro', ancho / 2, alto / 2);
      return canvas.toDataURL('image/png');
    }

    const grupoAncho = areaAncho / labels.length;
    const numSeries = series.length;
    const barraAncho = Math.max((grupoAncho * 0.55) / numSeries, 4);
    labels.forEach((label, i) => {
      const xGrupo = margenIzq + i * grupoAncho + grupoAncho * 0.22;
      series.forEach((s, si) => {
        const valor = s.valores[i] || 0;
        const h = (valor / maxValor) * areaAlto;
        const x = xGrupo + si * (barraAncho + 3);
        const yBarra = margenSup + areaAlto - h;
        ctx.fillStyle = s.color;
        ctx.fillRect(x, yBarra, barraAncho, h);
      });
      ctx.fillStyle = '#332D1E';
      ctx.textAlign = 'center';
      ctx.font = '10px Arial';
      const xEtiqueta = margenIzq + i * grupoAncho + grupoAncho / 2;
      ctx.fillText(label.length > 14 ? label.substring(0, 13) + '…' : label, xEtiqueta, alto - margenInf + 16);
    });

    let xLeyenda = margenIzq;
    series.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.fillRect(xLeyenda, 8, 10, 10);
      ctx.fillStyle = '#332D1E';
      ctx.textAlign = 'left';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(s.nombre, xLeyenda + 14, 17);
      xLeyenda += ctx.measureText(s.nombre).width + 40;
    });

    return canvas.toDataURL('image/png');
  };

  // Gráfica de torta (distribución) — mismo principio, sin librería externa.
  const dibujarGraficaTorta = (datosTorta, opciones = {}) => {
    const size = opciones.size || 260;
    const anchoLeyenda = 210;
    const canvas = document.createElement('canvas');
    canvas.width = size + anchoLeyenda;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const total = datosTorta.reduce((sum, d) => sum + d.valor, 0) || 1;
    const cx = size / 2, cy = size / 2, r = size / 2 - 16;
    let anguloInicial = -Math.PI / 2;
    datosTorta.forEach(d => {
      const porcion = d.valor / total;
      const anguloFinal = anguloInicial + porcion * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, anguloInicial, anguloFinal);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      anguloInicial = anguloFinal;
    });

    let yLeyenda = 16;
    datosTorta.forEach(d => {
      ctx.fillStyle = d.color;
      ctx.fillRect(size + 16, yLeyenda, 10, 10);
      ctx.fillStyle = '#332D1E';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      const pct = ((d.valor / total) * 100).toFixed(1);
      const nombreCorto = d.nombre.length > 20 ? d.nombre.substring(0, 19) + '…' : d.nombre;
      ctx.fillText(`${nombreCorto} (${pct}%)`, size + 32, yLeyenda + 9);
      yLeyenda += 20;
    });

    return canvas.toDataURL('image/png');
  };

  // Arma el resumen, las gráficas (como datos, no imágenes todavía) y la tabla del Informe —
  // todo a partir de `registrosFinanzas` (el filtro que se está viendo en pantalla ahora mismo).
  const construirDatosInformeFinanzas = () => {
    const datos = registrosFinanzas;
    // Mismos criterios que el Dashboard Financiero: cada movimiento se agrupa en la moneda de SU
    // EMPRESA (las de COP pagan en COP; ARKO en USD — la única excepción, FOR SEVEN en USD pagado en
    // COP, queda como Gasto Neutro en COP). Los Pagos a Tercero sí cuentan como gasto y no suman
    // los Gastos Neutros ni lo que sigue Pendiente (aún no pagado/recibido).
    const monedaR = (r) => getMoneda(r.empresa);
    const esGastoInforme = (r) => r._origen === 'gasto' && r.tipo !== 'Traslado' && !r.neutro && r.estado !== 'Pendiente';
    const esIngresoInforme = (r) => r.tipo === 'Ingreso' && r.estado !== 'Pendiente';
    const monedasPresentes = [...new Set(datos.map(monedaR))].sort();

    const filtrosTexto = [
      (filtroFinanzasFechaInicio || filtroFinanzasFechaFin) ? `Fecha: ${filtroFinanzasFechaInicio || '…'} a ${filtroFinanzasFechaFin || '…'}` : 'Fecha: histórico completo',
      `Empresa: ${filtroFinanzasEmpresa}`,
      `CECO: ${filtroFinanzasCeco}`,
      `Tipo: ${filtroTipoFinanzas}`,
      ...((valorMinFinanzas !== null || valorMaxFinanzas !== null) ? [`Valor: ${valorMinFinanzas !== null ? valorMinFinanzas.toLocaleString('es-CO') : '…'} a ${valorMaxFinanzas !== null ? valorMaxFinanzas.toLocaleString('es-CO') : '…'}`] : []),
      ...(busquedaFinanzas.trim() ? [`Búsqueda: "${busquedaFinanzas.trim()}"`] : [])
    ];

    const etiquetaMes = (m) => {
      const [anio, mesNum] = m.split('-');
      const nombreMes = MESES_ES[parseInt(mesNum, 10) - 1] || mesNum;
      return `${nombreMes.substring(0, 3)} ${anio}`;
    };

    const porMoneda = monedasPresentes.map(moneda => {
      const filas = datos.filter(r => monedaR(r) === moneda);
      const ingresos = filas.filter(esIngresoInforme).reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
      const gastos = filas.filter(esGastoInforme).reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
      const trasladoSalida = filas.filter(r => r.tipo === 'Traslado' && r._ladoTraslado === 'salida').reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
      // Cada Traslado aparece como 2 filas (salida/entrada) en registrosFinanzas — se cuenta una
      // sola vez por su id real, para no duplicar el conteo de movimientos.
      const idsTrasladoUnicos = new Set(filas.filter(r => r.tipo === 'Traslado').map(r => r.id));
      const cantidadMovimientos = filas.filter(r => r.tipo !== 'Traslado').length + idsTrasladoUnicos.size;

      const meses = {};
      filas.forEach(r => {
        if (r.tipo === 'Traslado') return;
        const mes = (r.fecha || '').substring(0, 7);
        if (!mes) return;
        if (!meses[mes]) meses[mes] = { ingresos: 0, gastos: 0 };
        if (esIngresoInforme(r)) meses[mes].ingresos += parseFloat(r.valor) || 0;
        if (esGastoInforme(r)) meses[mes].gastos += parseFloat(r.valor) || 0;
      });
      const mesesOrdenados = Object.keys(meses).sort();
      const graficaMensual = {
        labels: mesesOrdenados.map(etiquetaMes),
        series: [
          { nombre: 'Ingresos', color: COLOR_INGRESO_INFORME, valores: mesesOrdenados.map(m => meses[m].ingresos) },
          { nombre: 'Gastos', color: COLOR_GASTO_INFORME, valores: mesesOrdenados.map(m => meses[m].gastos) },
        ]
      };

      const empresasMoneda = empresas.filter(e => filas.some(r => r.empresa === e));
      const graficaEmpresa = {
        labels: empresasMoneda,
        series: [
          { nombre: 'Ingresos', color: COLOR_INGRESO_INFORME, valores: empresasMoneda.map(e => filas.filter(r => r.empresa === e && esIngresoInforme(r)).reduce((s, r) => s + (parseFloat(r.valor) || 0), 0)) },
          { nombre: 'Gastos', color: COLOR_GASTO_INFORME, valores: empresasMoneda.map(e => filas.filter(r => r.empresa === e && esGastoInforme(r)).reduce((s, r) => s + (parseFloat(r.valor) || 0), 0)) },
        ]
      };

      const categoriasMap = {};
      filas.filter(esGastoInforme).forEach(r => {
        const clave = r.categoria || r.ceco || 'Sin categoría';
        categoriasMap[clave] = (categoriasMap[clave] || 0) + (parseFloat(r.valor) || 0);
      });
      const categoriasOrdenadas = Object.entries(categoriasMap).sort((a, b) => b[1] - a[1]);
      const topCategorias = categoriasOrdenadas.slice(0, 6);
      const restoValor = categoriasOrdenadas.slice(6).reduce((s, [, v]) => s + v, 0);
      const distribucionCategoria = [
        ...topCategorias.map(([nombre, valor], i) => ({ nombre, valor, color: COLORES_CATEGORIA_INFORME[i % COLORES_CATEGORIA_INFORME.length] })),
        ...(restoValor > 0 ? [{ nombre: 'Otros', valor: restoValor, color: '#AFA897' }] : [])
      ];

      return { moneda, ingresos, gastos, neto: ingresos - gastos, trasladoSalida, cantidadTraslados: idsTrasladoUnicos.size, cantidadMovimientos, graficaMensual, graficaEmpresa, distribucionCategoria };
    });

    const truncado = datos.length > LIMITE_FILAS_TABLA_INFORME;
    const filasTabla = (truncado ? datos.slice(0, LIMITE_FILAS_TABLA_INFORME) : datos).map(r => ({
      fecha: r.fecha,
      tipo: r._ladoTraslado ? `Traslado (${r._ladoTraslado})` : r.tipo,
      colaborador: colaboradoresPublico.find(c => c.id === r.responsableId)?.nombre || r.responsableNombre || '—',
      empresa: r.empresa,
      cecoCuenta: r.ceco || r.cuenta || '—',
      detalle: r.detalle || '—',
      valorTexto: formatMoneyByMoneda(r.valor, r.moneda || getMoneda(r.empresa))
    }));

    return {
      generadoPor: user.nombre,
      fechaGeneracion: new Date().toISOString(),
      filtrosTexto,
      empresaFiltro: filtroFinanzasEmpresa,
      totalRegistros: datos.length,
      porMoneda,
      filasTabla,
      truncado
    };
  };

  // Abre la vista previa del Informe ("👁️ Ver Informe") — calcula todo UNA vez (datos +
  // imágenes de las gráficas) y lo deja en estado; tanto la vista previa como el botón
  // "Descargar PDF" de adentro usan este mismo resultado, sin volver a calcularlo.
  const handleAbrirInformeFinanzas = () => {
    const datos = construirDatosInformeFinanzas();
    const graficas = datos.porMoneda.map(pm => ({
      moneda: pm.moneda,
      imgMensual: dibujarGraficaBarras(pm.graficaMensual.labels, pm.graficaMensual.series, { formatoValor: (v) => formatMoneyByMoneda(v, pm.moneda) }),
      imgEmpresa: dibujarGraficaBarras(pm.graficaEmpresa.labels, pm.graficaEmpresa.series, { formatoValor: (v) => formatMoneyByMoneda(v, pm.moneda) }),
      imgCategoria: pm.distribucionCategoria.length > 0 ? dibujarGraficaTorta(pm.distribucionCategoria) : null,
    }));
    setInformeFinanzas({ datos, graficas });
  };

  // Genera y descarga el PDF a partir de lo que ya está calculado en `informeFinanzas` (lo que
  // se ve en la vista previa) — así el PDF nunca puede mostrar algo distinto de lo previsualizado.
  const handleDescargarInformeFinanzas = async () => {
    if (!informeFinanzas) return;
    setGenerandoInformePDF(true);
    try {
      const { datos, graficas } = informeFinanzas;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margen = 15;
      let y = margen;

      // Portada: logo de la empresa filtrada, o de todas las que aparecen en los datos si el
      // filtro es "Todas" — igual que en la carátula de mergeSoportesToPDF.
      const empresasEnDatos = [...new Set(datos.filasTabla.map(r => r.empresa))];
      const empresasParaLogo = datos.empresaFiltro !== 'Todas' ? [datos.empresaFiltro] : empresasEnDatos;
      let xLogo = margen;
      for (const emp of empresasParaLogo) {
        const logoSrc = EMPRESA_LOGOS[emp];
        if (!logoSrc) continue;
        try {
          const logoBytes = new Uint8Array(await fetch(logoSrc).then(r => r.arrayBuffer()));
          const logoDataUrl = uint8ArrayToDataUrl(logoBytes, 'image/png');
          doc.addImage(logoDataUrl, 'PNG', xLogo, y, 28, 14, undefined, 'FAST');
          xLogo += 34;
        } catch (logoError) {
          console.warn('No se pudo insertar el logo de', emp, logoError);
        }
      }
      y += 22;

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('INFORME FINANCIERO', margen, y);
      y += 8;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(107, 100, 88);
      datos.filtrosTexto.forEach(linea => { doc.text(linea, margen, y); y += 5; });
      doc.text(`Generado por ${datos.generadoPor} — ${new Date(datos.fechaGeneracion).toLocaleString('es-CO')}`, margen, y);
      doc.setTextColor(0, 0, 0);
      y += 10;

      for (const pm of datos.porMoneda) {
        const g = graficas.find(x => x.moneda === pm.moneda);
        if (y > 235) { doc.addPage(); y = margen; }

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(196, 167, 71);
        doc.text(`Resumen (${pm.moneda})`, margen, y);
        doc.setTextColor(0, 0, 0);
        y += 6;

        doc.autoTable({
          startY: y,
          head: [['Ingresos', 'Gastos', 'Neto', 'Traslados', 'Movimientos']],
          body: [[
            formatMoneyByMoneda(pm.ingresos, pm.moneda),
            formatMoneyByMoneda(pm.gastos, pm.moneda),
            formatMoneyByMoneda(pm.neto, pm.moneda),
            `${pm.cantidadTraslados} (${formatMoneyByMoneda(pm.trasladoSalida, pm.moneda)})`,
            String(pm.cantidadMovimientos)
          ]],
          margin: margen,
          theme: 'grid',
          styles: { fontSize: 9 }
        });
        y = doc.lastAutoTable.finalY + 10;

        if (y > 195) { doc.addPage(); y = margen; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(`Ingresos vs Gastos por mes (${pm.moneda})`, margen, y);
        y += 4;
        doc.addImage(g.imgMensual, 'PNG', margen, y, pageWidth - margen * 2, 70);
        y += 76;

        if (y > 195) { doc.addPage(); y = margen; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(`Ingresos vs Gastos por empresa (${pm.moneda})`, margen, y);
        y += 4;
        doc.addImage(g.imgEmpresa, 'PNG', margen, y, pageWidth - margen * 2, 70);
        y += 76;

        if (g.imgCategoria) {
          if (y > 185) { doc.addPage(); y = margen; }
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text(`Distribución del Gasto por Categoría/CECO (${pm.moneda})`, margen, y);
          y += 4;
          doc.addImage(g.imgCategoria, 'PNG', margen, y, 130, 60);
          y += 66;
        }
      }

      doc.addPage();
      y = margen;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(196, 167, 71);
      doc.text('Detalle de Movimientos', margen, y);
      doc.setTextColor(0, 0, 0);
      y += 4;
      if (datos.truncado) {
        y += 5;
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(204, 75, 75);
        doc.text(`Mostrando ${datos.filasTabla.length} de ${datos.totalRegistros} movimientos — acota el filtro para ver el detalle completo.`, margen, y);
        doc.setTextColor(0, 0, 0);
      }

      doc.autoTable({
        startY: y + 6,
        head: [['Fecha', 'Tipo', 'Colaborador', 'Empresa', 'CECO/Cuenta', 'Detalle', 'Valor']],
        body: datos.filasTabla.map(f => [f.fecha, f.tipo, f.colaborador, f.empresa, f.cecoCuenta, f.detalle, f.valorTexto]),
        margin: margen,
        theme: 'grid',
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [196, 167, 71], textColor: [34, 30, 21] }
      });

      const totalPaginas = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPaginas; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(143, 136, 119);
        doc.text(`Página ${p} de ${totalPaginas}`, pageWidth - margen, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
        doc.text('AM Holding — Sistema Financiero', margen, doc.internal.pageSize.getHeight() - 8);
      }

      doc.save(`Informe_Finanzas_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generando el Informe de Finanzas:', error);
      alert('❌ No se pudo generar el Informe PDF: ' + error.message);
    } finally {
      setGenerandoInformePDF(false);
    }
  };

  // Dashboard financiero — separado por moneda (ARKO en USD, el resto en COP).
  // Sumar pesos y dólares en un mismo total daría un número financieramente incorrecto.
  const gastosBase = user?.rol === 'Responsable' ? gastosUsuario : gastos;
  const ingresosBase = user?.rol === 'Responsable' ? ingresosUsuario : ingresos;

  // Los totales se agrupan por la moneda de la EMPRESA: las empresas en COP pagan en COP y ARKO
  // en USD. La única excepción (FOR SEVEN: Pago a Tercero solicitado en USD y pagado en COP) se
  // registra como Gasto Neutro en COP y no suma como gasto.
  const monedaMovimiento = (m) => getMoneda(m.empresa);

  // Los Traslados viven en la tabla de gastos pero NO son gastos: mueven plata entre cuentas
  // (propias o de otra empresa de la holding). Se excluyen de Gastos/Balance/CECOs y se
  // resumen aparte en la tarjeta "Traslados".
  const enRangoDashboard = (m) => m.fecha >= filtroFechaInicio && m.fecha <= filtroFechaFin;
  // Los Gastos Neutros (ver esPagoTerceroNeutro) quedan fuera de Gastos/Balance/CECOs, igual que los traslados.
  // Lo que sigue "Pendiente" (registrado pero aún no pagado/recibido) tampoco suma.
  const gastosFiltradomat = gastosBase.filter(g => g.tipo !== 'Traslado' && !g.neutro && g.estado !== 'Pendiente' && enRangoDashboard(g));
  const neutrosFiltrados = gastosBase.filter(g => g.neutro && enRangoDashboard(g));
  const ingresosFiltradomat = ingresosBase.filter(i => i.estado !== 'Pendiente' && enRangoDashboard(i));
  const trasladosFiltrados = gastosBase.filter(g => g.tipo === 'Traslado' && enRangoDashboard(g));

  // Vistas filtradas por moneda — para tarjetas y gráficos que comparan varias empresas a la vez
  const gastosFiltradomatCOP = gastosFiltradomat.filter(g => monedaMovimiento(g) === 'COP');
  const gastosFiltradomatUSD = gastosFiltradomat.filter(g => monedaMovimiento(g) === 'USD');
  const ingresosFiltradomatCOP = ingresosFiltradomat.filter(i => monedaMovimiento(i) === 'COP');
  const ingresosFiltradomatUSD = ingresosFiltradomat.filter(i => monedaMovimiento(i) === 'USD');

  // Traslados agrupados por ruta (empresa origen → destino), en la moneda de SALIDA.
  const trasladosPorRuta = Object.values(trasladosFiltrados.reduce((acc, t) => {
    const destino = t.cuentaDestino === CUENTA_DESTINO_EXTERNA
      ? 'Empresa externa'
      : getEmpresaDestinoTraslado(t.cuentaDestino, t.empresa);
    const moneda = getMoneda(t.empresa);
    const clave = `${t.empresa}|${destino}|${moneda}`;
    if (!acc[clave]) acc[clave] = { origen: t.empresa, destino, moneda, cantidad: 0, total: 0 };
    acc[clave].cantidad += 1;
    acc[clave].total += parseFloat(t.valor) || 0;
    return acc;
  }, {})).sort((a, b) => a.origen.localeCompare(b.origen) || b.total - a.total);

  // Datos por mes (solo empresas en COP — ARKO se muestra aparte en su propio resumen USD)
  const datosPorMes = (() => {
    const meses = {};
    gastosFiltradomatCOP.forEach(g => {
      const mes = g.fecha.substring(0, 7);
      if (!meses[mes]) meses[mes] = { mes, gastos: 0, ingresos: 0 };
      meses[mes].gastos += parseFloat(g.valor) || 0;
    });
    ingresosFiltradomatCOP.forEach(i => {
      const mes = i.fecha.substring(0, 7);
      if (!meses[mes]) meses[mes] = { mes, gastos: 0, ingresos: 0 };
      meses[mes].ingresos += parseFloat(i.valor) || 0;
    });
    return Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes));
  })();

  // Top CECOs (solo COP — mezclar CECOs en dólares y pesos en el mismo top daría proporciones falsas)
  const topCecos = cecos.map(ceco => ({
    name: ceco.nombre,
    value: gastosFiltradomatCOP
      .filter(g => g.ceco === ceco.codigo)
      .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0)
  }))
  .filter(c => c.value > 0)
  .sort((a, b) => b.value - a.value)
  .slice(0, 5);

  // Top Empresas (solo COP — ARKO ya tiene su propio resumen en USD más abajo)
  const topEmpresas = empresas.map(emp => ({
    name: emp.split(' ')[0],
    value: gastosFiltradomatCOP
      .filter(g => g.empresa === emp)
      .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0)
  }))
  .filter(e => e.value > 0)
  .sort((a, b) => b.value - a.value)
  .slice(0, 5);

  // Ingresos, Gastos y Balance de cada empresa individual en COP (ARKO mantiene su propio resumen en USD, aparte)
  const resumenPorEmpresaCOP = empresas.map(emp => {
    const ingresosEmp = ingresosFiltradomatCOP.filter(i => i.empresa === emp).reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0);
    const gastosEmp = gastosFiltradomatCOP.filter(g => g.empresa === emp).reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0);
    return { empresa: emp, ingresos: ingresosEmp, gastos: gastosEmp, balance: ingresosEmp - gastosEmp };
  }).filter(r => getMoneda(r.empresa) === 'COP' || r.ingresos || r.gastos);

  // Valor ejecutado (gastos) de cada CECO, cruzado por empresa (COP) — ARKO se muestra aparte en USD
  const empresasCOP = empresas.filter(emp => getMoneda(emp) === 'COP' || gastosFiltradomatCOP.some(g => g.empresa === emp));
  const cecosPorEmpresaCOP = cecos.map(ceco => {
    const porEmpresa = {};
    let total = 0;
    empresasCOP.forEach(emp => {
      const valor = gastosFiltradomatCOP
        .filter(g => g.ceco === ceco.codigo && g.empresa === emp)
        .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0);
      porEmpresa[emp] = valor;
      total += valor;
    });
    return { codigo: ceco.codigo, nombre: ceco.nombre, porEmpresa, total };
  }).filter(c => c.total > 0);

  // Valor ejecutado por CECO en dólares (ARKO + pagos en USD de cualquier empresa)
  const cecosArkoUSD = cecos.map(ceco => ({
    codigo: ceco.codigo,
    nombre: ceco.nombre,
    valor: gastosFiltradomatUSD
      .filter(g => g.ceco === ceco.codigo)
      .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0)
  })).filter(c => c.valor > 0);

  // ===== PRESUPUESTO =====
  // Valor esperado de un concepto en un mes puntual: usa el ajuste manual de ese mes si existe
  // (presupuestoOverrides), o si no el valor base recurrente del concepto.
  const getValorEsperado = (presupuestoItemId, anio, mes) => {
    const override = presupuestoOverrides.find(o => o.presupuestoItemId === presupuestoItemId && o.anio === anio && o.mes === mes);
    if (override) return override.valor;
    const item = presupuestoItems.find(p => p.id === presupuestoItemId);
    return item ? (parseFloat(item.valorMensual) || 0) : 0;
  };

  // Vista mensual: cada concepto recurrente activo de la empresa filtrada, cruzado contra los gastos
  // ya registrados en Finanzas ese mes (vía presupuestoItemId) para saber qué está Pagado y qué Pendiente,
  // más las deducciones (préstamos/otros descuentos) vigentes ese mes para calcular el Neto a Pagar.
  //
  // Prioridad del valor: si el concepto YA se pagó este mes (existe un gasto vinculado), el valor real
  // ingresado en el formulario de Gasto de Finanzas manda sobre el valor base/ajustado de Presupuesto —
  // no tiene sentido mantener los dos sincronizados a mano cuando el valor real ya quedó registrado.
  // El valor base/ajuste manual (getValorEsperado) solo sigue sirviendo de ESTIMADO mientras el concepto
  // sigue Pendiente ese mes (útil para saber cuánto esperar antes de pagar).
  // Registro de la app → número del lote PAB VIGENTE (no anulado) en que ya se exportó.
  const lotePorClave = useMemo(() => {
    const mapa = {};
    lotesPago.filter(l => l.estado !== 'Anulado').forEach(l => {
      (l.lotes_pago_banco_items || []).filter(i => i.activo).forEach(i => { mapa[i.entidad_clave] = l.numero; });
    });
    return mapa;
  }, [lotesPago]);

  // Estado de aprobación de un concepto en un mes: aprobado solo si el neto aprobado coincide
  // con el neto actual (al peso, tolerando centavos de redondeo).
  const estadoAprobacionPresupuesto = (presupuestoItemId, anio, mes, netoActual) => {
    const aprobacion = presupuestoAprobaciones.find(a => a.presupuestoItemId === presupuestoItemId && a.anio === anio && a.mes === mes) || null;
    const vigente = !!aprobacion && Math.abs(aprobacion.valorNeto - netoActual) < 0.5;
    return { aprobacion, aprobado: vigente, aprobacionDesactualizada: !!aprobacion && !vigente };
  };

  // Honorarios ("Prestación de Servicio"): antes de aprobar el pago en Presupuesto, el
  // colaborador debe tener su Cuenta de Cobro de ESE mes/año y empresa en estado Aprobado (o ya
  // Pagado). Los demás tipos de concepto (Nómina, servicios, etc.) no tienen este requisito.
  // Tolera mayúsculas, tildes y "Servicio(s)" en el tipo del concepto.
  const esConceptoHonorarios = (tipo) => String(tipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().startsWith('prestacion de servicio');
  const requisitoCuentaCobro = (item, anio, mes) => {
    if (!esConceptoHonorarios(item.tipo)) return { ok: true };
    if (!item.responsableId) return { ok: false, motivo: 'Concepto sin colaborador vinculado (asígnalo en Gestión de Conceptos)' };
    const delMes = cuentasDeCobro.filter(c => c.responsableId === item.responsableId && Number(c.mes) === Number(mes) && Number(c.anio) === Number(anio) && c.empresa === item.empresa);
    if (delMes.length === 0) return { ok: false, motivo: 'Sin cuenta de cobro del mes' };
    const aprobada = delMes.find(c => ['Aprobado', 'Pagado'].includes(c.estado));
    if (!aprobada) return { ok: false, motivo: `Cuenta de cobro N° ${delMes[0].numero || '—'} en estado ${delMes[0].estado}` };
    return { ok: true, cuentaCobro: aprobada };
  };

  const presupuestoMensualDetalle = (() => {
    const { empresa, mes, anio } = filtroPresupuesto;
    const mesStr = `${anio}-${String(mes).padStart(2, '0')}`;
    return presupuestoItems
      .filter(p => p.activo !== false && p.empresa === empresa)
      .map(item => {
        const gastoVinculado = gastos.find(g => g.presupuestoItemId === item.id && g.fecha && g.fecha.substring(0, 7) === mesStr);
        const valorBaseEsperado = getValorEsperado(item.id, anio, mes);
        const ajustado = valorBaseEsperado !== (parseFloat(item.valorMensual) || 0);
        const deduccionesDelItem = deducciones.filter(d => d.presupuestoItemId === item.id);
        const totalDeduccionesEstimadas = deduccionesDelItem.reduce((sum, d) => sum + getCuotaAplicada(d, anio, mes), 0);

        // Si hay gasto vinculado: "Valor del Mes" = lo que se escribió en el campo Valor de Finanzas
        // (el bruto, si hubo deducción aplicada — así no se ve "doble descontado"); Deducciones = lo
        // que realmente se aplicó a ESE pago (no el cálculo teórico); Neto a Pagar = lo que de verdad
        // se pagó (gastoVinculado.valor, ya neto). Sin gasto vinculado, todo sigue siendo el estimado.
        const valorMes = gastoVinculado
          ? (gastoVinculado.valorBruto != null ? gastoVinculado.valorBruto : (parseFloat(gastoVinculado.valor) || 0))
          : valorBaseEsperado;
        const totalDeducciones = gastoVinculado
          ? (gastoVinculado.deduccionAplicada != null ? gastoVinculado.deduccionAplicada : 0)
          : totalDeduccionesEstimadas;
        const netoAPagar = gastoVinculado ? (parseFloat(gastoVinculado.valor) || 0) : (valorBaseEsperado - totalDeduccionesEstimadas);

        return {
          ...item,
          valorEsperado: valorMes,
          valorBaseEsperado,
          ajustado,
          esValorReal: !!gastoVinculado,
          deducciones: deduccionesDelItem.map(d => ({ ...d, cuotaAplicada: getCuotaAplicada(d, anio, mes), saldoPendiente: getSaldoPendienteEnMes(d, anio, mes) })),
          totalDeducciones,
          netoAPagar,
          pagado: !!gastoVinculado,
          valorPagadoReal: gastoVinculado ? (parseFloat(gastoVinculado.valor) || 0) : 0,
          gastoId: gastoVinculado ? gastoVinculado.id : null,
          ...(() => {
            const est = estadoAprobacionPresupuesto(item.id, anio, mes, netoAPagar);
            const requisito = requisitoCuentaCobro(item, anio, mes);
            // Una aprobación solo vale mientras se siga cumpliendo el requisito de la cuenta de
            // cobro (si alguien la devuelve a Pendiente después, el concepto deja de estar aprobado).
            return {
              ...est,
              aprobado: est.aprobado && requisito.ok,
              aprobacionDesactualizada: est.aprobacionDesactualizada || (est.aprobado && !requisito.ok),
              requisitoCuentaCobro: requisito
            };
          })()
        };
      })
      // Pagados primero, Pendientes al final; dentro de cada grupo, alfabético por Concepto (más
      // fácil de ubicar uno puntual que el orden de creación/DB que traía antes).
      .sort((a, b) => Number(b.pagado) - Number(a.pagado) || (a.nombre || '').localeCompare(b.nombre || ''));
  })();

  const presupuestoMensualTotales = presupuestoMensualDetalle.reduce((acc, item) => {
    acc.totalPresupuestado += item.valorEsperado;
    acc.totalDeducciones += item.totalDeducciones;
    acc.totalNeto += item.netoAPagar;
    if (item.pagado) { acc.totalPagado += item.valorEsperado; acc.itemsPagados += 1; }
    else { acc.totalPendiente += item.valorEsperado; acc.itemsPendientes += 1; }
    return acc;
  }, { totalPresupuestado: 0, totalPagado: 0, totalPendiente: 0, totalDeducciones: 0, totalNeto: 0, itemsPagados: 0, itemsPendientes: 0 });

  // Filtra la selección contra los "Pendiente" realmente visibles ahora mismo (mismo mes/año/
  // empresa) — así, si el usuario cambia el filtro con casillas marcadas, o algún seleccionado
  // ya se pagó (otra persona, otra pestaña), no arrastra ids fantasma al modal de confirmación.
  const seleccionPresupuestoValida = seleccionPresupuestoPendientes.filter(id =>
    presupuestoMensualDetalle.some(item => item.id === id && !item.pagado)
  );

  // Vista anual: ejecución acumulada del año por CECO (empresa filtrada) contra el techo anual cargado manualmente.
  const presupuestoAnualDetalle = (() => {
    const { empresa, anio } = filtroPresupuesto;
    return cecos.map(ceco => {
      const techo = presupuestoAnual.find(p => p.empresa === empresa && p.ceco === ceco.codigo && String(p.anio) === String(anio));
      const valorAnual = techo ? (parseFloat(techo.valorAnual) || 0) : 0;
      const ejecutado = gastos
        .filter(g => !g.neutro && g.estado !== 'Pendiente' && g.empresa === empresa && g.ceco === ceco.codigo && g.fecha && g.fecha.substring(0, 4) === String(anio))
        .reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0);
      return {
        codigo: ceco.codigo,
        nombre: ceco.nombre,
        valorAnual,
        ejecutado,
        restante: valorAnual - ejecutado,
        porcentaje: valorAnual > 0 ? (ejecutado / valorAnual) * 100 : null
      };
    }).filter(c => c.valorAnual > 0 || c.ejecutado > 0);
  })();

  // COLABORADORES — cumpleaños del mes actual, ordenados por día
  const cumpleanosEsteMes = responsables
    .filter(r => r.fechaNacimiento)
    .map(r => ({ ...r, diaCumple: parseInt(r.fechaNacimiento.substring(8, 10), 10), mesCumple: parseInt(r.fechaNacimiento.substring(5, 7), 10) }))
    .filter(r => r.mesCumple === (new Date().getMonth() + 1))
    .sort((a, b) => a.diaCumple - b.diaCumple);

  // PERMISOS POR ROL
  // El Gerente dejó de ser "solo lectura" en Solicitudes/Cuentas de Cobro: ahora crea y gestiona
  // las suyas propias, igual que un Responsable (pero solo ve las suyas, no las de los demás).
  const canEdit = user?.rol && ['Administrador', 'Coordinadora Administrativa', 'Responsable', 'Gerente'].includes(user.rol);
  const canApprove = user?.rol && ['Administrador', 'Coordinadora Administrativa'].includes(user.rol);
  const isReadOnly = user?.rol === 'Contadora';
  // Finanzas, Dashboard Financiero y Presupuesto: solo Administrador, Coordinadora y Gerente
  // (mismo criterio que ROLES_FINANZAS en components/TopNav.jsx).
  const puedeVerFinanzas = ['Administrador', 'Coordinadora Administrativa', 'Gerente'].includes(user?.rol);
  
  // Color estado
  const getColorEstado = (estado) => {
    const colores = { 'Pendiente': '#CC4B4B', 'Aprobado': '#D6A419', 'Devuelto': '#C4622D', 'Pagado': '#2F9E52', 'Legalizado': '#6C63D1' };
    return colores[estado] || '#6B6458';
  };

  // DESCARGAS Y REPORTES
  // ===== REPORTES Y DESCARGAS (Dashboard) =====
  // Todos usan el rango "Desde/Hasta" del panel (el mismo del Dashboard Financiero) y solo lo
  // que el rol ve en pantalla (solicitudesUsuario, gastosUsuario, etc.). Se exporta a .xlsx y
  // no a CSV: un CSV con comas se abre mal en Excel en español (tildes rotas, todo en una
  // columna) y cualquier comilla en un detalle rompía la fila.
  const enRangoReportes = (fecha) => !!fecha && fecha >= filtroFechaInicio && fecha <= filtroFechaFin;
  const sufijoRango = () => `${filtroFechaInicio}_a_${filtroFechaFin}`;
  const nombreColaboradorReporte = (id, respaldo) => colaboradoresPublico.find(c => c.id === id)?.nombre || respaldo || '';

  const descargarExcel = (nombreArchivo, nombreHoja, encabezados, filas) => {
    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
    ws['!cols'] = encabezados.map(h => ({ wch: Math.min(Math.max(h.length + 2, 12), 45) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
    XLSX.writeFile(wb, nombreArchivo);
  };

  const downloadReporteFinanzas = () => {
    const encabezados = ['Fecha', 'Movimiento', 'Empresa', 'Colaborador', 'CECO', 'Cuenta', 'Cuenta salida', 'Cuenta destino', 'Detalle', 'Valor', 'Moneda', 'Valor destino', 'Categoría', 'Estado', 'Tercero', 'Documento tercero', 'Observaciones', 'Soporte (link Drive)', 'Lote de pago'];
    const filaGasto = (g) => [
      g.fecha, g.tipo, g.empresa, nombreColaboradorReporte(g.responsableId, g.responsable), g.ceco || '',
      g.cuenta || '', g.cuentaSalida || '', g.cuentaDestino || '', g.detalle || '',
      parseFloat(g.valor) || 0,
      // Traslado: el valor sale en la moneda de la empresa origen; el resto, en su moneda real.
      g.tipo === 'Traslado' ? getMoneda(g.empresa) : (g.moneda || getMoneda(g.empresa)),
      g.valorDestino !== null && g.valorDestino !== undefined && g.valorDestino !== '' ? parseFloat(g.valorDestino) || '' : '',
      g.categoria || '', g.estado || '', g.terceroInfo?.nombre || '', g.terceroInfo?.dni || '',
      g.observaciones || '', g.soporteDriveLink || '', g.lotePagoId || ''
    ];
    const filaIngreso = (i) => [
      i.fecha, 'Ingreso', i.empresa, nombreColaboradorReporte(i.responsableId, i.responsable), i.ceco || '',
      i.cuenta || '', '', '', i.detalle || '', parseFloat(i.valor) || 0, getMoneda(i.empresa), '',
      i.categoria || '', i.estado || '', '', '', i.observaciones || '', i.soporteDriveLink || '', ''
    ];
    const filas = [
      ...gastosUsuario.filter(g => enRangoReportes(g.fecha)).map(filaGasto),
      ...ingresosUsuario.filter(i => enRangoReportes(i.fecha)).map(filaIngreso)
    ].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
    if (filas.length === 0) {
      alert('No hay movimientos de Finanzas en el rango de fechas elegido.');
      return;
    }
    descargarExcel(`Reporte_Finanzas_${sufijoRango()}.xlsx`, 'Finanzas', encabezados, filas);
  };

  const downloadReporteSolicitudes = () => {
    const encabezados = ['Fecha', 'Tipo', 'Empresa', 'Colaborador', 'Detalle', 'Valor', 'Moneda', 'Estado', 'Tercero', 'Documento tercero', 'Motivo devolución', 'Lote de pago'];
    const filas = solicitudesUsuario
      .filter(s => enRangoReportes(s.fecha))
      .map(s => [
        s.fecha, s.tipo, s.empresa, nombreColaboradorReporte(s.responsableId, s.responsableNombre), s.detalle || '',
        montoSolicitud(s), monedaSolicitud(s), s.estado,
        s.terceroInfo?.nombre || '', s.terceroInfo?.dni || '', s.motivoDevolucion || '', s.lotePagoId || ''
      ])
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])));
    if (filas.length === 0) {
      alert('No hay solicitudes en el rango de fechas elegido.');
      return;
    }
    descargarExcel(`Reporte_Solicitudes_${sufijoRango()}.xlsx`, 'Solicitudes', encabezados, filas);
  };

  // Soportes del rango elegido, de TODOS los módulos (Solicitudes, Finanzas, Cuentas de cobro),
  // cada uno en su carpeta. Nombres únicos dentro de cada carpeta (antes dos archivos con el
  // mismo nombre se pisaban en el ZIP sin aviso). Un mismo archivo compartido entre una
  // Solicitud y su Gasto se descarga una sola vez y se copia a ambas carpetas. Los soportes que
  // son links de Drive van listados en "Links de Drive.xlsx".
  const downloadSoportesZIP = async () => {
    if (progresoZip) return;
    const limpiarNombre = (t) => String(t || '').replace(/[\\/:*?"<>|]+/g, '_').trim();
    const entidades = {};
    solicitudesUsuario.filter(s => enRangoReportes(s.fecha)).forEach(s => { entidades[`solicitud:${s.id}`] = { carpeta: 'Solicitudes', fecha: s.fecha, etiqueta: s.tipo, registro: s }; });
    gastosUsuario.filter(g => enRangoReportes(g.fecha)).forEach(g => { entidades[`gasto:${g.id}`] = { carpeta: 'Finanzas', fecha: g.fecha, etiqueta: g.tipo, registro: g }; });
    ingresosUsuario.filter(i => enRangoReportes(i.fecha)).forEach(i => { entidades[`ingreso:${i.id}`] = { carpeta: 'Finanzas', fecha: i.fecha, etiqueta: 'Ingreso', registro: i }; });
    cuentasCobroUsuario.filter(c => enRangoReportes(c.fecha)).forEach(c => { entidades[`cuenta_cobro:${c.id}`] = { carpeta: 'Cuentas de cobro', fecha: c.fecha, etiqueta: `CuentaCobro-${c.numero || ''}`, registro: c }; });

    const ids = [...new Set(Object.keys(entidades).map(k => k.split(':')[1]))];
    if (ids.length === 0) {
      alert('No hay registros en el rango de fechas elegido.');
      return;
    }

    setProgresoZip({ hechos: 0, total: 0 });
    try {
      // Filas de public.soportes de esas entidades (en bloques, para no armar una URL gigante).
      const filasSoportes = [];
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await supabase
          .from('soportes')
          .select('bucket_path, nombre_original, entidad_tipo, entidad_id')
          .in('entidad_id', ids.slice(i, i + 150));
        if (error) throw new Error('No se pudieron leer los soportes: ' + error.message);
        filasSoportes.push(...(data || []).filter(sp => entidades[`${sp.entidad_tipo}:${sp.entidad_id}`]));
      }

      const zip = new JSZip();
      const usados = {};
      const nombreUnico = (carpeta, nombre) => {
        const base = limpiarNombre(nombre) || 'archivo';
        const punto = base.lastIndexOf('.');
        const [raiz, ext] = punto > 0 ? [base.slice(0, punto), base.slice(punto)] : [base, ''];
        let candidato = base;
        for (let n = 2; usados[`${carpeta}/${candidato}`]; n++) candidato = `${raiz} (${n})${ext}`;
        usados[`${carpeta}/${candidato}`] = true;
        return `${carpeta}/${candidato}`;
      };

      // Descarga cada archivo una sola vez, 4 a la vez.
      const rutas = [...new Set(filasSoportes.map(sp => sp.bucket_path))];
      const blobs = {};
      const fallidos = [];
      const descargarRuta = async (ruta) => {
        const { data: blob, error } = await supabase.storage.from('soportes').download(ruta);
        if (error || !blob) fallidos.push(ruta); else blobs[ruta] = blob;
      };
      setProgresoZip({ hechos: 0, total: rutas.length });
      for (let i = 0; i < rutas.length; i += 4) {
        await Promise.all(rutas.slice(i, i + 4).map(descargarRuta));
        setProgresoZip({ hechos: Math.min(i + 4, rutas.length), total: rutas.length });
      }

      let count = 0;
      filasSoportes.forEach(sp => {
        const blob = blobs[sp.bucket_path];
        if (!blob) return;
        const ent = entidades[`${sp.entidad_tipo}:${sp.entidad_id}`];
        zip.file(nombreUnico(ent.carpeta, `${ent.fecha}_${ent.etiqueta}_${sp.nombre_original}`), blob);
        count++;
      });

      // Compatibilidad con solicitudes antiguas que aún tengan archivo por documento embebido.
      Object.values(entidades).filter(e => e.carpeta === 'Solicitudes').forEach(({ registro: sol }) => {
        (sol.documentos || []).forEach((doc, docIdx) => {
          if (doc.archivo && String(doc.archivo).includes(',')) {
            zip.file(nombreUnico('Solicitudes', `${sol.fecha}_${sol.tipo}_${doc.archivoNombre || `documento_${docIdx + 1}`}`), doc.archivo.split(',')[1], { base64: true });
            count++;
          }
        });
      });

      // Soportes que viven en Drive (registros históricos importados): se listan con su link.
      const links = Object.values(entidades)
        .filter(e => e.registro.soporteDriveLink)
        .map(e => [e.fecha, e.carpeta, e.etiqueta, e.registro.empresa || '', e.registro.detalle || '', parseFloat(e.registro.valor) || 0, e.registro.soporteDriveLink]);
      if (links.length > 0) {
        const ws = XLSX.utils.aoa_to_sheet([['Fecha', 'Módulo', 'Tipo', 'Empresa', 'Detalle', 'Valor', 'Link Drive'], ...links]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Links Drive');
        zip.file('Links de Drive.xlsx', XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
      }

      if (count === 0 && links.length === 0) {
        alert('No hay soportes en el rango de fechas elegido.');
        return;
      }

      const blobZip = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blobZip));
      link.setAttribute('download', `Soportes_${sufijoRango()}.zip`);
      link.click();
      if (fallidos.length > 0) {
        alert(`⚠️ El ZIP se descargó, pero ${fallidos.length} archivo(s) no se pudieron bajar del almacenamiento y no quedaron incluidos.`);
      }
    } catch (error) {
      console.error('Error armando el ZIP de soportes:', error);
      alert('❌ ' + error.message);
    } finally {
      setProgresoZip(null);
    }
  };

  // Mientras se revisa si ya hay una sesión de Supabase activa, no mostramos
  // ni el login ni la app (evita el parpadeo del formulario de login).
  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8F6F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={logoAmHolding} alt="AM HOLDING" style={{ height: '64px', width: 'auto', objectFit: 'contain', opacity: 0.6 }} />
      </div>
    );
  }

  // OLVIDÉ MI CONTRASEÑA — paso 2: pantalla para poner la contraseña nueva, mostrada al llegar
  // desde el link que Supabase manda por correo. No depende de `user` — va antes que el login.
  if (recuperandoPassword) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8F6F1', backgroundImage: 'radial-gradient(circle at 15% 10%, rgba(196,167,71,0.10), transparent 45%), radial-gradient(circle at 85% 90%, rgba(196,167,71,0.08), transparent 45%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E6E0D2', borderTop: '4px solid #C4A747', borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '500px', width: '100%', boxShadow: '0 20px 50px -12px rgba(34,30,21,0.18), 0 2px 8px rgba(34,30,21,0.06)' }}>
          <img src={logoAmHolding} alt="AM HOLDING" style={{ height: '64px', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
          <h2 style={{ color: '#221E15', margin: '1.25rem 0 0.5rem 0' }}>Nueva contraseña</h2>
          <p style={{ color: '#6B6458', margin: '0 0 2rem 0', fontSize: '0.9rem' }}>Escribe la nueva contraseña para tu cuenta.</p>

          <input type="password" placeholder="Nueva contraseña" value={nuevaPasswordRecuperacion} onChange={(e) => setNuevaPasswordRecuperacion(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#F8F6F1', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: '4px' }} />
          <input type="password" placeholder="Confirmar nueva contraseña" value={confirmarPasswordRecuperacion} onChange={(e) => setConfirmarPasswordRecuperacion(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleGuardarNuevaPasswordRecuperacion()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#F8F6F1', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: '4px' }} />
          <button onClick={handleGuardarNuevaPasswordRecuperacion} disabled={guardandoPasswordRecuperacion} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#221E15', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: guardandoPasswordRecuperacion ? 'default' : 'pointer', opacity: guardandoPasswordRecuperacion ? 0.7 : 1 }}>{guardandoPasswordRecuperacion ? 'Guardando...' : 'Guardar nueva contraseña'}</button>
        </div>
      </div>
    );
  }

  // LOGIN
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8F6F1', backgroundImage: 'radial-gradient(circle at 15% 10%, rgba(196,167,71,0.10), transparent 45%), radial-gradient(circle at 85% 90%, rgba(196,167,71,0.08), transparent 45%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E6E0D2', borderTop: '4px solid #C4A747', borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', maxWidth: '500px', width: '100%', boxShadow: '0 20px 50px -12px rgba(34,30,21,0.18), 0 2px 8px rgba(34,30,21,0.06)' }}>
          <img src={logoAmHolding} alt="AM HOLDING" style={{ height: '64px', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
          <p style={{ color: '#6B6458', margin: '1.25rem 0 2rem 0' }}>Gestión Financiera/Contable</p>

          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#F8F6F1', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: '4px' }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#F8F6F1', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '1rem', boxSizing: 'border-box', borderRadius: '4px' }} />
          {loginError && (
            <p style={{ color: '#CC4B4B', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>{loginError}</p>
          )}
          <button onClick={handleLogin} disabled={loggingIn} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#C4A747', color: '#221E15', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: loggingIn ? 'default' : 'pointer', opacity: loggingIn ? 0.7 : 1 }}>{loggingIn ? 'Entrando...' : 'Entrar'}</button>

          <button onClick={() => { setMostrarOlvidoPassword(!mostrarOlvidoPassword); setRecuperacionEnviada(false); }} style={{ background: 'none', border: 'none', color: '#6B6458', fontSize: '0.8rem', cursor: 'pointer', marginTop: '1.25rem', textDecoration: 'underline', display: 'block', width: '100%', textAlign: 'center' }}>
            ¿Olvidaste tu contraseña?
          </button>

          {mostrarOlvidoPassword && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E6E0D2', textAlign: 'left' }}>
              {recuperacionEnviada ? (
                <p style={{ color: '#2F9E52', fontSize: '0.85rem', margin: 0 }}>✅ Si ese correo está registrado, te llegó un link para poner una contraseña nueva. Revisa también Spam/Promociones.</p>
              ) : (
                <>
                  <p style={{ color: '#6B6458', fontSize: '0.85rem', margin: '0 0 0.75rem 0' }}>Escribe tu email y te enviamos un link para poner una contraseña nueva.</p>
                  <input type="email" placeholder="Tu email" value={emailRecuperacion} onChange={(e) => setEmailRecuperacion(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleEnviarRecuperacion()} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#F8F6F1', border: '1px solid #C4A747', color: '#C4A747', marginBottom: '0.75rem', boxSizing: 'border-box', borderRadius: '4px' }} />
                  <button onClick={handleEnviarRecuperacion} disabled={enviandoRecuperacion} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#E6E0D2', color: '#221E15', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: enviandoRecuperacion ? 'default' : 'pointer', opacity: enviandoRecuperacion ? 0.7 : 1 }}>{enviandoRecuperacion ? 'Enviando...' : 'Enviar link de recuperación'}</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // APP MAIN
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8F6F1', color: '#221E15' }}>
      {/* Menú superior con desplegables (components/TopNav.jsx): fijo arriba al bajar en la
          página; qué módulos ve cada rol se decide ahí con los mismos permisos de siempre. */}
      <TopNav
        active={currentView}
        onNavigate={setCurrentView}
        role={user.rol}
        userName={user.nombre}
        logoSrc={logoAmHolding}
        bell={<NotificacionesCampana user={user} onNavegar={setCurrentView} />}
        onLogout={handleLogout}
      />

      <main style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1rem' }}>
        {currentView === 'datosBancarios' && (user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
          <DatosBancariosView
            user={user}
            usuarios={usuariosDB}
            terceros={todosTerceros}
            cuentasPorEmpresa={cuentasPorEmpresa}
            nitEmpresas={NIT_EMPRESAS}
            onUsuariosCambiaron={cargarUsuarios}
            onActualizarTercero={handleUpdateTercero}
          />
        )}

        {currentView === 'auditoria' && (user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
          <AuditoriaView usuarios={usuariosDB} onNavegar={setCurrentView} />
        )}

        {currentView === 'pagosPAB' && (user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
          <ExportadorPABView
            user={user}
            empresas={empresas}
            solicitudes={solicitudesUsuario}
            presupuestoDetalle={presupuestoMensualDetalle}
            filtroPresupuesto={filtroPresupuesto}
            setFiltroPresupuesto={setFiltroPresupuesto}
            usuarios={usuariosDB}
            terceros={todosTerceros}
            lotes={lotesPago}
            lotePorClave={lotePorClave}
            onRecargarLotes={cargarLotesPago}
            onRegistrarPagoLote={registrarPagoLotePAB}
            cecosGasto={cecosGasto}
            onRecargarDatos={() => { cargarUsuarios(); cargarTodosTerceros(); cargarSolicitudes(); cargarCuentasCobro(); cargarPresupuestoItems(); cargarPresupuestoOverrides(); cargarPresupuestoAprobaciones(); cargarDeducciones(); cargarGastos(); cargarLotesPago(); }}
            getMoneda={getMoneda}
            formatCOP={(v) => formatMoneyByMoneda(v, 'COP')}
          />
        )}

        {currentView === 'dashboard' && (
          // Etapa 3 del sistema de diseño: Dashboard migrado a los componentes de
          // src/components/ui/ (mismos datos y permisos que antes; solo cambia la presentación).
          <div className="flex flex-col gap-6">
            <h2 className="m-0 flex items-center gap-2 text-xl font-extrabold"><LayoutDashboard size={22} className="text-primary" /> Dashboard</h2>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:[grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
              {[
                { icon: FileText, label: 'Total Solicitudes', value: totalSolicitudes, color: '#C4A747' },
                { icon: Banknote, label: 'Monto Total (COP)', value: formatMoneyByMoneda(totalMontoCOP, 'COP'), color: '#2F9E52', compact: true },
                { icon: DollarSign, label: 'Monto Total ARKO (USD)', value: formatMoneyByMoneda(totalMontoUSD, 'USD'), color: '#2F9E52', compact: true },
                { icon: Clock, label: 'Pendiente', value: statsEstado.Pendiente, color: '#CC4B4B' },
                { icon: Search, label: 'Aprobado', value: statsEstado.Aprobado, color: '#D6A419' },
                { icon: Undo2, label: 'Devuelto', value: statsEstado.Devuelto, color: '#C4622D' },
                { icon: CheckCircle2, label: 'Pagado', value: statsEstado.Pagado, color: '#2F9E52' },
                { icon: Paperclip, label: 'Legalizado', value: statsEstado.Legalizado, color: '#6C63D1' },
              ].map((card, idx) => {
                const Icono = card.icon;
                return (
                  <Card key={idx} className="min-w-0 gap-2 overflow-hidden px-3.5 py-4 sm:gap-3 sm:px-5 sm:py-5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${card.color}1F`, color: card.color }}><Icono size={16} /></span>
                      <p className="m-0 text-[0.7rem] font-semibold uppercase leading-tight tracking-wide text-muted-foreground sm:truncate sm:text-xs">{card.label}</p>
                    </div>
                    <p className={cn('m-0 min-w-0 font-extrabold leading-tight tabular-nums [overflow-wrap:anywhere]', card.compact ? 'text-[clamp(1.05rem,2vw,1.6rem)]' : 'text-[clamp(1.5rem,2.5vw,2.25rem)]')} style={{ color: card.color }}>{card.value}</p>
                  </Card>
                );
              })}
            </div>

            {statsPorEmpresa.length > 0 && (
              <Card className="gap-4 px-0 py-5">
                <CardHeader className="sm:px-6">
                  <CardTitle className="flex items-center gap-2"><Building2 size={18} className="text-primary" /> Por Empresa</CardTitle>
                </CardHeader>
                <CardContent className="sm:px-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Empresa</TableHead>
                        <TableHead className="text-center">Solicitudes</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statsPorEmpresa.map((emp, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground"><div className="flex items-center gap-2"><EmpresaLogo empresa={emp.empresa} height={18} />{emp.empresa}</div></TableCell>
                          <TableCell className="text-center font-semibold text-primary">{emp.cantidad}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-bold text-success">{formatMoney(emp.monto, emp.empresa)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {topResponsables.length > 0 && (
              <Card className="gap-4 px-0 py-5">
                <CardHeader className="sm:px-6">
                  <CardTitle className="flex items-center gap-2"><Users size={18} className="text-primary" /> Top Colaboradores</CardTitle>
                </CardHeader>
                <CardContent className="sm:px-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Colaborador</TableHead>
                        <TableHead className="text-center">Solicitudes</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topResponsables.map((resp, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground">{resp.nombre}</TableCell>
                          <TableCell className="text-center font-semibold text-primary">{resp.cantidad}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-bold text-success">{formatMoney(resp.monto, resp.empresa)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {ultimasSolicitudes.length > 0 && (
              <Card className="gap-4 px-0 py-5">
                <CardHeader className="sm:px-6">
                  <CardTitle className="flex items-center gap-2"><ClipboardList size={18} className="text-primary" /> Últimas Solicitudes</CardTitle>
                </CardHeader>
                <CardContent className="sm:px-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Fecha</TableHead>
                        {(user.rol === 'Administrador' || user.rol === 'Contadora' || user.rol === 'Coordinadora Administrativa') && <TableHead>Colaborador</TableHead>}
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ultimasSolicitudes.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{s.fecha}</TableCell>
                          {(user.rol === 'Administrador' || user.rol === 'Contadora' || user.rol === 'Coordinadora Administrativa') && <TableCell className="text-xs"><div className="flex items-center gap-2"><ColaboradorAvatar foto={colaboradoresPublico.find(c => c.id === s.responsableId)?.foto_url} nombre={colaboradoresPublico.find(c => c.id === s.responsableId)?.nombre || s.responsableNombre} size={22} />{colaboradoresPublico.find(c => c.id === s.responsableId)?.nombre || s.responsableNombre || '—'}</div></TableCell>}
                          <TableCell className="whitespace-nowrap font-bold text-primary">{s.tipo}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-bold text-success">{s.tipo === 'Pago a Tercero' ? formatMoneyByMoneda(parseFloat(s.valor) || 0, s.moneda || getMoneda(s.empresa)) : formatMoney(esTipoValorUnico(s.tipo) ? parseFloat(s.valor) : s.totalCalculado || 0, s.empresa)}</TableCell>
                          <TableCell className="text-center"><Badge variant={estadoBadge(s.estado)}>{s.estado}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* REPORTES Y DESCARGAS */}
            {(isReadOnly || user?.rol === 'Administrador' || user?.rol === 'Coordinadora Administrativa') && (
              <Card className="gap-4 px-0 py-6">
                <CardHeader className="sm:px-6">
                  <CardTitle className="flex items-center gap-2"><FileDown size={18} className="text-primary" /> Reportes y Descargas</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:px-6">
                  <div className="flex flex-wrap items-end gap-3">
                    <CampoUI label="Desde" htmlFor="rep-desde" className="w-[calc(50%-0.375rem)] sm:w-40">
                      <Input id="rep-desde" type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} />
                    </CampoUI>
                    <CampoUI label="Hasta" htmlFor="rep-hasta" className="w-[calc(50%-0.375rem)] sm:w-40">
                      <Input id="rep-hasta" type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} />
                    </CampoUI>
                    <p className="m-0 flex-[1_1_220px] text-xs text-muted-foreground">Las 3 descargas usan este rango de fechas (es el mismo del Dashboard Financiero) y solo incluyen lo que tu rol puede ver.</p>
                  </div>
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
                    {[
                      { onClick: downloadReporteFinanzas, icon: FileSpreadsheet, titulo: 'Descargar Reporte Finanzas (Excel)', detalle: 'Gastos, Pagos a Tercero, Traslados e Ingresos del período' },
                      { onClick: downloadReporteSolicitudes, icon: ClipboardList, titulo: 'Descargar Reporte Solicitudes (Excel)', detalle: 'Solicitudes del período con su estado' },
                      { onClick: downloadSoportesZIP, icon: progresoZip ? Loader2 : Archive, titulo: progresoZip ? `Descargando soportes… ${progresoZip.hechos}/${progresoZip.total || '?'}` : 'Descargar Soportes (ZIP)', detalle: 'Soportes del período de Solicitudes, Finanzas y Cuentas de cobro, por carpetas', disabled: !!progresoZip, cargando: !!progresoZip },
                    ].map(r => {
                      const Icono = r.icon;
                      return (
                        <button key={r.detalle} type="button" onClick={r.onClick} disabled={r.disabled}
                          className={cn('flex cursor-pointer items-start gap-3 rounded-lg border border-solid border-border bg-background p-4 text-left font-[inherit] transition-colors hover:border-primary hover:bg-secondary/30 disabled:opacity-70', r.cargando && 'cursor-wait')}>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Icono size={18} className={cn(r.cargando && 'animate-spin')} /></span>
                          <span className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-foreground">{r.titulo}</span>
                            <span className="text-xs text-muted-foreground">{r.detalle}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* MI PERFIL — visible para cualquier rol. Cada quien ve y edita SOLO su propia fila
            (miPerfilForm viene de miPerfil, que ya está limitado por RLS/derivado de usuariosDB).
            Nombre, Email, Rol, Empresa, Cargo, Fecha de Ingreso y Tipo de Vinculación NO son
            editables desde acá — esos siguen siendo responsabilidad de Administrador/Coordinadora. */}
        {currentView === 'mi-perfil' && (() => {
          const cumpleanosEsteMesTodos = colaboradoresPublico
            .filter(c => c.fecha_nacimiento)
            .map(c => ({ ...c, diaCumple: parseInt(c.fecha_nacimiento.substring(8, 10), 10), mesCumple: parseInt(c.fecha_nacimiento.substring(5, 7), 10) }))
            .filter(c => c.mesCumple === (new Date().getMonth() + 1))
            .sort((a, b) => a.diaCumple - b.diaCumple);

          if (!miPerfilForm) {
            return <p className="m-0 inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Cargando tu perfil...</p>;
          }

          // Etapa 3 del sistema de diseño: misma lógica; solo cambia la presentación.
          const seccion = (titulo, contenido, extra) => (
            <section className="flex flex-col gap-3">
              <h3 className="m-0 border-0 border-b border-solid border-border pb-2 text-sm font-bold">{titulo}</h3>
              {extra}
              {contenido}
            </section>
          );
          const grilla = 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]';
          const soloLectura = 'bg-muted text-muted-foreground disabled:opacity-100';

          return (
            <div className="flex flex-col gap-6">
              {cumpleanosEsteMesTodos.length > 0 && (
                <Card className="gap-3 border-l-4 border-l-primary px-0 py-5">
                  <CardHeader className="sm:px-7">
                    <CardTitle>🎂 Cumpleaños de {nombresMeses[new Date().getMonth()]}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3 sm:px-7">
                    {cumpleanosEsteMesTodos.map(c => (
                      <div key={c.id} className="flex items-center gap-2 rounded-full border border-solid border-border bg-background py-1.5 pl-1.5 pr-4">
                        <ColaboradorAvatar foto={c.foto_url} nombre={c.nombre} size={28} />
                        <span className="text-sm">{c.nombre} — día {c.diaCumple}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="gap-6 px-0 py-6">
                <CardHeader className="sm:px-7">
                  <CardTitle className="text-lg">🙋 Mi Perfil</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6 sm:px-7">
                  {seccion('Datos de la organización', (
                    <div className={grilla}>
                      <CampoUI label="Nombre Completo" htmlFor="mp-nombre"><Input id="mp-nombre" value={miPerfilForm.nombre} disabled className={soloLectura} /></CampoUI>
                      <CampoUI label="Email" htmlFor="mp-email"><Input id="mp-email" type="email" value={miPerfilForm.email} disabled className={soloLectura} /></CampoUI>
                      <CampoUI label="Rol" htmlFor="mp-rol"><Input id="mp-rol" value={miPerfilForm.rol} disabled className={soloLectura} /></CampoUI>
                      <CampoUI label="Empresa" htmlFor="mp-empresa"><Input id="mp-empresa" value={miPerfilForm.empresa} disabled className={soloLectura} /></CampoUI>
                      <CampoUI label="Cargo / Puesto" htmlFor="mp-cargo"><Input id="mp-cargo" value={miPerfilForm.cargo} disabled className={soloLectura} /></CampoUI>
                      <CampoUI label="Fecha de Ingreso" htmlFor="mp-ingreso"><Input id="mp-ingreso" value={miPerfilForm.fechaIngreso} disabled className={soloLectura} /></CampoUI>
                      <CampoUI label="Tipo de Vinculación" htmlFor="mp-vinculacion"><Input id="mp-vinculacion" value={miPerfilForm.tipoVinculacion} disabled className={soloLectura} /></CampoUI>
                    </div>
                  ), <p className="m-0 text-xs text-muted-foreground">Estos los administra Coordinadora Administrativa o Administrador — si algo está mal, avísales.</p>)}

                  {seccion('Datos personales', (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                      <div className="flex flex-col items-center gap-2">
                        <Label>Foto</Label>
                        <ColaboradorAvatar foto={miPerfilForm.foto} nombre={miPerfilForm.nombre} size={64} />
                        <label className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs', subiendoMiArchivo === 'foto' && 'pointer-events-none opacity-50')}>
                          {subiendoMiArchivo === 'foto' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {subiendoMiArchivo === 'foto' ? 'Subiendo...' : (miPerfilForm.foto ? 'Cambiar' : 'Subir foto')}
                          <input type="file" accept="image/*" disabled={subiendoMiArchivo === 'foto'} onChange={handleMiPerfilFoto} className="hidden" />
                        </label>
                        {miPerfilForm.foto && <Button variant="link" size="sm" onClick={handleMiPerfilQuitarFoto} className="h-auto p-0 text-xs text-destructive">Quitar foto</Button>}
                      </div>
                      <div className={cn(grilla, 'flex-1')}>
                        <CampoUI label="Tipo de Documento">
                          <SelectTipoDocumento value={miPerfilForm.tipoDocumento} placeholder="Seleccionar" onChange={(v) => setMiPerfilForm({ ...miPerfilForm, tipoDocumento: v })} style={estiloCampoUI} />
                        </CampoUI>
                        <CampoUI label="Número de Documento" htmlFor="mp-cedula">
                          <Input id="mp-cedula" placeholder="Solo números" value={miPerfilForm.cedula} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, cedula: e.target.value })} />
                        </CampoUI>
                        <CampoUI label="Teléfono" htmlFor="mp-telefono">
                          <Input id="mp-telefono" placeholder="Teléfono" value={miPerfilForm.telefono} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, telefono: e.target.value })} />
                        </CampoUI>
                        <CampoUI label="Fecha de Nacimiento" htmlFor="mp-nacimiento">
                          <Input id="mp-nacimiento" type="date" value={miPerfilForm.fechaNacimiento} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, fechaNacimiento: e.target.value })} />
                        </CampoUI>
                      </div>
                    </div>
                  ))}

                  {seccion('Funciones', (
                    <CampoUI label="Funciones (para la Cuenta de Cobro)" htmlFor="mp-funciones">
                      <Textarea id="mp-funciones" placeholder="Ej: Coordinar estrategias en el desarrollo de los proyectos deportivos asignados." value={miPerfilForm.funciones} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, funciones: e.target.value })} rows={2} />
                      <p className="m-0 text-xs text-muted-foreground">Se usa como el texto entre paréntesis del PDF de Cuenta de Cobro — se guarda una sola vez y se reutiliza cada mes.</p>
                    </CampoUI>
                  ))}

                  {seccion('Datos bancarios (para consignación y Cuenta de Cobro)', (
                    <div className={grilla}>
                      <CampoUI label="Banco">
                        <CampoBanco codigo={miPerfilForm.codigoBanco} texto={miPerfilForm.banco} onChange={({ codigo, texto }) => setMiPerfilForm({ ...miPerfilForm, codigoBanco: codigo, banco: texto })} style={estiloCampoUI} />
                        {!miPerfilForm.codigoBanco && miPerfilForm.banco && <p className="m-0 text-xs text-[#C4622D]">Antes: "{miPerfilForm.banco}" — elige el banco de la lista</p>}
                      </CampoUI>
                      <CampoUI label="Tipo de Cuenta" htmlFor="mp-tipo-cuenta">
                        <Select id="mp-tipo-cuenta" value={miPerfilForm.tipoCuentaBancaria} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, tipoCuentaBancaria: e.target.value })}>
                          <option value="">Seleccionar</option>
                          <option value="Ahorros">Ahorros</option>
                          <option value="Corriente">Corriente</option>
                        </Select>
                      </CampoUI>
                      <CampoUI label="Número de Cuenta" htmlFor="mp-numero-cuenta">
                        <Input id="mp-numero-cuenta" value={miPerfilForm.numeroCuenta} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, numeroCuenta: e.target.value })} />
                      </CampoUI>
                      <CampoUI label="Titular de la Cuenta" htmlFor="mp-titular">
                        <Input id="mp-titular" placeholder="Si es distinto a tu nombre" value={miPerfilForm.titularCuenta} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, titularCuenta: e.target.value })} />
                      </CampoUI>
                    </div>
                  ))}

                  {seccion('Contacto de emergencia y salud', (
                    <div className={grilla}>
                      <CampoUI label="Nombre Contacto de Emergencia" htmlFor="mp-emergencia-nombre">
                        <Input id="mp-emergencia-nombre" value={miPerfilForm.contactoEmergenciaNombre} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, contactoEmergenciaNombre: e.target.value })} />
                      </CampoUI>
                      <CampoUI label="Teléfono Contacto de Emergencia" htmlFor="mp-emergencia-telefono">
                        <Input id="mp-emergencia-telefono" value={miPerfilForm.contactoEmergenciaTelefono} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, contactoEmergenciaTelefono: e.target.value })} />
                      </CampoUI>
                      <CampoUI label="EPS" htmlFor="mp-eps">
                        <Input id="mp-eps" value={miPerfilForm.eps} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, eps: e.target.value })} />
                      </CampoUI>
                      <CampoUI label="ARL" htmlFor="mp-arl">
                        <Input id="mp-arl" value={miPerfilForm.arl} onChange={(e) => setMiPerfilForm({ ...miPerfilForm, arl: e.target.value })} />
                      </CampoUI>
                    </div>
                  ))}

                  {seccion('Documentos', (
                    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                      {['documentoCedula', 'documentoPasaporte'].map(campo => (
                        <div key={campo} className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-background p-4">
                          <Label>{campo === 'documentoCedula' ? 'Cédula' : 'Pasaporte'}</Label>
                          {miPerfilForm[campo] ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-1 text-sm text-success"><Paperclip size={14} /> Archivo cargado</span>
                              <Button variant="outline" size="sm" onClick={() => handleMiPerfilVerDocumento(miPerfilForm[campo])}><Eye size={14} /> Ver</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleMiPerfilEliminarDocumento(campo)} className="text-destructive"><Trash2 size={14} /> Quitar</Button>
                            </div>
                          ) : (
                            <Input type="file" accept=".pdf,image/*" aria-label={campo === 'documentoCedula' ? 'Cédula' : 'Pasaporte'} disabled={subiendoMiArchivo === campo} onChange={(e) => handleMiPerfilDocumento(e, campo)} className={claseInputArchivo} />
                          )}
                          {subiendoMiArchivo === campo && <p className="m-0 inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Subiendo...</p>}
                        </div>
                      ))}
                    </div>
                  ), <p className="m-0 text-xs text-muted-foreground">Se guardan en un almacenamiento privado — solo tú, Administrador y Coordinadora Administrativa pueden verlos.</p>)}

                  <Button size="lg" onClick={handleGuardarMiPerfil} disabled={guardandoMiPerfil} className={cn(guardandoMiPerfil && 'cursor-wait')}>
                    {guardandoMiPerfil ? <><Loader2 className="animate-spin" /> Guardando...</> : <><Check /> Guardar Cambios</>}
                  </Button>
                </CardContent>
              </Card>

              {/* SEGURIDAD — cambiar la contraseña de inicio de sesión, sin depender de Admin/Coordinadora */}
              <Card className="gap-4 px-0 py-6">
                <CardHeader className="sm:px-7">
                  <CardTitle className="text-lg">🔒 Seguridad</CardTitle>
                  {!mostrarCambiarPassword && <CardDescription>Cambia la contraseña con la que inicias sesión.</CardDescription>}
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:px-7">
                  {!mostrarCambiarPassword ? (
                    <Button variant="secondary" onClick={() => setMostrarCambiarPassword(true)} className="self-start">Cambiar mi contraseña</Button>
                  ) : (
                    <>
                      <div className={grilla}>
                        <CampoUI label="Contraseña actual" htmlFor="mp-pass-actual">
                          <Input id="mp-pass-actual" type="password" autoComplete="current-password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} />
                        </CampoUI>
                        <CampoUI label="Nueva contraseña" htmlFor="mp-pass-nueva">
                          <Input id="mp-pass-nueva" type="password" autoComplete="new-password" value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} />
                        </CampoUI>
                        <CampoUI label="Confirmar nueva contraseña" htmlFor="mp-pass-confirmar">
                          <Input id="mp-pass-confirmar" type="password" autoComplete="new-password" value={passwordConfirmar} onChange={(e) => setPasswordConfirmar(e.target.value)} />
                        </CampoUI>
                      </div>
                      <p className="m-0 text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
                      <div className="flex gap-3">
                        <Button onClick={handleCambiarPassword} disabled={cambiandoPassword} className={cn('flex-1', cambiandoPassword && 'cursor-wait')}>
                          {cambiandoPassword ? <><Loader2 className="animate-spin" /> Cambiando...</> : 'Guardar nueva contraseña'}
                        </Button>
                        <Button variant="outline" onClick={() => { setMostrarCambiarPassword(false); setPasswordActual(''); setPasswordNueva(''); setPasswordConfirmar(''); }}>Cancelar</Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {currentView === 'solicitudes' && (
          // Etapa 3 del sistema de diseño: Solicitudes migrado a los componentes de
          // src/components/ui/ (misma lógica, handlers y permisos que antes; solo cambia la presentación).
          <div className="flex flex-col gap-6">
              {/* Administrador y Coordinadora no crean solicitudes, solo las gestionan: no ven la
                  Bandeja ni "Nueva Solicitud". El formulario solo se les muestra al editar una
                  (✏️ en la tabla), porque la edición reutiliza ese mismo formulario. */}
              {!isReadOnly && !gestionaSolicitudes && (
                <Card className="gap-4 px-0 py-6 sm:py-7">
                  <CardHeader className="sm:px-7">
                    <CardTitle className="text-lg">📥 Mi Bandeja de Soportes</CardTitle>
                    <CardDescription>Sube aquí tus recibos y facturas a medida que te van llegando. Cuando quieras pedir una Legalización o Reembolso, marca los que quieras usar y el sistema prellena el formulario de abajo con esos datos.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 sm:px-7">

                  <div className="grid gap-3 rounded-lg border border-solid border-border bg-background p-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                    <CampoUI label="Fecha" htmlFor="bs-fecha"><Input id="bs-fecha" type="date" value={nuevoSoportePendiente.fecha} onChange={(e) => setNuevoSoportePendiente({...nuevoSoportePendiente, fecha: e.target.value})} /></CampoUI>
                    <CampoUI label="Pagado a" htmlFor="bs-proveedor"><Input id="bs-proveedor" type="text" placeholder="Pagado a" value={nuevoSoportePendiente.proveedor} onChange={(e) => setNuevoSoportePendiente({...nuevoSoportePendiente, proveedor: e.target.value})} /></CampoUI>
                    <CampoUI label="NIT" htmlFor="bs-nit"><Input id="bs-nit" type="text" placeholder="NIT" value={nuevoSoportePendiente.nit} onChange={(e) => setNuevoSoportePendiente({...nuevoSoportePendiente, nit: e.target.value})} /></CampoUI>
                    <CampoUI label="Por concepto de *" htmlFor="bs-desc"><Input id="bs-desc" type="text" placeholder="Por concepto de *" required value={nuevoSoportePendiente.descripcion} onChange={(e) => setNuevoSoportePendiente({...nuevoSoportePendiente, descripcion: e.target.value})} /></CampoUI>
                    <CampoUI label="Valor pagado" htmlFor="bs-valor"><Input id="bs-valor" type="number" placeholder="Valor pagado" value={nuevoSoportePendiente.valor} onChange={(e) => setNuevoSoportePendiente({...nuevoSoportePendiente, valor: e.target.value})} /></CampoUI>
                    <CampoUI label="Tipo de Soporte" htmlFor="bs-tipo">
                      <Select id="bs-tipo" value={nuevoSoportePendiente.tipoSoporte} onChange={(e) => setNuevoSoportePendiente({...nuevoSoportePendiente, tipoSoporte: e.target.value})}>
                        <option value="">Tipo de Soporte</option>
                        {tiposSoporte.map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </CampoUI>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input type="file" accept="application/pdf,image/*" onChange={handleSeleccionarArchivoPendiente} aria-label="Archivo del soporte" className={cn(claseInputArchivo, 'min-w-[200px] flex-1')} />
                    {nuevoSoportePendiente.archivo && <span className="flex items-center gap-1 text-xs text-success"><Paperclip size={14} /> {nuevoSoportePendiente.archivo.nombre}</span>}
                    <Button onClick={handleAgregarSoportePendiente} disabled={subiendoSoportePendiente}>
                      {subiendoSoportePendiente ? 'Subiendo...' : <><Plus size={16} /> Agregar a mi bandeja</>}
                    </Button>
                  </div>

                  {cargandoSoportesPendientes && <p className="m-0 text-sm text-muted-foreground">Cargando tu bandeja...</p>}

                  {soportesPendientes.length === 0 ? (
                    <p className="m-0 text-sm text-muted-foreground">Tu bandeja está vacía.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {bandejaSoloUltimo ? `Mostrando el último de ${soportesPendientes.length}` : `${soportesPendientes.length} en tu bandeja`}
                        </span>
                        {/* Para no tener que desplazarse tanto cuando hay muchos recibos acumulados
                            — "el último" es el primero de la lista (ya viene ordenada por fecha
                            descendente desde cargarSoportesPendientes). */}
                        <div className="flex gap-2">
                          <Button size="sm" variant={!bandejaSoloUltimo ? 'default' : 'outline'} onClick={() => setBandejaSoloUltimo(false)} aria-pressed={!bandejaSoloUltimo}>Ver todos</Button>
                          <Button size="sm" variant={bandejaSoloUltimo ? 'default' : 'outline'} onClick={() => setBandejaSoloUltimo(true)} aria-pressed={bandejaSoloUltimo}>Ver solo el último</Button>
                        </div>
                      </div>
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead></TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Pagado a</TableHead>
                            <TableHead>Concepto</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Archivo</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(bandejaSoloUltimo ? soportesPendientes.slice(0, 1) : soportesPendientes).map(item => {
                              const enEdicion = editandoPendienteId === item.id;
                              if (enEdicion) {
                                return (
                                  <TableRow key={item.id} className="bg-secondary/30 hover:bg-secondary/30">
                                    <TableCell></TableCell>
                                    <TableCell className="px-1.5"><Input type="date" aria-label="Fecha" value={pendienteEditData.fecha} onChange={(e) => setPendienteEditData({...pendienteEditData, fecha: e.target.value})} className="h-8 text-xs" /></TableCell>
                                    <TableCell className="px-1.5"><Input type="text" aria-label="Pagado a" value={pendienteEditData.proveedor} onChange={(e) => setPendienteEditData({...pendienteEditData, proveedor: e.target.value})} className="h-8 text-xs" /></TableCell>
                                    <TableCell className="px-1.5">
                                      <div className="flex flex-col gap-1">
                                        <Input type="text" placeholder="Concepto *" required value={pendienteEditData.descripcion} onChange={(e) => setPendienteEditData({...pendienteEditData, descripcion: e.target.value})} className="h-8 text-xs" />
                                        <Select aria-label="Tipo de Soporte" value={pendienteEditData.tipoSoporte} onChange={(e) => setPendienteEditData({...pendienteEditData, tipoSoporte: e.target.value})} className="h-8 text-xs">
                                          <option value="">Tipo de Soporte</option>
                                          {tiposSoporte.map(t => <option key={t} value={t}>{t}</option>)}
                                        </Select>
                                      </div>
                                    </TableCell>
                                    <TableCell className="px-1.5"><Input type="number" aria-label="Valor" value={pendienteEditData.valor} onChange={(e) => setPendienteEditData({...pendienteEditData, valor: e.target.value})} className="h-8 text-right text-xs" /></TableCell>
                                    <TableCell className="text-muted-foreground">{item.nombre}</TableCell>
                                    <TableCell className="whitespace-nowrap text-center">
                                      <Button variant="ghost" size="icon" onClick={() => handleGuardarEdicionPendiente(item.id)} disabled={guardandoEdicionPendiente} title="Guardar" aria-label="Guardar" className="text-success"><Check size={16} /></Button>
                                      <Button variant="ghost" size="icon" onClick={handleCancelarEdicionPendiente} disabled={guardandoEdicionPendiente} title="Cancelar" aria-label="Cancelar" className="text-muted-foreground"><X size={16} /></Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                              return (
                              <TableRow key={item.id}>
                                <TableCell className="text-center"><input type="checkbox" aria-label="Seleccionar soporte" checked={seleccionPendientes.includes(item.id)} onChange={() => toggleSeleccionPendiente(item.id)} className={claseCheckbox} /></TableCell>
                                <TableCell className="whitespace-nowrap text-muted-foreground">{item.fecha}</TableCell>
                                <TableCell className="text-muted-foreground">{item.proveedor}</TableCell>
                                <TableCell className="text-muted-foreground">{item.descripcion}</TableCell>
                                <TableCell className="whitespace-nowrap text-right font-bold text-success">{formatMoney(item.valor, user.rol === 'Responsable' ? user.empresa : newSolicitud.empresa)}</TableCell>
                                <TableCell className="text-muted-foreground">{item.nombre}</TableCell>
                                <TableCell className="whitespace-nowrap text-center">
                                  <Button variant="ghost" size="icon" onClick={() => handlePreviewSoporte(item)} disabled={cargandoPreviewSoporte} title="Ver archivo" aria-label="Ver archivo"><Eye size={16} /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleIniciarEdicionPendiente(item)} title="Editar" aria-label="Editar" className="text-[#6C63D1]"><Pencil size={16} /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleEliminarSoportePendiente(item)} title="Eliminar" aria-label="Eliminar" className="text-destructive"><Trash2 size={16} /></Button>
                                </TableCell>
                              </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => handleUsarPendientesEnSolicitud('Legalización')} disabled={seleccionPendientes.length === 0}>Usar seleccionados en Legalización</Button>
                        <Button variant="success" onClick={() => handleUsarPendientesEnSolicitud('Reembolso')} disabled={seleccionPendientes.length === 0}>Usar seleccionados en Reembolso</Button>
                        {/* "Legalización T. Pro" (gastos pagados con efectivo/tarjeta personal):
                            hoy solo aplica a este colaborador. */}
                        {user.nombre === COLABORADOR_LEGALIZACION_TPRO && (
                          <Button onClick={() => handleUsarPendientesEnSolicitud('Legalización T. Pro')} disabled={seleccionPendientes.length === 0} className={claseBotonMorado}>Usar seleccionados en Legalización T. Pro</Button>
                        )}
                      </div>
                    </>
                  )}
                  </CardContent>
                </Card>
              )}

              {(!gestionaSolicitudes || editingSolicitudId) && (
              <Card id="form-nueva-solicitud" className={cn('gap-4 px-0 py-6 sm:py-7', editingSolicitudId && 'border-2 border-[#6C63D1]')}>
                <CardHeader className="sm:px-7">
                  <CardTitle className={cn('text-lg', editingSolicitudId && 'text-[#6C63D1]')}>{editingSolicitudId ? '✏️ Editando Solicitud' : 'Nueva Solicitud'}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:px-7">

                {isReadOnly && (
                  <div className="rounded-lg border border-solid border-destructive bg-destructive/10 p-4 text-[#B0102B]">
                    <p className="m-0 font-bold">🔒 Modo Solo Lectura</p>
                    <p className="m-0 mt-2 text-sm">Los Contadores no pueden crear ni editar solicitudes. Solo pueden ver y descargar.</p>
                  </div>
                )}

                {editingSolicitudId && (() => {
                  const solicitudEnEdicion = solicitudes.find(x => x.id === editingSolicitudId);
                  const esLegalizadaTPro = solicitudEnEdicion?.tipo === 'Legalización T. Pro' && solicitudEnEdicion?.estado === 'Legalizado';
                  return (
                    <div className="rounded-lg border border-solid border-[#6C63D1] bg-[#F1EFFB] p-4 text-[#4A4499]">
                      <p className="m-0 font-bold">✏️ {esLegalizadaTPro ? 'Editando una Legalización T. Pro ya Legalizada' : 'Editando una Solicitud Pendiente'}</p>
                      <p className="m-0 mt-2 text-sm">
                        {esLegalizadaTPro
                          ? 'Corrige lo que haga falta. Como ya está Legalizada y el Gasto ya quedó registrado en Finanzas, se queda en estado "Legalizado" al guardar (no se reenvía a revisión).'
                          : 'Corrige lo que haga falta y agrega algún soporte faltante más abajo. El Tipo no se puede cambiar. Cuando termines, dale "Guardar Cambios" — o "Cancelar edición" para dejarla como estaba.'}
                      </p>
                    </div>
                  );
                })()}

                <div className={cn('grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]', isReadOnly && 'pointer-events-none opacity-50')}>
                  <CampoUI label="Fecha" htmlFor="sol-fecha"><Input id="sol-fecha" type="date" value={newSolicitud.fecha} onChange={(e) => setNewSolicitud({...newSolicitud, fecha: e.target.value})} /></CampoUI>
                  <CampoUI label="Tipo" htmlFor="sol-tipo">
                  <Select id="sol-tipo" value={newSolicitud.tipo} disabled={!!editingSolicitudId} onChange={(e) => {
                    const nuevoTipo = e.target.value;
                    setNewSolicitud({
                      ...newSolicitud,
                      tipo: nuevoTipo,
                      documentos: [],
                      // Pago a Tercero es el único tipo donde la Empresa que paga puede NO ser la
                      // propia del Responsable/Gerente (ej. un pago en USD que sale de ARKO en vez
                      // de su empresa de siempre) — se precarga con la suya como punto de partida,
                      // pero el selector de Empresa (abajo) queda editable para ese tipo.
                      empresa: ((nuevoTipo === 'Pago a Tercero' && user.rol === 'Responsable') || (user.rol === 'Gerente' && !newSolicitud.tipo && !editingSolicitudId && user.empresa)) ? user.empresa : newSolicitud.empresa
                    });
                  }}>
                    <option value="">Seleccionar Tipo</option>
                    <option value="Anticipo">Anticipo</option>
                    <option value="Legalización">Legalización</option>
                    <option value="Reembolso">Reembolso</option>
                    <option value="Pago a Tercero">Pago a Tercero</option>
                    <option value="Comisión">Comisión</option>
                    {/* "Legalización T. Pro" (gastos pagados con efectivo/tarjeta personal): hoy
                        solo aplica a un colaborador — se ofrece en el desplegable para él, y se
                        mantiene visible si ya se está editando una solicitud de ese tipo (para
                        que Administrador/Coordinadora también la vean correctamente). */}
                    {(user.nombre === COLABORADOR_LEGALIZACION_TPRO || newSolicitud.tipo === 'Legalización T. Pro') && (
                      <option value="Legalización T. Pro">Legalización T. Pro</option>
                    )}
                  </Select>
                  </CampoUI>
                  {/* Empresa a la que se le hace la solicitud: lista elegible para Administrador,
                      Coordinadora, Gerente y Colaborador (como en Cuentas de Cobro). Solo el
                      Responsable la tiene fija en su empresa (ese gasto sale de su propio
                      presupuesto), por eso el selector queda oculto para él. Pago a Tercero es la excepción: el pago puede necesitar
                      salir de OTRA empresa de la holding (ej. ARKO para pagar en USD) — sin esto,
                      quedaba fijo en su empresa de siempre y, al momento de pagar, el modal de
                      Confirmar Pago solo ofrecía las cuentas de esa empresa, sin forma de elegir la
                      cuenta correcta. */}
                  {(user.rol !== 'Responsable' || newSolicitud.tipo === 'Pago a Tercero') && (
                    <CampoUI label="Empresa" htmlFor="sol-empresa">
                      <Select id="sol-empresa" value={newSolicitud.empresa} onChange={(e) => setNewSolicitud({...newSolicitud, empresa: e.target.value})}>
                        {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                      </Select>
                    </CampoUI>
                  )}
                  {esTipoValorUnico(newSolicitud.tipo) && (
                    <CampoUI label={`${newSolicitud.tipo === 'Comisión' ? 'Valor de la Comisión' : 'Valor Solicitado'} (${getMoneda(user.rol === 'Responsable' ? user.empresa : newSolicitud.empresa)})`} htmlFor="sol-valor">
                      <Input id="sol-valor" type="number" placeholder={`${newSolicitud.tipo === 'Comisión' ? 'Valor de la Comisión' : 'Valor Solicitado'} (${getMoneda(user.rol === 'Responsable' ? user.empresa : newSolicitud.empresa)})`} value={newSolicitud.valor} onChange={(e) => setNewSolicitud({...newSolicitud, valor: e.target.value})} />
                    </CampoUI>
                  )}
                  {newSolicitud.tipo === 'Legalización' && (
                    <CampoUI label={`Valor Anticipo Original (${getMoneda(user.rol === 'Responsable' ? user.empresa : newSolicitud.empresa)})`} htmlFor="sol-anticipo">
                      <Input id="sol-anticipo" type="number" placeholder={`Valor Anticipo Original (${getMoneda(user.rol === 'Responsable' ? user.empresa : newSolicitud.empresa)})`} disabled={newSolicitud.anticipoIds.length > 0} value={newSolicitud.valorAnticipoOriginal} onChange={(e) => setNewSolicitud({...newSolicitud, valorAnticipoOriginal: e.target.value})} />
                    </CampoUI>
                  )}
                  {/* Pago a Tercero: la moneda del pago se elige aparte — no depende de la empresa
                      que paga, a diferencia de los demás tipos (puede ser una empresa en COP
                      pagando a un tercero en USD, o al revés). */}
                  {newSolicitud.tipo === 'Pago a Tercero' && (
                    <>
                      <CampoUI label="Moneda" htmlFor="sol-moneda">
                        <Select id="sol-moneda" value={newSolicitud.moneda} onChange={(e) => setNewSolicitud({...newSolicitud, moneda: e.target.value})}>
                          <option value="COP">Pesos Colombianos (COP)</option>
                          <option value="USD">Dólares (USD)</option>
                        </Select>
                      </CampoUI>
                      <CampoUI label={`Valor a Pagar (${newSolicitud.moneda})`} htmlFor="sol-valor-tercero">
                        <Input id="sol-valor-tercero" type="number" placeholder={`Valor a Pagar (${newSolicitud.moneda})`} value={newSolicitud.valor} onChange={(e) => setNewSolicitud({...newSolicitud, valor: e.target.value})} />
                      </CampoUI>
                    </>
                  )}
                </div>

                {newSolicitud.tipo === 'Legalización' && (() => {
                  const misAnticipos = solicitudes.filter(a => a.tipo === 'Anticipo' && a.responsableId === user.id);
                  if (misAnticipos.length === 0) return null;
                  // Un Anticipo ya legalizado (cualquier Legalización propia, en cualquier estado,
                  // que ya lo tenga en su anticipo_ids) se muestra tachado y deshabilitado, para no
                  // volver a seleccionarlo por error y duplicar la legalización. Si se está
                  // EDITANDO una Legalización, esa misma solicitud se excluye de la comparación —
                  // si no, sus propios anticipos vinculados aparecerían tachados e imposibles de
                  // desmarcar.
                  const idsYaLegalizados = new Set(
                    solicitudes
                      .filter(x => x.tipo === 'Legalización' && x.responsableId === user.id && x.id !== editingSolicitudId)
                      .flatMap(x => x.anticipoIds || [])
                  );
                  return (
                    <div className="flex flex-col gap-1.5">
                      <Label>Vincular a los Anticipos que se están legalizando (opcional, recomendado — puedes elegir varios)</Label>
                      <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto rounded-lg border border-solid border-border bg-background p-3">
                        {misAnticipos.map(a => {
                          const yaLegalizado = idsYaLegalizados.has(a.id);
                          const seleccionado = newSolicitud.anticipoIds.includes(a.id);
                          return (
                            <label key={a.id} className={cn('flex items-center gap-2 text-sm', yaLegalizado ? 'cursor-not-allowed text-muted-foreground line-through' : 'cursor-pointer')}>
                              <input
                                type="checkbox"
                                className={claseCheckbox}
                                disabled={yaLegalizado}
                                checked={seleccionado}
                                onChange={(e) => {
                                  const marcado = e.target.checked;
                                  const nuevosIds = marcado
                                    ? [...newSolicitud.anticipoIds, a.id]
                                    : newSolicitud.anticipoIds.filter(id => id !== a.id);
                                  const nuevosAnticipos = misAnticipos.filter(x => nuevosIds.includes(x.id));
                                  const sumaValor = nuevosAnticipos.reduce((sum, x) => sum + (parseFloat(x.valor) || 0), 0);
                                  setNewSolicitud({...newSolicitud, anticipoIds: nuevosIds, valorAnticipoOriginal: nuevosIds.length > 0 ? sumaValor : ''});
                                }}
                              />
                              <span>{a.fecha} — {formatMoney(a.valor, a.empresa)}{yaLegalizado ? '  (ya legalizado)' : ''}</span>
                            </label>
                          );
                        })}
                      </div>
                      {newSolicitud.anticipoIds.length > 1 && (
                        <div className="text-xs text-[#6C63D1]">
                          {newSolicitud.anticipoIds.length} anticipos seleccionados — suma: {formatMoney(parseFloat(newSolicitud.valorAnticipoOriginal) || 0, newSolicitud.empresa)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <CampoUI label="Concepto *" htmlFor="sol-concepto">
                  <Input id="sol-concepto" type="text" placeholder="Concepto * (obligatorio)" required value={newSolicitud.detalle} onChange={(e) => setNewSolicitud({...newSolicitud, detalle: e.target.value})} aria-invalid={newSolicitud.tipo && !newSolicitud.detalle.trim() ? true : undefined} />
                </CampoUI>

                {newSolicitud.tipo === 'Pago a Tercero' && (
                  <>
                    <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-background p-4">
                      <h3 className="m-0 text-base font-bold">Información del Tercero</h3>

                      {/* Elegir un tercero ya guardado prellena todo lo de abajo — así, si el pago se
                          repite, solo hace falta ingresar el Valor. */}
                      <div className="flex gap-2">
                        <Select aria-label="Tercero guardado" value={newSolicitud.terceroId} onChange={(e) => {
                          const id = e.target.value;
                          if (!id) {
                            setNewSolicitud({...newSolicitud, terceroId: '', terceroNombre: '', terceroDni: '', terceroTipoDocumento: '', terceroPaisOrigen: '', terceroBanco: '', terceroCodigoBanco: '', terceroTipoCuenta: '', terceroNumeroCuenta: '', guardarTercero: true, actualizarTercero: false});
                            return;
                          }
                          const t = tercerosDB.find(x => x.id === id);
                          // "Actualizar" queda marcada por defecto al elegir un tercero guardado: si se
                          // edita Nombre/DNI/banco/etc. abajo, el catálogo compartido se sincroniza solo
                          // al guardar (se puede desmarcar si esta vez NO se quiere tocar el catálogo).
                          setNewSolicitud({...newSolicitud, terceroId: id, terceroNombre: t?.nombre || '', terceroDni: t?.dni || '', terceroTipoDocumento: t?.tipo_documento || '', terceroPaisOrigen: t?.pais_origen || '', terceroBanco: t?.banco || '', terceroCodigoBanco: t?.codigo_banco || inferirCodigoBanco(t?.banco), terceroTipoCuenta: t?.tipo_cuenta || '', terceroNumeroCuenta: t?.numero_cuenta || '', guardarTercero: false, actualizarTercero: true});
                        }}>
                          <option value="">➕ Nuevo tercero</option>
                          {tercerosDB.map(t => <option key={t.id} value={t.id}>{t.nombre} — {t.dni}</option>)}
                        </Select>
                        {/* Eliminar del catálogo: solo Admin/Coordinadora, mismos roles que ya pueden
                            editar terceros en Supabase (RLS) — evita mostrar un botón que a otros roles
                            les fallaría al hacer clic. Es un borrado lógico (activo=false, nunca se
                            borra la fila) para no romper el vínculo con pagos históricos que ya lo usaron. */}
                        {newSolicitud.terceroId && (user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
                          <Button variant="outline" size="icon" onClick={() => handleEliminarTercero(newSolicitud.terceroId)} className="shrink-0 text-destructive" title="Eliminar este tercero del catálogo" aria-label="Eliminar este tercero del catálogo">
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                        <Input type="text" aria-label="Nombre completo" placeholder="Nombre completo *" value={newSolicitud.terceroNombre} onChange={(e) => setNewSolicitud({...newSolicitud, terceroNombre: e.target.value})} />
                        <SelectTipoDocumento value={newSolicitud.terceroTipoDocumento} onChange={(v) => setNewSolicitud({...newSolicitud, terceroTipoDocumento: v})} style={estiloCampoUI} />
                        <Input type="text" aria-label="Documento" placeholder="Documento (NIT sin DV) *" value={newSolicitud.terceroDni} onChange={(e) => setNewSolicitud({...newSolicitud, terceroDni: e.target.value})} />
                        <Input type="text" aria-label="País de origen" placeholder="País de origen" value={newSolicitud.terceroPaisOrigen} onChange={(e) => setNewSolicitud({...newSolicitud, terceroPaisOrigen: e.target.value})} />
                      </div>
                      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                        <CampoBanco codigo={newSolicitud.terceroCodigoBanco} texto={newSolicitud.terceroBanco} onChange={({ codigo, texto }) => setNewSolicitud({...newSolicitud, terceroCodigoBanco: codigo, terceroBanco: texto})} style={estiloCampoUI} />
                        <Select aria-label="Tipo de cuenta" value={newSolicitud.terceroTipoCuenta} onChange={(e) => setNewSolicitud({...newSolicitud, terceroTipoCuenta: e.target.value})}>
                          <option value="">Tipo de cuenta</option>
                          <option value="Ahorros">Ahorros</option>
                          <option value="Corriente">Corriente</option>
                        </Select>
                        <Input type="text" aria-label="Número de cuenta" placeholder="Número de cuenta" value={newSolicitud.terceroNumeroCuenta} onChange={(e) => setNewSolicitud({...newSolicitud, terceroNumeroCuenta: e.target.value})} />
                      </div>

                      {!newSolicitud.terceroId ? (
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                          <input type="checkbox" className={claseCheckbox} checked={newSolicitud.guardarTercero} onChange={(e) => setNewSolicitud({...newSolicitud, guardarTercero: e.target.checked})} />
                          💾 Guardar este tercero para futuros pagos (la próxima vez solo se ingresa el valor)
                        </label>
                      ) : (
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                          <input type="checkbox" className={claseCheckbox} checked={newSolicitud.actualizarTercero} onChange={(e) => setNewSolicitud({...newSolicitud, actualizarTercero: e.target.checked})} />
                          🔄 Actualizar los datos guardados de este tercero con lo que edité arriba
                        </label>
                      )}
                    </div>

                    {/* SOPORTES — archivos simples (foto, PDF, etc.), sin unirse en un solo PDF */}
                    <ListaSoportesUI
                      titulo="Soportes (foto, PDF, etc.)"
                      inputProps={{ multiple: true, onChange: handleAddSoporteTercero }}
                      archivos={soportesTerceroTemp}
                      resumen={`Archivos cargados: ${soportesTerceroTemp.length}`}
                      onQuitar={handleRemoveSoporteTercero}
                    />
                  </>
                )}

                {(newSolicitud.tipo === 'Legalización' || newSolicitud.tipo === 'Reembolso' || newSolicitud.tipo === 'Legalización T. Pro') && (
                  <>
                    <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-background p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="m-0 text-base font-bold">Ítems del Gasto</h3>
                        <Button size="sm" onClick={handleAddDocumento}><Plus size={14} /> Agregar</Button>
                      </div>

                      {newSolicitud.documentos.map((doc, idx) => (
                        <div key={idx} className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-card p-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr_1fr_1.6fr]">
                            <Input type="date" aria-label="Fecha del Gasto" placeholder="Fecha del Gasto" value={doc.fecha || ''} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].fecha = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }} />
                            <Input type="text" aria-label="Pagado a" placeholder="Pagado a" value={doc.proveedor} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].proveedor = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }} />
                            <Input type="text" aria-label="NIT" placeholder="NIT" value={doc.nit} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].nit = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }} />
                            <Input type="text" aria-label="Por concepto de" placeholder="Por concepto de *" required value={doc.descripcion} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].descripcion = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }} aria-invalid={(doc.descripcion || '').trim() ? undefined : true} />
                          </div>
                          <div className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
                            <Input type="number" aria-label="Valor pagado" placeholder="Valor pagado" value={doc.valor} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].valor = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }} />
                            <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                              <Select aria-label="Tipo de Soporte" value={doc.tipoSoporte || ''} onChange={(e) => { const newDocs = [...newSolicitud.documentos]; newDocs[idx].tipoSoporte = e.target.value; setNewSolicitud({...newSolicitud, documentos: newDocs}); }}>
                                <option value="">Tipo de Soporte</option>
                                {tiposSoporte.map(t => <option key={t} value={t}>{t}</option>)}
                              </Select>
                            </div>
                            <Button variant="outline" size="icon" onClick={() => handleDeleteDocumento(idx)} className="text-destructive" title="Quitar ítem" aria-label="Quitar ítem"><Trash2 size={16} /></Button>
                          </div>
                        </div>
                      ))}

                      {newSolicitud.documentos.length > 0 && (
                        <p className="m-0 text-right text-sm font-bold">
                          Total: {formatMoney(newSolicitud.documentos.reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0), user.rol === 'Responsable' ? user.empresa : newSolicitud.empresa)}
                        </p>
                      )}
                    </div>

                    {/* SOPORTES CONSOLIDADOS — se unen automáticamente en un solo PDF al guardar.
                        SOLO aplica al CREAR: el PDF consolidado se arma una sola vez al crear la
                        solicitud. En modo edición este bloque no se muestra (ver más abajo
                        "Agregar soporte faltante") porque, antes de este fix, los archivos
                        subidos aquí durante una edición se descartaban en silencio al guardar
                        — el código de guardado solo arma el PDF consolidado "!editingSolicitudId". */}
                    {!editingSolicitudId && (
                      <ListaSoportesUI
                        titulo="Soportes (PDFs e imágenes — se unen en un solo PDF)"
                        inputProps={{ multiple: true, accept: 'application/pdf,image/*', onChange: handleAddSoporteLegalizacion }}
                        archivos={soportesLegalizacionTemp}
                        resumen={`Archivos cargados: ${soportesLegalizacionTemp.length} (se unirán en un solo PDF al guardar)`}
                        onQuitar={handleRemoveSoporteLegalizacion}
                      />
                    )}
                  </>
                )}

                {newSolicitud.tipo === 'Comisión' && !editingSolicitudId && (
                  <ListaSoportesUI
                    titulo="Soportes de la comisión * (PDFs e imágenes — se unen en un solo PDF)"
                    inputProps={{ multiple: true, accept: 'application/pdf,image/*', onChange: handleAddSoporteLegalizacion }}
                    archivos={soportesLegalizacionTemp}
                    resumen={`Archivos cargados: ${soportesLegalizacionTemp.length} (se unirán en un solo PDF al guardar)`}
                    onQuitar={handleRemoveSoporteLegalizacion}
                  />
                )}

                {editingSolicitudId && (
                  <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-background p-4">
                    <h3 className="m-0 flex items-center gap-1.5 text-sm font-bold text-[#6C63D1]"><Paperclip size={15} /> Agregar soporte(s) de los ítems nuevos / faltante</h3>
                    <p className="m-0 text-xs text-muted-foreground">Sube aquí los soportes de los ítems que agregaste arriba (o algún soporte que haya faltado al crear la solicitud). Al guardar se fusionan con el PDF ya consolidado en uno solo nuevo — no quedan sueltos.</p>
                    <Input type="file" accept="application/pdf,image/*" multiple onChange={handleSeleccionarSoporteAdicionalEdicion} aria-label="Agregar soportes" className={claseInputArchivo} />
                    {soportesAdicionalesEdicion.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {soportesAdicionalesEdicion.map(soporte => (
                          <div key={soporte.id} className="flex items-center justify-between gap-2 rounded-md border border-solid border-border bg-card px-3 py-1.5">
                            <span className="flex min-w-0 items-center gap-1 truncate text-xs text-success"><Paperclip size={13} /> {soporte.nombre}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleQuitarSoporteAdicionalEdicion(soporte.id)} className="size-7 text-destructive" title="Quitar archivo" aria-label="Quitar archivo"><Trash2 size={14} /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button size="lg" onClick={handleAddSolicitud} disabled={isReadOnly || guardandoSolicitud} className={cn('flex-1', editingSolicitudId && claseBotonMorado)}>
                    {guardandoSolicitud ? '⏳ Guardando...' : (editingSolicitudId ? '✅ Guardar Cambios' : 'Guardar Solicitud')}
                  </Button>
                  {editingSolicitudId && (
                    <Button size="lg" variant="outline" onClick={handleCancelarEdicionSolicitud} disabled={guardandoSolicitud}>
                      Cancelar edición
                    </Button>
                  )}
                </div>
                </CardContent>
              </Card>
              )}

            <Card className="gap-4 px-0 py-6 sm:py-7">
              <CardHeader className="sm:px-7">
                <CardTitle className="text-lg">
                  📋 {soloPropias ? 'Mis Solicitudes' : user.rol === 'Contadora' ? 'Solicitudes Auditadas' : 'Todas las Solicitudes'} ({solicitudesFiltradas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:px-7">

              {/* FILTROS: buscador de texto libre + Tipo/Estado/(Empresa) + rango de fechas.
                  Empresa solo se ofrece a los roles que de por sí ven varias empresas a la vez —
                  Responsable/Gerente ya están limitados a la suya por `solicitudesUsuario`. */}
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-solid border-border bg-background p-4">
                <CampoUI label="Buscar" htmlFor="fs-buscar" className="min-w-[200px] flex-[1_1_220px]">
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="fs-buscar" type="text" placeholder="Colaborador, concepto, empresa..." value={busquedaSolicitudes} onChange={(e) => setBusquedaSolicitudes(e.target.value)} className="pl-8" />
                  </div>
                </CampoUI>
                <CampoUI label="Tipo" htmlFor="fs-tipo" className="w-full sm:w-44">
                  <Select id="fs-tipo" value={filtroSolicitudesTipo} onChange={(e) => setFiltroSolicitudesTipo(e.target.value)}>
                    <option value="Todos">Todos</option>
                    {tiposSolicitud.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </CampoUI>
                <CampoUI label="Estado" htmlFor="fs-estado" className="w-full sm:w-36">
                  <Select id="fs-estado" value={filtroSolicitudesEstado} onChange={(e) => setFiltroSolicitudesEstado(e.target.value)}>
                    <option value="Todos">Todos</option>
                    {estadosSolicitud.map(e => <option key={e} value={e}>{e}</option>)}
                  </Select>
                </CampoUI>
                {(user.rol === 'Administrador' || user.rol === 'Contadora' || user.rol === 'Coordinadora Administrativa') && (
                  <CampoUI label="Empresa" htmlFor="fs-empresa" className="w-full sm:w-60">
                    <Select id="fs-empresa" value={filtroSolicitudesEmpresa} onChange={(e) => setFiltroSolicitudesEmpresa(e.target.value)}>
                      <option value="Todas">Todas</option>
                      {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </Select>
                  </CampoUI>
                )}
                <CampoUI label="Desde" htmlFor="fs-desde" className="w-full sm:w-40">
                  <Input id="fs-desde" type="date" value={filtroSolicitudesFechaInicio} onChange={(e) => setFiltroSolicitudesFechaInicio(e.target.value)} />
                </CampoUI>
                <CampoUI label="Hasta" htmlFor="fs-hasta" className="w-full sm:w-40">
                  <Input id="fs-hasta" type="date" value={filtroSolicitudesFechaFin} onChange={(e) => setFiltroSolicitudesFechaFin(e.target.value)} />
                </CampoUI>
                <Button variant="outline" onClick={() => { setBusquedaSolicitudes(''); setFiltroSolicitudesTipo('Todos'); setFiltroSolicitudesEstado('Todos'); setFiltroSolicitudesEmpresa('Todas'); setFiltroSolicitudesFechaInicio(''); setFiltroSolicitudesFechaFin(''); }}><RotateCcw size={14} /> Reiniciar</Button>
              </div>

              {cargandoSolicitudes && <p className="m-0 text-sm text-muted-foreground">Cargando solicitudes...</p>}

              {/* Barra de Pago en Lote — solo Administrador/Coordinadora Administrativa. Aparece en
                  cuanto hay al menos un Reembolso o Pago a Tercero marcado con el checkbox de la
                  tabla (los dos tipos comparten esta función, pero no se mezclan en un mismo lote). */}
              {canApprove && seleccionReembolsosPago.length > 0 && (() => {
                const seleccionados = solicitudesUsuario.filter(s => seleccionReembolsosPago.includes(s.id));
                const tipoSeleccion = seleccionados[0]?.tipo;
                const empresaSeleccion = seleccionados[0]?.empresa;
                const esTerceroSeleccion = tipoSeleccion === 'Pago a Tercero';
                const monedaSeleccion = esTerceroSeleccion ? (seleccionados[0]?.moneda || getMoneda(empresaSeleccion)) : null;
                const totalSeleccion = seleccionados.reduce((sum, s) => sum + calcularAccionFinanzasSolicitud(s).monto, 0);
                const totalFormateado = esTerceroSeleccion ? formatMoneyByMoneda(totalSeleccion, monedaSeleccion) : formatMoney(totalSeleccion, empresaSeleccion);
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-solid border-primary bg-[#FBF3DC] px-5 py-3">
                    <span className="text-sm text-[#6B5A1E]">
                      <strong>{seleccionados.length}</strong> {etiquetaTipoLote(seleccionados.map(x => x.tipo), seleccionados.length !== 1)} {!esTerceroSeleccion && <>de <strong>{colaboradoresPublico.find(c => c.id === seleccionados[0]?.responsableId)?.nombre || seleccionados[0]?.responsableNombre || 'colaborador'}</strong> </>}— <strong>{empresaSeleccion}</strong> seleccionado{seleccionados.length !== 1 ? 's' : ''} — total <strong>{totalFormateado}</strong>
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSeleccionReembolsosPago([])}>Cancelar selección</Button>
                      <Button size="sm" onClick={handleAbrirPagoLoteReembolsos}>💳 Pagar seleccionados en lote</Button>
                    </div>
                  </div>
                );
              })()}

              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {canApprove && <TableHead className="text-center"></TableHead>}
                    <TableHead>Fecha</TableHead>
                    {(user.rol === 'Administrador' || user.rol === 'Contadora' || user.rol === 'Coordinadora Administrativa') && <TableHead>Colaborador</TableHead>}
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right"><EncabezadoAbreviado corto="Ant. orig." largo="Anticipo original" /></TableHead>
                    <TableHead className="text-right"><EncabezadoAbreviado corto="Dif. reemb." largo="Diferencia a reembolsar" /></TableHead>
                    <TableHead className="text-center">Docs</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {solicitudesFiltradas.length === 0 ? (
                      <TableRow className="hover:bg-transparent"><TableCell colSpan={canApprove ? 11 : 10} className="py-8 text-center text-muted-foreground">Sin solicitudes para estos filtros.</TableCell></TableRow>
                    ) : solicitudesFiltradas.map(s => {
                      // Legalización con anticipo vinculado: base para las 2 columnas nuevas y para
                      // marcar el anticipo original como "ya legalizado" (solo visual, no toca s.estado).
                      // Nota: la búsqueda del vínculo sigue mirando TODAS las solicitudes del usuario
                      // (no solo las que pasan el filtro de la tabla), para no perder el aviso "✅ Ya
                      // legalizado" en el Anticipo si su Legalización quedó oculta por el filtro.
                      const esLegalizacionConAnticipo = s.tipo === 'Legalización' && s.valorAnticipoOriginal;
                      const diferenciaReembolso = esLegalizacionConAnticipo ? (s.totalCalculado || 0) - parseFloat(s.valorAnticipoOriginal) : null;
                      const legalizacionVinculada = s.tipo === 'Anticipo' ? solicitudesUsuario.find(x => x.tipo === 'Legalización' && (x.anticipoIds || []).includes(s.id)) : null;
                      // Checkbox de Pago en Lote: Reembolsos, Anticipos y Pago a Tercero "Aprobado" son elegibles
                      // (Reembolsos y Anticipos se pueden combinar; Pago a Tercero va aparte)
                      // (no mezclados entre sí), y dentro de un mismo lote solo se puede mezclar la
                      // MISMA empresa — un comprobante de banco corresponde a una sola cuenta
                      // bancaria — y, si es Pago a Tercero, también la MISMA moneda (COP/USD), porque
                      // el pago sale de una sola cuenta en una sola divisa.
                      const primeraSeleccionada = seleccionReembolsosPago.length > 0 ? solicitudesUsuario.find(x => x.id === seleccionReembolsosPago[0]) : null;
                      const empresaLoteActual = primeraSeleccionada?.empresa || null;
                      const tipoLoteActual = primeraSeleccionada?.tipo || null;
                      const monedaLoteActual = primeraSeleccionada?.tipo === 'Pago a Tercero' ? (primeraSeleccionada?.moneda || getMoneda(primeraSeleccionada?.empresa)) : null;
                      const elegibleParaLote = TIPOS_PAGO_LOTE_SOLICITUD.includes(s.tipo) && s.estado === 'Aprobado';
                      const monedaSolicitud = s.tipo === 'Pago a Tercero' ? (s.moneda || getMoneda(s.empresa)) : null;
                      const deshabilitadoPorEmpresa = elegibleParaLote && !!tipoLoteActual && (
                        grupoPagoLote(s.tipo) !== grupoPagoLote(tipoLoteActual) ||
                        // Reembolsos/Anticipos: un lote = UN colaborador (una sola cuenta destino).
                        (grupoPagoLote(tipoLoteActual) === 'colaboradores' && s.responsableId !== primeraSeleccionada?.responsableId) ||
                        s.empresa !== empresaLoteActual ||
                        (tipoLoteActual === 'Pago a Tercero' && monedaSolicitud !== monedaLoteActual)
                      );
                      return (
                      <TableRow key={s.id}>
                        {canApprove && (
                          <TableCell className="text-center">
                            {elegibleParaLote && (
                              <input
                                type="checkbox"
                                className={claseCheckbox}
                                checked={seleccionReembolsosPago.includes(s.id)}
                                disabled={deshabilitadoPorEmpresa}
                                onChange={() => handleToggleSeleccionReembolso(s.id)}
                                title={deshabilitadoPorEmpresa ? (grupoPagoLote(tipoLoteActual) === 'colaboradores' && grupoPagoLote(s.tipo) === 'colaboradores' && s.responsableId !== primeraSeleccionada?.responsableId && s.empresa === empresaLoteActual ? `Ya elegiste reembolsos/anticipos de ${colaboradoresPublico.find(c => c.id === primeraSeleccionada?.responsableId)?.nombre || primeraSeleccionada?.responsableNombre || 'otro colaborador'} — un lote es de un solo colaborador (una sola cuenta destino)` : `Ya elegiste ${grupoPagoLote(tipoLoteActual) === 'terceros' ? 'pagos a tercero' : 'reembolsos/anticipos'} de ${empresaLoteActual}${monedaLoteActual ? ` en ${monedaLoteActual}` : ''} — un lote es de una sola empresa${tipoLoteActual === 'Pago a Tercero' ? ', moneda y solo pagos a tercero' : ', un solo colaborador y sin mezclar con pagos a tercero'}`) : 'Elegir para pago en lote'}
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{s.fecha}</TableCell>
                        {(user.rol === 'Administrador' || user.rol === 'Contadora' || user.rol === 'Coordinadora Administrativa') && <TableCell className="text-xs"><div className="flex items-center gap-2"><ColaboradorAvatar foto={colaboradoresPublico.find(c => c.id === s.responsableId)?.foto_url} nombre={colaboradoresPublico.find(c => c.id === s.responsableId)?.nombre || s.responsableNombre} size={22} />{colaboradoresPublico.find(c => c.id === s.responsableId)?.nombre || s.responsableNombre || '—'}</div></TableCell>}
                        <TableCell className="whitespace-nowrap font-bold text-primary">{s.tipo}</TableCell>
                        <TableCell className="min-w-[200px] max-w-[280px] text-muted-foreground">
                          <TextoResumido texto={s.detalle} />
                          {s.tipo === 'Pago a Tercero' && s.terceroInfo?.nombre && (
                            <div className="text-[0.7rem] text-muted-foreground">👤 {s.terceroInfo.nombre}{s.terceroInfo.dni ? ` · ${s.terceroInfo.dni}` : ''}</div>
                          )}
                          {s.estado === 'Devuelto' && s.motivoDevolucion && (
                            <div className="mt-1.5 rounded-md border border-solid border-[#C4622D] bg-[#FBEAE0] px-2.5 py-1.5 text-[0.7rem] text-[#8A3E17]">
                              ↩️ <strong>Motivo de devolución:</strong> {s.motivoDevolucion}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-bold text-success">{s.tipo === 'Pago a Tercero' ? formatMoneyByMoneda(parseFloat(s.valor) || 0, s.moneda || getMoneda(s.empresa)) : formatMoney(esTipoValorUnico(s.tipo) ? parseFloat(s.valor) : s.totalCalculado || 0, s.empresa)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-muted-foreground">{esLegalizacionConAnticipo ? formatMoney(parseFloat(s.valorAnticipoOriginal), s.empresa) : '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-bold">
                          {esLegalizacionConAnticipo ? (
                            <span className={diferenciaReembolso > 0 ? 'text-success' : diferenciaReembolso < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                              {diferenciaReembolso > 0 ? '+' : diferenciaReembolso < 0 ? '−' : ''}{formatMoney(Math.abs(diferenciaReembolso), s.empresa)}
                            </span>
                          ) : '—'}
                        </TableCell>
                        {/* "documentos" solo se llena en Legalización/Reembolso (desglose de la
                            Bandeja de Soportes); Pago a Tercero (y cualquier archivo suelto) sube
                            directo a public.soportes sin pasar por ahí — por eso, si "documentos"
                            viene vacío, se muestra el conteo real de soportes en su lugar. */}
                        {(() => {
                          const numDocs = (s.documentos && s.documentos.length > 0) ? s.documentos.length : (s.cantidadSoportes || 0);
                          return <TableCell className={cn('text-center', numDocs > 0 ? 'text-success' : 'text-muted-foreground')}>{numDocs}</TableCell>;
                        })()}
                        <TableCell className="text-center">
                          {canApprove ? (
                            <select aria-label="Cambiar estado" value={s.estado} onChange={(e) => {
                              const nuevoEstado = e.target.value;
                              // Pasar a "Pagado" pide antes Cuenta (+ CECO si no es Pago a Tercero) +
                              // Comprobante del banco en el modal "Confirmar Pago" — pero solo cuando
                              // el cambio realmente mueve plata (una Legalización cuadrada no genera
                              // nada en Finanzas, así que no interrumpe con el modal). El resto de
                              // transiciones sigue igual. "Legalización T. Pro" es la excepción: pasar
                              // a "Legalizado" NO abre ese modal (no hace falta relacionar Cuenta,
                              // CECO ni Comprobante) — el Gasto en Finanzas se genera solo, directo,
                              // igual que cualquier otra transición (ver handleChangeEstado).
                              if (nuevoEstado === 'Pagado' && !s.gastoGeneradoId && !s.ingresoGeneradoId && calcularAccionFinanzasSolicitud(s).accion !== 'ninguno') {
                                setConfirmarPagoSolicitud({ solicitud: s, cuenta: '', ceco: '', comprobantes: [], fechaPago: fechaHoyLocal(), ...calcularAccionFinanzasSolicitud(s) });
                              } else if (nuevoEstado === 'Devuelto') {
                                // Pide el motivo antes de guardar nada — sin él, el colaborador no
                                // sabría qué corregir (ver modal "Devolver Solicitud").
                                handleAbrirDevolverSolicitud(s);
                              } else {
                                handleChangeEstado(s.id, nuevoEstado);
                              }
                            }} className={cn(badgeVariants({ variant: estadoBadge(s.estado) }), claseSelectEstado)}>
                              {estadosParaSolicitud(s).map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                          ) : (
                            <Badge variant={estadoBadge(s.estado)}>{s.estado}</Badge>
                          )}
                          {legalizacionVinculada && (
                            <div className="mt-1.5 text-[0.65rem] font-bold text-[#6C63D1]">✅ Ya legalizado</div>
                          )}
                          {s.estado === 'Aprobado' && lotePorClave[`solicitud:${s.id}`] && (
                            <div title="Ya va en un archivo PAB generado para el banco; falta confirmar el pago" className="mt-1.5 text-[0.65rem] font-bold text-chart-3">📤 Exportado · lote #{lotePorClave[`solicitud:${s.id}`]}</div>
                          )}
                          {s.lotePagoId && (
                            <button type="button" onClick={() => handleVerLotePagoSolicitudes(s.lotePagoId)} className="mx-auto mt-1.5 block cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[0.65rem] font-bold text-[#6C63D1] hover:underline">
                              🔗 Pagado en lote
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center">
                          {(s.tipo === 'Legalización' || s.tipo === 'Reembolso' || s.tipo === 'Legalización T. Pro') && s.documentos?.length > 0 && (() => {
                            const esDueño = s.responsableId === user.id;
                            return (
                              <>
                                {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa' || esDueño) && (
                                  <Button variant="ghost" size="icon" onClick={() => handleGenerarPDF(s)} disabled={generandoPDF === s.id} className="text-[#6C63D1]" title="PDF" aria-label="PDF">
                                    {generandoPDF === s.id ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                                  </Button>
                                )}
                                {(user.rol === 'Administrador' || user.rol === 'Contadora' || user.rol === 'Coordinadora Administrativa' || user.rol === 'Gerente') && (
                                  <Button variant="ghost" size="icon" onClick={() => handleGenerarExcel(s)} className="text-success" title="Excel" aria-label="Excel">
                                    <FileSpreadsheet size={16} />
                                  </Button>
                                )}
                                {/* Ver Soportes: los roles de gestión/auditoría lo ven en cualquier solicitud, y
                                    el dueño (Responsable/Gerente incluidos) siempre puede ver lo que él mismo subió. */}
                                {(user.rol === 'Administrador' || user.rol === 'Contadora' || user.rol === 'Coordinadora Administrativa' || user.rol === 'Gerente' || esDueño) && (
                                  <Button variant="ghost" size="icon" onClick={() => handleVerSoportesSolicitud(s)} className="text-success" title="Ver Soportes" aria-label="Ver Soportes">
                                    <Paperclip size={16} />
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                          {/* Pago a Tercero: "Ver Detalle" muestra al instante los datos del tercero y su
                              cuenta bancaria (sin descargar nada) para que quien vaya a pagar no tenga
                              que adivinar dónde consignar; "📄" regenera la misma ficha en PDF; sus
                              soportes son archivos simples (no se desglosan como Legalización/Reembolso),
                              así que solo necesitan el botón "Ver Soportes". */}
                          {s.tipo === 'Pago a Tercero' && (() => {
                            const esDueño = s.responsableId === user.id;
                            const puedeVer = user.rol === 'Administrador' || user.rol === 'Contadora' || user.rol === 'Coordinadora Administrativa' || user.rol === 'Gerente' || esDueño;
                            return puedeVer && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => setVerDetalleTercero(s)} title="Ver Detalle del Tercero" aria-label="Ver Detalle del Tercero">
                                  <Eye size={16} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleGenerarPDFPagoTercero(s)} className="text-[#6C63D1]" title="PDF" aria-label="PDF">
                                  <FileDown size={16} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleVerSoportesSolicitud(s)} className="text-success" title="Ver Soportes" aria-label="Ver Soportes">
                                  <Paperclip size={16} />
                                </Button>
                              </>
                            );
                          })()}
                          {/* Editar: solo mientras está Pendiente — quien la creó, o Administrador/
                              Coordinadora Administrativa. Reabre el formulario de arriba precargado. */}
                          {puedeEditarSolicitud(s) && (
                            <Button variant="ghost" size="icon" onClick={() => handleIniciarEdicionSolicitud(s)} className="text-[#6C63D1]" title="Editar" aria-label="Editar"><Pencil size={16} /></Button>
                          )}
                          {(user.rol === 'Responsable' || user.rol === 'Gerente' || user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && puedeEliminarSolicitud(s) && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteSolicitud(s.id)} className="text-destructive" title="Eliminar" aria-label="Eliminar"><Trash2 size={16} /></Button>
                          )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'responsables' && (() => {
          // Etapa 3 del sistema de diseño: Colaboradores migrado a los componentes de
          // src/components/ui/ (misma lógica, handlers y permisos que antes; solo cambia la presentación).
          const listaUsuarios = [
            ...responsables.map(r => ({ ...r, rol: 'Colaborador', origen: 'responsables' })),
            ...usuariosAdmin.map(u => ({ ...u, origen: 'admin' }))
          ];
          const rolIcono = { 'Colaborador': '👥', 'Gerente': '📈', 'Coordinadora Administrativa': '🗂️', 'Contadora': '🧮', 'Administrador': '🔑' };
          const seccion = (titulo, contenido, extra) => (
            <section className="flex flex-col gap-3">
              <h3 className="m-0 border-0 border-b border-solid border-border pb-2 text-sm font-bold">{titulo}</h3>
              {extra}
              {contenido}
            </section>
          );
          const grilla = 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]';

          return (
            <div className="flex flex-col gap-6">
              {/* CUMPLEAÑOS DEL MES */}
              {cumpleanosEsteMes.length > 0 && (
                <Card className="gap-3 border-l-4 border-l-primary px-0 py-5">
                  <CardHeader className="sm:px-7">
                    <CardTitle>🎂 Cumpleaños de {nombresMeses[new Date().getMonth()]}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3 sm:px-7">
                    {cumpleanosEsteMes.map(r => (
                      <div key={r.id} className="flex items-center gap-2 rounded-full border border-solid border-border bg-background py-1.5 pl-1.5 pr-4">
                        <ColaboradorAvatar foto={r.foto} nombre={r.nombre} size={28} />
                        <span className="text-sm">{r.nombre} — día {r.diaCumple}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Sin nadie en edición: instrucciones para sumar una persona nueva (sigue siendo manual, por decisión) */}
              {!editingResponsableId && (
                <Card className="gap-3 px-0 py-6">
                  <CardHeader className="sm:px-7">
                    <CardTitle className="text-lg">Agregar una persona nueva</CardTitle>
                    <CardDescription>Por ahora esto se hace en 2 pasos fuera de la app (así quedó decidido, para no manejar llaves sensibles desde el navegador):</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground sm:px-7">
                    <ol className="m-0 flex flex-col gap-1.5 pl-5">
                      <li>Crea su cuenta en Supabase → <strong>Authentication → Users</strong> (con "Auto Confirm User" marcado), igual que hiciste con las cuentas actuales.</li>
                      <li>Pide el pequeño SQL para vincularla a <code>usuarios</code> con su nombre, rol y empresa — o edítalo tú mismo siguiendo el patrón de <code>vincular_usuarios_reales.sql</code>.</li>
                    </ol>
                    <p className="m-0 text-xs">Para editar a alguien que ya tiene cuenta, usa el ✏️ en la tabla de abajo.</p>
                  </CardContent>
                </Card>
              )}

              {/* FORMULARIO EDITAR */}
              {editingResponsableId && (
              <Card className="gap-5 border-2 border-[#6C63D1] px-0 py-6">
                <CardHeader className="sm:px-7">
                  <CardTitle className="text-lg text-[#6C63D1]">✏️ Editar Usuario</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-7 sm:px-7">

                {seccion('Acceso al sistema', (
                  <div className={grilla}>
                    <CampoUI label="Rol / Perfil" htmlFor="co-rol">
                      <Select id="co-rol" value={newUserType} onChange={(e) => setNewUserType(e.target.value)} disabled>
                        <option value="Colaborador">👥 Colaborador</option>
                        <option value="Gerente">📈 Gerente</option>
                        <option value="Coordinadora Administrativa">🗂️ Coordinadora Administrativa</option>
                        <option value="Contadora">🧮 Contadora</option>
                        <option value="Administrador">🔑 Administrador</option>
                      </Select>
                      <p className="m-0 text-xs text-muted-foreground">El rol no se cambia desde aquí — avísame si alguien necesita otro perfil.</p>
                    </CampoUI>
                    <CampoUI label="Nombre Completo" htmlFor="co-nombre">
                      <Input id="co-nombre" type="text" placeholder="Nombre Completo" value={newResponsable.nombre} onChange={(e) => setNewResponsable({...newResponsable, nombre: e.target.value})} />
                    </CampoUI>
                    <CampoUI label="Email" htmlFor="co-email">
                      <Input id="co-email" type="email" placeholder="Email" value={newResponsable.email} disabled />
                      <p className="m-0 text-xs text-muted-foreground">Es el email de acceso — se cambia desde Authentication en Supabase, aquí es solo informativo.</p>
                    </CampoUI>
                    {(newUserType === 'Colaborador' || newUserType === 'Gerente') && (
                      <CampoUI label="Empresa" htmlFor="co-empresa">
                        <Select id="co-empresa" value={newResponsable.empresa} onChange={(e) => setNewResponsable({...newResponsable, empresa: e.target.value})}>
                          {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                        </Select>
                      </CampoUI>
                    )}
                  </div>
                ))}

                {/* Cédula, Funciones y Datos bancarios los necesita CUALQUIER usuario para poder
                    generar su propia Cuenta de Cobro, sin importar su perfil (Admin, Gerente, etc.). */}
                {seccion('Datos personales', (
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <Label>Foto</Label>
                      <ColaboradorAvatar foto={newResponsable.foto} nombre={newResponsable.nombre} size={64} />
                      <label className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs')}>
                        <Upload size={13} /> {newResponsable.foto ? 'Cambiar' : 'Subir foto'}
                        <input type="file" accept="image/*" onChange={handleColaboradorFoto} className="hidden" />
                      </label>
                      {newResponsable.foto && <Button variant="link" size="sm" onClick={() => handleColaboradorRemoveArchivo('foto')} className="h-auto p-0 text-xs text-destructive">Quitar foto</Button>}
                    </div>
                    <div className={cn(grilla, 'min-w-[260px] flex-1')}>
                      <CampoUI label="Tipo de Documento">
                        <SelectTipoDocumento value={newResponsable.tipoDocumento} placeholder="Seleccionar" onChange={(v) => setNewResponsable({ ...newResponsable, tipoDocumento: v })} style={estiloCampoUI} />
                      </CampoUI>
                      <CampoUI label="Número de Documento" htmlFor="co-doc">
                        <Input id="co-doc" type="text" placeholder="Solo números" value={newResponsable.cedula} onChange={(e) => setNewResponsable({ ...newResponsable, cedula: e.target.value })} />
                      </CampoUI>
                      <CampoUI label="Teléfono" htmlFor="co-tel">
                        <Input id="co-tel" type="text" placeholder="Teléfono" value={newResponsable.telefono} onChange={(e) => setNewResponsable({...newResponsable, telefono: e.target.value})} />
                      </CampoUI>
                      <CampoUI label="Fecha de Nacimiento" htmlFor="co-nac">
                        <Input id="co-nac" type="date" value={newResponsable.fechaNacimiento} onChange={(e) => setNewResponsable({...newResponsable, fechaNacimiento: e.target.value})} />
                      </CampoUI>
                    </div>
                  </div>
                ))}

                {seccion('Datos laborales', (
                  <div className={grilla}>
                    <CampoUI label="Cargo / Puesto" htmlFor="co-cargo">
                      <Input id="co-cargo" type="text" placeholder="Ej: Coordinador Deportivo" value={newResponsable.cargo} onChange={(e) => setNewResponsable({...newResponsable, cargo: e.target.value})} />
                    </CampoUI>
                    <CampoUI label="Fecha de Ingreso" htmlFor="co-ingreso">
                      <Input id="co-ingreso" type="date" value={newResponsable.fechaIngreso} onChange={(e) => setNewResponsable({...newResponsable, fechaIngreso: e.target.value})} />
                    </CampoUI>
                    <CampoUI label="Tipo de Vinculación" htmlFor="co-vinculacion">
                      <Select id="co-vinculacion" value={newResponsable.tipoVinculacion} onChange={(e) => setNewResponsable({...newResponsable, tipoVinculacion: e.target.value})}>
                        <option value="">Seleccionar</option>
                        <option value="Nómina">Nómina</option>
                        <option value="Prestación de Servicios">Prestación de Servicios</option>
                      </Select>
                    </CampoUI>
                    <CampoUI label="Funciones (para la Cuenta de Cobro)" htmlFor="co-funciones" className="col-span-full">
                      <Textarea id="co-funciones" placeholder="Ej: Coordinar estrategias en el desarrollo de los proyectos deportivos asignados y prestar apoyo al área de scouting de la empresa." value={newResponsable.funciones} onChange={(e) => setNewResponsable({...newResponsable, funciones: e.target.value})} rows={2} />
                      <p className="m-0 text-xs text-muted-foreground">Se usa como el texto entre paréntesis del PDF de Cuenta de Cobro — se guarda una sola vez y se reutiliza cada mes.</p>
                    </CampoUI>
                  </div>
                ))}

                {seccion('Datos bancarios (para consignación y Cuenta de Cobro)', (
                  <div className={grilla}>
                    <CampoUI label="Banco">
                      <CampoBanco codigo={newResponsable.codigoBanco} texto={newResponsable.banco} onChange={({ codigo, texto }) => setNewResponsable({ ...newResponsable, codigoBanco: codigo, banco: texto })} style={estiloCampoUI} />
                      {!newResponsable.codigoBanco && newResponsable.banco && <p className="m-0 text-xs text-[#C4622D]">Antes: "{newResponsable.banco}" — elige el banco de la lista</p>}
                    </CampoUI>
                    <CampoUI label="Tipo de Cuenta" htmlFor="co-tipocuenta">
                      <Select id="co-tipocuenta" value={newResponsable.tipoCuentaBancaria} onChange={(e) => setNewResponsable({...newResponsable, tipoCuentaBancaria: e.target.value})}>
                        <option value="">Seleccionar</option>
                        <option value="Ahorros">Ahorros</option>
                        <option value="Corriente">Corriente</option>
                      </Select>
                    </CampoUI>
                    <CampoUI label="Número de Cuenta" htmlFor="co-numcuenta">
                      <Input id="co-numcuenta" type="text" value={newResponsable.numeroCuenta} onChange={(e) => setNewResponsable({...newResponsable, numeroCuenta: e.target.value})} />
                    </CampoUI>
                    <CampoUI label="Titular de la Cuenta" htmlFor="co-titular">
                      <Input id="co-titular" type="text" placeholder="Si es distinto al nombre del colaborador" value={newResponsable.titularCuenta} onChange={(e) => setNewResponsable({...newResponsable, titularCuenta: e.target.value})} />
                    </CampoUI>
                  </div>
                ))}

                {seccion('Contacto de emergencia y salud', (
                  <div className={grilla}>
                    <CampoUI label="Nombre Contacto de Emergencia" htmlFor="co-emerg-nombre">
                      <Input id="co-emerg-nombre" type="text" value={newResponsable.contactoEmergenciaNombre} onChange={(e) => setNewResponsable({...newResponsable, contactoEmergenciaNombre: e.target.value})} />
                    </CampoUI>
                    <CampoUI label="Teléfono Contacto de Emergencia" htmlFor="co-emerg-tel">
                      <Input id="co-emerg-tel" type="text" value={newResponsable.contactoEmergenciaTelefono} onChange={(e) => setNewResponsable({...newResponsable, contactoEmergenciaTelefono: e.target.value})} />
                    </CampoUI>
                    <CampoUI label="EPS" htmlFor="co-eps">
                      <Input id="co-eps" type="text" value={newResponsable.eps} onChange={(e) => setNewResponsable({...newResponsable, eps: e.target.value})} />
                    </CampoUI>
                    <CampoUI label="ARL" htmlFor="co-arl">
                      <Input id="co-arl" type="text" value={newResponsable.arl} onChange={(e) => setNewResponsable({...newResponsable, arl: e.target.value})} />
                    </CampoUI>
                  </div>
                ))}

                {seccion('Documentos', (
                  <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                    {['documentoCedula', 'documentoPasaporte'].map(campo => (
                      <div key={campo} className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-background p-4">
                        <Label>{campo === 'documentoCedula' ? 'Cédula' : 'Pasaporte'}</Label>
                        {newResponsable[campo] ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-1 text-sm text-success"><Paperclip size={14} /> Archivo cargado</span>
                            <Button variant="outline" size="sm" onClick={() => handleColaboradorVerDocumento(newResponsable[campo])}><Eye size={14} /> Ver</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleColaboradorEliminarDocumento(campo)} className="text-destructive"><Trash2 size={14} /> Quitar</Button>
                          </div>
                        ) : (
                          <Input type="file" accept=".pdf,image/*" aria-label={campo === 'documentoCedula' ? 'Cédula' : 'Pasaporte'} disabled={subiendoDocumento === campo} onChange={(e) => handleColaboradorDocumento(e, campo)} className={claseInputArchivo} />
                        )}
                        {subiendoDocumento === campo && <p className="m-0 text-xs text-muted-foreground">Subiendo...</p>}
                      </div>
                    ))}
                  </div>
                ), <p className="m-0 text-xs text-muted-foreground">Se guardan en un almacenamiento privado — solo Administrador y Coordinadora Administrativa pueden verlos o subirlos.</p>)}

                <div className="flex gap-3">
                  <Button size="lg" onClick={handleSaveResponsable} className="flex-1">Guardar Cambios</Button>
                  <Button size="lg" variant="outline" onClick={handleCancelEditResponsable}>Cancelar</Button>
                </div>
                </CardContent>
              </Card>
              )}

              {/* TABLA DE USUARIOS */}
              <Card className="gap-4 px-0 py-6">
                <CardHeader className="sm:px-7">
                  <CardTitle className="text-lg">👥 Usuarios ({listaUsuarios.length})</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:px-7">
                {cargandoUsuarios && <p className="m-0 text-sm text-muted-foreground">Cargando usuarios...</p>}
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Usuario</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead className="text-center">🎂</TableHead>
                      <TableHead className="text-center">Docs</TableHead>
                      <TableHead className="text-center">Solicitudes</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {listaUsuarios.map(r => {
                        const solicitudesColaborador = solicitudes.filter(s => s.responsableId === r.id && r.origen === 'responsables').length;
                        const numDocs = (r.documentoCedula ? 1 : 0) + (r.documentoPasaporte ? 1 : 0);
                        const esSensible = rolesSensibles.includes(r.rol);
                        const puedeGestionar = !esSensible || user?.rol === 'Administrador';
                        return (
                          <TableRow key={`${r.origen}-${r.id}`} className={cn(editingResponsableId === r.id && 'bg-secondary/30')}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <ColaboradorAvatar foto={r.foto} nombre={r.nombre} size={32} />
                                <div className="min-w-0">
                                  <div className="whitespace-nowrap font-medium">{r.nombre}</div>
                                  <div className="text-xs text-muted-foreground">{r.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{rolIcono[r.rol] || ''} {r.rol}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.cargo || '-'}</TableCell>
                            <TableCell className="text-xs">{r.empresa ? <div className="flex items-center gap-2"><EmpresaLogo empresa={r.empresa} height={16} /><span className="text-primary">{r.empresa}</span></div> : '-'}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.telefono || '-'}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.cedula || '-'}</TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">{r.fechaNacimiento ? `${r.fechaNacimiento.substring(8,10)}/${r.fechaNacimiento.substring(5,7)}` : '-'}</TableCell>
                            <TableCell className="text-center">
                              {numDocs > 0 ? <span className="inline-flex items-center gap-1 text-success"><Paperclip size={14} /> {numDocs}</span> : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center font-bold text-success">{r.origen === 'responsables' ? solicitudesColaborador : '-'}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center">
                              {puedeGestionar ? (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenEditResponsable(r, r.origen)} title="Editar" aria-label="Editar" className="text-[#6C63D1]"><Pencil size={16} /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteResponsable(r.id, r.origen)} title="Eliminar" aria-label="Eliminar" className="text-destructive"><Trash2 size={16} /></Button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground" title="Solo el Administrador puede gestionar este perfil">🔒</span>
                              )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {currentView === 'finanzas' && !puedeVerFinanzas && (
          <Card className="items-center px-6 py-8 text-center">
            <p className="m-0 text-lg font-bold text-destructive">🔒 Acceso Restringido</p>
            <p className="m-0 text-muted-foreground">Tu rol no tiene acceso al módulo de Finanzas.</p>
            <Button onClick={() => setCurrentView('dashboard')}>Ir al Dashboard</Button>
          </Card>
        )}

        {currentView === 'finanzas' && puedeVerFinanzas && (
          // Etapa 3 del sistema de diseño: Finanzas migrado a los componentes de
          // src/components/ui/ (misma lógica, handlers y permisos que antes; solo cambia la presentación).
          <div className="flex flex-col gap-6">
            {/* BOTÓN IMPORTAR (SOLO ADMIN) */}
            {user?.rol === 'Administrador' && (
              <Card className="flex-row flex-wrap items-center gap-4 px-5 py-4">
                <Button variant="outline" onClick={() => setMostrarImportar(true)} className="text-chart-3">
                  <Upload size={16} /> Importar Histórico
                </Button>
                <p className="m-0 text-sm text-muted-foreground">{cargandoGastos ? 'Cargando gastos desde Supabase...' : `Gastos cargados desde Supabase: ${gastos.length}`}</p>
              </Card>
            )}

            {/* NUEVA TRANSACCIÓN (SOLO ADMIN Y COORDINADORA) */}
            {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
            <Card className="gap-4 px-0 py-6 sm:py-7">
              <CardHeader className="sm:px-7">
                <button type="button" onClick={() => setMostrarNuevoMovimientoFinanzas(!mostrarNuevoMovimientoFinanzas)} aria-expanded={mostrarNuevoMovimientoFinanzas} className="flex w-full cursor-pointer flex-wrap items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit]">
                  {mostrarNuevoMovimientoFinanzas ? <ChevronDown size={18} className="text-primary" /> : <ChevronRight size={18} className="text-primary" />}
                  <CardTitle className="text-lg">Nuevo Gasto / Ingreso / Traslado</CardTitle>
                  <span className="text-xs text-muted-foreground">(clic para {mostrarNuevoMovimientoFinanzas ? 'ocultar' : 'registrar uno nuevo'})</span>
                </button>
              </CardHeader>
              {mostrarNuevoMovimientoFinanzas && (
              <CardContent className="flex flex-col gap-4 sm:px-7">

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <CampoUI label="Tipo" htmlFor="fin-tipo">
                  <Select id="fin-tipo" value={newGasto.tipo} onChange={(e) => {
                    // "Pago a Tercero en Lote" no es un tipo real de Gasto — es un atajo que abre
                    // su propio formulario emergente (varias facturas de distintos colaboradores,
                    // un solo pago). No cambia newGasto.tipo, para no afectar el formulario normal.
                    if (e.target.value === 'PagoTerceroLote') { handleAbrirRegistrarFacturasTercero(); return; }
                    setNewGasto({...newGasto, tipo: e.target.value}); setNewIngreso({...newIngreso, tipo: e.target.value});
                  }}>
                    <option value="Gasto">💸 Gasto</option>
                    <option value="Ingreso">💰 Ingreso</option>
                    <option value="Traslado">🔄 Traslado</option>
                    <option value="Pago a Tercero">🤝 Pago a Tercero</option>
                    <option value="PagoTerceroLote">🧾 Pago a Tercero en Lote (varias facturas)</option>
                  </Select>
                </CampoUI>
                <CampoUI label="Fecha" htmlFor="fin-fecha">
                  <Input id="fin-fecha" type="date" value={newGasto.fecha} onChange={(e) => {setNewGasto({...newGasto, fecha: e.target.value}); setNewIngreso({...newIngreso, fecha: e.target.value});}} />
                </CampoUI>
              </div>

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                <CampoUI label="Empresa" htmlFor="fin-empresa">
                  <Select id="fin-empresa" value={newGasto.empresa} onChange={(e) => {setNewGasto({...newGasto, empresa: e.target.value, cuenta: ''}); setNewIngreso({...newIngreso, empresa: e.target.value, cuenta: ''});}}>
                    {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                  </Select>
                </CampoUI>

                {newGasto.tipo === 'Traslado' ? (
                  <>
                    <CampoUI label="Cuenta Salida" htmlFor="fin-cuenta-salida">
                      <Select id="fin-cuenta-salida" value={newGasto.cuentaSalida} onChange={(e) => setNewGasto({...newGasto, cuentaSalida: e.target.value})}>
                        <option value="">Seleccionar</option>
                        {(cuentasPorEmpresa[newGasto.empresa] || []).map(cuenta => <option key={cuenta} value={cuenta}>{cuenta}</option>)}
                      </Select>
                    </CampoUI>
                    <CampoUI label="Cuenta Destino" htmlFor="fin-cuenta-destino">
                      <Select id="fin-cuenta-destino" value={newGasto.cuentaDestino} onChange={(e) => setNewGasto({...newGasto, cuentaDestino: e.target.value, cuentaDestinoExternaNumero: '', cuentaDestinoExternaDetalle: ''})}>
                        <option value="">Seleccionar</option>
                        <option value={CUENTA_DESTINO_EXTERNA}>🏢 Empresa Externa</option>
                        {empresas.map(emp => (
                          <optgroup key={emp} label={emp}>
                            {(cuentasPorEmpresa[emp] || []).map(cuenta => <option key={`${emp}-${cuenta}`} value={`${emp}: ${cuenta}`}>{cuenta}</option>)}
                          </optgroup>
                        ))}
                      </Select>
                      {/* Traslado hacia una cuenta que no es de ninguna empresa de la holding
                          (ej. pagarle directo a un banco/entidad externa) — se digitan a mano
                          en vez de elegir de la lista de cuentas propias. */}
                      {newGasto.cuentaDestino === CUENTA_DESTINO_EXTERNA && (
                        <div className="mt-1.5 flex flex-col gap-2">
                          <Input type="text" aria-label="Número de cuenta" placeholder="Número de cuenta" value={newGasto.cuentaDestinoExternaNumero} onChange={(e) => setNewGasto({...newGasto, cuentaDestinoExternaNumero: e.target.value})} />
                          <Input type="text" aria-label="Detalle de la cuenta externa" placeholder="Detalle (banco, titular, etc.)" value={newGasto.cuentaDestinoExternaDetalle} onChange={(e) => setNewGasto({...newGasto, cuentaDestinoExternaDetalle: e.target.value})} />
                        </div>
                      )}
                    </CampoUI>
                  </>
                ) : (
                  <>
                    <CampoUI label="Cuenta" htmlFor="fin-cuenta">
                      {/* Este mismo campo se usa para Gasto/Pago a Tercero (guarda en newGasto.cuenta)
                          y para Ingreso (handleAddIngreso valida/guarda newIngreso.cuenta, un estado
                          aparte) — sin este segundo setNewIngreso, elegir una Cuenta al crear un
                          Ingreso no quedaba guardada ahí, y el guardado siempre fallaba con
                          "Cuenta es obligatoria" aunque sí se hubiera seleccionado una. */}
                      <Select id="fin-cuenta" value={newGasto.cuenta} onChange={(e) => { setNewGasto({...newGasto, cuenta: e.target.value}); setNewIngreso({...newIngreso, cuenta: e.target.value}); }}>
                        <option value="">Seleccionar</option>
                        {(cuentasPorEmpresa[newGasto.empresa] || []).map(cuenta => <option key={cuenta} value={cuenta}>{cuenta}</option>)}
                      </Select>
                    </CampoUI>
                    <CampoUI label="Colaborador" htmlFor="fin-colaborador">
                      <Select id="fin-colaborador" value={newGasto.responsable} onChange={(e) => {setNewGasto({...newGasto, responsable: e.target.value}); setNewIngreso({...newIngreso, responsable: e.target.value});}}>
                        <option value="">Seleccionar</option>
                        {[...personasFinanzas].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(r => <option key={r.id} value={r.nombre}>{r.nombre}{r.rol && r.rol !== 'Responsable' ? ` (${r.rol})` : ''}</option>)}
                      </Select>
                    </CampoUI>
                  </>
                )}

                {(newGasto.tipo === 'Gasto' || newGasto.tipo === 'Pago a Tercero') && (
                  <CampoUI label="CECO" htmlFor="fin-ceco">
                    <Select id="fin-ceco" value={newGasto.ceco} onChange={(e) => setNewGasto({...newGasto, ceco: e.target.value})}>
                      {cecosGasto.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                    </Select>
                  </CampoUI>
                )}

                {newGasto.tipo === 'Ingreso' && (
                  <CampoUI label="CEIN (origen)" htmlFor="fin-cein">
                    <Select id="fin-cein" value={newIngreso.ceco} onChange={(e) => setNewIngreso({...newIngreso, ceco: e.target.value})}>
                      {cecosIngreso.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                    </Select>
                  </CampoUI>
                )}

                {/* Traslado elige su propio CECO, de la categoría "Traslado" en Gestión de CECOs
                    (antes quedaba fijo siempre en CEIN-003-ACPT, ahora se deja como una opción más). */}
                {newGasto.tipo === 'Traslado' && (
                  <CampoUI label="CECO" htmlFor="fin-ceco-traslado">
                    <Select id="fin-ceco-traslado" value={newGasto.ceco} onChange={(e) => setNewGasto({...newGasto, ceco: e.target.value})}>
                      <option value="">Seleccionar</option>
                      {cecosTraslado.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                    </Select>
                  </CampoUI>
                )}
              </div>

              <CampoUI label="Detalle/Descripción" htmlFor="fin-detalle">
                <Input id="fin-detalle" type="text" placeholder="Detalle/Descripción" value={newGasto.detalle} onChange={(e) => {setNewGasto({...newGasto, detalle: e.target.value}); setNewIngreso({...newIngreso, detalle: e.target.value});}} />
              </CampoUI>

              {/* PAGO A TERCERO DIRECTO DESDE FINANZAS (Opción B) — mismo bloque y mismo catálogo
                  reutilizable (public.terceros) que ya usa Solicitudes, para que un pago hecho
                  desde cualquiera de las dos pantallas quede visible en el mismo desplegable. */}
              {esPagoTerceroFinanzas && (
                <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-background p-4">
                  <h3 className="m-0 text-base font-bold">Información del Tercero</h3>

                  <div className="flex gap-2">
                    <Select aria-label="Tercero guardado" value={newGasto.terceroId} onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        setNewGasto({...newGasto, terceroId: '', terceroNombre: '', terceroDni: '', terceroTipoDocumento: '', terceroPaisOrigen: '', terceroBanco: '', terceroCodigoBanco: '', terceroTipoCuenta: '', terceroNumeroCuenta: '', guardarTercero: true, actualizarTercero: false});
                        return;
                      }
                      const t = tercerosDB.find(x => x.id === id);
                      setNewGasto({...newGasto, terceroId: id, terceroNombre: t?.nombre || '', terceroDni: t?.dni || '', terceroTipoDocumento: t?.tipo_documento || '', terceroPaisOrigen: t?.pais_origen || '', terceroBanco: t?.banco || '', terceroCodigoBanco: t?.codigo_banco || inferirCodigoBanco(t?.banco), terceroTipoCuenta: t?.tipo_cuenta || '', terceroNumeroCuenta: t?.numero_cuenta || '', guardarTercero: false, actualizarTercero: true});
                    }}>
                      <option value="">➕ Nuevo tercero</option>
                      {tercerosDB.map(t => <option key={t.id} value={t.id}>{t.nombre} — {t.dni}</option>)}
                    </Select>
                    {newGasto.terceroId && (user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
                      <Button variant="outline" size="icon" onClick={() => handleEliminarTercero(newGasto.terceroId)} className="shrink-0 text-destructive" title="Eliminar este tercero del catálogo" aria-label="Eliminar este tercero del catálogo">
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                    <Input type="text" aria-label="Nombre completo" placeholder="Nombre completo *" value={newGasto.terceroNombre} onChange={(e) => setNewGasto({...newGasto, terceroNombre: e.target.value})} />
                    <SelectTipoDocumento value={newGasto.terceroTipoDocumento} onChange={(v) => setNewGasto({...newGasto, terceroTipoDocumento: v})} style={estiloCampoUI} />
                    <Input type="text" aria-label="Documento" placeholder="Documento (NIT sin DV) *" value={newGasto.terceroDni} onChange={(e) => setNewGasto({...newGasto, terceroDni: e.target.value})} />
                    <Input type="text" aria-label="País de origen" placeholder="País de origen" value={newGasto.terceroPaisOrigen} onChange={(e) => setNewGasto({...newGasto, terceroPaisOrigen: e.target.value})} />
                  </div>
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                    <CampoBanco codigo={newGasto.terceroCodigoBanco} texto={newGasto.terceroBanco} onChange={({ codigo, texto }) => setNewGasto({...newGasto, terceroCodigoBanco: codigo, terceroBanco: texto})} style={estiloCampoUI} />
                    <Select aria-label="Tipo de cuenta" value={newGasto.terceroTipoCuenta} onChange={(e) => setNewGasto({...newGasto, terceroTipoCuenta: e.target.value})}>
                      <option value="">Tipo de cuenta</option>
                      <option value="Ahorros">Ahorros</option>
                      <option value="Corriente">Corriente</option>
                    </Select>
                    <Input type="text" aria-label="Número de cuenta" placeholder="Número de cuenta" value={newGasto.terceroNumeroCuenta} onChange={(e) => setNewGasto({...newGasto, terceroNumeroCuenta: e.target.value})} />
                  </div>

                  {!newGasto.terceroId ? (
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                      <input type="checkbox" className={claseCheckbox} checked={newGasto.guardarTercero} onChange={(e) => setNewGasto({...newGasto, guardarTercero: e.target.checked})} />
                      💾 Guardar este tercero para futuros pagos (la próxima vez solo se ingresa el valor)
                    </label>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                      <input type="checkbox" className={claseCheckbox} checked={newGasto.actualizarTercero} onChange={(e) => setNewGasto({...newGasto, actualizarTercero: e.target.checked})} />
                      🔄 Actualizar los datos guardados de este tercero con lo que edité arriba
                    </label>
                  )}
                </div>
              )}

              {newGasto.tipo === 'Gasto' && (() => {
                const candidatos = getPresupuestoCandidatos(newGasto.empresa, newGasto.ceco, newGasto.responsable, newGasto.detalle, presupuestoItems);
                if (!candidatos.length) return null;
                const sugeridoId = (candidatos[0] && candidatos[0].score > 0) ? candidatos[0].item.id : '';
                // El CECO elegido arriba SIEMPRE es el que se guarda — vincular a un concepto de otro
                // CECO ya no se lo cambia. La sugerencia por texto solo aparece marcada en la lista;
                // hay que elegirla a propósito, no queda seleccionada sola.
                const valorSeleccionado = newGasto.presupuestoItemId || '';
                return (
                  <CampoUI label="Vincular a Presupuesto (opcional)" htmlFor="fin-presupuesto">
                    <Select id="fin-presupuesto" value={valorSeleccionado} onChange={(e) => {
                      const nuevoId = e.target.value || '';
                      // Si el concepto elegido ya tiene un Colaborador vinculado (Gestión de Conceptos),
                      // se rellena solo el campo Responsable de este formulario — así no toca escribirlo
                      // dos veces. Si el concepto no tiene Colaborador, se deja lo que ya había escrito.
                      const conceptoElegido = candidatos.find(c => c.item.id === nuevoId)?.item;
                      setNewGasto({
                        ...newGasto,
                        presupuestoItemId: nuevoId,
                        responsable: conceptoElegido?.responsableNombre ? conceptoElegido.responsableNombre : newGasto.responsable
                      });
                    }}>
                      <option value="">Sin vincular</option>
                      {candidatos.map(({ item: p }) => <option key={p.id} value={p.id}>{p.nombre}{p.ceco !== newGasto.ceco ? ` · ${p.ceco}` : ''} — {formatMoney(p.valorMensual, newGasto.empresa)}{p.id === sugeridoId ? ' (Sugerido)' : ''}</option>)}
                    </Select>
                    {sugeridoId && !valorSeleccionado && (
                      <p className="m-0 text-xs text-muted-foreground">💡 Por proveedor/responsable, este gasto coincide con "{candidatos[0].item.nombre}" — selecciónalo en la lista si aplica. No se vincula solo.</p>
                    )}
                    {valorSeleccionado && (() => {
                      const seleccionado = candidatos.find(c => c.item.id === valorSeleccionado);
                      return seleccionado && !seleccionado.mismoCeco ? (
                        <p className="m-0 text-xs text-[#8A6A0C]">ℹ️ Este concepto está catalogado en {seleccionado.item.ceco}. El gasto se guardará con el CECO que elegiste arriba ({newGasto.ceco}) — no se cambia solo.</p>
                      ) : null;
                    })()}
                  </CampoUI>
                );
              })()}

              {/* DEDUCCIONES DETECTADAS PARA EL CONCEPTO VINCULADO (préstamos u otros descuentos) */}
              {newGasto.tipo === 'Gasto' && newGasto.presupuestoItemId && (() => {
                const [anioGasto, mesGasto] = (newGasto.fecha || '').split('-').map(n => parseInt(n));
                if (!anioGasto || !mesGasto) return null;
                const deduccionesItem = deducciones
                  .filter(d => d.presupuestoItemId === newGasto.presupuestoItemId)
                  .map(d => ({ ...d, cuotaAplicada: getCuotaAplicada(d, anioGasto, mesGasto) }))
                  .filter(d => d.cuotaAplicada > 0);
                if (!deduccionesItem.length) return null;
                const totalDeduccion = deduccionesItem.reduce((sum, d) => sum + d.cuotaAplicada, 0);
                const bruto = parseFloat(newGasto.valor) || 0;
                const neto = Math.max(0, bruto - totalDeduccion);
                return (
                  <div className="rounded-lg border border-solid border-primary bg-[#FBF3E5] p-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                      <input type="checkbox" className={claseCheckbox} checked={newGasto.aplicarDeduccion !== false} onChange={(e) => setNewGasto({...newGasto, aplicarDeduccion: e.target.checked})} />
                      💵 Se detectaron deducciones activas — aplicar al valor neto de este pago
                    </label>
                    {deduccionesItem.map(d => (
                      <p key={d.id} className="m-0 ml-6 mt-2 text-xs text-muted-foreground">
                        {d.tipo} — {formatMoney(d.cuotaAplicada, newGasto.empresa)}{d.observaciones ? ` (${d.observaciones})` : ''}
                      </p>
                    ))}
                    {newGasto.aplicarDeduccion !== false && (
                      <div className="mt-3 flex flex-wrap justify-between gap-2 border-0 border-t border-solid border-border pt-3 text-sm">
                        <span className="text-muted-foreground">Bruto: {formatMoney(bruto, newGasto.empresa)} − Deducción: {formatMoney(totalDeduccion, newGasto.empresa)}</span>
                        <span className="font-bold">Neto a Pagar: {formatMoney(neto, newGasto.empresa)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                {/* Pago a Tercero: la moneda del pago se elige aparte, igual que en Solicitudes —
                    no depende de la empresa que paga. Aplica tanto si el Tipo es "Pago a
                    Tercero" como si es "Gasto" con el CECO "Pago a Terceros" elegido. */}
                {esPagoTerceroFinanzas && (
                  <CampoUI label="Moneda" htmlFor="fin-moneda">
                    <Select id="fin-moneda" value={newGasto.moneda} onChange={(e) => setNewGasto({...newGasto, moneda: e.target.value})}>
                      <option value="COP">Pesos Colombianos (COP)</option>
                      <option value="USD">Dólares (USD)</option>
                    </Select>
                  </CampoUI>
                )}

                <CampoUI label={newGasto.tipo === 'Traslado' ? `Valor (Salida — ${getMoneda(newGasto.empresa)})` : (esPagoTerceroFinanzas ? `Valor a Pagar (${newGasto.moneda})` : 'Valor')} htmlFor="fin-valor">
                  <Input id="fin-valor" type="number" placeholder={esPagoTerceroFinanzas ? `Valor a Pagar (${newGasto.moneda})` : 'Valor'} value={newGasto.valor} onChange={(e) => {setNewGasto({...newGasto, valor: e.target.value}); setNewIngreso({...newIngreso, valor: e.target.value});}} />
                </CampoUI>

                {/* Traslado entre monedas distintas (ej. ARKO en USD hacia/desde el resto de la
                    holding en COP): el valor que sale (arriba) y el que entra a la cuenta destino
                    son montos distintos en monedas distintas, no la misma cifra convertida. Este
                    campo solo aparece cuando origen y destino tienen monedas diferentes. */}
                {newGasto.tipo === 'Traslado' && newGasto.cuentaDestino && getMoneda(newGasto.empresa) !== getMoneda(getEmpresaDestinoTraslado(newGasto.cuentaDestino, newGasto.empresa)) && (
                  <CampoUI label={`Valor en Cuenta Destino (${getMoneda(getEmpresaDestinoTraslado(newGasto.cuentaDestino, newGasto.empresa))})`} htmlFor="fin-valor-destino">
                    <Input id="fin-valor-destino" type="number" placeholder={`Valor en ${getMoneda(getEmpresaDestinoTraslado(newGasto.cuentaDestino, newGasto.empresa))}`} value={newGasto.valorDestino} onChange={(e) => setNewGasto({...newGasto, valorDestino: e.target.value})} />
                  </CampoUI>
                )}
              </div>

              <CampoUI label="Observaciones" htmlFor="fin-observaciones">
                <Input id="fin-observaciones" type="text" placeholder="Observaciones" value={newGasto.observaciones} onChange={(e) => {setNewGasto({...newGasto, observaciones: e.target.value}); setNewIngreso({...newIngreso, observaciones: e.target.value});}} />
              </CampoUI>

              {/* CARGA DE SOPORTES */}
              <ListaSoportesUI
                titulo="Soportes (Archivos)"
                inputProps={{ multiple: true, onChange: handleAddSoporte }}
                archivos={soportesTemp}
                resumen={`Archivos cargados: ${soportesTemp.length}`}
                onQuitar={handleRemoveSoporte}
              />

              <Button size="lg" disabled={guardandoGasto || guardandoIngreso} onClick={newGasto.tipo === 'Ingreso' ? handleAddIngreso : handleAddGasto} className="w-full">
                {(guardandoGasto || guardandoIngreso) ? 'Guardando...' : `Registrar ${newGasto.tipo}`}
              </Button>
              </CardContent>
              )}
            </Card>
            )}

            {/* GESTIÓN DE CECOs (SOLO ADMIN Y COORDINADORA) — catálogo editable en Supabase */}
            {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
            <Card className="gap-4 px-0 py-5">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 sm:px-7">
                <CardTitle className="text-lg">🗂️ Gestión de CECOs ({cecosDB.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setMostrarGestionCecos(!mostrarGestionCecos)}>
                  {mostrarGestionCecos ? 'Ocultar' : 'Ver / Crear CECOs'}
                </Button>
              </CardHeader>
              {mostrarGestionCecos && (
                <CardContent className="flex flex-col gap-4 sm:px-7">
                  {cargandoCecos && <p className="m-0 text-sm text-muted-foreground">Cargando CECOs...</p>}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
                    <Input type="text" aria-label="Código del CECO" placeholder="Código (ej. CECO-014-XX)" value={nuevoCeco.codigo} onChange={(e) => setNuevoCeco({...nuevoCeco, codigo: e.target.value})} />
                    <Input type="text" aria-label="Nombre del CECO" placeholder="Nombre" value={nuevoCeco.nombre} onChange={(e) => setNuevoCeco({...nuevoCeco, nombre: e.target.value})} />
                    <Select aria-label="Tipo de CECO" value={nuevoCeco.tipo} onChange={(e) => setNuevoCeco({...nuevoCeco, tipo: e.target.value})}>
                      <option value="Gasto">Gasto (CECO-xxx)</option>
                      <option value="Ingreso">Ingreso (CEIN-xxx)</option>
                      <option value="Traslado">Traslado</option>
                    </Select>
                    <Button disabled={guardandoCeco} onClick={handleAddCeco}><Plus size={16} /> Agregar</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Activo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...cecosDB].sort((a, b) => a.codigo.localeCompare(b.codigo)).map(c => (
                        <TableRow key={c.id} className={cn(c.activo === false && 'opacity-50')}>
                          <TableCell className="whitespace-nowrap font-bold text-primary">{c.codigo}</TableCell>
                          <TableCell>
                            <Input type="text" aria-label="Nombre" defaultValue={c.nombre} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.nombre) handleUpdateCeco(c.id, 'nombre', v); }} className="h-8 min-w-[180px]" />
                          </TableCell>
                          <TableCell>
                            <Select aria-label="Tipo" value={c.tipo} onChange={(e) => handleUpdateCeco(c.id, 'tipo', e.target.value)} className="h-8 min-w-[120px]">
                              <option value="Gasto">Gasto</option>
                              <option value="Ingreso">Ingreso</option>
                              <option value="Traslado">Traslado</option>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            <input type="checkbox" aria-label="Activo" className={claseCheckbox} checked={c.activo !== false} onChange={(e) => handleUpdateCeco(c.id, 'activo', e.target.checked)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="m-0 text-xs text-muted-foreground">Desmarcar "Activo" oculta el CECO de los desplegables sin borrarlo — los registros que ya lo usaron lo siguen mostrando normalmente.</p>
                </CardContent>
              )}
            </Card>
            )}

            {/* GESTIÓN DE TERCEROS (SOLO ADMIN Y COORDINADORA) — Opción A de la arquitectura
                aprobada: catálogo de terceros/proveedores administrable desde Finanzas, sin
                depender de crear primero un Pago a Tercero desde Solicitudes. Mismo patrón que
                Gestión de CECOs: se puede crear, editar en línea y desactivar (nunca se borra
                la fila, para no romper el vínculo con pagos históricos). */}
            {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
            <Card className="gap-4 px-0 py-5">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 sm:px-7">
                <CardTitle className="text-lg">🤝 Gestión de Terceros ({todosTerceros.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setMostrarGestionTerceros(!mostrarGestionTerceros)}>
                  {mostrarGestionTerceros ? 'Ocultar' : 'Ver / Crear Terceros'}
                </Button>
              </CardHeader>
              {mostrarGestionTerceros && (
                <CardContent className="flex flex-col gap-4 sm:px-7">
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                    <Input type="text" aria-label="Nombre completo" placeholder="Nombre completo *" value={nuevoTercero.nombre} onChange={(e) => setNuevoTercero({...nuevoTercero, nombre: e.target.value})} />
                    <SelectTipoDocumento value={nuevoTercero.tipoDocumento} onChange={(v) => setNuevoTercero({...nuevoTercero, tipoDocumento: v})} style={estiloCampoUI} />
                    <Input type="text" aria-label="Documento" placeholder="Documento (sin DV) *" value={nuevoTercero.dni} onChange={(e) => setNuevoTercero({...nuevoTercero, dni: e.target.value})} />
                    <Input type="text" aria-label="País de origen" placeholder="País de origen" value={nuevoTercero.paisOrigen} onChange={(e) => setNuevoTercero({...nuevoTercero, paisOrigen: e.target.value})} />
                    <CampoBanco codigo={nuevoTercero.codigoBanco} texto={nuevoTercero.banco} onChange={({ codigo, texto }) => setNuevoTercero({...nuevoTercero, codigoBanco: codigo, banco: texto})} style={estiloCampoUI} />
                    <Select aria-label="Tipo de cuenta" value={nuevoTercero.tipoCuenta} onChange={(e) => setNuevoTercero({...nuevoTercero, tipoCuenta: e.target.value})}>
                      <option value="">Tipo de cuenta</option>
                      <option value="Ahorros">Ahorros</option>
                      <option value="Corriente">Corriente</option>
                    </Select>
                    <Input type="text" aria-label="Número de cuenta" placeholder="Número de cuenta" value={nuevoTercero.numeroCuenta} onChange={(e) => setNuevoTercero({...nuevoTercero, numeroCuenta: e.target.value})} />
                    <Button disabled={guardandoTercero} onClick={handleAddTerceroFinanzas}><Plus size={16} /> Agregar</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tipo Doc.</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Banco</TableHead>
                        <TableHead>Tipo Cuenta</TableHead>
                        <TableHead>Número de Cuenta</TableHead>
                        <TableHead className="text-center">Activo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todosTerceros.length === 0 ? (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin terceros guardados todavía.</TableCell></TableRow>
                      ) : [...todosTerceros].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(t => (
                        <TableRow key={t.id} className={cn(t.activo === false && 'opacity-50')}>
                          <TableCell>
                            <Input type="text" aria-label="Nombre" defaultValue={t.nombre} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.nombre) handleUpdateTercero(t.id, 'nombre', v); }} className="h-8 min-w-[160px]" />
                          </TableCell>
                          <TableCell>
                            <SelectTipoDocumento value={t.tipo_documento} placeholder="—" onChange={(v) => handleUpdateTercero(t.id, 'tipoDocumento', v || null)} style={estiloCampoCompactoUI} />
                          </TableCell>
                          <TableCell>
                            <Input type="text" aria-label="Documento" defaultValue={t.dni} onBlur={(e) => { const v = limpiarDocumento(e.target.value.trim(), t.tipo_documento); e.target.value = v; if (v && v !== t.dni) handleUpdateTercero(t.id, 'dni', v); }} className="h-8 min-w-[120px]" />
                          </TableCell>
                          <TableCell>
                            <SelectBanco value={t.codigo_banco} placeholder="—" onChange={(v) => handleUpdateTercero(t.id, 'codigoBanco', v)} style={estiloCampoCompactoUI} />
                            {!t.codigo_banco && t.banco && <div className="mt-1 text-[0.7rem] text-[#C4622D]">Antes: "{t.banco}" — elige el banco de la lista</div>}
                            {t.codigo_banco === CODIGO_BANCO_EXTERIOR && <Input type="text" aria-label="Nombre del banco del exterior" placeholder="Nombre del banco del exterior" defaultValue={t.banco || ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (t.banco || '')) handleUpdateTercero(t.id, 'banco', v); }} className="mt-1 h-8" />}
                          </TableCell>
                          <TableCell>
                            <Select aria-label="Tipo de cuenta" value={t.tipo_cuenta || ''} onChange={(e) => handleUpdateTercero(t.id, 'tipoCuenta', e.target.value)} className="h-8 min-w-[110px]">
                              <option value="">—</option>
                              <option value="Ahorros">Ahorros</option>
                              <option value="Corriente">Corriente</option>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input type="text" aria-label="Número de cuenta" defaultValue={t.numero_cuenta || ''} onBlur={(e) => { const v = limpiarNumeroCuenta(e.target.value.trim()); e.target.value = v; if (v !== (t.numero_cuenta || '')) handleUpdateTercero(t.id, 'numeroCuenta', v); }} className="h-8 min-w-[130px]" />
                          </TableCell>
                          <TableCell className="text-center">
                            <input type="checkbox" aria-label="Activo" className={claseCheckbox} checked={t.activo !== false} onChange={(e) => handleUpdateTercero(t.id, 'activo', e.target.checked)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="m-0 text-xs text-muted-foreground">Desmarcar "Activo" oculta el tercero de los desplegables de Pago a Tercero (Solicitudes y Finanzas) sin borrarlo — los pagos que ya se le hicieron lo siguen mostrando normalmente.</p>
                </CardContent>
              )}
            </Card>
            )}

            {/* HISTORIAL UNIFICADO: Gastos + Traslados + Ingresos en una sola tabla, con filtro por Tipo */}
            <Card className="gap-4 px-0 py-6 sm:py-7">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 sm:px-7">
                <CardTitle className="text-lg">📋 Historial de Finanzas ({registrosFinanzas.length})</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {['Todos', 'Gasto', 'Traslado', 'Ingreso', 'Pago a Tercero'].map(t => (
                    <Button key={t} size="sm" variant={filtroTipoFinanzas === t ? 'default' : 'outline'} onClick={() => setFiltroTipoFinanzas(t)} className={cn('rounded-full', filtroTipoFinanzas !== t && 'text-muted-foreground')} aria-pressed={filtroTipoFinanzas === t}>
                      {t === 'Gasto' ? '💸 Gasto' : t === 'Traslado' ? '🔄 Traslado' : t === 'Ingreso' ? '💰 Ingreso' : t === 'Pago a Tercero' ? '🤝 Pago a Tercero' : 'Todos'}
                    </Button>
                  ))}
                  {/* Informe PDF del filtro actualmente aplicado — resumen, gráficas y tabla,
                      con vista previa antes de descargar (ver modal más abajo). */}
                  <Button size="sm" onClick={handleAbrirInformeFinanzas} disabled={registrosFinanzas.length === 0} className={claseBotonMorado}>
                    <Eye size={14} /> Ver Informe
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:px-7">

              {/* FILTROS: buscador de texto libre + Empresa/CECO + rango de fechas propio de la
                  tabla (distinto del filtro de fechas del Dashboard de arriba, que no la toca). */}
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-solid border-border bg-background p-4">
                <CampoUI label="Buscar" htmlFor="ff-buscar" className="min-w-[200px] flex-[1_1_220px]">
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="ff-buscar" type="text" placeholder="Colaborador, detalle, cuenta..." value={busquedaFinanzas} onChange={(e) => setBusquedaFinanzas(e.target.value)} className="pl-8" />
                  </div>
                </CampoUI>
                <CampoUI label="Empresa" htmlFor="ff-empresa" className="w-full sm:w-60">
                  <Select id="ff-empresa" value={filtroFinanzasEmpresa} onChange={(e) => setFiltroFinanzasEmpresa(e.target.value)}>
                    <option value="Todas">Todas</option>
                    {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                  </Select>
                </CampoUI>
                <CampoUI label="CECO" htmlFor="ff-ceco" className="w-full sm:w-44">
                  <Select id="ff-ceco" value={filtroFinanzasCeco} onChange={(e) => setFiltroFinanzasCeco(e.target.value)}>
                    <option value="Todos">Todos</option>
                    {[...cecos].sort((a, b) => a.codigo.localeCompare(b.codigo)).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo}</option>)}
                  </Select>
                </CampoUI>
                <CampoUI label="Desde" htmlFor="ff-desde" className="w-full sm:w-40">
                  <Input id="ff-desde" type="date" value={filtroFinanzasFechaInicio} onChange={(e) => setFiltroFinanzasFechaInicio(e.target.value)} />
                </CampoUI>
                <CampoUI label="Hasta" htmlFor="ff-hasta" className="w-full sm:w-40">
                  <Input id="ff-hasta" type="date" value={filtroFinanzasFechaFin} onChange={(e) => setFiltroFinanzasFechaFin(e.target.value)} />
                </CampoUI>
                <CampoUI label="Valor desde" htmlFor="ff-valor-min" className="w-[calc(50%-0.375rem)] sm:w-36">
                  <Input id="ff-valor-min" type="text" inputMode="decimal" placeholder="Ej: 1.000.000" value={filtroFinanzasValorMin} onChange={(e) => setFiltroFinanzasValorMin(e.target.value)} />
                </CampoUI>
                <CampoUI label="Valor hasta" htmlFor="ff-valor-max" className="w-[calc(50%-0.375rem)] sm:w-36">
                  <Input id="ff-valor-max" type="text" inputMode="decimal" placeholder="Ej: 5.000.000" value={filtroFinanzasValorMax} onChange={(e) => setFiltroFinanzasValorMax(e.target.value)} />
                </CampoUI>
                <Button variant="outline" onClick={() => { setBusquedaFinanzas(''); setFiltroFinanzasEmpresa('Todas'); setFiltroFinanzasCeco('Todos'); setFiltroFinanzasFechaInicio(''); setFiltroFinanzasFechaFin(''); setFiltroFinanzasValorMin(''); setFiltroFinanzasValorMax(''); }}><RotateCcw size={14} /> Reiniciar</Button>
              </div>

              {(cargandoGastos || cargandoIngresos) && <p className="m-0 text-sm text-muted-foreground">Cargando...</p>}
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-px">Fecha / Tipo</TableHead>
                    {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa' || user.rol === 'Contadora' || user.rol === 'Gerente') && <TableHead>Colaborador</TableHead>}
                    <TableHead>Empresa</TableHead>
                    <TableHead>CECO / Cuenta</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="w-px text-right">Valor</TableHead>
                    <TableHead className="w-px text-center">Soportes</TableHead>
                    {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && <TableHead className="w-px text-center">Acción</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {registrosFinanzas.length === 0 ? (
                      <TableRow className="hover:bg-transparent"><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Sin registros para este filtro.</TableCell></TableRow>
                    ) : registrosFinanzas.map(r => {
                      const esGasto = r.tipo === 'Gasto';
                      const esTraslado = r.tipo === 'Traslado';
                      const esIngreso = r.tipo === 'Ingreso';
                      // También detecta un Gasto normal categorizado bajo el CECO "Pago a
                      // Terceros" (esPagoTerceroFinanzas en el formulario) — esas filas quedan
                      // con tipo: 'Gasto' pero sí traen terceroInfo, así que se identifican por
                      // eso y no solo por el tipo.
                      const esPagoTercero = r.tipo === 'Pago a Tercero' || !!r.terceroInfo;
                      const esSalidaTraslado = r._ladoTraslado === 'salida';
                      const esEntradaTraslado = r._ladoTraslado === 'entrada';
                      const claseValor = esPagoTercero ? 'text-destructive' : (esIngreso || esEntradaTraslado ? 'text-success' : (esSalidaTraslado ? 'text-destructive' : (esTraslado ? 'text-primary' : 'text-destructive')));
                      const iconoTipo = esPagoTercero ? '🤝' : (esGasto ? '💸' : (esTraslado ? '🔄' : '💰'));
                      const verSoportesFn = esIngreso ? handleVerSoportesIngreso : handleVerSoportesGasto;
                      const deleteFn = esIngreso ? handleDeleteIngreso : handleDeleteGasto;
                      // Nombre/foto del colaborador: se resuelven por colaboradores_publico (id), no por
                      // personasFinanzas/responsableNombre — esos dependen de leer la fila de la OTRA
                      // persona en public.usuarios, que RLS solo permite a Administrador/Coordinadora.
                      // Contadora y Gerente ven el historial completo pero antes les salía "?" sin nombre
                      // en cualquier fila que no fuera la suya propia.
                      const colaboradorInfo = colaboradoresPublico.find(c => c.id === r.responsableId);
                      const nombreColaborador = colaboradorInfo?.nombre || r.responsableNombre || '—';
                      const nombreTerceroCatalogo = !esPagoTercero && r.terceroId ? todosTerceros.find(t => t.id === r.terceroId)?.nombre : null;
                      return (
                        <TableRow key={`${r.tipo}-${r.id}${r._ladoTraslado ? '-' + r._ladoTraslado : ''}`}>
                          <TableCell className="w-px whitespace-nowrap text-xs"><div className="text-[0.7rem] text-muted-foreground">{r.fecha}</div>
                            {iconoTipo} {r.tipo}
                            {esSalidaTraslado && <span className="font-bold text-destructive"> · Salida</span>}
                            {esEntradaTraslado && <span className="font-bold text-success"> · Entrada</span>}
                          </TableCell>
                          {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa' || user.rol === 'Contadora' || user.rol === 'Gerente') && <TableCell className="w-px whitespace-nowrap text-xs"><div className="flex items-center gap-2"><ColaboradorAvatar foto={colaboradorInfo?.foto_url} nombre={nombreColaborador} size={22} />{nombreColaborador}</div></TableCell>}
                          <TableCell className="w-px whitespace-nowrap text-xs" title={r.empresa}><EmpresaLogo empresa={r.empresa} height={20} /><div className="text-[0.65rem] text-muted-foreground">{(r.empresa || '').split(' ')[0]}</div></TableCell>
                          <TableCell className="w-px whitespace-nowrap text-xs">
                            <span className="whitespace-nowrap font-bold text-primary">{r.ceco}</span>
                            {r.cuenta && <div className="text-muted-foreground">{r.cuenta}</div>}
                          </TableCell>
                          <TableCell className="min-w-[220px] text-muted-foreground">
                            {editandoConceptoFinanzas && editandoConceptoFinanzas.id === r.id && editandoConceptoFinanzas.tabla === (esIngreso ? 'ingresos' : 'gastos') ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Input type="date" value={editandoConceptoFinanzas.fecha} onChange={(e) => setEditandoConceptoFinanzas({ ...editandoConceptoFinanzas, fecha: e.target.value })} title="Fecha" aria-label="Fecha" className="h-8 w-auto border-primary text-xs" />
                                <div className="w-auto max-w-[180px]">
                                  <Select value={editandoConceptoFinanzas.ceco} onChange={(e) => setEditandoConceptoFinanzas({ ...editandoConceptoFinanzas, ceco: e.target.value })} title="CECO" aria-label="CECO" className="h-8 border-primary text-xs">
                                    {!editandoConceptoFinanzas.opcionesCeco.some(c => c.codigo === editandoConceptoFinanzas.ceco) && <option value={editandoConceptoFinanzas.ceco}>{editandoConceptoFinanzas.ceco || 'Elegir CECO…'}</option>}
                                    {editandoConceptoFinanzas.opcionesCeco.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                                  </Select>
                                </div>
                                {editandoConceptoFinanzas.permiteNeutro && (
                                  <div className="w-[84px]">
                                    <Select value={editandoConceptoFinanzas.neutro ? 'COP' : editandoConceptoFinanzas.moneda} disabled={!!editandoConceptoFinanzas.neutro} onChange={(e) => setEditandoConceptoFinanzas({ ...editandoConceptoFinanzas, moneda: e.target.value })} title="Moneda en que realmente se pagó (si la cambias, corrige también el valor)" aria-label="Moneda" className="h-8 border-primary text-xs">
                                      <option value="COP">COP</option>
                                      <option value="USD">USD</option>
                                    </Select>
                                  </div>
                                )}
                                <Input type="text" inputMode="decimal" value={editandoConceptoFinanzas.valor} onChange={(e) => setEditandoConceptoFinanzas({ ...editandoConceptoFinanzas, valor: e.target.value })} title="Valor" aria-label="Valor" placeholder="Valor" className="h-8 w-[110px] border-primary text-xs" />
                                {editandoConceptoFinanzas.tieneValorDestino && (
                                  <Input type="text" inputMode="decimal" value={editandoConceptoFinanzas.valorDestino} onChange={(e) => setEditandoConceptoFinanzas({ ...editandoConceptoFinanzas, valorDestino: e.target.value })} title="Valor destino (otra moneda)" aria-label="Valor destino" placeholder="Valor destino" className="h-8 w-[110px] border-primary text-xs" />
                                )}
                                {editandoConceptoFinanzas.permiteNeutro && (
                                  <label title="Gasto Neutro: se registra en COP y no suma en los gastos de la empresa" className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                                    <input type="checkbox" className={claseCheckbox} checked={!!editandoConceptoFinanzas.neutro} onChange={(e) => setEditandoConceptoFinanzas({ ...editandoConceptoFinanzas, neutro: e.target.checked })} />
                                    ⚪ Neutro (COP)
                                  </label>
                                )}
                                {editandoConceptoFinanzas.permiteVinculo && (() => {
                                  // Vínculo a Presupuesto (antes era una columna del historial): conceptos activos
                                  // del MISMO CECO elegido en el editor y de la misma empresa; si ya estaba vinculado
                                  // a uno de otro CECO, se mantiene en la lista para no perder la selección.
                                  const ed = editandoConceptoFinanzas;
                                  const mismos = presupuestoItems.filter(p => p.activo !== false && p.empresa === ed.empresa && p.ceco === ed.ceco);
                                  const actual = ed.presupuestoItemId ? presupuestoItems.find(p => p.id === ed.presupuestoItemId) : null;
                                  const opciones = (actual && !mismos.some(p => p.id === actual.id) ? [...mismos, actual] : mismos)
                                    .slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
                                  if (!opciones.length) return null;
                                  return (
                                    <div className="w-[170px]">
                                      <Select value={ed.presupuestoItemId} onChange={(e) => setEditandoConceptoFinanzas({ ...ed, presupuestoItemId: e.target.value })} title="Vincular a un concepto de Presupuesto (marca ese mes como pagado)" aria-label="Vincular a Presupuesto" className={cn('h-8 border-primary text-xs', ed.presupuestoItemId && 'bg-success/10')}>
                                        <option value="">📅 Sin vincular</option>
                                        {opciones.map(p => <option key={p.id} value={p.id}>📅 {p.nombre}{p.ceco !== ed.ceco ? ` · ${p.ceco}` : ''}</option>)}
                                      </Select>
                                    </div>
                                  );
                                })()}
                                <Input autoFocus type="text" aria-label="Concepto" value={editandoConceptoFinanzas.texto} onChange={(e) => setEditandoConceptoFinanzas({ ...editandoConceptoFinanzas, texto: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') handleGuardarConceptoFinanzas(); if (e.key === 'Escape') setEditandoConceptoFinanzas(null); }} className="h-8 min-w-[140px] flex-1 border-primary text-xs" />
                                <Button variant="ghost" size="icon" disabled={guardandoConceptoFinanzas} onClick={handleGuardarConceptoFinanzas} title="Guardar" aria-label="Guardar" className="size-8 text-success"><Check size={16} /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setEditandoConceptoFinanzas(null)} title="Cancelar" aria-label="Cancelar" className="size-8 text-muted-foreground"><X size={16} /></Button>
                              </div>
                            ) : (
                              <div className="flex items-start gap-1">
                                <div><TextoResumido texto={r.detalle} /></div>
                                {puedeEditarConceptoFinanzas && (
                                  <Button variant="ghost" size="icon" onClick={() => setEditandoConceptoFinanzas({ tabla: esIngreso ? 'ingresos' : 'gastos', id: r.id, texto: r.detalle || '', fecha: r.fecha || '', ceco: r.ceco || '', valor: String((esIngreso ? r : (gastos.find(g => g.id === r.id) || r)).valor ?? '').replace('.', ','), tieneValorDestino: esTraslado && r.valorDestino != null, permiteNeutro: !esIngreso && !esTraslado, neutro: !!r.neutro, permiteVinculo: esGasto && (user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa'), empresa: r.empresa, presupuestoItemId: r.presupuestoItemId || '', presupuestoItemIdOriginal: r.presupuestoItemId || '', moneda: r.moneda || getMoneda(r.empresa), monedaOriginal: r.moneda || getMoneda(r.empresa), valorDestino: String(r.valorDestino ?? '').replace('.', ','), opcionesCeco: esIngreso ? cecosIngreso : (esTraslado ? cecosTraslado : cecosGasto) })} title="Editar fecha, CECO, valor y concepto (solo en Finanzas)" aria-label="Editar" className="size-7 shrink-0 text-[#6C63D1]"><Pencil size={14} /></Button>
                                )}
                              </div>
                            )}
                            {esPagoTercero && r.terceroInfo?.nombre && (
                              <div className="text-[0.7rem] text-muted-foreground">👤 {r.terceroInfo.nombre}{r.terceroInfo.dni ? ` · ${r.terceroInfo.dni}` : ''}</div>
                            )}
                            {nombreTerceroCatalogo && (
                              <div className="text-[0.7rem] text-muted-foreground">🏢 {nombreTerceroCatalogo}</div>
                            )}
                            {r.neutro && (
                              <Badge variant="outline" className="mt-1 text-[0.65rem]" title="Registrado en COP; no suma en los gastos de la empresa">⚪ Gasto Neutro</Badge>
                            )}
                            {r.solicitudOrigenId && (
                              <button type="button" onClick={() => handleVerSolicitudOrigen(r.solicitudOrigenId)} title="Ver la solicitud original" className="block cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-[0.7rem] text-[#6C63D1] underline-offset-2 hover:underline">🔗 Generado desde Solicitudes</button>
                            )}
                            {r.presupuestoItemId && r.observaciones === OBSERVACIONES_GASTO_DESDE_PRESUPUESTO && (
                              <div className="text-[0.7rem] text-[#6C63D1]">🔗 Generado desde Presupuesto</div>
                            )}
                            {r.presupuestoItemId && r.observaciones !== OBSERVACIONES_GASTO_DESDE_PRESUPUESTO && (
                              <div className="text-[0.7rem] text-[#6C63D1]">📅 Vinculado a Presupuesto: {presupuestoItems.find(p => p.id === r.presupuestoItemId)?.nombre || 'concepto'}</div>
                            )}
                            {r.observaciones && r.observaciones.startsWith(OBSERVACIONES_GASTO_LOTE_TERCERO) && (
                              <div className="flex flex-wrap items-center gap-1.5 text-[0.7rem] text-[#6C63D1]">
                                🧾 Factura de tercero (lote)
                                {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
                                  <button type="button" onClick={() => handleAbrirEditarLoteTercero(r)} title="Editar todas las facturas de este lote (retención, N° de factura, valores, agregar colaboradores)" className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[0.7rem] font-bold text-[#6C63D1] underline underline-offset-2">Editar lote</button>
                                )}
                              </div>
                            )}
                            {r.lotePagoId && (
                              <button type="button" onClick={() => handleVerLotePagoGastos(r.lotePagoId)} className="mt-0.5 block cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[0.7rem] font-bold text-[#6C63D1] hover:underline">
                                🔗 Pagado en lote junto con otros
                              </button>
                            )}
                          </TableCell>
                          <TableCell className={cn('w-px whitespace-nowrap text-right font-bold', claseValor)}>
                            {esSalidaTraslado ? '− ' : esEntradaTraslado ? '+ ' : ''}{(esPagoTercero || (esGasto && r.moneda)) ? formatMoneyByMoneda(parseFloat(r.valor) || 0, r.moneda || getMoneda(r.empresa)) : formatMoney(r.valor, r.empresa)}
                            {r.valorBruto != null && (
                              <div className="text-[0.7rem] font-normal text-muted-foreground" title="Valor bruto antes de deducciones">
                                Bruto {formatMoney(r.valorBruto, r.empresa)} · −{formatMoney(r.deduccionAplicada, r.empresa)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-0.5">
                            {esPagoTercero && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => setVerDetalleTercero({...r, responsableNombre: nombreColaborador, moneda: r.moneda || getMoneda(r.empresa)})} title="Ver Detalle del Tercero" aria-label="Ver Detalle del Tercero">
                                  <Eye size={16} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleGenerarPDFPagoTercero({...r, responsableNombre: nombreColaborador, moneda: r.moneda || getMoneda(r.empresa)})} className="text-[#6C63D1]" title="PDF" aria-label="PDF">
                                  <FileDown size={16} />
                                </Button>
                              </>
                            )}
                            {(r.cantidadSoportes > 0 || r.soporteDriveLink) ? (
                              <Button variant="ghost" size="sm" onClick={() => verSoportesFn(r)} className="text-success" title="Ver soportes"><Paperclip size={14} /> {r.soporteDriveLink ? 'Drive' : r.cantidadSoportes}</Button>
                            ) : (
                              <span className="px-2 text-xs text-muted-foreground">—</span>
                            )}
                            {/* Subir un soporte sobreviniente (o varios) a este registro ya guardado,
                                sin abrir ningún formulario — solo Administrador/Coordinadora. */}
                            {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
                              <label title="Agregar soporte" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'text-[#6C63D1]', agregandoSoporteId === r.id && 'cursor-not-allowed opacity-60')}>
                                {agregandoSoporteId === r.id ? <Loader2 size={16} className="animate-spin" /> : <FilePlus2 size={16} />}
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  multiple
                                  disabled={agregandoSoporteId === r.id}
                                  className="hidden"
                                  onChange={(e) => {
                                    const files = e.target.files;
                                    if (files && files.length) handleAgregarSoporteHistorial(r, files);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                            </div>
                          </TableCell>
                          {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && (
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon" onClick={() => deleteFn(r.id)} className="text-destructive" title="Eliminar" aria-label="Eliminar"><Trash2 size={16} /></Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === 'dashboardFinanciero' && puedeVerFinanzas && (
          // Etapa 3 del sistema de diseño: Dashboard Financiero migrado a los componentes de
          // src/components/ui/ (mismos datos y cálculos; solo cambia la presentación).
          <div className="flex flex-col gap-6">
            <h2 className="m-0 flex items-center gap-2 text-xl font-extrabold"><TrendingUp size={22} className="text-primary" /> Dashboard Financiero Avanzado</h2>

            {/* FILTRO DE FECHAS */}
            <Card className="flex-row flex-wrap items-end gap-3 px-5 py-4">
              <CampoUI label="Desde" htmlFor="df-desde" className="w-[calc(50%-0.375rem)] sm:w-44">
                <Input id="df-desde" type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} className="cursor-pointer" />
              </CampoUI>
              <CampoUI label="Hasta" htmlFor="df-hasta" className="w-[calc(50%-0.375rem)] sm:w-44">
                <Input id="df-hasta" type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} className="cursor-pointer" />
              </CampoUI>
              <Button variant="outline" onClick={() => { setFiltroFechaInicio('2026-01-01'); setFiltroFechaFin(new Date().toISOString().split('T')[0]); }}>
                <RotateCcw size={14} /> Reiniciar
              </Button>
            </Card>

            {/* CARDS RESUMEN — COP (todas las empresas excepto ARKO) */}
            {(() => {
              const ingresosCOPFiltrado = ingresosFiltradomatCOP.reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0);
              const gastosCOPFiltrado = gastosFiltradomatCOP.reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0);
              const balanceCOPFiltrado = ingresosCOPFiltrado - gastosCOPFiltrado;
              const ingresosUSDFiltrado = ingresosFiltradomatUSD.reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0);
              const gastosUSDFiltrado = gastosFiltradomatUSD.reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0);
              const balanceUSDFiltrado = ingresosUSDFiltrado - gastosUSDFiltrado;
              // Tres tarjetas Ingresos / Gastos / Balance para una moneda.
              const tarjetasResumen = (ingresos, gastos, balance, moneda, sufijo) => (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: TrendingUp, label: `Ingresos${sufijo}`, valor: ingresos, clase: 'text-success', fondo: 'bg-success/10' },
                    { icon: TrendingDown, label: `Gastos${sufijo}`, valor: gastos, clase: 'text-destructive', fondo: 'bg-destructive/10' },
                    { icon: Scale, label: `Balance${sufijo}`, valor: balance, clase: balance >= 0 ? 'text-success' : 'text-destructive', fondo: balance >= 0 ? 'bg-success/10' : 'bg-destructive/10' },
                  ].map(t => {
                    const Icono = t.icon;
                    return (
                      <Card key={t.label} className="min-w-0 gap-2 px-5 py-5">
                        <div className="flex items-center gap-2">
                          <span className={cn('flex size-8 items-center justify-center rounded-lg', t.fondo, t.clase)}><Icono size={16} /></span>
                          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</p>
                        </div>
                        <p className={cn('m-0 text-[clamp(1.35rem,2.4vw,1.9rem)] font-extrabold leading-tight tabular-nums [overflow-wrap:anywhere]', t.clase)}>{formatMoneyByMoneda(t.valor, moneda)}</p>
                      </Card>
                    );
                  })}
                </div>
              );
              const subtitulo = (texto, nota) => (
                <h3 className="m-0 text-sm font-bold text-muted-foreground">{texto}{nota && <span className="font-normal"> — {nota}</span>}</h3>
              );
              return (
                <>
                  <div className="flex flex-col gap-3">
                    {subtitulo('Resumen en Pesos (COP)', 'movimientos en pesos de todas las empresas (sin traslados)')}
                    {tarjetasResumen(ingresosCOPFiltrado, gastosCOPFiltrado, balanceCOPFiltrado, 'COP', '')}
                  </div>

                  {/* RESUMEN POR EMPRESA — Ingresos, Gastos y Balance de cada empresa individual (COP) */}
                  <Card className="gap-4 px-0 py-5">
                    <CardHeader className="sm:px-6"><CardTitle className="flex items-center gap-2"><Building2 size={18} className="text-primary" /> Resumen por Empresa (COP)</CardTitle></CardHeader>
                    <CardContent className="sm:px-6">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Empresa</TableHead>
                            <TableHead className="text-right">Ingresos</TableHead>
                            <TableHead className="text-right">Gastos</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resumenPorEmpresaCOP.map(r => (
                            <TableRow key={r.empresa}>
                              <TableCell className="font-semibold"><div className="flex items-center gap-2"><EmpresaLogo empresa={r.empresa} height={18} />{r.empresa}</div></TableCell>
                              <TableCell className="whitespace-nowrap text-right text-success">{formatMoneyByMoneda(r.ingresos, 'COP')}</TableCell>
                              <TableCell className="whitespace-nowrap text-right text-destructive">{formatMoneyByMoneda(r.gastos, 'COP')}</TableCell>
                              <TableCell className={cn('whitespace-nowrap text-right font-bold', r.balance >= 0 ? 'text-success' : 'text-destructive')}>{formatMoneyByMoneda(r.balance, 'COP')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* CARDS RESUMEN — USD (ARKO + pagos en USD de cualquier empresa) */}
                  <div className="flex flex-col gap-3">
                    {subtitulo('💵 Resumen en Dólares (USD)', 'ARKO y pagos en USD (sin traslados)')}
                    {tarjetasResumen(ingresosUSDFiltrado, gastosUSDFiltrado, balanceUSDFiltrado, 'USD', ' USD')}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* GASTOS NEUTROS — registrados en COP pero sin sumar como gasto de la empresa */}
                    {neutrosFiltrados.length > 0 && (
                      <Card className="min-w-0 gap-3 px-5 py-5">
                        {subtitulo('⚪ Gastos Neutros del período', 'registrados, pero no cuentan como gasto')}
                        <div className="flex flex-wrap gap-8">
                          <div><p className="m-0 mb-1 text-xs text-muted-foreground">Cantidad</p><p className="m-0 text-2xl font-extrabold text-muted-foreground">{neutrosFiltrados.length}</p></div>
                          {['COP', 'USD'].map(m => {
                            const total = neutrosFiltrados.filter(g => monedaMovimiento(g) === m).reduce((sum, g) => sum + (parseFloat(g.valor) || 0), 0);
                            return total > 0 ? <div key={m}><p className="m-0 mb-1 text-xs text-muted-foreground">Total ({m})</p><p className="m-0 text-2xl font-extrabold text-muted-foreground">{formatMoneyByMoneda(total, m)}</p></div> : null;
                          })}
                        </div>
                      </Card>
                    )}

                    {/* TRASLADOS — movimientos entre cuentas/empresas, aparte de Gastos e Ingresos */}
                    <Card className={cn('min-w-0 gap-3 px-5 py-5', neutrosFiltrados.length === 0 && 'lg:col-span-2')}>
                      {subtitulo('🔄 Traslados del período', 'no cuentan como gasto ni ingreso')}
                      {trasladosPorRuta.length === 0 ? (
                        <p className="m-0 text-sm text-muted-foreground">Sin traslados en este rango de fechas.</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-8">
                            <div><p className="m-0 mb-1 text-xs text-muted-foreground">Cantidad</p><p className="m-0 text-2xl font-extrabold text-chart-3">{trasladosFiltrados.length}</p></div>
                            {['COP', 'USD'].map(m => {
                              const total = trasladosPorRuta.filter(r => r.moneda === m).reduce((sum, r) => sum + r.total, 0);
                              return total > 0 ? <div key={m}><p className="m-0 mb-1 text-xs text-muted-foreground">Total movido ({m})</p><p className="m-0 text-2xl font-extrabold text-chart-3">{formatMoneyByMoneda(total, m)}</p></div> : null;
                            })}
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead>Desde</TableHead>
                                <TableHead>Hacia</TableHead>
                                <TableHead className="text-center">Cantidad</TableHead>
                                <TableHead className="text-right">Total (moneda de salida)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {trasladosPorRuta.map(r => (
                                <TableRow key={`${r.origen}-${r.destino}-${r.moneda}`}>
                                  <TableCell>{r.origen}</TableCell>
                                  <TableCell>{r.destino === r.origen ? 'Entre cuentas propias' : r.destino}</TableCell>
                                  <TableCell className="text-center text-muted-foreground">{r.cantidad}</TableCell>
                                  <TableCell className="whitespace-nowrap text-right font-bold text-chart-3">{formatMoneyByMoneda(r.total, r.moneda)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </>
                      )}
                    </Card>
                  </div>
                </>
              );
            })()}

            {/* GRÁFICO GASTOS VS INGRESOS POR MES — al pasar el mouse por una barra se ve el valor exacto */}
            {datosPorMes.length > 0 && (() => {
              const maxVal = Math.max(...datosPorMes.map(m => Math.max(m.gastos, m.ingresos))) || 1;
              const anchoGrupo = 690 / datosPorMes.length;
              const barWidth = Math.min(anchoGrupo / 2.5, 48);
              const etiquetaMes = (clave) => { const [y, m] = clave.split('-').map(Number); return `${nombresMeses[m - 1]?.slice(0, 3) || m} ${String(y).slice(2)}`; };
              const compacto = (v) => v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(Math.round(v));
              return (
                <Card className="gap-4 px-0 py-5">
                  <CardHeader className="sm:px-6">
                    <CardTitle className="flex flex-wrap items-center gap-2"><BarChart3 size={18} className="text-primary" /> Gastos vs Ingresos por Mes <span className="text-xs font-normal text-muted-foreground">(COP — sin USD ni traslados)</span></CardTitle>
                  </CardHeader>
                  <CardContent className="sm:px-6">
                    <svg viewBox="0 0 800 300" role="img" aria-label="Gastos e ingresos por mes en COP" className="block h-auto max-h-[320px] w-full">
                      {/* Grid recesivo con valores del eje */}
                      {[0, 1, 2, 3, 4].map(i => (
                        <g key={`grid-${i}`}>
                          <line x1="60" y1={50 + i * 50} x2="750" y2={50 + i * 50} stroke="#E6E0D2" strokeWidth="1" strokeDasharray="4,4" />
                          <text x="54" y={54 + i * 50} textAnchor="end" fill="#8F8877" fontSize="11">{compacto(maxVal * (4 - i) / 4)}</text>
                        </g>
                      ))}
                      {datosPorMes.map((mes, idx) => {
                        const x = 60 + idx * anchoGrupo + (anchoGrupo - (barWidth * 2 + 4)) / 2;
                        const gastosHeight = (mes.gastos / maxVal) * 200;
                        const ingresosHeight = (mes.ingresos / maxVal) * 200;
                        return (
                          <g key={`mes-${idx}`}>
                            <rect x={x} y={250 - gastosHeight} width={barWidth} height={gastosHeight} rx="3" fill="#CC4B4B">
                              <title>{`${etiquetaMes(mes.mes)} · Gastos: ${formatMoneyByMoneda(mes.gastos, 'COP')}`}</title>
                            </rect>
                            <rect x={x + barWidth + 4} y={250 - ingresosHeight} width={barWidth} height={ingresosHeight} rx="3" fill="#2F9E52">
                              <title>{`${etiquetaMes(mes.mes)} · Ingresos: ${formatMoneyByMoneda(mes.ingresos, 'COP')}`}</title>
                            </rect>
                            <text x={x + barWidth + 2} y="272" textAnchor="middle" fill="#6B6458" fontSize="12">{etiquetaMes(mes.mes)}</text>
                          </g>
                        );
                      })}
                      <line x1="60" y1="250" x2="750" y2="250" stroke="#D9D2C0" strokeWidth="1.5" />
                    </svg>
                    <div className="mt-2 flex justify-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-sm bg-destructive" />Gastos</span>
                      <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-sm bg-success" />Ingresos</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* TOP CECOs Y TOP EMPRESAS — barras horizontales con su valor (antes eran tortas) */}
            {(topCecos.length > 0 || topEmpresas.length > 0) && (
              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  { datos: topCecos, titulo: 'Top 5 CECOs', icon: Trophy },
                  { datos: topEmpresas, titulo: 'Top 5 Empresas', icon: Building2 },
                ].filter(b => b.datos.length > 0).map(b => {
                  const Icono = b.icon;
                  const max = Math.max(...b.datos.map(d => d.value)) || 1;
                  const total = b.datos.reduce((sum, d) => sum + d.value, 0) || 1;
                  return (
                    <Card key={b.titulo} className="min-w-0 gap-4 px-0 py-5">
                      <CardHeader className="sm:px-6">
                        <CardTitle className="flex flex-wrap items-center gap-2"><Icono size={18} className="text-primary" /> {b.titulo} <span className="text-xs font-normal text-muted-foreground">(gastos COP — sin USD ni traslados)</span></CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 sm:px-6">
                        {b.datos.map(d => (
                          <div key={d.name} className="flex flex-col gap-1" title={`${d.name}: ${formatMoneyByMoneda(d.value, 'COP')}`}>
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="truncate">{d.name}</span>
                              <span className="whitespace-nowrap font-semibold tabular-nums">{formatMoneyByMoneda(d.value, 'COP')} <span className="text-xs font-normal text-muted-foreground">· {((d.value / total) * 100).toFixed(0)}%</span></span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${(d.value / max) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* CECOs POR EMPRESA — VALOR EJECUTADO TOTAL */}
            {cecosPorEmpresaCOP.length > 0 && (
              <Card className="gap-4 px-0 py-5">
                <CardHeader className="sm:px-6">
                  <CardTitle className="flex flex-wrap items-center gap-2"><FolderOpen size={18} className="text-primary" /> CECOs por Empresa <span className="text-xs font-normal text-muted-foreground">— Valor Ejecutado (COP — sin USD ni traslados)</span></CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6 sm:px-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>CECO</TableHead>
                        {empresasCOP.map(emp => (
                          <TableHead key={emp} className="text-right">
                            {EMPRESA_LOGOS[emp] ? <EmpresaLogo empresa={emp} height={16} style={{ display: 'block', marginLeft: 'auto', marginBottom: '0.25rem' }} /> : null}
                            {emp.split(' ')[0]}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Total Ejecutado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cecosPorEmpresaCOP.map(c => (
                        <TableRow key={c.codigo}>
                          <TableCell className="min-w-[160px] font-semibold">{c.nombre}</TableCell>
                          {empresasCOP.map(emp => (
                            <TableCell key={emp} className={cn('whitespace-nowrap text-right', c.porEmpresa[emp] > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                              {c.porEmpresa[emp] > 0 ? formatMoneyByMoneda(c.porEmpresa[emp], 'COP') : '—'}
                            </TableCell>
                          ))}
                          <TableCell className="whitespace-nowrap text-right font-bold text-primary">{formatMoneyByMoneda(c.total, 'COP')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {cecosArkoUSD.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h3 className="m-0 flex flex-wrap items-center gap-2 text-base font-bold"><FolderOpen size={18} className="text-primary" /> CECOs en USD <span className="text-xs font-normal text-muted-foreground">— Valor Ejecutado (USD)</span></h3>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>CECO</TableHead>
                            <TableHead className="text-right">Total Ejecutado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cecosArkoUSD.map(c => (
                            <TableRow key={c.codigo}>
                              <TableCell className="font-semibold">{c.nombre}</TableCell>
                              <TableCell className="whitespace-nowrap text-right font-bold text-destructive">{formatMoneyByMoneda(c.valor, 'USD')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {currentView === 'presupuesto' && !puedeVerFinanzas && (
          <Card className="items-center px-6 py-8 text-center">
            <CardTitle className="text-lg">📅 Presupuesto</CardTitle>
            <p className="m-0 text-muted-foreground">No tienes acceso a este módulo.</p>
            <Button onClick={() => setCurrentView('dashboard')}>Ir al Dashboard</Button>
          </Card>
        )}

        {currentView === 'presupuesto' && puedeVerFinanzas && (() => {
          // Etapa 3 del sistema de diseño: Presupuesto migrado a los componentes de
          // src/components/ui/ (misma lógica, handlers y permisos que antes; solo cambia la presentación).
          const puedeEditarPresupuesto = user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa';
          // Recuadro gris de las tarjetas de totales y de los formularios de cada pestaña.
          const claseRecuadro = 'rounded-lg border border-solid border-border bg-background p-5';
          // Filtro Pagado/Pendiente/Todos de la tabla Mensual — no afecta las tarjetas de totales
          // (esas siguen mostrando el total real de la Empresa/Mes/Año elegidos arriba).
          const presupuestoMensualFiltrado = presupuestoMensualDetalle.filter(item =>
            filtroEstadoMensual === 'pagados' ? item.pagado : filtroEstadoMensual === 'pendientes' ? !item.pagado : true
          );
          // Gestión de Conceptos: filtrado por la Empresa de arriba salvo que se active "Todas".
          const conceptosGestionFiltrados = (gestionConceptosTodasEmpresas ? presupuestoItems : presupuestoItems.filter(p => p.empresa === filtroPresupuesto.empresa))
            .slice().sort((a, b) => (a.empresa || '').localeCompare(b.empresa || '') || (a.nombre || '').localeCompare(b.nombre || ''));
          const pestanas = [
            { id: 'mensual', label: '📆 Mensual: Pagado/Pendiente' },
            { id: 'anual', label: '📊 Ejecución Anual por CECO' },
            ...(user.rol !== 'Gerente' ? [{ id: 'deducciones', label: '💵 Deducciones' }, { id: 'gestion', label: '⚙️ Gestión de Conceptos' }] : []),
          ];

          return (
            <Card className="gap-5 px-0 py-6 sm:py-7">
              <CardHeader className="sm:px-7">
                <CardTitle className="text-lg">📅 Presupuesto</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 sm:px-7">
                {cargandoPresupuesto && <p className="m-0 text-sm text-muted-foreground">Cargando presupuesto...</p>}

                {/* FILTROS */}
                <div className="flex flex-wrap items-end gap-3 rounded-lg border border-solid border-border bg-background p-4">
                  <CampoUI label="Empresa" htmlFor="pp-empresa" className="w-full sm:w-64">
                    <Select id="pp-empresa" value={filtroPresupuesto.empresa} onChange={(e) => setFiltroPresupuesto({...filtroPresupuesto, empresa: e.target.value})}>
                      {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </Select>
                  </CampoUI>
                  <CampoUI label="Mes" htmlFor="pp-mes" className="w-[calc(50%-0.375rem)] sm:w-40">
                    <Select id="pp-mes" value={filtroPresupuesto.mes} onChange={(e) => setFiltroPresupuesto({...filtroPresupuesto, mes: parseInt(e.target.value)})}>
                      {nombresMeses.map((nombre, idx) => <option key={idx} value={idx + 1}>{nombre}</option>)}
                    </Select>
                  </CampoUI>
                  <CampoUI label="Año" htmlFor="pp-anio" className="w-[calc(50%-0.375rem)] sm:w-28">
                    <Input id="pp-anio" type="number" value={filtroPresupuesto.anio} onChange={(e) => setFiltroPresupuesto({...filtroPresupuesto, anio: parseInt(e.target.value) || filtroPresupuesto.anio})} />
                  </CampoUI>
                </div>

                {/* TABS */}
                <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
                  {pestanas.map(t => (
                    <button key={t.id} type="button" role="tab" aria-selected={presupuestoTab === t.id} onClick={() => setPresupuestoTab(t.id)}
                      className={cn('flex-1 cursor-pointer whitespace-nowrap rounded-md border-0 px-3 py-2 font-[inherit] text-sm font-semibold transition-colors', presupuestoTab === t.id ? 'bg-card text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground')}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ===== TAB MENSUAL ===== */}
                {presupuestoTab === 'mensual' && (
                  presupuestoMensualDetalle.length === 0 ? (
                    <p className="m-0 text-muted-foreground">Aún no hay conceptos de presupuesto cargados para <strong>{filtroPresupuesto.empresa}</strong>. Ve a la pestaña "Gestión de Conceptos" para agregarlos.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                        <div className={claseRecuadro}>
                          <p className="m-0 mb-2 text-xs text-muted-foreground">Total Presupuestado</p>
                          <p className="m-0 text-xl font-extrabold">{formatMoney(presupuestoMensualTotales.totalPresupuestado, filtroPresupuesto.empresa)}</p>
                        </div>
                        <div className={cn(claseRecuadro, 'border-l-4 border-l-success')}>
                          <p className="m-0 mb-2 text-xs text-muted-foreground">Pagado ({presupuestoMensualTotales.itemsPagados})</p>
                          <p className="m-0 text-xl font-extrabold text-success">{formatMoney(presupuestoMensualTotales.totalPagado, filtroPresupuesto.empresa)}</p>
                          <p className="m-0 mt-1 text-xs text-muted-foreground">{presupuestoMensualTotales.totalPresupuestado > 0 ? ((presupuestoMensualTotales.totalPagado / presupuestoMensualTotales.totalPresupuestado) * 100).toFixed(1) : '0.0'}%</p>
                        </div>
                        <div className={cn(claseRecuadro, 'border-l-4 border-l-destructive')}>
                          <p className="m-0 mb-2 text-xs text-muted-foreground">Pendiente ({presupuestoMensualTotales.itemsPendientes})</p>
                          <p className="m-0 text-xl font-extrabold text-destructive">{formatMoney(presupuestoMensualTotales.totalPendiente, filtroPresupuesto.empresa)}</p>
                          <p className="m-0 mt-1 text-xs text-muted-foreground">{presupuestoMensualTotales.totalPresupuestado > 0 ? ((presupuestoMensualTotales.totalPendiente / presupuestoMensualTotales.totalPresupuestado) * 100).toFixed(1) : '0.0'}%</p>
                        </div>
                        {presupuestoMensualTotales.totalDeducciones > 0 && (
                          <div className={cn(claseRecuadro, 'border-l-4 border-l-chart-3')}>
                            <p className="m-0 mb-2 text-xs text-muted-foreground">Neto a Pagar</p>
                            <p className="m-0 text-xl font-extrabold text-chart-3">{formatMoney(presupuestoMensualTotales.totalNeto, filtroPresupuesto.empresa)}</p>
                            <p className="m-0 mt-1 text-xs text-muted-foreground">−{formatMoney(presupuestoMensualTotales.totalDeducciones, filtroPresupuesto.empresa)} en deducciones</p>
                          </div>
                        )}
                      </div>

                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
                        <div className="h-full bg-success" style={{ width: `${presupuestoMensualTotales.totalPresupuestado > 0 ? (presupuestoMensualTotales.totalPagado / presupuestoMensualTotales.totalPresupuestado) * 100 : 0}%` }} />
                      </div>

                      {puedeEditarPresupuesto && presupuestoMensualTotales.itemsPendientes > 0 && (
                        <div className="flex flex-wrap items-center gap-3">
                          <Button onClick={() => setConfirmarPagoLotePresupuesto({ items: presupuestoMensualDetalle.filter(i => seleccionPresupuestoValida.includes(i.id)), cuenta: '', fecha: new Date().toISOString().split('T')[0], comprobantes: {} })} disabled={seleccionPresupuestoValida.length === 0}>
                            <Check size={16} /> Marcar Pagado {seleccionPresupuestoValida.length > 0 ? `(${seleccionPresupuestoValida.length})` : ''}
                          </Button>
                          <span className="text-xs text-muted-foreground">Marca las casillas de los conceptos que ya pagaste para registrarlos juntos en Finanzas.</span>
                        </div>
                      )}
                      {(() => {
                        const sinAprobar = presupuestoMensualDetalle.filter(i => !i.pagado && !i.aprobado && i.netoAPagar > 0);
                        const bloqueadosCC = sinAprobar.filter(i => !i.requisitoCuentaCobro?.ok).length;
                        const aprobables = sinAprobar.filter(i => i.requisitoCuentaCobro?.ok);
                        const aprobados = presupuestoMensualDetalle.filter(i => !i.pagado && i.aprobado).length;
                        const pendientesTotales = presupuestoMensualDetalle.filter(i => !i.pagado).length;
                        if (pendientesTotales === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-solid border-border bg-background px-4 py-3">
                            <span className="text-sm">
                              👍 Aprobación del mes: <strong>{aprobados}</strong> de <strong>{pendientesTotales}</strong> pendientes aprobados
                              {sinAprobar.some(i => i.aprobacionDesactualizada) && <span className="text-[#C4622D]"> · ⚠️ {sinAprobar.filter(i => i.aprobacionDesactualizada).length} requieren reaprobar</span>}
                              {bloqueadosCC > 0 && <span className="text-muted-foreground"> · 🔒 {bloqueadosCC} honorario(s) esperan su cuenta de cobro aprobada</span>}
                            </span>
                            {puedeEditarPresupuesto && aprobables.length > 0 && (
                              <Button variant="success" size="sm" disabled={guardandoAprobacionPresupuesto} onClick={() => handleAprobarPresupuesto(sinAprobar)} className={cn(guardandoAprobacionPresupuesto && 'cursor-wait')}>
                                👍 Aprobar {aprobables.length === 1 ? 'el pendiente' : `los ${aprobables.length} pendientes`} del mes
                              </Button>
                            )}
                            <span className="text-xs text-muted-foreground">Solo lo aprobado se podrá exportar al banco. Si cambia el valor o una deducción, hay que volver a aprobar.</span>
                          </div>
                        );
                      })()}
                      <div className="flex items-center gap-3">
                        <Label htmlFor="pp-mostrar" className="font-normal">Mostrar:</Label>
                        <div className="w-60">
                          <Select id="pp-mostrar" value={filtroEstadoMensual} onChange={(e) => setFiltroEstadoMensual(e.target.value)}>
                            <option value="todos">Todos ({presupuestoMensualDetalle.length})</option>
                            <option value="pendientes">Solo Pendientes ({presupuestoMensualTotales.itemsPendientes})</option>
                            <option value="pagados">Solo Pagados ({presupuestoMensualTotales.itemsPagados})</option>
                          </Select>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            {puedeEditarPresupuesto && <TableHead className="text-center"></TableHead>}
                            <TableHead>Concepto</TableHead>
                            <TableHead>CECO</TableHead>
                            <TableHead>Colaborador</TableHead>
                            <TableHead className="text-right">Valor del Mes</TableHead>
                            <TableHead className="text-right">Deducciones</TableHead>
                            <TableHead className="text-right">Neto a Pagar</TableHead>
                            <TableHead className="text-center">Día Límite</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                            <TableHead className="text-center">Aprobación</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {presupuestoMensualFiltrado.map(item => (
                              <TableRow key={item.id}>
                                {puedeEditarPresupuesto && (
                                  <TableCell className="text-center">
                                    {!item.pagado && (
                                      <input type="checkbox" aria-label={`Seleccionar ${item.nombre}`} className={claseCheckbox} checked={seleccionPresupuestoValida.includes(item.id)} onChange={(e) => {
                                        setSeleccionPresupuestoPendientes(prev => e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id));
                                      }} />
                                    )}
                                  </TableCell>
                                )}
                                <TableCell className="min-w-[160px]">{item.nombre}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{cecos.find(c => c.codigo === item.ceco)?.nombre || item.ceco}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.responsableNombre || '—'}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                    {item.esValorReal ? (
                                      <span title="Valor real ingresado al registrar el pago en Finanzas" className="text-[0.7rem] text-success">💰 real</span>
                                    ) : (item.ajustado && <span title={`Valor base: ${formatMoney(item.valorMensual, item.empresa)}`} className="text-[0.7rem] text-chart-3">✏️ ajustado</span>)}
                                    {formatMoney(item.valorEsperado, filtroPresupuesto.empresa)}
                                    {puedeEditarPresupuesto && !item.esValorReal && (
                                      <Button variant="ghost" size="icon" onClick={() => handleEditarValorMes(item)} title="Ajustar el valor ESTIMADO de este mes (deja de usarse en cuanto se registre el pago real en Finanzas)" aria-label="Ajustar valor del mes" className="size-7 text-[#6C63D1]"><Pencil size={14} /></Button>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className={cn('whitespace-nowrap text-right', item.totalDeducciones > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                                  {item.totalDeducciones > 0 ? `−${formatMoney(item.totalDeducciones, filtroPresupuesto.empresa)}` : '—'}
                                </TableCell>
                                <TableCell className={cn('whitespace-nowrap text-right', item.totalDeducciones > 0 && 'font-bold')}>
                                  {formatMoney(item.netoAPagar, filtroPresupuesto.empresa)}
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">{item.diaLimitePago || '-'}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={item.pagado ? 'success' : 'destructive'}>{item.pagado ? '✅ Pagado' : '⏳ Pendiente'}</Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-center">
                                  {item.pagado ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : item.aprobado ? (
                                    <span title={item.aprobacion?.aprobadoAt ? `Aprobado el ${new Date(item.aprobacion.aprobadoAt).toLocaleDateString('es-CO')}` : ''} className="inline-flex flex-wrap items-center justify-center text-xs font-bold text-success">
                                      👍 Aprobado
                                      {puedeEditarPresupuesto && <Button variant="ghost" size="icon" onClick={() => handleQuitarAprobacionPresupuesto(item)} title="Quitar aprobación" aria-label="Quitar aprobación" className="ml-0.5 size-6 text-muted-foreground"><X size={13} /></Button>}
                                      {lotePorClave[`presupuesto:${item.id}:${filtroPresupuesto.anio}-${filtroPresupuesto.mes}`] && <span className="block w-full text-[0.7rem] text-chart-3">📤 Exportado · lote #{lotePorClave[`presupuesto:${item.id}:${filtroPresupuesto.anio}-${filtroPresupuesto.mes}`]}</span>}
                                    </span>
                                  ) : !item.requisitoCuentaCobro?.ok ? (
                                    <span className="text-xs text-muted-foreground" title="Los honorarios se aprueban solo cuando la Cuenta de Cobro del mes está Aprobada">
                                      🔒 {item.requisitoCuentaCobro.motivo}
                                    </span>
                                  ) : item.aprobacionDesactualizada ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-[#C4622D]" title={`Aprobado por ${formatMoney(item.aprobacion.valorNeto, filtroPresupuesto.empresa)}; el neto actual es otro`}>
                                      ⚠️ Cambió el valor
                                      {puedeEditarPresupuesto && <Button size="sm" disabled={guardandoAprobacionPresupuesto} onClick={() => handleAprobarPresupuesto([item])} className="h-6 bg-[#C4622D] px-2 text-[0.7rem] text-white hover:bg-[#C4622D]/90">Reaprobar</Button>}
                                    </span>
                                  ) : puedeEditarPresupuesto && item.netoAPagar > 0 ? (
                                    <Button variant="outline" size="sm" disabled={guardandoAprobacionPresupuesto} onClick={() => handleAprobarPresupuesto([item])} className="h-7 border-success text-success">Aprobar</Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Sin aprobar</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                            {presupuestoMensualFiltrado.length === 0 && (
                              <TableRow className="hover:bg-transparent"><TableCell colSpan={puedeEditarPresupuesto ? 10 : 9} className="py-8 text-center text-sm text-muted-foreground">No hay conceptos {filtroEstadoMensual === 'pagados' ? 'pagados' : 'pendientes'} este mes.</TableCell></TableRow>
                            )}
                        </TableBody>
                      </Table>
                    </div>
                  )
                )}

                {/* ===== TAB DEDUCCIONES ===== */}
                {presupuestoTab === 'deducciones' && user.rol !== 'Gerente' && (() => {
                  const deduccionesEmpresa = deducciones.filter(d => presupuestoItems.find(p => p.id === d.presupuestoItemId)?.empresa === filtroPresupuesto.empresa);
                  return (
                  <div className="flex flex-col gap-4">
                    <div>
                      <h3 className="m-0 mb-1 text-base font-bold">Deducciones — Préstamos y Otros Descuentos</h3>
                      <p className="m-0 text-sm text-muted-foreground">Se restan del valor del mes del concepto seleccionado y se ven reflejadas como "Neto a Pagar" en la pestaña Mensual. Un préstamo deja de descontarse automáticamente en cuanto su saldo llega a $0 — no hace falta desactivarlo a mano.</p>
                    </div>

                    {puedeEditarPresupuesto && (
                      <div className={cn(claseRecuadro, 'flex flex-col gap-4')}>
                        <h4 className="m-0 text-sm font-bold">{editingDeduccionId ? '✏️ Editar Deducción' : 'Nueva Deducción'}</h4>
                        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                          <CampoUI label="Persona / Concepto" htmlFor="ded-item">
                            <Select id="ded-item" value={newDeduccion.presupuestoItemId} onChange={(e) => setNewDeduccion({...newDeduccion, presupuestoItemId: e.target.value || ''})}>
                              <option value="">-- Selecciona persona/concepto --</option>
                              {presupuestoItems.filter(p => p.empresa === filtroPresupuesto.empresa).map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                              ))}
                            </Select>
                          </CampoUI>
                          <CampoUI label="Tipo" htmlFor="ded-tipo">
                            <Select id="ded-tipo" value={newDeduccion.tipo} onChange={(e) => setNewDeduccion({...newDeduccion, tipo: e.target.value})}>
                              <option value="Préstamo">Préstamo</option>
                              <option value="Seguridad Social (PS)">Seguridad Social (PS)</option>
                              <option value="Otro">Otro descuento (recurrente)</option>
                            </Select>
                          </CampoUI>
                          <CampoUI label="Empieza a descontar desde" htmlFor="ded-inicio">
                            <Input id="ded-inicio" type="date" value={newDeduccion.fechaInicio} onChange={(e) => setNewDeduccion({...newDeduccion, fechaInicio: e.target.value})} />
                          </CampoUI>
                          <CampoUI label="Cuota mensual" htmlFor="ded-cuota">
                            <Input id="ded-cuota" type="number" placeholder="Valor de la cuota mensual" value={newDeduccion.valorCuota} onChange={(e) => setNewDeduccion({...newDeduccion, valorCuota: e.target.value})} />
                          </CampoUI>
                          {newDeduccion.tipo === 'Préstamo' && (
                            <CampoUI label="Saldo total del préstamo" htmlFor="ded-saldo">
                              <Input id="ded-saldo" type="number" placeholder="Saldo total del préstamo" value={newDeduccion.saldoTotal} onChange={(e) => setNewDeduccion({...newDeduccion, saldoTotal: e.target.value})} />
                            </CampoUI>
                          )}
                        </div>
                        <CampoUI label="Observaciones" htmlFor="ded-obs">
                          <Input id="ded-obs" type="text" placeholder="Observaciones (opcional)" value={newDeduccion.observaciones} onChange={(e) => setNewDeduccion({...newDeduccion, observaciones: e.target.value})} />
                        </CampoUI>
                        <div className="flex gap-3">
                          <Button onClick={handleAddDeduccion}>
                            {editingDeduccionId ? 'Guardar Cambios' : <><Plus size={16} /> Agregar Deducción</>}
                          </Button>
                          {editingDeduccionId && (
                            <Button variant="outline" onClick={handleCancelEditDeduccion}>Cancelar</Button>
                          )}
                        </div>
                      </div>
                    )}

                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Persona / Concepto</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Cuota Mensual</TableHead>
                          <TableHead className="text-right">Saldo Total</TableHead>
                          <TableHead className="text-right">Saldo Pendiente ({filtroPresupuesto.mes}/{filtroPresupuesto.anio})</TableHead>
                          <TableHead className="text-center">Estado</TableHead>
                          {puedeEditarPresupuesto && <TableHead className="text-center">Acción</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                          {deduccionesEmpresa.length === 0 ? (
                            <TableRow className="hover:bg-transparent"><TableCell colSpan={puedeEditarPresupuesto ? 7 : 6} className="py-8 text-center text-muted-foreground">Sin deducciones cargadas para {filtroPresupuesto.empresa}.</TableCell></TableRow>
                          ) : deduccionesEmpresa.map(d => {
                            const item = presupuestoItems.find(p => p.id === d.presupuestoItemId);
                            const saldoPendiente = getSaldoPendienteEnMes(d, filtroPresupuesto.anio, filtroPresupuesto.mes);
                            const transcurridos = mesesTranscurridos(d.fechaInicio, filtroPresupuesto.anio, filtroPresupuesto.mes);
                            const pagado = d.tipo === 'Préstamo' && transcurridos >= 0 && saldoPendiente === 0;
                            return (
                              <TableRow key={d.id} className={cn(d.activo === false && 'opacity-50')}>
                                <TableCell>{item?.nombre || '(concepto eliminado)'}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{d.tipo}</TableCell>
                                <TableCell className="whitespace-nowrap text-right">{formatMoney(d.valorCuota, filtroPresupuesto.empresa)}</TableCell>
                                <TableCell className="whitespace-nowrap text-right text-muted-foreground">{d.tipo === 'Préstamo' ? formatMoney(d.saldoTotal, filtroPresupuesto.empresa) : '-'}</TableCell>
                                <TableCell className={cn('whitespace-nowrap text-right font-bold', pagado && 'text-success')}>{d.tipo === 'Préstamo' ? formatMoney(saldoPendiente, filtroPresupuesto.empresa) : '-'}</TableCell>
                                <TableCell className="text-center">
                                  {d.activo === false ? (
                                    <Badge variant="muted">Inactiva</Badge>
                                  ) : pagado ? (
                                    <Badge variant="success">✅ Pagado</Badge>
                                  ) : (
                                    <Badge variant="info">Activa</Badge>
                                  )}
                                </TableCell>
                                {puedeEditarPresupuesto && (
                                  <TableCell>
                                    <div className="flex items-center justify-center">
                                      <Button variant="ghost" size="icon" onClick={() => handleEditDeduccion(d)} title="Editar" aria-label="Editar" className="text-[#6C63D1]"><Pencil size={16} /></Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleToggleDeduccionActivo(d.id)} title={d.activo === false ? 'Reactivar' : 'Desactivar'} aria-label={d.activo === false ? 'Reactivar' : 'Desactivar'} className="text-[#8A6A0C]">{d.activo === false ? <Play size={16} /> : <Pause size={16} />}</Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDeduccion(d.id)} title="Eliminar" aria-label="Eliminar" className="text-destructive"><Trash2 size={16} /></Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                  );
                })()}

                {/* ===== TAB ANUAL ===== */}
                {presupuestoTab === 'anual' && (
                  presupuestoAnualDetalle.length === 0 ? (
                    <p className="m-0 text-muted-foreground">Aún no hay techos anuales cargados para <strong>{filtroPresupuesto.empresa}</strong> en {filtroPresupuesto.anio}. Ve a la pestaña "Gestión de Conceptos" para agregarlos.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>CECO</TableHead>
                          <TableHead className="text-right">Presupuesto Anual</TableHead>
                          <TableHead className="text-right">Ejecutado</TableHead>
                          <TableHead className="text-right">Falta por Cubrir</TableHead>
                          <TableHead className="w-[220px]">% Ejecutado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                          {presupuestoAnualDetalle.map(c => {
                            const pct = c.porcentaje === null ? 0 : Math.min(c.porcentaje, 100);
                            const colorBarra = c.porcentaje === null ? '#AFA897' : c.porcentaje >= 100 ? '#CC4B4B' : c.porcentaje >= 80 ? '#D6A419' : '#2F9E52';
                            return (
                              <TableRow key={c.codigo}>
                                <TableCell className="min-w-[160px]">{c.nombre}</TableCell>
                                <TableCell className="whitespace-nowrap text-right">{c.valorAnual > 0 ? formatMoney(c.valorAnual, filtroPresupuesto.empresa) : '-'}</TableCell>
                                <TableCell className="whitespace-nowrap text-right text-muted-foreground">{formatMoney(c.ejecutado, filtroPresupuesto.empresa)}</TableCell>
                                <TableCell className={cn('whitespace-nowrap text-right', c.restante < 0 && 'font-bold text-destructive')}>{c.valorAnual > 0 ? formatMoney(c.restante, filtroPresupuesto.empresa) : '-'}</TableCell>
                                <TableCell className="min-w-[180px]">
                                  {c.porcentaje === null ? (
                                    <span className="text-xs text-muted-foreground">Sin techo cargado</span>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: colorBarra }} />
                                      </div>
                                      <span className="min-w-[45px] text-xs font-bold" style={{ color: colorBarra }}>{c.porcentaje.toFixed(0)}%</span>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )
                )}

                {/* ===== TAB GESTIÓN ===== */}
                {presupuestoTab === 'gestion' && user.rol !== 'Gerente' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="m-0 text-base font-bold">Conceptos Recurrentes Mensuales</h3>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant={!gestionConceptosTodasEmpresas ? 'default' : 'outline'} onClick={() => setGestionConceptosTodasEmpresas(false)} aria-pressed={!gestionConceptosTodasEmpresas}>🏢 Solo {filtroPresupuesto.empresa}</Button>
                        <Button size="sm" variant={gestionConceptosTodasEmpresas ? 'default' : 'outline'} onClick={() => setGestionConceptosTodasEmpresas(true)} aria-pressed={gestionConceptosTodasEmpresas}>🌐 Todas las empresas ({presupuestoItems.length})</Button>
                      </div>
                    </div>

                    {puedeEditarPresupuesto && presupuestoItems.length === 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-solid border-primary bg-[#FFF8E1] px-5 py-4">
                        <span className="text-sm text-muted-foreground">⚠️ No hay conceptos de Presupuesto en Supabase todavía. Si ya habías cargado tu Presupuesto en este mismo navegador antes de esta actualización, puedes recuperarlo con un solo clic.</span>
                        <Button onClick={handleMigrarPresupuestoLocal}><RotateCcw size={16} /> Migrar Presupuesto guardado localmente</Button>
                      </div>
                    )}

                    {puedeEditarPresupuesto && (
                      <div className={cn(claseRecuadro, 'flex flex-col gap-4')}>
                        <h4 className="m-0 text-sm font-bold">{editingPresupuestoItemId ? '✏️ Editar Concepto' : 'Nuevo Concepto'}</h4>
                        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                          <CampoUI label="Empresa" htmlFor="pc-empresa">
                            <Select id="pc-empresa" value={newPresupuestoItem.empresa} onChange={(e) => setNewPresupuestoItem({...newPresupuestoItem, empresa: e.target.value})}>
                              {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                            </Select>
                          </CampoUI>
                          <CampoUI label="CECO" htmlFor="pc-ceco">
                            <Select id="pc-ceco" value={newPresupuestoItem.ceco} onChange={(e) => setNewPresupuestoItem({...newPresupuestoItem, ceco: e.target.value})}>
                              {cecosGasto.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                            </Select>
                          </CampoUI>
                          <CampoUI label="Día límite de pago" htmlFor="pc-dia">
                            <Input id="pc-dia" type="number" placeholder="Día límite de pago" value={newPresupuestoItem.diaLimitePago} onChange={(e) => setNewPresupuestoItem({...newPresupuestoItem, diaLimitePago: e.target.value})} />
                          </CampoUI>
                          <CampoUI label="Colaborador" htmlFor="pc-colaborador">
                            <Select id="pc-colaborador" value={newPresupuestoItem.responsableId} onChange={(e) => setNewPresupuestoItem({...newPresupuestoItem, responsableId: e.target.value})}>
                              <option value="">Sin vincular a colaborador</option>
                              {[...personasFinanzas].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                            </Select>
                          </CampoUI>
                          <CampoUI label="Tipo" htmlFor="pc-tipo">
                            <Select id="pc-tipo" value={newPresupuestoItem.tipo} onChange={(e) => setNewPresupuestoItem({...newPresupuestoItem, tipo: e.target.value})}>
                              <option value="">Sin tipo</option>
                              {TIPOS_CONCEPTO_PRESUPUESTO.map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                          </CampoUI>
                          <CampoUI label="Forma de pago" htmlFor="pc-forma">
                            <Select id="pc-forma" value={newPresupuestoItem.formaPago} onChange={(e) => setNewPresupuestoItem({...newPresupuestoItem, formaPago: e.target.value})}>
                              <option value="">Sin definir</option>
                              {FORMAS_PAGO_PRESUPUESTO.map(f => <option key={f} value={f}>{f}</option>)}
                            </Select>
                          </CampoUI>
                          {newPresupuestoItem.tipo === 'Proveedor / servicio' && (
                            <CampoUI label="Beneficiario (tercero)" htmlFor="pc-tercero">
                              <Select id="pc-tercero" value={newPresupuestoItem.terceroId} onChange={(e) => setNewPresupuestoItem({...newPresupuestoItem, terceroId: e.target.value})}>
                                <option value="">Elegir del catálogo de terceros…</option>
                                {todosTerceros.filter(t => t.activo !== false || t.id === newPresupuestoItem.terceroId).map(t => <option key={t.id} value={t.id}>{t.nombre}{t.dni ? ` — ${t.dni}` : ''}</option>)}
                              </Select>
                            </CampoUI>
                          )}
                        </div>
                        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[2fr_1fr_auto]">
                          <CampoUI label="Nombre / Responsable / Concepto" htmlFor="pc-nombre">
                            <Input id="pc-nombre" type="text" placeholder="Nombre / Responsable / Concepto" value={newPresupuestoItem.nombre} onChange={(e) => setNewPresupuestoItem({...newPresupuestoItem, nombre: e.target.value})} />
                          </CampoUI>
                          <CampoUI label="Valor mensual" htmlFor="pc-valor">
                            <Input id="pc-valor" type="number" placeholder="Valor mensual" value={newPresupuestoItem.valorMensual} onChange={(e) => setNewPresupuestoItem({...newPresupuestoItem, valorMensual: e.target.value})} />
                          </CampoUI>
                          <Button onClick={handleAddPresupuestoItem}>{editingPresupuestoItemId ? 'Guardar Cambios' : <><Plus size={16} /> Agregar</>}</Button>
                        </div>
                        {editingPresupuestoItemId && (
                          <Button variant="outline" onClick={handleCancelEditPresupuestoItem} className="self-start">Cancelar</Button>
                        )}
                        <p className="m-0 text-xs text-muted-foreground">Vincular el colaborador es opcional, pero permite que el Gasto que se genere al "Marcar Pagado" en la pestaña Mensual quede con el Responsable correcto desde el primer clic. Pagos PAB: Nómina y Prestación de Servicio le pagan al colaborador; "Proveedor / servicio" con forma de pago PAB le paga al Beneficiario (sus datos bancarios vienen del catálogo de terceros). Facturas por convenio (EPM, Tigo…) van con "Convenio / PSE" y se marcan pagadas en la pestaña Mensual.</p>
                      </div>
                    )}

                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Empresa</TableHead>
                          <TableHead>CECO</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead>Colaborador</TableHead>
                          <TableHead className="text-right">Valor Mensual</TableHead>
                          <TableHead className="text-center">Día Límite</TableHead>
                          <TableHead className="text-center">Activo</TableHead>
                          {puedeEditarPresupuesto && <TableHead className="text-center">Acción</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                          {conceptosGestionFiltrados.length === 0 ? (
                            <TableRow className="hover:bg-transparent"><TableCell colSpan={puedeEditarPresupuesto ? 8 : 7} className="py-8 text-center text-muted-foreground">{gestionConceptosTodasEmpresas ? 'Sin conceptos cargados todavía.' : `Sin conceptos cargados todavía para ${filtroPresupuesto.empresa}.`}</TableCell></TableRow>
                          ) : conceptosGestionFiltrados.map(item => (
                            <TableRow key={item.id} className={cn(item.activo === false && 'opacity-50')}>
                              <TableCell className="text-xs text-muted-foreground"><div className="flex items-center gap-2"><EmpresaLogo empresa={item.empresa} height={16} />{item.empresa}</div></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{cecos.find(c => c.codigo === item.ceco)?.nombre || item.ceco}</TableCell>
                              <TableCell className="min-w-[160px]">
                                {item.nombre}
                                {(item.tipo || item.formaPago) && (
                                  <div className="text-[0.7rem] text-muted-foreground">
                                    {[item.tipo, item.formaPago, item.terceroId && `→ ${todosTerceros.find(t => t.id === item.terceroId)?.nombre || 'tercero'}`].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {puedeEditarPresupuesto ? (
                                  <Select aria-label="Colaborador" value={item.responsableId} onChange={(e) => handleUpdatePresupuestoItemResponsable(item.id, e.target.value)} className="h-8 min-w-[160px] text-xs">
                                    <option value="">Sin vincular</option>
                                    {[...personasFinanzas].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                                  </Select>
                                ) : (item.responsableNombre || '—')}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right">{formatMoney(item.valorMensual, item.empresa)}</TableCell>
                              <TableCell className="text-center text-muted-foreground">{item.diaLimitePago || '-'}</TableCell>
                              <TableCell className="text-center">
                                {puedeEditarPresupuesto ? (
                                  <input type="checkbox" aria-label="Activo" className={claseCheckbox} checked={item.activo !== false} onChange={(e) => handleUpdatePresupuestoItem(item.id, 'activo', e.target.checked)} />
                                ) : (item.activo !== false ? 'Sí' : 'No')}
                              </TableCell>
                              {puedeEditarPresupuesto && (
                                <TableCell>
                                  <div className="flex items-center justify-center">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditPresupuestoItem(item)} title="Editar" aria-label="Editar" className="text-[#6C63D1]"><Pencil size={16} /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeletePresupuestoItem(item.id)} title="Eliminar" aria-label="Eliminar" className="text-destructive"><Trash2 size={16} /></Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>

                    <h3 className="m-0 mt-4 text-base font-bold">Techos Anuales por CECO</h3>

                    {puedeEditarPresupuesto && (
                      <div className={claseRecuadro}>
                        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1.5fr_1.5fr_1fr_1fr_auto]">
                          <CampoUI label="Empresa" htmlFor="pa-empresa">
                            <Select id="pa-empresa" value={newPresupuestoAnual.empresa} onChange={(e) => setNewPresupuestoAnual({...newPresupuestoAnual, empresa: e.target.value})}>
                              {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                            </Select>
                          </CampoUI>
                          <CampoUI label="CECO" htmlFor="pa-ceco">
                            <Select id="pa-ceco" value={newPresupuestoAnual.ceco} onChange={(e) => setNewPresupuestoAnual({...newPresupuestoAnual, ceco: e.target.value})}>
                              {cecosGasto.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                            </Select>
                          </CampoUI>
                          <CampoUI label="Año" htmlFor="pa-anio">
                            <Input id="pa-anio" type="number" placeholder="Año" value={newPresupuestoAnual.anio} onChange={(e) => setNewPresupuestoAnual({...newPresupuestoAnual, anio: parseInt(e.target.value) || newPresupuestoAnual.anio})} />
                          </CampoUI>
                          <CampoUI label="Valor anual" htmlFor="pa-valor">
                            <Input id="pa-valor" type="number" placeholder="Valor anual" value={newPresupuestoAnual.valorAnual} onChange={(e) => setNewPresupuestoAnual({...newPresupuestoAnual, valorAnual: e.target.value})} />
                          </CampoUI>
                          <Button onClick={handleAddPresupuestoAnual}><Plus size={16} /> Guardar</Button>
                        </div>
                      </div>
                    )}

                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Empresa</TableHead>
                          <TableHead>CECO</TableHead>
                          <TableHead className="text-center">Año</TableHead>
                          <TableHead className="text-right">Valor Anual</TableHead>
                          {puedeEditarPresupuesto && <TableHead className="text-center">Acción</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                          {presupuestoAnual.length === 0 ? (
                            <TableRow className="hover:bg-transparent"><TableCell colSpan={puedeEditarPresupuesto ? 5 : 4} className="py-8 text-center text-muted-foreground">Sin techos anuales cargados todavía.</TableCell></TableRow>
                          ) : presupuestoAnual.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs text-muted-foreground"><div className="flex items-center gap-2"><EmpresaLogo empresa={p.empresa} height={16} />{p.empresa}</div></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{cecos.find(c => c.codigo === p.ceco)?.nombre || p.ceco}</TableCell>
                              <TableCell className="text-center">{p.anio}</TableCell>
                              <TableCell className="whitespace-nowrap text-right">{formatMoney(p.valorAnual, p.empresa)}</TableCell>
                              {puedeEditarPresupuesto && (
                                <TableCell className="text-center">
                                  <Button variant="ghost" size="icon" onClick={() => handleDeletePresupuestoAnual(p.id)} title="Eliminar" aria-label="Eliminar" className="text-destructive"><Trash2 size={16} /></Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {currentView === 'cuentasCobro' && (
          // Etapa 3 del sistema de diseño: primer módulo migrado a los componentes de
          // src/components/ui/ (misma lógica y handlers que antes; solo cambia la presentación).
          <div className="flex flex-col gap-6">
            <Card className="gap-5 px-0 py-6 sm:py-7">
              <CardHeader className="sm:px-7">
                {canApprove ? (
                  <button type="button" onClick={() => setMostrarNuevaCuentaCobro(!mostrarNuevaCuentaCobro)} className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-[inherit]">
                    {mostrarNuevaCuentaCobro ? <ChevronDown size={18} className="text-primary" /> : <ChevronRight size={18} className="text-primary" />}
                    <CardTitle className="text-lg">Nueva Cuenta de Cobro</CardTitle>
                    <span className="text-xs text-muted-foreground">(mi propia cuenta — clic para {mostrarNuevaCuentaCobro ? 'ocultar' : 'mostrar'})</span>
                  </button>
                ) : (
                  <CardTitle className="text-lg">Nueva Cuenta de Cobro</CardTitle>
                )}
              </CardHeader>
              {(!canApprove || mostrarNuevaCuentaCobro) && (
              <CardContent className="flex flex-col gap-4 sm:px-7">

              {/* DATOS AUTOMÁTICOS DEL COLABORADOR LOGUEADO — ya no hay que elegir a quién pertenece */}
              <div className="grid gap-3 rounded-lg border border-solid border-border bg-background p-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <div><span className="text-xs text-muted-foreground">Colaborador</span><p className="m-0 font-bold">{user.nombre}</p></div>
                <div><span className="text-xs text-muted-foreground">C.C</span><p className={cn('m-0 font-bold', !user.cedula && 'text-destructive')}>{user.cedula || 'Falta en tu perfil'}</p></div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="cc-empresa" className="font-normal">Empresa a la que le facturas</Label>
                  <Select id="cc-empresa" value={newCuentaCobro.empresa || user.empresa || ''} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, empresa: e.target.value})} className="h-8 font-bold">
                    {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                  </Select>
                </div>
                <div><span className="text-xs text-muted-foreground">Cargo</span><p className={cn('m-0 font-bold', !user.cargo && 'text-destructive')}>{user.cargo || 'Falta en tu perfil'}</p></div>
              </div>
              <p className="m-0 -mt-2 text-xs text-muted-foreground">💡 Si le facturas a más de una empresa de la holding, crea una Cuenta de Cobro por cada una eligiéndola aquí.</p>
              {(!user.cedula || !user.cargo || !user.banco || !user.numeroCuenta) && (
                <p className="m-0 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">⚠️ Completa tu Cédula, Cargo y Datos Bancarios en el módulo Colaboradores antes de crear tu Cuenta de Cobro.</p>
              )}

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cc-mes">Mes que está cobrando</Label>
                  <Select id="cc-mes" value={newCuentaCobro.mes} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, mes: parseInt(e.target.value)})}>
                    {MESES_ES.map((m, idx) => <option key={m} value={idx + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cc-anio">Año</Label>
                  <Input id="cc-anio" type="number" value={newCuentaCobro.anio} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, anio: parseInt(e.target.value) || newCuentaCobro.anio})} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cc-ciudad">Ciudad</Label>
                  <Input id="cc-ciudad" type="text" value={newCuentaCobro.ciudad} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, ciudad: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cc-valor">Valor</Label>
                  <Input id="cc-valor" type="number" placeholder="Valor" value={newCuentaCobro.monto} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, monto: e.target.value})} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cc-funciones">Funciones (texto entre paréntesis del PDF)</Label>
                <Textarea id="cc-funciones" value={newCuentaCobro.funciones || user.funciones || ''} onChange={(e) => setNewCuentaCobro({...newCuentaCobro, funciones: e.target.value})} rows={2} />
                {!user.funciones && <p className="m-0 text-xs text-muted-foreground">💡 Si guardas esto en tu perfil (Colaboradores), no tendrás que escribirlo cada mes.</p>}
              </div>

              {/* CARGA DE SOPORTES */}
              <ListaSoportesUI
                titulo="Soportes (PDF u otros archivos)"
                inputProps={{ multiple: true, onChange: handleAddSoporteCuentaCobro }}
                archivos={soportesCuentaCobroTemp}
                resumen={`Archivos cargados: ${soportesCuentaCobroTemp.length}`}
                onQuitar={handleRemoveSoporteCuentaCobro}
              />
              <Button size="lg" onClick={handleAddCuentaCobro} disabled={isReadOnly || guardandoCuentaCobro} className="w-full">{guardandoCuentaCobro ? '⏳ Guardando...' : 'Crear Cuenta de Cobro'}</Button>
              </CardContent>
              )}
            </Card>

            <Card className="gap-4 px-0 py-6 sm:py-7">
              <CardHeader className="sm:px-7">
                <CardTitle className="text-lg">💳 Cuentas de Cobro ({cuentasCobroUsuario.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:px-7">
              {/* Filtros: Mes cobrado y Empresa */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-full sm:w-56">
                  <Select aria-label="Filtrar por mes cobrado" value={filtroCuentasMes} onChange={(e) => setFiltroCuentasMes(e.target.value)}>
                    <option value="Todos">📅 Todos los meses</option>
                    {mesesCuentasCobro.map(k => { const [y, m] = k.split('-').map(Number); return <option key={k} value={k}>{MESES_ES[m - 1].charAt(0).toUpperCase() + MESES_ES[m - 1].slice(1)} {y}</option>; })}
                  </Select>
                </div>
                {empresasCuentasCobro.length > 1 && (
                  <div className="w-full sm:w-72">
                    <Select aria-label="Filtrar por empresa" value={filtroCuentasEmpresa} onChange={(e) => setFiltroCuentasEmpresa(e.target.value)}>
                      <option value="Todas">🏢 Todas las empresas</option>
                      {empresasCuentasCobro.map(e => <option key={e} value={e}>{e}</option>)}
                    </Select>
                  </div>
                )}
                {(filtroCuentasMes !== 'Todos' || filtroCuentasEmpresa !== 'Todas' || filtroCuentasEstado !== 'Todos') && (
                  <Button variant="outline" onClick={() => { setFiltroCuentasMes('Todos'); setFiltroCuentasEmpresa('Todas'); setFiltroCuentasEstado('Todos'); }}><RotateCcw size={14} /> Limpiar filtros</Button>
                )}
              </div>
              {/* Filtro por estado, con el conteo de cada uno (sobre el mes y empresa elegidos) */}
              <div className="flex flex-wrap gap-2">
                {['Todos', ...estadosCuentaCobro].map(e => {
                  const n = e === 'Todos' ? cuentasCobroPorMesEmpresa.length : cuentasCobroPorMesEmpresa.filter(c => c.estado === e).length;
                  const activo = filtroCuentasEstado === e;
                  return (
                    <Button key={e} size="sm" variant={activo ? 'default' : 'outline'} onClick={() => setFiltroCuentasEstado(e)} className={cn('rounded-full', !activo && 'text-muted-foreground')} aria-pressed={activo}>
                      {e} ({n})
                    </Button>
                  );
                })}
              </div>
              {cargandoCuentasCobro && <p className="m-0 text-sm text-muted-foreground">Cargando cuentas de cobro...</p>}
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Mes cobrado</TableHead>
                    {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && <TableHead>Colaborador</TableHead>}
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuentasCobroFiltradas.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{c.fecha}</TableCell>
                      <TableCell className="whitespace-nowrap font-bold text-primary">{c.numero}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{c.mes ? `${MESES_ES[c.mes - 1]} ${c.anio}` : '—'}</TableCell>
                      {(user.rol === 'Administrador' || user.rol === 'Coordinadora Administrativa') && <TableCell className="text-xs"><div className="flex items-center gap-2"><ColaboradorAvatar foto={responsables.find(r => r.nombre === c.responsableNombre)?.foto} nombre={c.responsableNombre} size={22} />{c.responsableNombre}</div></TableCell>}
                      <TableCell className="text-xs"><div className="flex items-center gap-2"><EmpresaLogo empresa={c.empresa} height={16} />{c.empresa}</div></TableCell>
                      <TableCell className="whitespace-nowrap text-right font-bold text-success">{formatMoney(c.monto, c.empresa)}</TableCell>
                      <TableCell className="text-center">
                        {canApprove ? (
                          <select aria-label="Cambiar estado" value={c.estado} onChange={(e) => handleUpdateCuentaCobro(c.id, 'estado', e.target.value)} disabled={isReadOnly || !canApprove} className={cn(badgeVariants({ variant: estadoBadge(c.estado) }), claseSelectEstado)}>
                            {estadosCuentaCobro.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                        ) : (
                          <Badge variant={estadoBadge(c.estado)}>{c.estado}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {c.responsableCedula && (
                            <Button variant="ghost" size="icon" onClick={() => handleGenerarPDFCuentaCobro(c)} title="Descargar PDF" aria-label="Descargar PDF"><FileDown size={16} /></Button>
                          )}
                          {c.cantidadSoportes > 0 && (
                            <Button variant="ghost" size="icon" onClick={() => handleVistaRapidaCuentaCobro(c)} title="Vista previa de la cuenta de cobro" aria-label="Vista previa de la cuenta de cobro"><Eye size={16} /></Button>
                          )}
                          {c.cantidadSoportes > 0 ? (
                            <Button variant="ghost" size="sm" onClick={() => handleVerSoportesCuentaCobro(c)} className="text-success" title="Ver soportes"><Paperclip size={14} /> {c.cantidadSoportes}</Button>
                          ) : (
                            <span className="px-2 text-xs text-muted-foreground">—</span>
                          )}
                          {puedeEliminarCuentaCobro(c) && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCuentaCobro(c)} className="text-destructive" title="Eliminar" aria-label="Eliminar"><Trash2 size={16} /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cuentasCobroUsuario.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Sin cuentas de cobro registradas</TableCell>
                    </TableRow>
                  )}
                  {cuentasCobroUsuario.length > 0 && cuentasCobroFiltradas.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No hay cuentas de cobro con estos filtros</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MODAL IMPORTAR HISTÓRICO */}
        {mostrarImportar && (
          <ModalUI titulo="📥 Importar Histórico" className="max-w-lg">
            {/* OPCIÓN PRINCIPAL: Excel/CSV combinado (Gastos + Ingresos + Traslados) */}
            <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-background p-4 text-sm">
              <p className="m-0 text-muted-foreground">⚠️ Esto agregará todos los registros del archivo al histórico — Gastos, Ingresos y Traslados en un mismo Excel (columna "Movimiento" indica a cuál va cada fila).</p>
              <p className="m-0 text-muted-foreground">Registros actuales: <strong className="text-primary">{gastos.length} Gastos/Traslados</strong> · <strong className="text-primary">{ingresos.length} Ingresos</strong></p>
              <Input type="file" accept=".xlsx,.xls,.csv" aria-label="Archivo a importar" onChange={handleImportarExcel} className={claseInputArchivo} />
              <Button variant="outline" onClick={handleDescargarPlantillaImportacion}><FileDown size={16} /> Descargar plantilla en blanco</Button>
              <p className="m-0 text-xs text-muted-foreground">Si no sabes cómo dejar el Excel en este formato, súbele el extracto bancario o la planilla original a Claude en el chat del proyecto y pídele que te lo entregue en la plantilla — luego solo subes el resultado aquí.</p>
            </div>
            {/* OPCIÓN ANTIGUA: JSON, solo Gastos/Traslados — se deja disponible para quien
                todavía tenga archivos generados en ese formato de una migración anterior. */}
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">Formato anterior (JSON, solo Gastos/Traslados)</summary>
              <div className="mt-3 flex flex-col gap-2">
                <Input type="file" accept=".json" aria-label="Archivo JSON" onChange={handleImportarGastos} className={claseInputArchivo} />
                <p className="m-0 text-xs text-muted-foreground">📄 Carga el archivo <code className="text-primary">gastos_importar.json</code> generado desde DBAMHolding</p>
              </div>
            </details>
            <Button variant="outline" onClick={() => setMostrarImportar(false)}>Cancelar</Button>
          </ModalUI>
        )}

        {/* MODAL CONFIRMAR PAGO — al marcar como "Pagado" una Solicitud de Pago a Tercero,
            Anticipo, Reembolso o Legalización (con diferencia contra el anticipo), pide la
            Cuenta de la empresa usada, el CECO (salvo Pago a Tercero, que ya trae uno fijo) y
            el comprobante del banco ANTES de guardar el estado y generar el Gasto/Ingreso
            automático en Finanzas (Opción C). Cancelar no cambia nada. */}
        {confirmarPagoSolicitud && (() => {
          const { solicitud, accion, monto } = confirmarPagoSolicitud;
          const esTercero = solicitud.tipo === 'Pago a Tercero';
          const esLegalizacionTPro = solicitud.tipo === 'Legalización T. Pro';
          const moneda = esTercero ? (solicitud.moneda || getMoneda(solicitud.empresa)) : getMoneda(solicitud.empresa);
          const subtitulo = esTercero
            ? `${solicitud.terceroInfo?.nombre || 'Tercero'} — ${formatMoneyByMoneda(monto, moneda)}`
            : `${solicitud.tipo} de ${solicitud.responsableNombre || 'colaborador'} — ${accion === 'ingreso' ? 'a devolver por el colaborador' : (esLegalizacionTPro ? 'a legalizar' : 'a pagar')}: ${formatMoneyByMoneda(monto, moneda)}`;
          const opcionesCeco = accion === 'ingreso' ? cecosIngreso : cecosGasto;
          const tituloAccion = esLegalizacionTPro ? 'Legalización' : (accion === 'ingreso' ? 'Reintegro' : 'Pago');
          return (
          <ModalUI titulo={`💳 Confirmar ${tituloAccion}`} descripcion={subtitulo}>
            <CampoUI label={`Cuenta de la empresa ${accion === 'ingreso' ? 'que recibió el dinero' : (esLegalizacionTPro ? 'con la que se le reembolsa' : 'con la que se pagó')} *`} htmlFor="cps-cuenta">
              <Select id="cps-cuenta" value={confirmarPagoSolicitud.cuenta} onChange={(e) => setConfirmarPagoSolicitud({...confirmarPagoSolicitud, cuenta: e.target.value})}>
                <option value="">Seleccionar</option>
                {(cuentasPorEmpresa[solicitud.empresa] || []).map(cuenta => <option key={cuenta} value={cuenta}>{cuenta}</option>)}
              </Select>
            </CampoUI>
            <CampoUI label={`Fecha ${accion === 'ingreso' ? 'en que se recibió el dinero' : 'del pago'} *`} htmlFor="cps-fecha">
              <Input id="cps-fecha" type="date" value={confirmarPagoSolicitud.fechaPago || ''} onChange={(e) => setConfirmarPagoSolicitud({...confirmarPagoSolicitud, fechaPago: e.target.value})} />
              <p className="m-0 text-xs text-muted-foreground">Es la fecha que queda en Finanzas.</p>
            </CampoUI>
            <CampoUI label="CECO *" htmlFor="cps-ceco">
              <Select id="cps-ceco" value={confirmarPagoSolicitud.ceco} onChange={(e) => setConfirmarPagoSolicitud({...confirmarPagoSolicitud, ceco: e.target.value})}>
                <option value="">Seleccionar</option>
                {opcionesCeco.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
              </Select>
            </CampoUI>

            {esPagoTerceroNeutro(solicitud, confirmarPagoSolicitud.ceco) && (
              <div className="flex flex-col gap-3 rounded-lg border border-solid border-[#CFCBC0] bg-[#F1F0EC] p-4">
                <p className="m-0 text-sm">⚪ <strong>Gasto Neutro</strong>: se registra en Finanzas en <strong>COP</strong> con el valor realmente pagado, pero <strong>no suma</strong> en los gastos de la empresa. Requiere al menos 2 soportes.</p>
                <CampoUI label="Concepto *" htmlFor="cps-neutro-concepto">
                  <Input id="cps-neutro-concepto" value={confirmarPagoSolicitud.detalleNeutro ?? (solicitud.detalle || '')} onChange={(e) => setConfirmarPagoSolicitud({ ...confirmarPagoSolicitud, detalleNeutro: e.target.value })} />
                </CampoUI>
                <CampoUI label={`Valor pagado en COP * (solicitud original: ${formatMoneyByMoneda(monto, 'USD')})`} htmlFor="cps-neutro-valor">
                  <Input id="cps-neutro-valor" inputMode="decimal" placeholder="Ej: 4.250.000" value={confirmarPagoSolicitud.valorCOP || ''} onChange={(e) => setConfirmarPagoSolicitud({ ...confirmarPagoSolicitud, valorCOP: e.target.value })} />
                </CampoUI>
              </div>
            )}

            <CampoUI label={`Comprobante(s) de ${accion === 'ingreso' ? 'la consignación' : 'pago'} del banco *`} htmlFor="cps-comprobantes">
              <Input id="cps-comprobantes" type="file" multiple onChange={handleSeleccionarComprobantePago} className={claseInputArchivo} />
              <p className="m-0 text-xs text-muted-foreground">Puedes adjuntar varios, ej. factura + soporte de pago.</p>
              <ArchivosElegidosUI archivos={confirmarPagoSolicitud.comprobantes || []} onQuitar={handleQuitarComprobantePago} />
            </CampoUI>

            <div className="flex gap-3">
              <Button size="lg" disabled={guardandoConfirmarPago} onClick={handleConfirmarPagoSolicitud} className={cn('flex-1', guardandoConfirmarPago && 'cursor-wait')}>
                {guardandoConfirmarPago ? <><Loader2 className="animate-spin" /> Guardando...</> : <><Check /> Confirmar {tituloAccion}</>}
              </Button>
              <Button size="lg" variant="outline" disabled={guardandoConfirmarPago} onClick={() => setConfirmarPagoSolicitud(null)}>Cancelar</Button>
            </div>
          </ModalUI>
          );
        })()}

        {/* MODAL DEVOLVER SOLICITUD — Administrador/Coordinadora Administrativa explican por qué
            una Solicitud (Anticipo, Reembolso, Legalización o Pago a Tercero) no pudo aprobarse.
            El motivo es obligatorio y queda visible para el colaborador en la tabla de
            Solicitudes; puede editarla y reenviarla (vuelve a "Pendiente" y se limpia el motivo). */}
        {devolverSolicitud && (
          <ModalUI
            titulo={<span className="text-[#C4622D]">↩️ Devolver Solicitud</span>}
            descripcion={`${devolverSolicitud.solicitud.tipo} de ${colaboradoresPublico.find(c => c.id === devolverSolicitud.solicitud.responsableId)?.nombre || devolverSolicitud.solicitud.responsableNombre || 'colaborador'} — ${devolverSolicitud.solicitud.detalle || 'sin concepto'}`}
            className="border-t-4 border-t-[#C4622D]"
          >
            <CampoUI label="Motivo de la devolución *" htmlFor="dev-motivo">
              <p className="m-0 text-xs text-muted-foreground">El colaborador verá este texto en su Solicitud y podrá editarla para corregirlo y reenviarla.</p>
              <Textarea
                id="dev-motivo"
                value={devolverSolicitud.motivo}
                onChange={(e) => setDevolverSolicitud({ ...devolverSolicitud, motivo: e.target.value })}
                rows={4}
                placeholder="Ej: Falta el soporte de la factura de transporte, el valor no coincide con el anticipo original..."
              />
            </CampoUI>
            <div className="flex gap-3">
              <Button size="lg" disabled={guardandoDevolucion} onClick={handleConfirmarDevolucion} className={cn('flex-1 bg-[#C4622D] text-white hover:bg-[#C4622D]/90', guardandoDevolucion && 'cursor-wait')}>
                {guardandoDevolucion ? <><Loader2 className="animate-spin" /> Guardando...</> : <><Undo2 /> Devolver Solicitud</>}
              </Button>
              <Button size="lg" variant="outline" disabled={guardandoDevolucion} onClick={() => setDevolverSolicitud(null)}>Cancelar</Button>
            </div>
          </ModalUI>
        )}

        {/* MODAL CONFIRMAR PAGO EN LOTE (Presupuesto -> Finanzas) — para los conceptos
            "Pendiente" marcados en la pestaña Mensual: una sola Cuenta y Fecha para todo el
            lote, un comprobante por concepto (con opción de aplicar uno solo a todos), y al
            confirmar genera un Gasto por cada concepto sin volver a llenar el formulario. */}
        {confirmarPagoLotePresupuesto && (
          <ModalUI
            titulo={`💳 Confirmar Pago — ${confirmarPagoLotePresupuesto.items.length} concepto${confirmarPagoLotePresupuesto.items.length !== 1 ? 's' : ''}`}
            descripcion={`${filtroPresupuesto.empresa} — Total: ${formatMoney(confirmarPagoLotePresupuesto.items.reduce((sum, it) => sum + (it.netoAPagar || 0), 0), filtroPresupuesto.empresa)}`}
            className="max-w-xl"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoUI label="Cuenta de la empresa con la que se pagó *" htmlFor="cpp-cuenta">
                <Select id="cpp-cuenta" value={confirmarPagoLotePresupuesto.cuenta} onChange={(e) => setConfirmarPagoLotePresupuesto({...confirmarPagoLotePresupuesto, cuenta: e.target.value})}>
                  <option value="">Seleccionar</option>
                  {(cuentasPorEmpresa[filtroPresupuesto.empresa] || []).map(cuenta => <option key={cuenta} value={cuenta}>{cuenta}</option>)}
                </Select>
              </CampoUI>
              <CampoUI label="Fecha del pago *" htmlFor="cpp-fecha">
                <Input id="cpp-fecha" type="date" value={confirmarPagoLotePresupuesto.fecha} onChange={(e) => setConfirmarPagoLotePresupuesto({...confirmarPagoLotePresupuesto, fecha: e.target.value})} />
              </CampoUI>
            </div>
            <CampoUI label="📎 Usar el/los mismo(s) comprobante(s) para todos (opcional)" htmlFor="cpp-todos">
              <Input id="cpp-todos" type="file" multiple onChange={handleSeleccionarComprobantePresupuestoTodos} className={claseInputArchivo} />
              <p className="m-0 text-xs text-muted-foreground">Puedes elegir varios.</p>
            </CampoUI>
            <div className="flex flex-col rounded-lg border border-solid border-border">
              {confirmarPagoLotePresupuesto.items.map(item => {
                const archivosItem = confirmarPagoLotePresupuesto.comprobantes[item.id] || [];
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-border px-3 py-2.5 last:border-b-0">
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-bold">{item.nombre}</p>
                      <p className="m-0 text-xs text-muted-foreground">{formatMoney(item.netoAPagar, filtroPresupuesto.empresa)}</p>
                    </div>
                    <div className="flex min-w-[180px] flex-col items-end gap-1">
                      <Input type="file" multiple aria-label={`Comprobante de ${item.nombre}`} onChange={(e) => handleSeleccionarComprobantePresupuestoItem(item.id, e)} className={cn(claseInputArchivo, 'h-auto py-1 text-xs')} />
                      {archivosItem.length > 0 ? (
                        <ArchivosElegidosUI archivos={archivosItem} onQuitar={(id) => handleQuitarComprobantePresupuestoItem(item.id, id)} compacto />
                      ) : (
                        <span className="text-xs text-destructive">Falta comprobante</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button size="lg" disabled={guardandoPagoLotePresupuesto} onClick={handleConfirmarPagoLotePresupuesto} className={cn('flex-1', guardandoPagoLotePresupuesto && 'cursor-wait')}>
                {guardandoPagoLotePresupuesto ? <><Loader2 className="animate-spin" /> Guardando...</> : <><Check /> Confirmar Pago ({confirmarPagoLotePresupuesto.items.length})</>}
              </Button>
              <Button size="lg" variant="outline" disabled={guardandoPagoLotePresupuesto} onClick={() => setConfirmarPagoLotePresupuesto(null)}>Cancelar</Button>
            </div>
          </ModalUI>
        )}

        {/* MODAL CONFIRMAR PAGO EN LOTE — REEMBOLSOS o PAGO A TERCERO (Solicitudes -> Finanzas) —
            Administrador/Coordinadora Administrativa eligen varias solicitudes "Aprobado" de un
            mismo tipo, misma Empresa (y, si es Pago a Tercero, misma moneda) desde la tabla de
            Solicitudes, y aquí adjuntan UN solo comprobante de banco para todas. Al confirmar,
            cada una se marca "Pagado" y genera su propio Gasto en Finanzas — todas con el mismo
            lote_pago_id para poder verlas agrupadas después. */}
        {confirmarPagoLoteReembolsos && (() => {
          const { items, cuenta, ceco } = confirmarPagoLoteReembolsos;
          const empresaLote = items[0]?.empresa;
          const esLoteTerceroModal = items[0]?.tipo === 'Pago a Tercero';
          const monedaLoteModal = esLoteTerceroModal ? (items[0]?.moneda || getMoneda(empresaLote)) : null;
          const totalLote = items.reduce((sum, it) => sum + calcularAccionFinanzasSolicitud(it).monto, 0);
          const totalLoteFormateado = esLoteTerceroModal ? formatMoneyByMoneda(totalLote, monedaLoteModal) : formatMoney(totalLote, empresaLote);
          return (
          <ModalUI titulo={`💳 Confirmar Pago en Lote — ${items.length} ${etiquetaTipoLote(items.map(x => x.tipo), items.length !== 1)}`} descripcion={`${empresaLote} — Total: ${totalLoteFormateado}`} className="max-w-lg">
            <div className="max-h-40 overflow-y-auto rounded-lg border border-solid border-border px-3 py-1">
              {items.map(it => (
                <div key={it.id} className="flex justify-between gap-3 py-1.5 text-xs">
                  <span>{esLoteTerceroModal ? (it.terceroInfo?.nombre || 'Tercero') : (colaboradoresPublico.find(c => c.id === it.responsableId)?.nombre || it.responsableNombre || '—')} — {it.detalle || it.tipo}</span>
                  <span className="whitespace-nowrap font-bold text-success">{esLoteTerceroModal ? formatMoneyByMoneda(calcularAccionFinanzasSolicitud(it).monto, it.moneda || getMoneda(it.empresa)) : formatMoney(calcularAccionFinanzasSolicitud(it).monto, it.empresa)}</span>
                </div>
              ))}
            </div>
            <CampoUI label="Cuenta de la empresa con la que se pagó *" htmlFor="cpl-cuenta">
              <Select id="cpl-cuenta" value={cuenta} onChange={(e) => setConfirmarPagoLoteReembolsos({...confirmarPagoLoteReembolsos, cuenta: e.target.value})}>
                <option value="">Seleccionar</option>
                {(cuentasPorEmpresa[empresaLote] || []).map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </CampoUI>
            <CampoUI label="Fecha del pago *" htmlFor="cpl-fecha">
              <Input id="cpl-fecha" type="date" value={confirmarPagoLoteReembolsos.fechaPago || ''} onChange={(e) => setConfirmarPagoLoteReembolsos({...confirmarPagoLoteReembolsos, fechaPago: e.target.value})} />
              <p className="m-0 text-xs text-muted-foreground">Es la fecha que queda en Finanzas para todo el lote.</p>
            </CampoUI>
            {/* El CECO se pide para todos los tipos, incluido Pago a Tercero. */}
            <CampoUI label="CECO del lote *" htmlFor="cpl-ceco">
              <Select id="cpl-ceco" value={ceco} onChange={(e) => setConfirmarPagoLoteReembolsos({...confirmarPagoLoteReembolsos, ceco: e.target.value})}>
                <option value="">Seleccionar</option>
                {cecosGasto.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
              </Select>
            </CampoUI>
            <CampoUI label="Comprobante(s) de pago del banco *" htmlFor="cpl-comprobantes">
              <Input id="cpl-comprobantes" type="file" multiple onChange={handleSeleccionarComprobantePagoLoteReembolsos} className={claseInputArchivo} />
              <p className="m-0 text-xs text-muted-foreground">Aplica a todo el lote; puedes adjuntar varios.</p>
              <ArchivosElegidosUI archivos={confirmarPagoLoteReembolsos.comprobantes || []} onQuitar={handleQuitarComprobantePagoLoteReembolsos} />
            </CampoUI>
            <div className="flex gap-3">
              <Button size="lg" disabled={guardandoPagoLoteReembolsos} onClick={handleConfirmarPagoLoteReembolsos} className={cn('flex-1', guardandoPagoLoteReembolsos && 'cursor-wait')}>
                {guardandoPagoLoteReembolsos ? <><Loader2 className="animate-spin" /> Guardando...</> : <><Check /> Confirmar Pago ({items.length})</>}
              </Button>
              <Button size="lg" variant="outline" disabled={guardandoPagoLoteReembolsos} onClick={() => setConfirmarPagoLoteReembolsos(null)}>Cancelar</Button>
            </div>
          </ModalUI>
          );
        })()}

        {/* MODAL VER LOTE DE PAGO — lista simple (fecha, colaborador, valor) de qué otras
            Solicitudes o Gastos se pagaron junto con este, con el mismo comprobante. */}
        {verLotePago && (
          <ModalUI titulo={verLotePago.titulo}>
            {verLotePago.items.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">No se encontraron otros registros de este lote.</p>
            ) : (
              <div className="flex flex-col rounded-lg border border-solid border-border">
                {verLotePago.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between gap-3 border-0 border-b border-solid border-border px-3 py-2.5 last:border-b-0">
                    <div>
                      <p className="m-0 text-sm font-bold">{it.nombre}</p>
                      <p className="m-0 text-xs text-muted-foreground">{it.fecha} · {it.empresa}</p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-success">{it.valor}</span>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => setVerLotePago(null)}>Cerrar</Button>
          </ModalUI>
        )}

        {/* MODAL PAGO A TERCERO EN LOTE (ej. Caelum manda varias facturas de distintos
            colaboradores para un solo pago) — Empresa/Cuenta/Tercero/CECO una sola vez arriba,
            una línea por colaborador (Colaborador + Valor + su propia factura) en medio, y un
            comprobante de pago compartido para todo el lote abajo. Al Registrar, crea un Gasto
            YA "Pagado" por colaborador, cada uno con su factura y el mismo comprobante. */}
        {registrarFacturasTercero && (() => {
          const lt = registrarFacturasTercero;
          const editando = lt.modo === 'editar';
          const totales = lt.lineas.reduce((acc, l) => { const m = montosLineaFacturaTercero(l); return { bruto: acc.bruto + m.bruto, retencion: acc.retencion + m.retencion, neto: acc.neto + m.neto }; }, { bruto: 0, retencion: 0, neto: 0 });
          return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
            <Card className="max-h-[90vh] w-full max-w-4xl gap-4 overflow-y-auto px-0 py-6">
              <CardHeader className="sm:px-7">
                <CardTitle className="text-lg">{editando ? `✏️ Editar Pago a Tercero en Lote · ${lt.fecha}` : '🧾 Pago a Tercero en Lote'}</CardTitle>
                {editando ? (
                  <CardDescription>Corrige o completa las facturas de este lote (N° de factura, valores, retención), cambia la cuenta o el CECO, o agrega colaboradores que faltaron. Para quitar una factura, elimínala desde el historial.</CardDescription>
                ) : (
                <CardDescription>Para cuando un tercero (ej. Caelum) envía varias facturas de distintos colaboradores y se paga todo junto. Se registra <strong>un gasto por colaborador</strong> con su factura y la copia del comprobante — no se crea ningún registro por el total.</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:px-7">
                <div className="grid gap-3 rounded-lg border border-solid border-border bg-background p-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
                  <CampoUI label="Empresa *" htmlFor="lt-empresa">
                    <Select id="lt-empresa" value={lt.empresa} disabled={editando} onChange={(e) => setRegistrarFacturasTercero({ ...lt, empresa: e.target.value, cuenta: '' })}>
                      {empresas.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </Select>
                  </CampoUI>
                  <CampoUI label="Cuenta *" htmlFor="lt-cuenta">
                    <Select id="lt-cuenta" value={lt.cuenta} onChange={(e) => setRegistrarFacturasTercero({ ...lt, cuenta: e.target.value })}>
                      <option value="">Seleccionar</option>
                      {(cuentasPorEmpresa[lt.empresa] || []).map(cuenta => <option key={cuenta} value={cuenta}>{cuenta}</option>)}
                    </Select>
                  </CampoUI>
                  <CampoUI label="Tercero *" htmlFor="lt-tercero">
                    <Select id="lt-tercero" value={lt.terceroId} onChange={(e) => {
                      const id = e.target.value;
                      const t = todosTerceros.find(x => x.id === id);
                      setRegistrarFacturasTercero({ ...lt, terceroId: id, terceroNombre: t?.nombre || lt.terceroNombre });
                    }}>
                      <option value="">✍️ Escribir abajo</option>
                      {todosTerceros.filter(t => t.activo !== false).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </Select>
                    <Input type="text" aria-label="Nombre del tercero" placeholder="Nombre del tercero (ej. Caelum)" value={lt.terceroNombre} onChange={(e) => setRegistrarFacturasTercero({ ...lt, terceroId: '', terceroNombre: e.target.value })} className="h-8 text-xs" />
                  </CampoUI>
                  <CampoUI label="CECO *" htmlFor="lt-ceco">
                    <Select id="lt-ceco" value={lt.ceco} onChange={(e) => setRegistrarFacturasTercero({ ...lt, ceco: e.target.value })}>
                      <option value="">Seleccionar</option>
                      {cecosGasto.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>)}
                    </Select>
                  </CampoUI>
                </div>

                <h3 className="m-0 text-sm font-bold">Facturas por colaborador</h3>
                <div className="flex flex-col gap-2">
                  {lt.lineas.map((linea, idx) => {
                    const m = montosLineaFacturaTercero(linea);
                    return (
                      <div key={linea.id} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-solid border-border bg-card p-3 sm:grid-cols-[1.4fr_0.9fr_1fr_0.9fr_1fr_1.3fr_auto]">
                        <CampoUI label={idx === 0 ? 'Colaborador *' : null} className="col-span-2 sm:col-span-1">
                          <Select aria-label="Colaborador" value={linea.responsable} onChange={(e) => handleCambiarLineaFacturaTercero(linea.id, 'responsable', e.target.value)} className="text-xs">
                            <option value="">Colaborador *</option>
                            {personasFinanzas.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                          </Select>
                        </CampoUI>
                        <CampoUI label={idx === 0 ? 'N° factura' : null}>
                          <Input type="text" aria-label="Número de factura" placeholder="FE 2820" value={linea.numeroFactura} onChange={(e) => handleCambiarLineaFacturaTercero(linea.id, 'numeroFactura', e.target.value)} className="text-xs" />
                        </CampoUI>
                        <CampoUI label={idx === 0 ? 'Valor factura *' : null}>
                          <Input type="number" aria-label="Valor de la factura" placeholder="Valor *" value={linea.valor} onChange={(e) => handleCambiarLineaFacturaTercero(linea.id, 'valor', e.target.value)} className="text-xs" />
                        </CampoUI>
                        <CampoUI label={idx === 0 ? 'Retención' : null}>
                          <Input type="number" aria-label="Retención" placeholder="0" value={linea.retencion} onChange={(e) => handleCambiarLineaFacturaTercero(linea.id, 'retencion', e.target.value)} aria-invalid={m.retencion < 0 || (m.bruto > 0 && m.neto <= 0) ? true : undefined} className="text-xs" />
                        </CampoUI>
                        <CampoUI label={idx === 0 ? 'Neto pagado' : null}>
                          <div className="flex h-9 items-center justify-end rounded-md bg-muted px-3 text-xs font-bold tabular-nums">{formatMoney(m.neto, lt.empresa)}</div>
                        </CampoUI>
                        <CampoUI label={idx === 0 ? 'Soporte factura *' : null} className="col-span-2 sm:col-span-1">
                          <label className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9 w-full justify-start overflow-hidden text-xs', (linea.factura || linea.facturaExistente) ? 'text-success' : 'text-destructive')}>
                            <Paperclip size={14} /> <span className="truncate">{linea.factura ? linea.factura.nombre : (linea.facturaExistente ? 'Ya cargada · agregar otra' : 'Adjuntar factura *')}</span>
                            <input type="file" className="hidden" onChange={(e) => handleSeleccionarFacturaLinea(linea.id, e)} />
                          </label>
                        </CampoUI>
                        <Button variant="ghost" size="icon" onClick={() => handleQuitarLineaFacturaTercero(linea.id)} disabled={lt.lineas.length === 1 || !!linea.gastoId} className="justify-self-end text-destructive" title="Quitar esta línea" aria-label="Quitar esta línea"><Trash2 size={16} /></Button>
                      </div>
                    );
                  })}
                </div>

                <Button variant="outline" onClick={handleAgregarLineaFacturaTercero} className="self-start border-dashed border-primary"><Plus size={16} /> Agregar otro colaborador</Button>

                <div className="grid grid-cols-3 gap-3 rounded-lg border border-solid border-border bg-background p-4 text-sm">
                  <div><p className="m-0 text-xs text-muted-foreground">Total facturas</p><p className="m-0 font-bold tabular-nums">{formatMoney(totales.bruto, lt.empresa)}</p></div>
                  <div><p className="m-0 text-xs text-muted-foreground">Retenciones</p><p className="m-0 font-bold tabular-nums text-destructive">−{formatMoney(totales.retencion, lt.empresa)}</p></div>
                  <div><p className="m-0 text-xs text-muted-foreground">Neto pagado (banco)</p><p className="m-0 font-extrabold tabular-nums text-success">{formatMoney(totales.neto, lt.empresa)}</p></div>
                </div>

                <ListaSoportesUI
                  titulo={editando ? 'Agregar otro soporte de pago (opcional — el que ya tiene el lote se conserva)' : 'Soporte de pago (recibo único del banco para todo el lote) *'}
                  inputProps={{ multiple: true, onChange: handleSeleccionarComprobantePagoTercero }}
                  archivos={(lt.comprobantesPago || []).map(c => ({ ...c, tamaño: Math.round((c.data || '').length * 0.75) }))}
                  resumen="Se copia a cada uno de los gastos del lote (un solo archivo en el sistema)."
                  onQuitar={handleQuitarComprobantePagoTercero}
                />

                <div className="flex gap-3">
                  <Button size="lg" disabled={guardandoFacturasTercero} onClick={handleGuardarFacturasTercero} className="flex-1">
                    {guardandoFacturasTercero ? 'Guardando...' : (editando ? `💾 Guardar cambios (${lt.lineas.length} factura(s))` : `✅ Registrar ${lt.lineas.length} factura(s)`)}
                  </Button>
                  <Button size="lg" variant="outline" disabled={guardandoFacturasTercero} onClick={() => setRegistrarFacturasTercero(null)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
          );
        })()}

        {/* MODAL VER DETALLE DEL TERCERO — para que la Coordinadora Administrativa pueda
            ejecutar el pago sin abrir el PDF ni buscar en "Ver Soportes". */}
        {verDetalleTercero && (() => {
          const t = verDetalleTercero.terceroInfo || {};
          const fila = (label, valor) => (
            <div className="flex justify-between gap-4 border-0 border-b border-solid border-border py-2 last:border-b-0">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-right text-sm font-bold">{valor || '—'}</span>
            </div>
          );
          const grupo = (titulo, filas) => (
            <div className="flex flex-col">
              <p className="m-0 mb-1 text-xs font-bold uppercase tracking-wide text-primary">{titulo}</p>
              <div className="flex flex-col rounded-lg border border-solid border-border bg-background px-3">{filas}</div>
            </div>
          );
          return (
            <ModalUI titulo="👤 Detalle del Pago a Tercero">
              {grupo('Pago', <>
                {fila('Empresa que paga', verDetalleTercero.empresa)}
                {fila('Fecha', verDetalleTercero.fecha)}
                {fila('Solicitado por', verDetalleTercero.responsableNombre)}
                {fila('Concepto', verDetalleTercero.detalle)}
                {fila('Valor a pagar', formatMoneyByMoneda(parseFloat(verDetalleTercero.valor) || 0, verDetalleTercero.moneda || getMoneda(verDetalleTercero.empresa)))}
              </>)}
              {grupo('Datos del tercero', <>
                {fila('Nombre', t.nombre)}
                {fila('DNI / Documento', t.dni)}
                {fila('País de origen', t.paisOrigen)}
              </>)}
              {grupo('Datos bancarios para el pago', <>
                {fila('Banco', t.banco)}
                {fila('Tipo de cuenta', t.tipoCuenta)}
                {fila('Número de cuenta', t.numeroCuenta)}
              </>)}
              <div className="flex gap-3">
                <Button size="lg" onClick={() => handleGenerarPDFPagoTercero(verDetalleTercero)} className="flex-1"><FileDown /> Descargar PDF</Button>
                <Button size="lg" variant="outline" onClick={() => setVerDetalleTercero(null)}>Cerrar</Button>
              </div>
            </ModalUI>
          );
        })()}

        {/* MODAL INFORME DE FINANZAS — vista previa (resumen + gráficas + tabla) del filtro
            actualmente aplicado, antes de descargar el PDF. Usa exactamente lo mismo que arma
            handleDescargarInformeFinanzas, así que lo que se ve aquí es lo que trae el PDF. */}
        {informeFinanzas && (
          <ModalUI
            titulo={<span className="flex flex-wrap items-center justify-between gap-3"><span>👁️ Informe Financiero — Vista Previa</span>{informeFinanzas.datos.empresaFiltro !== 'Todas' && <EmpresaLogo empresa={informeFinanzas.datos.empresaFiltro} height={32} />}</span>}
            descripcion={informeFinanzas.datos.filtrosTexto.join(' · ')}
            className="max-w-3xl"
          >
            {informeFinanzas.datos.porMoneda.length === 0 && (
              <p className="m-0 py-8 text-center text-muted-foreground">Sin registros para este filtro.</p>
            )}
            {informeFinanzas.datos.porMoneda.map(pm => {
              const g = informeFinanzas.graficas.find(x => x.moneda === pm.moneda);
              return (
                <section key={pm.moneda} className="flex flex-col gap-4 border-0 border-t border-solid border-border pt-4">
                  <h3 className="m-0 text-base font-bold">Resumen ({pm.moneda})</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Ingresos', valor: pm.ingresos, clase: 'text-success' },
                      { label: 'Gastos', valor: pm.gastos, clase: 'text-destructive' },
                      { label: 'Neto', valor: pm.neto, clase: pm.neto >= 0 ? 'text-success' : 'text-destructive' },
                      { label: 'Movimientos', valor: null, texto: String(pm.cantidadMovimientos), clase: 'text-[#6C63D1]' },
                    ].map(card => (
                      <div key={card.label} className="min-w-0 rounded-lg border border-solid border-border bg-background p-3">
                        <p className="m-0 mb-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">{card.label}</p>
                        <p className={cn('m-0 truncate text-base font-bold', card.clase)}>{card.texto || formatMoneyByMoneda(card.valor, pm.moneda)}</p>
                      </div>
                    ))}
                  </div>
                  <img src={g.imgMensual} alt={`Ingresos vs Gastos por mes (${pm.moneda})`} className="block h-auto w-full rounded-md border border-solid border-border" />
                  <img src={g.imgEmpresa} alt={`Ingresos vs Gastos por empresa (${pm.moneda})`} className="block h-auto w-full rounded-md border border-solid border-border" />
                  {g.imgCategoria && (
                    <img src={g.imgCategoria} alt={`Distribución por categoría (${pm.moneda})`} className="block h-auto max-w-full rounded-md border border-solid border-border" />
                  )}
                </section>
              );
            })}
            {informeFinanzas.datos.totalRegistros > 0 && (
              <p className={cn('m-0 text-xs', informeFinanzas.datos.truncado ? 'text-destructive' : 'text-muted-foreground')}>
                {informeFinanzas.datos.truncado
                  ? `⚠️ El PDF incluirá el detalle de ${informeFinanzas.datos.filasTabla.length} de ${informeFinanzas.datos.totalRegistros} movimientos (límite ${LIMITE_FILAS_TABLA_INFORME}) — acota el filtro para verlos todos.`
                  : `El PDF incluirá el detalle completo de los ${informeFinanzas.datos.totalRegistros} movimiento(s).`}
              </p>
            )}
            <div className="flex gap-3">
              <Button size="lg" onClick={handleDescargarInformeFinanzas} disabled={generandoInformePDF} className={cn('flex-1', generandoInformePDF && 'cursor-wait')}>
                {generandoInformePDF ? <><Loader2 className="animate-spin" /> Generando...</> : <><FileDown /> Descargar PDF</>}
              </Button>
              <Button size="lg" variant="outline" onClick={() => setInformeFinanzas(null)}>Cerrar</Button>
            </div>
          </ModalUI>
        )}

        {/* MODAL SOLICITUD DE ORIGEN — desde "🔗 Generado desde Solicitudes" en Finanzas */}
        {verSolicitudOrigen && (() => {
          const so = verSolicitudOrigen.solicitud;
          const valorSo = so.tipo === 'Pago a Tercero' ? formatMoneyByMoneda(parseFloat(so.valor) || 0, so.moneda || getMoneda(so.empresa)) : formatMoney(esTipoValorUnico(so.tipo) ? parseFloat(so.valor) : so.totalCalculado || 0, so.empresa);
          const nombreSo = colaboradoresPublico.find(c => c.id === so.responsableId)?.nombre || so.responsableNombre || '—';
          return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
              <Card className="max-h-[90vh] w-full max-w-lg gap-4 overflow-y-auto px-0 py-6">
                <CardHeader className="sm:px-7">
                  <CardTitle className="text-lg">🔗 Solicitud de origen</CardTitle>
                  <CardDescription>El movimiento de Finanzas se generó al pagar esta solicitud.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:px-7">
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-solid border-border bg-background p-4 text-sm">
                    <div><p className="m-0 text-xs text-muted-foreground">Tipo</p><p className="m-0 font-bold text-primary">{so.tipo}</p></div>
                    <div><p className="m-0 text-xs text-muted-foreground">Estado</p><Badge variant={estadoBadge(so.estado)}>{so.estado}</Badge></div>
                    <div><p className="m-0 text-xs text-muted-foreground">Fecha</p><p className="m-0">{so.fecha}</p></div>
                    <div><p className="m-0 text-xs text-muted-foreground">Valor</p><p className="m-0 font-bold text-success">{valorSo}</p></div>
                    <div><p className="m-0 text-xs text-muted-foreground">Colaborador</p><p className="m-0">{nombreSo}</p></div>
                    <div><p className="m-0 text-xs text-muted-foreground">Empresa</p><p className="m-0">{so.empresa}</p></div>
                    {so.terceroInfo?.nombre && <div className="col-span-2"><p className="m-0 text-xs text-muted-foreground">Tercero</p><p className="m-0">👤 {so.terceroInfo.nombre}{so.terceroInfo.dni ? ` · ${so.terceroInfo.dni}` : ''}</p></div>}
                  </div>
                  <CampoUI label="Concepto" htmlFor="so-concepto">
                    {puedeGestionarSolicitudOrigen ? (
                      <Textarea id="so-concepto" rows={2} value={verSolicitudOrigen.concepto} onChange={(e) => setVerSolicitudOrigen({ ...verSolicitudOrigen, concepto: e.target.value })} />
                    ) : (
                      <p className="m-0 text-sm">{so.detalle || '—'}</p>
                    )}
                  </CampoUI>
                  {puedeGestionarSolicitudOrigen && <p className="m-0 -mt-2 text-xs text-muted-foreground">Al guardar se actualiza la solicitud y también el concepto de su registro en Finanzas.</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => handleVerSoportesSolicitud(so)}><Paperclip size={14} /> Ver soportes</Button>
                    <div className="flex-1" />
                    <Button variant="outline" disabled={verSolicitudOrigen.guardando} onClick={() => setVerSolicitudOrigen(null)}>Cerrar</Button>
                    {puedeGestionarSolicitudOrigen && (
                      <Button disabled={verSolicitudOrigen.guardando} onClick={handleGuardarConceptoSolicitudOrigen}>{verSolicitudOrigen.guardando ? 'Guardando...' : 'Guardar concepto'}</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* MODAL VER SOPORTES */}
        {verSoportes && (
          <ModalUI titulo="📎 Soportes">
            {verSoportes.length === 0 ? (
              <p className="m-0 text-center text-sm text-muted-foreground">No hay soportes adjuntos</p>
            ) : (
              verSoportes.map((soporte, idx) => {
                const previsualizable = inferirTipoPreviewSoporte(soporte.nombre) !== 'otro';
                return (
                  <div key={idx} className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-background p-4">
                    <div className="min-w-0">
                      <p className="m-0 flex items-center gap-1.5 truncate text-sm font-bold"><FileText size={15} className="shrink-0 text-primary" /> {soporte.nombre}</p>
                      <p className="m-0 text-xs text-muted-foreground">{(soporte.tamaño / 1024).toFixed(2)} KB</p>
                    </div>
                    <div className="flex gap-2">
                      {previsualizable && (
                        <Button variant="outline" onClick={() => handlePreviewSoporte(soporte)} disabled={cargandoPreviewSoporte} className="flex-1"><Eye size={16} /> Ver</Button>
                      )}
                      <Button onClick={() => handleDownloadSoporte(soporte)} className="flex-1"><FileDown size={16} /> Descargar</Button>
                      {verSoportesContexto?.puedeEliminar && soporte.id && (
                        <Button variant="outline" size="icon" onClick={() => handleEliminarUnSoporte(soporte)} disabled={eliminandoSoporteId === soporte.id} title="Eliminar este soporte" aria-label="Eliminar este soporte" className="text-destructive">
                          {eliminandoSoporteId === soporte.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <Button variant="outline" onClick={() => { setVerSoportes(null); setVerSoportesContexto(null); }}>Cerrar</Button>
          </ModalUI>
        )}

        {/* MODAL VISTA PREVIA DE SOPORTE — PDF o imagen mostrados directo, sin descargar
            primero. Se abre desde el botón "👁️ Ver" de cualquier "Ver Soportes" de la app
            (Solicitudes, Gastos, Ingresos, Cuentas de Cobro, Pago a Tercero: todos comparten
            el mismo modal de arriba). */}
        {previewSoporte && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4">
            <Card className="flex max-h-[92vh] w-full max-w-4xl flex-col gap-3 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 flex min-w-0 items-center gap-1.5 truncate text-sm font-bold"><FileText size={15} className="shrink-0 text-primary" /> {previewSoporte.nombre}</p>
                <div className="flex shrink-0 gap-2">
                  {/* El archivo ya está cargado en memoria para la vista previa (object URL o
                      data URL) — se descarga directo desde ahí, sin volver a pedirlo a Storage. */}
                  <Button size="sm" onClick={() => { const link = document.createElement('a'); link.href = previewSoporte.url; link.download = previewSoporte.nombre; link.click(); }}><FileDown size={14} /> Descargar</Button>
                  <Button size="sm" variant="outline" onClick={handleCerrarPreviewSoporte}><X size={14} /> Cerrar</Button>
                </div>
              </div>
              <div className={cn('flex flex-1 justify-center overflow-auto rounded-md bg-background', previewSoporte.tipo === 'imagen' ? 'items-center' : 'items-stretch')}>
                {previewSoporte.tipo === 'pdf' ? (
                  <iframe src={previewSoporte.url} title={previewSoporte.nombre} className="h-[75vh] w-full rounded-md border-0" />
                ) : (
                  <img src={previewSoporte.url} alt={previewSoporte.nombre} className="max-h-[75vh] max-w-full object-contain" />
                )}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
