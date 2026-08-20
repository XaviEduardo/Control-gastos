import State from '../../core/state.js';
import { generateId } from '../../core/id.js';
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

export default { list, getById, create, update, remove };
