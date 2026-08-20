// Reglas de recurrencia de ingresos/gastos. Única fuente de verdad para determinar cuántas
// ocurrencias de un movimiento caen dentro de un rango de fechas (ver docs/architecture.md).

import { parseFlexibleDate } from '../core/dates.js';

export const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Único' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
  { value: 'custom', label: 'Personalizado (cada N días)' },
];

export function frequencyLabel(value) {
  return FREQUENCY_OPTIONS.find((f) => f.value === value)?.label || value;
}

function addPeriodic(anchor, intervalDays, start, end, out) {
  if (anchor > end || intervalDays <= 0) return;
  const msInterval = intervalDays * 86400000;
  let cursor = new Date(anchor);
  if (cursor < start) {
    const steps = Math.floor((start - cursor) / msInterval);
    cursor = new Date(cursor.getTime() + steps * msInterval);
  }
  while (cursor < start) cursor = new Date(cursor.getTime() + msInterval);
  while (cursor <= end) {
    out.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + msInterval);
  }
}

function addMonthly(anchor, dueDay, start, end, out) {
  const day = dueDay || anchor.getDate();
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const boundary = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= boundary) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const occurrence = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day, lastDay));
    if (occurrence >= anchor && occurrence >= start && occurrence <= end) out.push(occurrence);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
}

function addYearly(anchor, start, end, out) {
  for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
    const lastDay = new Date(year, anchor.getMonth() + 1, 0).getDate();
    const occurrence = new Date(year, anchor.getMonth(), Math.min(anchor.getDate(), lastDay));
    if (occurrence >= anchor && occurrence >= start && occurrence <= end) out.push(occurrence);
  }
}

/** Devuelve las fechas concretas en que `item` (con .date y .frequency) ocurre dentro de [start, end]. */
export function getOccurrencesInRange(item, start, end) {
  const anchor = parseFlexibleDate(item.date);
  const occurrences = [];
  if (Number.isNaN(anchor.getTime()) || anchor > end) return occurrences;

  switch (item.frequency) {
    case 'weekly':
      addPeriodic(anchor, 7, start, end, occurrences);
      break;
    case 'biweekly':
      addPeriodic(anchor, 14, start, end, occurrences);
      break;
    case 'monthly':
      addMonthly(anchor, item.dueDay, start, end, occurrences);
      break;
    case 'yearly':
      addYearly(anchor, start, end, occurrences);
      break;
    case 'custom': {
      const intervalDays = item.customRule?.intervalDays;
      if (intervalDays > 0) addPeriodic(anchor, intervalDays, start, end, occurrences);
      else if (anchor >= start && anchor <= end) occurrences.push(new Date(anchor));
      break;
    }
    default:
      if (anchor >= start && anchor <= end) occurrences.push(new Date(anchor));
  }

  return occurrences;
}
