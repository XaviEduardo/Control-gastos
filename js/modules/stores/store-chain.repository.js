// CRUD de StoreChain (V2-2, ver docs/v2-data-model.md): la cadena ("Walmart", "Smart"). Nunca
// se elimina físicamente, solo se desactiva (mismo criterio que Product/Store/categorías —
// ver docs/decisions.md).

import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'storeChains';

function list({ includeInactive = true } = {}) {
  const items = State.getCollection(COLLECTION);
  return includeInactive ? items : items.filter((c) => c.status === 'active');
}

function getById(id) {
  return list().find((c) => c.id === id);
}

function create(data) {
  const chain = {
    id: generateId(),
    name: data.name.trim(),
    notes: (data.notes || '').trim(),
    status: 'active',
  };
  State.setCollection(COLLECTION, [...list(), chain]);
  return chain;
}

function update(id, patch) {
  const normalized = { ...patch };
  if ('name' in normalized) normalized.name = (normalized.name || '').trim();
  if ('notes' in normalized) normalized.notes = (normalized.notes || '').trim();
  const items = list().map((c) => (c.id === id ? { ...c, ...normalized } : c));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function setStatus(id, status) {
  return update(id, { status });
}

export default { list, getById, create, update, setStatus };
