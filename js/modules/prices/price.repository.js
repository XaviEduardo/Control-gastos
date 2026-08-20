// Historial de precios: create() SIEMPRE agrega un registro nuevo, nunca sobrescribe uno
// anterior (requisito explícito). Editar/eliminar están pensados para corregir errores de
// captura puntuales, no para "actualizar" el precio vigente.

import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'prices';

function all() {
  return State.getCollection(COLLECTION);
}

function getById(id) {
  return all().find((p) => p.id === id);
}

function forProduct(productId) {
  return all().filter((p) => p.productId === productId);
}

function create(data) {
  const price = {
    id: generateId(),
    productId: data.productId,
    storeId: data.storeId,
    price: Number(data.price),
    unit: data.unit,
    quantity: Number(data.quantity) || 1,
    date: data.date,
    notes: (data.notes || '').trim(),
    createdAt: new Date().toISOString(),
  };
  State.setCollection(COLLECTION, [...all(), price]);
  return price;
}

function update(id, patch) {
  const items = all().map((p) => (p.id === id ? { ...p, ...patch } : p));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function remove(id) {
  State.setCollection(COLLECTION, all().filter((p) => p.id !== id));
}

export default { all, getById, forProduct, create, update, remove };
