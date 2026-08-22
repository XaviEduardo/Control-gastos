// CRUD de StoreBranch (V2-2, ver docs/v2-data-model.md): la sucursal real donde se compra y se
// registra un precio (ej. "Walmart Ejército Nacional"). Nunca se elimina físicamente, solo se
// desactiva (mismo criterio que Product/Store/categorías — ver docs/decisions.md).
// `js/modules/stores/store.repository.js` (legacy) delega en esta misma colección — ver ese
// archivo para el porqué.

import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'storeBranches';

function list({ includeInactive = true } = {}) {
  const items = State.getCollection(COLLECTION);
  return includeInactive ? items : items.filter((b) => b.status === 'active');
}

function forChain(chainId, { includeInactive = true } = {}) {
  return list({ includeInactive }).filter((b) => b.chainId === chainId);
}

function getById(id) {
  return list().find((b) => b.id === id);
}

function create(data) {
  const branch = {
    id: generateId(),
    chainId: data.chainId,
    name: data.name.trim(),
    location: (data.location || '').trim(),
    notes: (data.notes || '').trim(),
    status: 'active',
  };
  State.setCollection(COLLECTION, [...list(), branch]);
  return branch;
}

function update(id, patch) {
  const normalized = { ...patch };
  if ('name' in normalized) normalized.name = (normalized.name || '').trim();
  if ('location' in normalized) normalized.location = (normalized.location || '').trim();
  if ('notes' in normalized) normalized.notes = (normalized.notes || '').trim();
  const items = list().map((b) => (b.id === id ? { ...b, ...normalized } : b));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function setStatus(id, status) {
  return update(id, { status });
}

export default { list, forChain, getById, create, update, setStatus };
