// "Marcar gasto como pagado" (ver docs/decisions.md): un `Expense` recurrente es UN solo
// registro (nunca se duplica por ocurrencia — regla ya establecida en todo el proyecto), así
// que el estado "pagado" no puede vivir en el propio `Expense`. Cada `ExpensePayment` referencia
// `expenseId` + `occurrenceDate` (string 'YYYY-MM-DD', la fecha concreta de esa ocurrencia —
// para un gasto único, es simplemente su `date`); la presencia de un registro significa
// "pagado", su ausencia "pendiente". `paidDate` es cuándo se pagó de verdad, que puede diferir
// de `occurrenceDate` (fecha esperada).

import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'expensePayments';

function all() {
  return State.getCollection(COLLECTION);
}

function find(expenseId, occurrenceDate) {
  return all().find((p) => p.expenseId === expenseId && p.occurrenceDate === occurrenceDate);
}

function isPaid(expenseId, occurrenceDate) {
  return !!find(expenseId, occurrenceDate);
}

// Upsert: si ya existe un pago para esta ocurrencia, solo actualiza paidDate (nunca duplica).
function markPaid(expenseId, occurrenceDate, paidDate) {
  const existing = find(expenseId, occurrenceDate);
  if (existing) {
    const items = all().map((p) => (p.id === existing.id ? { ...p, paidDate } : p));
    State.setCollection(COLLECTION, items);
    return find(expenseId, occurrenceDate);
  }
  const payment = {
    id: generateId(),
    expenseId,
    occurrenceDate,
    paidDate,
    createdAt: new Date().toISOString(),
  };
  State.setCollection(COLLECTION, [...all(), payment]);
  return payment;
}

function markUnpaid(expenseId, occurrenceDate) {
  State.setCollection(COLLECTION, all().filter((p) => !(p.expenseId === expenseId && p.occurrenceDate === occurrenceDate)));
}

// Limpieza al eliminar un Expense por completo (ver expense.module.js/movement-form.js) — si no,
// quedarían registros de pago huérfanos apuntando a un expenseId que ya no existe.
function removeByExpenseId(expenseId) {
  State.setCollection(COLLECTION, all().filter((p) => p.expenseId !== expenseId));
}

export default { all, find, isPaid, markPaid, markUnpaid, removeByExpenseId };
