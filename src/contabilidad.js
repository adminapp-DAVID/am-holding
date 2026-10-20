// Contabilidad (submenú de Finanzas): gestor de soportes de los movimientos de Finanzas,
// organizados por empresa, cuenta, año y mes. Lógica pura (sin React ni Supabase) para poder
// probarla aparte; la vista está en ContabilidadView.js.

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const nombreMes = (aaaamm) => {
  const [a, m] = String(aaaamm || '').split('-');
  return MESES[Number(m) - 1] ? `${MESES[Number(m) - 1]} ${a}` : 'Sin fecha';
};

// Registros de Finanzas (registrosFinanzasTodos de App.js) → filas del gestor. Un Traslado viene
// en dos líneas (salida y entrada) con los mismos soportes: aquí queda una sola, la de salida.
export const filasContabilidad = (registros) => (registros || [])
  .filter(r => r._ladoTraslado !== 'entrada')
  .map(r => ({
    clave: `${r._origen}:${r.id}`,
    entidadTipo: r._origen === 'ingreso' ? 'ingreso' : 'gasto',
    id: r.id,
    fecha: r.fecha || '',
    anio: (r.fecha || '').substring(0, 4),
    mes: (r.fecha || '').substring(0, 7),
    empresa: r.empresa || '',
    cuenta: (r.tipo === 'Traslado' ? r.cuentaSalida : r.cuenta) || '',
    concepto: r.detalle || '',
    tipo: r.tipo || '',
    valor: parseFloat(r.valor) || 0,
    moneda: r.moneda || '',
    ceco: r.ceco || '',
    soportes: r.cantidadSoportes || 0,
    soporteDriveLink: r.soporteDriveLink || '',
    solicitudOrigenId: r.solicitudOrigenId || null,
    registro: r,
  }));

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const FILTRO_CONTABILIDAD = { empresa: '', cuenta: '', anio: '', mes: '', desde: '', hasta: '', tipo: '', texto: '', soloConSoportes: false };

export const filtrarFilas = (filas, f) => {
  const texto = normalizar(f.texto).trim();
  return filas.filter(x =>
    (!f.empresa || x.empresa === f.empresa) &&
    (!f.cuenta || x.cuenta === f.cuenta) &&
    (!f.anio || x.anio === f.anio) &&
    (!f.mes || x.mes.substring(5, 7) === f.mes) &&
    (!f.desde || x.fecha >= f.desde) &&
    (!f.hasta || x.fecha <= f.hasta) &&
    (!f.tipo || x.tipo === f.tipo) &&
    (!f.soloConSoportes || x.soportes > 0 || !!x.soporteDriveLink) &&
    (!texto || normalizar(`${x.concepto} ${x.cuenta} ${x.empresa} ${x.ceco} ${x.tipo}`).includes(texto)));
};

export const CAMPOS_ORDEN = { fecha: 'Fecha', valor: 'Valor', empresa: 'Empresa', cuenta: 'Cuenta', concepto: 'Concepto' };

export const ordenarFilas = (filas, campo = 'fecha', direccion = 'desc') => {
  const signo = direccion === 'asc' ? 1 : -1;
  const valorDe = (x) => (campo === 'valor' ? x.valor : normalizar(x[campo]));
  return [...filas].sort((a, b) => {
    const va = valorDe(a);
    const vb = valorDe(b);
    if (va < vb) return -1 * signo;
    if (va > vb) return 1 * signo;
    // Desempate estable: fecha en la misma dirección.
    return a.fecha < b.fecha ? -1 * signo : a.fecha > b.fecha ? 1 * signo : 0;
  });
};

export const AGRUPACIONES = { mes: 'Mes', anio: 'Año', empresa: 'Empresa', cuenta: 'Cuenta', ninguno: 'Sin agrupar' };

// Grupos en el orden en que aparecen las filas ya ordenadas; los de fecha (mes / año) siguen la
// dirección elegida aunque el orden interno sea por otro campo.
export const agruparFilas = (filas, por = 'mes', direccion = 'desc') => {
  if (por === 'ninguno') return [{ clave: 'todo', titulo: 'Todos los registros', filas }];
  const titulo = (x) => (por === 'mes' ? nombreMes(x.mes) : por === 'anio' ? (x.anio || 'Sin fecha')
    : por === 'empresa' ? (x.empresa || 'Sin empresa') : `${x.empresa ? `${x.empresa} · ` : ''}${x.cuenta || 'Sin cuenta'}`);
  const clave = (x) => (por === 'mes' ? x.mes : por === 'anio' ? x.anio : por === 'empresa' ? x.empresa : `${x.empresa}|${x.cuenta}`);
  const mapa = new Map();
  filas.forEach(x => {
    const k = clave(x) || '';
    if (!mapa.has(k)) mapa.set(k, { clave: k, titulo: titulo(x), filas: [] });
    mapa.get(k).filas.push(x);
  });
  const grupos = [...mapa.values()];
  if (por === 'mes' || por === 'anio') {
    const signo = direccion === 'asc' ? 1 : -1;
    grupos.sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0) * signo);
  }
  return grupos;
};

// Totales por moneda de un grupo (no se suman pesos con dólares).
export const totalesPorMoneda = (filas, monedaDe) => filas.reduce((acc, x) => {
  const m = monedaDe(x);
  acc[m] = (acc[m] || 0) + x.valor;
  return acc;
}, {});

export const tipoArchivo = (nombre) => {
  const ext = String(nombre || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'imagen';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'hoja';
  return 'otro';
};
