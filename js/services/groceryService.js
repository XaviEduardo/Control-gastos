// Única fuente de verdad para cálculos de mandado (subtotales, totales, diferencia vs
// presupuesto). La UI de grocery-list.module.js consume esto, nunca recalcula por su cuenta
// (mismo principio que financeService.js).

import State from '../core/state.js';

export function itemsForList(listId) {
  return State.getCollection('groceryListItems').filter((item) => item.groceryListId === listId);
}

function effectivePrice(item) {
  if (item.actualPrice !== null && item.actualPrice !== undefined && item.actualPrice !== '') {
    return Number(item.actualPrice) || 0;
  }
  return Number(item.estimatedPrice) || 0;
}

export function itemEstimatedSubtotal(item) {
  return (Number(item.quantity) || 0) * (Number(item.estimatedPrice) || 0);
}

export function itemRealSubtotal(item) {
  return (Number(item.quantity) || 0) * (Number(item.actualPrice) || 0);
}

export function itemEffectiveSubtotal(item) {
  return (Number(item.quantity) || 0) * effectivePrice(item);
}

/** Totales por categoría dentro de una lista. Incluye toda categoría con al menos un
 * producto, aunque todavía no tenga precio capturado (nunca oculta productos sin precio). */
export function categoryTotals(listId) {
  const items = itemsForList(listId);
  const totals = new Map();

  items.forEach((item) => {
    const prev = totals.get(item.categoryId) || { estimated: 0, real: 0, effective: 0, count: 0 };
    prev.estimated += itemEstimatedSubtotal(item);
    prev.real += itemRealSubtotal(item);
    prev.effective += itemEffectiveSubtotal(item);
    prev.count += 1;
    totals.set(item.categoryId, prev);
  });

  return State.getCollection('groceryCategories')
    .map((category) => ({ category, ...(totals.get(category.id) || { estimated: 0, real: 0, effective: 0, count: 0 }) }))
    .filter((entry) => entry.count > 0);
}

export function listTotals(list) {
  const items = itemsForList(list.id);
  const estimated = items.reduce((sum, item) => sum + itemEstimatedSubtotal(item), 0);
  const real = items.reduce((sum, item) => sum + itemRealSubtotal(item), 0);
  const budget = list.budget !== null && list.budget !== undefined ? Number(list.budget) : null;
  const difference = budget !== null ? budget - real : null;

  return {
    estimated,
    real,
    budget,
    difference,
    itemCount: items.length,
    purchasedCount: items.filter((item) => item.purchased).length,
  };
}
