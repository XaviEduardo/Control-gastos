import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'groceryListItems';

function all() {
  return State.getCollection(COLLECTION);
}

function getById(id) {
  return all().find((i) => i.id === id);
}

function create(data) {
  const item = {
    id: generateId(),
    groceryListId: data.groceryListId,
    productId: data.productId,
    categoryId: data.categoryId,
    quantity: Number(data.quantity) || 1,
    unit: data.unit || 'pza',
    selectedStoreId: null,
    estimatedPrice: data.estimatedPrice !== undefined && data.estimatedPrice !== '' ? Number(data.estimatedPrice) : null,
    actualPrice: null,
    purchased: false,
    notes: (data.notes || '').trim(),
  };
  State.setCollection(COLLECTION, [...all(), item]);
  return item;
}

function update(id, patch) {
  const items = all().map((item) => (item.id === id ? { ...item, ...patch } : item));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function remove(id) {
  State.setCollection(COLLECTION, all().filter((item) => item.id !== id));
}

function removeByListId(groceryListId) {
  State.setCollection(COLLECTION, all().filter((item) => item.groceryListId !== groceryListId));
}

export default { getById, create, update, remove, removeByListId };
