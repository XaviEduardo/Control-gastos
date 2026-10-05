import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'movementTemplates';

function all() {
  return State.getCollection(COLLECTION);
}

function list({ type } = {}) {
  const items = all();
  return type ? items.filter((template) => template.type === type) : items;
}

function getById(id) {
  return all().find((template) => template.id === id);
}

function normalize(data) {
  return {
    type: data.type,
    name: data.name.trim(),
    description: data.description.trim(),
    amount: data.amount !== undefined && data.amount !== '' ? Number(data.amount) : null,
    incomeTypeId: data.type === 'income' ? data.incomeTypeId : null,
    categoryId: data.type === 'expense' ? data.categoryId : null,
    frequency: data.frequency || 'once',
    weekday: data.weekday !== undefined && data.weekday !== '' ? Number(data.weekday) : null,
    dueDay: data.dueDay !== undefined && data.dueDay !== '' ? Number(data.dueDay) : null,
    intervalDays: data.frequency === 'custom' ? Number(data.intervalDays) || 30 : null,
    paymentMethod: data.type === 'expense' ? (data.paymentMethod || '').trim() : '',
    notes: (data.notes || '').trim(),
  };
}

function create(data) {
  const now = new Date().toISOString();
  const template = {
    id: generateId(),
    ...normalize(data),
    createdAt: now,
    updatedAt: now,
  };
  State.setCollection(COLLECTION, [...all(), template]);
  return template;
}

function update(id, data) {
  const now = new Date().toISOString();
  const items = all().map((template) => (template.id === id
    ? { ...template, ...normalize(data), updatedAt: now }
    : template));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function remove(id) {
  State.setCollection(COLLECTION, all().filter((template) => template.id !== id));
}

export default { list, getById, create, update, remove };
