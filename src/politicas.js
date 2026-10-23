// Políticas Financieras: lógica pura (sin React ni Supabase). Los plazos y las notificaciones los
// calcula la base (supabase/migrations/20261024_politicas_financieras.sql); aquí solo se replica
// lo que la app necesita mostrar o advertir antes de guardar.

export const TIPOS_ANTICIPO = ['General', 'Viaje nacional', 'Viaje internacional'];
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Valores por defecto (los mismos de la migración), por si la tabla todavía no se ha creado.
export const POLITICA_POR_DEFECTO = {
  contenido: '', pago_dia_semana: 5, corte_dia_semana: 4, corte_hora: '11:00', dia_mes_corrido: 15,
  devolucion_horas: 5, legal_general_dias: 10, legal_general_habiles: true, legal_nacional_dias: 15,
  legal_nacional_habiles: true, legal_internacional_dia: 30, legal_recordar_dias_antes: 2,
  anticipo_min_horas: 48, notificaciones_activas: true,
};

// Fecha (AAAA-MM-DD) de un instante en hora Colombia.
export const fechaColombia = (instante) =>
  new Date(instante).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// Igual que la base: días entre la fecha de la solicitud (hora Colombia) y el día en que se
// necesita el recurso, × 24, contra las horas mínimas de la política.
export const anticipoFueraDePlazo = (fechaRequerida, creadaEn, minHoras) => {
  if (!fechaRequerida) return false;
  const dias = (Date.parse(`${fechaRequerida}T00:00:00Z`) - Date.parse(`${fechaColombia(creadaEn)}T00:00:00Z`)) / 86400000;
  return dias * 24 < (Number(minHoras) || 0);
};

// "11:00" / "11:00:00" → "11:00 a. m."
export const textoHora = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};

export const textoPlazoLegalizacion = (dias, habiles) => `${dias} día${dias === 1 ? '' : 's'}${habiles ? ' hábiles' : ' calendario'}`;

// Resumen legible de los valores vigentes (para la página de políticas).
export const resumenPolitica = (p) => {
  const x = { ...POLITICA_POR_DEFECTO, ...(p || {}) };
  return [
    ['Pago de reembolsos', `${DIAS_SEMANA[x.pago_dia_semana - 1]}${x.dia_mes_corrido ? ` (si cae día ${x.dia_mes_corrido}, el lunes siguiente)` : ''}; si es festivo, el siguiente día hábil`],
    ['Corte para reembolsos', `${DIAS_SEMANA[x.corte_dia_semana - 1]} a las ${textoHora(x.corte_hora)}`],
    ['Plazo para corregir una devuelta', `${x.devolucion_horas} horas`],
    ['Anticipación mínima de anticipos', `${x.anticipo_min_horas} horas`],
    ['Legalización · general', textoPlazoLegalizacion(x.legal_general_dias, x.legal_general_habiles)],
    ['Legalización · viaje nacional', textoPlazoLegalizacion(x.legal_nacional_dias, x.legal_nacional_habiles)],
    ['Legalización · viaje internacional', `Hasta el día ${x.legal_internacional_dia} del mes en que se pagó`],
  ];
};

// Texto de las políticas con un formato mínimo: "# Título", "- viñeta", "  - subviñeta" y
// **negrilla**. → [{ tipo: 'titulo' | 'item' | 'parrafo', nivel, partes: [{ texto, negrilla }] }]
export const partesNegrilla = (texto) => String(texto).split(/(\*\*[^*]+\*\*)/).filter(Boolean)
  .map(t => (t.startsWith('**') && t.endsWith('**') ? { texto: t.slice(2, -2), negrilla: true } : { texto: t, negrilla: false }));

export const bloquesContenido = (contenido) => String(contenido || '').split('\n')
  .filter(l => l.trim())
  .map(l => {
    const titulo = l.match(/^#+\s+(.*)$/);
    if (titulo) return { tipo: 'titulo', nivel: 0, partes: partesNegrilla(titulo[1]) };
    const item = l.match(/^(\s*)[-•]\s+(.*)$/);
    if (item) return { tipo: 'item', nivel: item[1].length >= 2 ? 1 : 0, partes: partesNegrilla(item[2]) };
    return { tipo: 'parrafo', nivel: 0, partes: partesNegrilla(l.trim()) };
  });

// Avisos de la política para una solicitud (lista y seguimiento). `legalizada`: el anticipo ya
// tiene una Legalización presentada. `ahora` para pruebas.
export const avisosPolitica = (s, { legalizada = false, ahora = new Date() } = {}) => {
  const avisos = [];
  const fechaCorta = (f) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (s.estado === 'Devuelto' && s.devueltaLimite && !s.devueltaVencida) {
    const limite = new Date(s.devueltaLimite);
    const hora = limite.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
    avisos.push({ clave: 'devuelta', tono: limite < ahora ? 'destructive' : 'warning', texto: `⏰ Corregir antes de ${hora} · ${fechaCorta(fechaColombia(limite))}` });
  }
  if (s.devueltaVencida && ['Devuelto', 'Pendiente', 'Aprobado'].includes(s.estado)) {
    avisos.push({ clave: 'vencida', tono: 'destructive', texto: '⌛ Devuelta fuera de plazo · semana siguiente' });
  }
  if (s.tipo === 'Reembolso' && s.fechaPagoEstimada && ['Pendiente', 'Aprobado', 'Devuelto'].includes(s.estado)) {
    avisos.push({ clave: 'pago', tono: s.extemporanea ? 'warning' : 'secondary', texto: `📅 Pago est. ${fechaCorta(s.fechaPagoEstimada)}${s.extemporanea ? ' · extemporáneo' : ''}` });
  }
  if (s.tipo === 'Anticipo' && s.requiereConfirmacionGerencia && ['Pendiente', 'Aprobado', 'Devuelto'].includes(s.estado)) {
    avisos.push({ clave: 'gerencia', tono: 'warning', texto: '⚠️ Requiere confirmación de gerencia' });
  }
  if (s.tipo === 'Anticipo' && s.estado === 'Pagado' && s.legalizarAntes && !legalizada) {
    const vencido = s.legalizarAntes < fechaColombia(ahora);
    avisos.push({ clave: 'legalizar', tono: vencido ? 'destructive' : 'secondary', texto: `🧾 ${vencido ? 'Legalización vencida' : 'Legalizar antes del'} ${fechaCorta(s.legalizarAntes)}` });
  }
  return avisos;
};
