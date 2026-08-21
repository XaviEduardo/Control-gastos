// Única fuente de verdad para cálculos de mandado (subtotales, totales, diferencia vs
// presupuesto). La UI de grocery-list.module.js consume esto, nunca recalcula por su cuenta
// (mismo principio que financeService.js).

import State from '../core/state.js';
import ProductVariantRepository from '../modules/grocery/product-variant.repository.js';

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

/** Sucursal "efectiva" de un item, en orden de prioridad (V2-3 + V2-6):
 * 1. `item.selectedBranchId` — el usuario la fijó explícitamente para ESTE item.
 * 2. `list.activeBranchId` — la sesión de compra actual ("dónde estoy comprando ahora").
 * 3. `ProductVariant.preferredBranchId` — sugerencia general del producto ("siempre lo
 *    compro aquí"), el escalón más bajo de prioridad.
 * Puramente derivado (no persiste nada); no participa en ningún subtotal — WEIGHT/UNIT no
 * cambian. Nunca bloquea nada: solo decide qué sucursal SUGERIR/asumir cuando no hay una más
 * específica. */
export function effectiveBranchId(item, list) {
  if (item.selectedBranchId) return item.selectedBranchId;
  if (list?.activeBranchId) return list.activeBranchId;
  const variant = item.productVariantId ? ProductVariantRepository.getById(item.productVariantId) : null;
  return variant?.preferredBranchId || null;
}

// V2-6: "productos habituales" — detección simple, SIN IA, sobre el historial real de listas
// ya cerradas. Un producto es "frecuente" si aparece en al menos `threshold` (80%) de las
// últimas `windowSize` (10) listas cerradas. `minLists` evita falsos positivos cuando todavía
// no hay suficiente historial (con 1 sola lista cerrada, todo lo que contiene sería "100%
// frecuente", una señal sin valor real). Nada de esto se persiste — se recalcula cada vez.
const FREQUENT_WINDOW = 10;
const FREQUENT_THRESHOLD = 0.8;
const FREQUENT_MIN_LISTS = 3;

export function frequentProductIds({ windowSize = FREQUENT_WINDOW, threshold = FREQUENT_THRESHOLD, minLists = FREQUENT_MIN_LISTS } = {}) {
  const closedLists = State.getCollection('groceryLists')
    .filter((l) => l.status === 'closed')
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
    .slice(0, windowSize);

  if (closedLists.length < minLists) return new Set();

  const appearances = new Map();
  closedLists.forEach((closedList) => {
    const productIdsInList = new Set(itemsForList(closedList.id).map((item) => item.productId));
    productIdsInList.forEach((productId) => {
      appearances.set(productId, (appearances.get(productId) || 0) + 1);
    });
  });

  const frequent = new Set();
  appearances.forEach((count, productId) => {
    if (count / closedLists.length >= threshold) frequent.add(productId);
  });
  return frequent;
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
