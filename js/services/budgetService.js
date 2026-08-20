// Progreso de presupuesto: SIEMPRE se calcula contra gastos reales existentes (financeService),
// nunca contra un número inventado ni una copia de los movimientos.

import { totalExpenses, mandadoTotal, categoryExpenseTotal } from './financeService.js';

export function spentForBudget(budget, period) {
  switch (budget.scope) {
    case 'monthly':
    case 'weekly':
      return totalExpenses(period);
    case 'grocery':
      return mandadoTotal(period) || 0;
    case 'category':
      return categoryExpenseTotal(budget.categoryId, period);
    default:
      return 0;
  }
}

/** { amount, spent, remaining, percentUsed }. percentUsed es Infinity si el presupuesto
 * es $0 y hubo gasto (excedido sin base para calcular un porcentaje real); 0 si el
 * presupuesto es $0 y no hubo gasto (categoría/periodo sin movimientos). */
export function budgetProgress(budget, period) {
  const amount = Number(budget.amount) || 0;
  const spent = spentForBudget(budget, period);
  const remaining = amount - spent;
  const percentUsed = amount > 0 ? spent / amount : (spent > 0 ? Infinity : 0);
  return { amount, spent, remaining, percentUsed };
}
