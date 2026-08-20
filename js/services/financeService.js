// Única fuente de verdad para cálculos financieros. La UI consume estas funciones y nunca
// reimplementa sumas/balances por su cuenta (ver docs/architecture.md, docs/decisions.md).

import State from '../core/state.js';
import { getOccurrencesInRange } from './recurrenceService.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseFlexibleDate } from '../core/dates.js';

/** Resuelve un `period` ({type:'week'|'month'|'year', date}) a [inicio, fin]. Reutilizable por
 * cualquier módulo que necesite el mismo rango que usan los totales (evita reimplementar fechas). */
export function getPeriodRange(period) {
  const date = period?.date ? parseFlexibleDate(period.date) : new Date();
  switch (period?.type) {
    case 'week':
      return [startOfWeek(date), endOfWeek(date)];
    case 'year':
      return [startOfYear(date.getFullYear()), endOfYear(date.getFullYear())];
    case 'month':
    default:
      return [startOfMonth(date.getFullYear(), date.getMonth()), endOfMonth(date.getFullYear(), date.getMonth())];
  }
}

function sumOccurrences(items, start, end) {
  return items.reduce((sum, item) => {
    const occurrences = getOccurrencesInRange(item, start, end);
    return sum + occurrences.length * (Number(item.amount) || 0);
  }, 0);
}

export function totalIncome(period) {
  const [start, end] = getPeriodRange(period);
  return sumOccurrences(State.getCollection('incomes'), start, end);
}

export function totalExpenses(period) {
  const [start, end] = getPeriodRange(period);
  return sumOccurrences(State.getCollection('expenses'), start, end);
}

export function balance(period) {
  return totalIncome(period) - totalExpenses(period);
}

export function expensesByCategory(period) {
  const [start, end] = getPeriodRange(period);
  const totals = new Map();
  State.getCollection('expenses').forEach((expense) => {
    const occurrences = getOccurrencesInRange(expense, start, end);
    if (!occurrences.length) return;
    const amount = occurrences.length * (Number(expense.amount) || 0);
    totals.set(expense.categoryId, (totals.get(expense.categoryId) || 0) + amount);
  });
  const categories = State.getCollection('expenseCategories');
  const result = categories.map((category) => ({
    category,
    total: totals.get(category.id) || 0,
  }));
  // Un categoryId que ya no corresponde a ninguna categoría (dato huérfano/corrupto — las
  // categorías nunca se eliminan físicamente en flujos normales) NO debe desaparecer del
  // desglose: se agrupa en "Sin categoría" para que la suma siga coincidiendo con totalExpenses().
  const knownIds = new Set(categories.map((c) => c.id));
  const orphanTotal = [...totals.entries()].reduce((sum, [id, amount]) => (knownIds.has(id) ? sum : sum + amount), 0);
  if (orphanTotal > 0) {
    result.push({ category: { id: null, name: 'Sin categoría', icon: '❓', status: 'active' }, total: orphanTotal });
  }
  return result;
}

/** Total gastado en UNA categoría específica dentro del periodo (0 si no hay movimientos). */
export function categoryExpenseTotal(categoryId, period) {
  const entry = expensesByCategory(period).find((e) => e.category.id === categoryId);
  return entry ? entry.total : 0;
}

/** Periodo inmediatamente anterior al dado (mismo tipo: semana/mes/año). Útil para comparativas. */
export function previousPeriod(period) {
  const date = period?.date ? parseFlexibleDate(period.date) : new Date();
  if (period?.type === 'week') {
    const d = new Date(date);
    d.setDate(d.getDate() - 7);
    return { type: 'week', date: d };
  }
  if (period?.type === 'year') {
    return { type: 'year', date: new Date(date.getFullYear() - 1, 0, 1) };
  }
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return { type: 'month', date: d };
}

/** Total gastado en la categoría "Mandado" en el periodo, o null si esa categoría no existe. */
export function mandadoTotal(period) {
  const entry = expensesByCategory(period).find((b) => b.category.name.trim().toLowerCase() === 'mandado');
  return entry ? entry.total : null;
}

export function incomeByType(period) {
  const [start, end] = getPeriodRange(period);
  const totals = new Map();
  State.getCollection('incomes').forEach((income) => {
    const occurrences = getOccurrencesInRange(income, start, end);
    if (!occurrences.length) return;
    const amount = occurrences.length * (Number(income.amount) || 0);
    totals.set(income.incomeTypeId, (totals.get(income.incomeTypeId) || 0) + amount);
  });
  const types = State.getCollection('incomeTypes');
  const result = types.map((type) => ({
    type,
    total: totals.get(type.id) || 0,
  }));
  // Mismo criterio que expensesByCategory: un incomeTypeId huérfano no debe desaparecer del
  // desglose, para que la suma siga coincidiendo con totalIncome().
  const knownIds = new Set(types.map((t) => t.id));
  const orphanTotal = [...totals.entries()].reduce((sum, [id, amount]) => (knownIds.has(id) ? sum : sum + amount), 0);
  if (orphanTotal > 0) {
    result.push({ type: { id: null, name: 'Sin tipo', icon: '❓', status: 'active' }, total: orphanTotal });
  }
  return result;
}
