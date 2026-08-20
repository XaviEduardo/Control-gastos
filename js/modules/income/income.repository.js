import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'incomes';

function list() {
  return State.getCollection(COLLECTION);
}

function getById(id) {
  return list().find((item) => item.id === id);
}

function create(data) {
  const now = new Date().toISOString();
  const income = {
    id: generateId(),
    description: data.description.trim(),
    incomeTypeId: data.incomeTypeId,
    amount: Number(data.amount),
    date: data.date,
    frequency: data.frequency || 'once',
    customRule: data.frequency === 'custom' ? { intervalDays: Number(data.intervalDays) || 30 } : undefined,
    notes: (data.notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  State.setCollection(COLLECTION, [...list(), income]);
  return income;
}

function update(id, data) {
  const now = new Date().toISOString();
  const items = list().map((item) => (item.id === id ? {
    ...item,
    description: data.description.trim(),
    incomeTypeId: data.incomeTypeId,
    amount: Number(data.amount),
    date: data.date,
    frequency: data.frequency || 'once',
    customRule: data.frequency === 'custom' ? { intervalDays: Number(data.intervalDays) || 30 } : undefined,
    notes: (data.notes || '').trim(),
    updatedAt: now,
  } : item));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function remove(id) {
  State.setCollection(COLLECTION, list().filter((item) => item.id !== id));
}

function duplicate(id) {
  const original = getById(id);
  if (!original) return null;
  const now = new Date().toISOString();
  const copy = { ...original, id: generateId(), description: `${original.description} (copia)`, createdAt: now, updatedAt: now };
  State.setCollection(COLLECTION, [...list(), copy]);
  return copy;
}

export default { list, getById, create, update, remove, duplicate };
