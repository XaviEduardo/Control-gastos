import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'groceryListItems';

function all() {
  return State.getCollection(COLLECTION);
}

function getById(id) {
  return all().find((i) => i.id === id);
}

function forList(groceryListId) {
  return all().filter((i) => i.groceryListId === groceryListId);
}

function create(data) {
  const item = {
    id: generateId(),
    groceryListId: data.groceryListId,
    productId: data.productId,
    productVariantId: data.productVariantId || null,
    categoryId: data.categoryId,
    quantity: Number(data.quantity) || 1,
    unit: data.unit || 'pza',
    selectedStoreId: null,
    selectedBranchId: null,
    estimatedPrice: data.estimatedPrice !== undefined && data.estimatedPrice !== '' ? Number(data.estimatedPrice) : null,
    actualPrice: null,
    purchased: false,
    notes: (data.notes || '').trim(),
  };
  State.setCollection(COLLECTION, [...all(), item]);
  return item;
}

// V2-2: si el patch fija `selectedStoreId` (ej. "Usar esta tienda" del Comparador, que todavía
// no se tocó en esta fase) sin fijar también `selectedBranchId`, se mantiene sincronizado con
// el mismo valor — misma sucursal, dos nombres de campo durante la transición (ver
// docs/v2-migration-plan.md). Evita que llamadores no actualizados dejen `selectedBranchId`
// desincronizado.
function update(id, patch) {
  const normalized = { ...patch };
  if ('selectedStoreId' in normalized && !('selectedBranchId' in normalized)) {
    normalized.selectedBranchId = normalized.selectedStoreId;
  }
  const items = all().map((item) => (item.id === id ? { ...item, ...normalized } : item));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function remove(id) {
  State.setCollection(COLLECTION, all().filter((item) => item.id !== id));
}

function removeByListId(groceryListId) {
  State.setCollection(COLLECTION, all().filter((item) => item.groceryListId !== groceryListId));
}

export default { getById, forList, create, update, remove, removeByListId };
