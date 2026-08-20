// Manejo centralizado de fechas: semana, mes, año, formato. Evita cálculos de fecha
// duplicados o inconsistentes entre módulos.

const MS_DAY = 86400000;

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function toISODate(date) {
  const d = new Date(date);
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function parseISODate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// "YYYY-MM-DD" (sin hora) representa un día calendario elegido por el usuario y debe
// interpretarse en hora local, nunca en UTC (new Date("YYYY-MM-DD") corre ese riesgo y
// puede mostrar/comparar un día antes en zonas horarias negativas). Los timestamps
// completos (createdAt/updatedAt, objetos Date) sí deben pasar por el parseo normal.
export function parseFlexibleDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseISODate(value);
  return new Date(value);
}

export function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / MS_DAY + 1) / 7);
}

export function startOfMonth(year, month) {
  return new Date(year, month, 1);
}

export function endOfMonth(year, month) {
  const d = new Date(year, month + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfYear(year) {
  return new Date(year, 0, 1);
}

export function endOfYear(year) {
  const d = new Date(year, 11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isDateInRange(date, start, end) {
  const t = parseFlexibleDate(date).getTime();
  return t >= parseFlexibleDate(start).getTime() && t <= parseFlexibleDate(end).getTime();
}

export function formatDateLong(date) {
  const d = parseFlexibleDate(date);
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function formatDateShort(date) {
  const d = parseFlexibleDate(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Fecha + hora local, para timestamps completos (ej. lastUpdated), no para fechas de
 * usuario "YYYY-MM-DD" (esas no llevan hora). */
export function formatDateTime(date) {
  const d = parseFlexibleDate(date);
  return `${formatDateShort(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
