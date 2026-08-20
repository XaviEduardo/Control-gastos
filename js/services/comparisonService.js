// Única fuente de verdad para el comparador de precios (Nivel 1: producto individual;
// Nivel 2: mandado completo). Nunca inventa precios: si una tienda no tiene un precio
// registrado y compatible para un producto, ese producto se excluye explícitamente para
// esa tienda (ver docs/decisions.md).

import State from '../core/state.js';
import { parseFlexibleDate } from '../core/dates.js';
import { itemsForList } from './groceryService.js';
import { normalizePrice, getUnitDimension, getBaseQuantity } from './priceService.js';

function activeStores() {
  return State.getCollection('stores').filter((s) => s.status === 'active');
}

/** Precio más reciente registrado para un producto en una tienda, o null si no existe. */
function latestPriceEntry(productId, storeId) {
  const entries = State.getCollection('prices').filter((p) => p.productId === productId && p.storeId === storeId);
  if (!entries.length) return null;
  return entries.reduce((latest, entry) => (
    !latest || parseFlexibleDate(entry.date) > parseFlexibleDate(latest.date) ? entry : latest
  ), null);
}

/** NIVEL 1 — Compara el precio más reciente de un producto entre todas las tiendas activas
 * que tengan un precio registrado. Agrupa por dimensión de unidad: nunca mezcla, por
 * ejemplo, un precio por litro con uno por pieza. */
export function compareProductAcrossStores(productId) {
  const entries = activeStores()
    .map((store) => {
      const priceEntry = latestPriceEntry(productId, store.id);
      if (!priceEntry) return null;
      const normalized = normalizePrice(priceEntry.price, priceEntry.quantity, priceEntry.unit);
      if (!normalized) return null;
      return { store, priceEntry, normalized };
    })
    .filter(Boolean);

  const groups = new Map();
  entries.forEach((entry) => {
    const dim = entry.normalized.dimension;
    if (!groups.has(dim)) groups.set(dim, []);
    groups.get(dim).push(entry);
  });

  return [...groups.entries()].map(([dimension, group]) => {
    const sorted = [...group].sort((a, b) => a.normalized.pricePerBaseUnit - b.normalized.pricePerBaseUnit);
    const best = sorted[0];
    return {
      dimension,
      baseUnit: best.normalized.baseUnit,
      entries: sorted.map((entry) => ({
        store: entry.store,
        priceEntry: entry.priceEntry,
        normalized: entry.normalized,
        isBest: entry === best,
        differenceVsBest: entry.normalized.pricePerBaseUnit - best.normalized.pricePerBaseUnit,
      })),
    };
  });
}

/** Costo de UN item de una lista si se comprara en `storeId`, usando el precio más
 * reciente registrado ahí. null si no hay precio, o si la presentación registrada no es
 * de la misma dimensión que la unidad que necesita el item (no se puede inferir). */
function costForItemAtStore(item, storeId) {
  const priceEntry = latestPriceEntry(item.productId, storeId);
  if (!priceEntry) return null;
  const normalized = normalizePrice(priceEntry.price, priceEntry.quantity, priceEntry.unit);
  if (!normalized) return null;
  if (getUnitDimension(item.unit) !== normalized.dimension) return null;
  const baseQuantityNeeded = getBaseQuantity(item.quantity, item.unit);
  if (baseQuantityNeeded === null) return null;
  return { cost: normalized.pricePerBaseUnit * baseQuantityNeeded, priceEntry, normalized };
}

/** NIVEL 2 — Compara una lista de mandado completa entre tiendas: costo de comprar todo
 * en cada tienda (con cobertura parcial explícita) y la compra optimizada (mejor tienda
 * por producto). */
export function compareListAcrossStores(listId) {
  const items = itemsForList(listId);
  const stores = activeStores();

  const perItem = items.map((item) => ({
    item,
    options: stores
      .map((store) => {
        const result = costForItemAtStore(item, store.id);
        return result ? { store, ...result } : null;
      })
      .filter(Boolean),
  }));

  const comparableItems = perItem.filter((entry) => entry.options.length > 0);
  const unavailableItems = perItem.filter((entry) => entry.options.length === 0).map((entry) => entry.item);

  const storeTotals = stores
    .map((store) => {
      let total = 0;
      let covered = 0;
      comparableItems.forEach(({ options }) => {
        const match = options.find((o) => o.store.id === store.id);
        if (match) { total += match.cost; covered += 1; }
      });
      return { store, total, covered, missing: comparableItems.length - covered };
    })
    .filter((entry) => entry.covered > 0)
    .sort((a, b) => (b.covered - a.covered) || (a.total - b.total));

  const bestSingleStore = storeTotals[0] || null;
  const bestSingleStoreFullCoverage = (bestSingleStore && bestSingleStore.covered === comparableItems.length)
    ? bestSingleStore
    : null;

  const optimized = comparableItems.map(({ item, options }) => {
    const best = [...options].sort((a, b) => a.cost - b.cost)[0];
    const pricePerItemUnit = best.normalized.pricePerBaseUnit * getBaseQuantity(1, item.unit);
    return {
      item, store: best.store, cost: best.cost, priceEntry: best.priceEntry, normalized: best.normalized, pricePerItemUnit,
    };
  });
  const optimizedTotal = optimized.reduce((sum, entry) => sum + entry.cost, 0);

  const potentialSavings = bestSingleStoreFullCoverage
    ? bestSingleStoreFullCoverage.total - optimizedTotal
    : null;

  return {
    comparableCount: comparableItems.length,
    totalItemCount: items.length,
    unavailableItems,
    storeTotals,
    bestSingleStore,
    bestSingleStoreFullCoverage,
    optimized,
    optimizedTotal,
    potentialSavings,
  };
}
