import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'groceryProducts';

function list({ includeInactive = true } = {}) {
  const items = State.getCollection(COLLECTION);
  return includeInactive ? items : items.filter((p) => p.status === 'active');
}

function getById(id) {
  return list().find((p) => p.id === id);
}

function findByName(name, { includeInactive = true } = {}) {
  const normalized = (name || '').trim().toLowerCase();
  if (!normalized) return undefined;
  return list({ includeInactive }).find((p) => p.name.trim().toLowerCase() === normalized);
}

function create(data) {
  const product = {
    id: generateId(),
    name: data.name.trim(),
    categoryId: data.categoryId,
    preferredUnit: data.preferredUnit || 'pza',
    notes: (data.notes || '').trim(),
    status: 'active',
  };
  State.setCollection(COLLECTION, [...list(), product]);
  return product;
}

function update(id, patch) {
  const items = list().map((p) => (p.id === id ? { ...p, ...patch } : p));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function setStatus(id, status) {
  return update(id, { status });
}

export default { list, getById, findByName, create, update, setStatus };
