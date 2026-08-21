// CRUD de ProductVariant (V2-1, ver docs/v2-data-model.md): el SKU real que efectivamente se
// compra (marca+presentación+unidad de compra). `Product` sigue siendo el concepto general;
// nunca se elimina físicamente una variante, solo se desactiva (mismo criterio que Product/
// Store/categorías — ver docs/decisions.md).

import State from '../../core/state.js';
import { generateId } from '../../core/id.js';

const COLLECTION = 'productVariants';

function list({ includeInactive = true } = {}) {
  const items = State.getCollection(COLLECTION);
  return includeInactive ? items : items.filter((v) => v.status === 'active');
}

function forProduct(productId, { includeInactive = true } = {}) {
  return list({ includeInactive }).filter((v) => v.productId === productId);
}

function getById(id) {
  return list().find((v) => v.id === id);
}

function create(data) {
  const variant = {
    id: generateId(),
    productId: data.productId,
    brand: (data.brand || '').trim(),
    name: (data.name || '').trim(),
    presentationAmount: data.presentationAmount !== undefined && data.presentationAmount !== '' ? Number(data.presentationAmount) : null,
    presentationUnit: data.presentationUnit || null,
    purchaseUnit: data.purchaseUnit || 'pza',
    notes: (data.notes || '').trim(),
    // V2-6: sugerencia opcional, nunca obligatoria — se fija por separado (ver "Preferir
    // sucursal..." en products.module.js), no como parte del alta normal de una variante.
    preferredBranchId: data.preferredBranchId || null,
    status: 'active',
  };
  State.setCollection(COLLECTION, [...list(), variant]);
  return variant;
}

// Normaliza los mismos campos que create() cuando vienen en el patch (ej. desde un
// FormData sin procesar) — evita que editar una variante deje `presentationAmount` como
// string en vez de Number, a diferencia de una variante creada o migrada.
function update(id, patch) {
  const normalized = { ...patch };
  if ('brand' in normalized) normalized.brand = (normalized.brand || '').trim();
  if ('name' in normalized) normalized.name = (normalized.name || '').trim();
  if ('presentationAmount' in normalized) {
    normalized.presentationAmount = normalized.presentationAmount !== undefined && normalized.presentationAmount !== ''
      ? Number(normalized.presentationAmount)
      : null;
  }
  if ('notes' in normalized) normalized.notes = (normalized.notes || '').trim();
  const items = list().map((v) => (v.id === id ? { ...v, ...normalized } : v));
  State.setCollection(COLLECTION, items);
  return getById(id);
}

function setStatus(id, status) {
  return update(id, { status });
}

export default { list, forProduct, getById, create, update, setStatus };
