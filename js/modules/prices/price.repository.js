// Historial de precios: create() SIEMPRE agrega un registro nuevo, nunca sobrescribe uno
// anterior (requisito explícito). Editar/eliminar están pensados para corregir errores de
// captura puntuales, no para "actualizar" el precio vigente.

import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'prices';

function all() {
  return State.getCollection(COLLECTION);
}

function getById(id) {
  return all().find((p) => p.id === id);
}

function forProduct(productId) {
  return all().filter((p) => p.productId === productId);
}

/** V2-4: la PriceObservation generada automáticamente por una compra (ver
 * js/services/purchaseObservationService.js) queda vinculada a su `GroceryListItem` de origen
 * — este lookup es la clave de deduplicación (nunca crear una segunda observación para el
 * mismo item, siempre actualizar la existente). */
function findByGroceryListItemId(groceryListItemId) {
  return all().find((p) => p.groceryListItemId === groceryListItemId);
}

function create(data) {
  const price = {
    id: generateId(),
    productId: data.productId,
    productVariantId: data.productVariantId || null,
    storeId: data.storeId,
    // V2-2: `branchId` es el campo real hacia adelante; `storeId` (el <select> de
    // price-form.js, sin cambios en esta fase) ya lista StoreBranch de forma transparente vía
    // el StoreRepository-compatibilidad, así que ambos apuntan al mismo id — se deriva de
    // `storeId` cuando no se pasa explícito (ver docs/v2-migration-plan.md).
    branchId: data.branchId || data.storeId || null,
    price: Number(data.price),
    unit: data.unit,
    quantity: Number(data.quantity) || 1,
    date: data.date,
    notes: (data.notes || '').trim(),
    // V2-4: 'purchase' | 'manual' | 'external'. Toda captura antes de V2-4 fue manual — mismo
    // default aquí que en el backfill de la migración (ver storage.js#migrateV4ToV5).
    source: data.source || 'manual',
    groceryListItemId: data.groceryListItemId || null,
    createdAt: new Date().toISOString(),
  };
  State.setCollection(COLLECTION, [...all(), price]);
  return price;
}

// Mismo criterio que grocery-list-item.repository.js#update(): si el patch fija `storeId` sin
// fijar también `branchId`, se mantiene sincronizado con el mismo valor.
function update(id, patch) {
  const normalized = { ...patch };
  if ('storeId' in normalized && !('branchId' in normalized)) {
    normalized.branchId = normalized.storeId;
  }
  const items = all().map((p) => (p.id === id ? { ...p, ...normalized } : p));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function remove(id) {
  State.setCollection(COLLECTION, all().filter((p) => p.id !== id));
}

export default { all, getById, forProduct, findByGroceryListItemId, create, update, remove };
