// Fábrica de repositorio CRUD reutilizable para colecciones con forma {id, name, icon, status}
// (IncomeType, ExpenseCategory y, en fases posteriores, GroceryCategory/Store).

import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

export function createCategoryRepository(collectionName) {
  function list({ includeInactive = true } = {}) {
    const items = State.getCollection(collectionName);
    return includeInactive ? items : items.filter((item) => item.status === 'active');
  }

  function create({ name, icon = '' }) {
    const item = { id: generateId(), name: name.trim(), icon, status: 'active' };
    State.setCollection(collectionName, [...list(), item]);
    return item;
  }

  function update(id, { name, icon }) {
    const items = list().map((item) => (item.id === id
      ? { ...item, name: name !== undefined ? name.trim() : item.name, icon: icon !== undefined ? icon : item.icon }
      : item));
    State.setCollection(collectionName, items);
  }

  function setStatus(id, status) {
    const items = list().map((item) => (item.id === id ? { ...item, status } : item));
    State.setCollection(collectionName, items);
  }

  return { list, create, update, setStatus };
}
