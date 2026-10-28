// Recordatorios de pagos próximos (v1 — aviso dentro de la app, ver docs/decisions.md). Reutiliza
// exactamente la misma lógica de ocurrencias que ya usan Calendario/Mensual
// (recurrenceService#getOccurrencesInRange) y el mismo criterio de "pagado" que
// expense-payment.repository.js — no inventa ningún concepto nuevo de fechas ni de pago.

import ExpenseRepository from '../modules/expenses/expense.repository.js';
import ExpensePaymentRepository from '../modules/expenses/expense-payment.repository.js';
import { getOccurrencesInRange } from './recurrenceService.js';
import { toISODate } from '../core/dates.js';

export const DEFAULT_REMINDERS_DAYS_AHEAD = 7;

/** Ocurrencias de gastos en los próximos `daysAhead` días (desde hoy inclusive) que todavía NO
 * están marcadas como pagadas, ordenadas por fecha ascendente. Mismo patrón que
 * monthly.module.js#monthlyExpenseOccurrences, acotado a un rango desde hoy (en vez de un mes
 * calendario) y filtrando solo las ocurrencias pendientes. */
export function upcomingUnpaidExpenses(daysAhead = DEFAULT_REMINDERS_DAYS_AHEAD) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);

  const rows = [];
  ExpenseRepository.list().forEach((expense) => {
    getOccurrencesInRange(expense, start, end).forEach((occ) => {
      const occurrenceDate = toISODate(occ);
      if (!ExpensePaymentRepository.isPaid(expense.id, occurrenceDate)) {
        rows.push({ expense, occurrenceDate });
      }
    });
  });

  return rows.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
}
