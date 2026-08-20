import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'stores';

function list({ includeInactive = true } = {}) {
  const items = State.getCollection(COLLECTION);
  return includeInactive ? items : items.filter((s) => s.status === 'active');
}

function getById(id) {
  return list().find((s) => s.id === id);
}

function create(data) {
  const store = {
    id: generateId(),
    name: data.name.trim(),
    location: (data.location || '').trim(),
    notes: (data.notes || '').trim(),
    status: 'active',
  };
  State.setCollection(COLLECTION, [...list(), store]);
  return store;
}

function update(id, patch) {
  const items = list().map((s) => (s.id === id ? { ...s, ...patch } : s));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function setStatus(id, status) {
  return update(id, { status });
}

export default { list, getById, create, update, setStatus };
