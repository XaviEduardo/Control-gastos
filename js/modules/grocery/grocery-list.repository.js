import State from '../../core/state.js';
import { generateId } from '../../core/id.js';
import { toISODate } from '../../core/dates.js';
import GroceryListItemRepository from './grocery-list-item.repository.js';

const COLLECTION = 'groceryLists';

function list() {
  return State.getCollection(COLLECTION);
}

function getById(id) {
  return list().find((l) => l.id === id);
}

function create(data) {
  const now = new Date().toISOString();
  const groceryList = {
    id: generateId(),
    name: data.name.trim(),
    startDate: data.startDate,
    weekNumber: null,
    status: 'open',
    budget: data.budget !== undefined && data.budget !== '' ? Number(data.budget) : null,
    notes: (data.notes || '').trim(),
    linkedExpenseId: null,
    activeBranchId: null,
    createdAt: now,
    updatedAt: now,
  };
  State.setCollection(COLLECTION, [...list(), groceryList]);
  return groceryList;
}

function update(id, patch) {
  const now = new Date().toISOString();
  const items = list().map((l) => (l.id === id ? { ...l, ...patch, updatedAt: now } : l));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function remove(id) {
  State.setCollection(COLLECTION, list().filter((l) => l.id !== id));
  GroceryListItemRepository.removeByListId(id);
}

// V2-5 (ver docs/v2-roadmap.md): "Repetir último mandado" — clona `sourceId` en una lista
// NUEVA (id nuevo, sin tocar la original) con sus items. `create()` YA garantiza `status:
// 'open'`, `linkedExpenseId: null` y `activeBranchId: null` sin importar qué se le pase — la
// lista siempre nace abierta y limpia. `GroceryListItemRepository.create()` YA garantiza
// `purchased: false`, `actualPrice: null`, `selectedStoreId/selectedBranchId: null` para cada
// item por el mismo motivo — no clona compra/precio real/sucursal fijada, solo la composición
// (variante, cantidad, categoría, precio estimado, notas). Nunca genera ninguna
// PriceObservation (no toca `prices` en absoluto). Devuelve `null` si `sourceId` no existe.
function duplicate(sourceId) {
  const source = getById(sourceId);
  if (!source) return null;

  const clone = create({
    name: `${source.name} (copia)`,
    startDate: toISODate(new Date()),
    budget: source.budget,
    notes: '',
  });

  GroceryListItemRepository.forList(sourceId).forEach((item) => {
    GroceryListItemRepository.create({
      groceryListId: clone.id,
      productId: item.productId,
      productVariantId: item.productVariantId,
      categoryId: item.categoryId,
      quantity: item.quantity,
      unit: item.unit,
      estimatedPrice: item.estimatedPrice,
      notes: item.notes,
    });
  });

  return clone;
}

export default { list, getById, create, update, remove, duplicate };
