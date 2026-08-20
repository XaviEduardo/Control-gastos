// Budget: monto objetivo permanente por rubro (no atado a un mes/semana específico —
// ver docs/decisions.md). upsert() garantiza como máximo un registro por scope (y por
// categoryId cuando scope='category'), evitando presupuestos duplicados para el mismo rubro.

import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'budgets';

function list() {
  return State.getCollection(COLLECTION);
}

function find(scope, categoryId = null) {
  return list().find((b) => b.scope === scope && (scope !== 'category' || b.categoryId === categoryId));
}

function upsert(scope, amount, categoryId = null) {
  const now = new Date().toISOString();
  const normalizedAmount = Number(amount) || 0;
  const existing = find(scope, categoryId);

  if (existing) {
    const items = list().map((b) => (b.id === existing.id ? { ...b, amount: normalizedAmount, updatedAt: now } : b));
    State.setCollection(COLLECTION, items);
    return find(scope, categoryId);
  }

  const budget = {
    id: generateId(),
    scope,
    categoryId: scope === 'category' ? categoryId : null,
    amount: normalizedAmount,
    createdAt: now,
    updatedAt: now,
  };
  State.setCollection(COLLECTION, [...list(), budget]);
  return budget;
}

function remove(id) {
  State.setCollection(COLLECTION, list().filter((b) => b.id !== id));
}

export default { list, find, upsert, remove };
