// Formulario "Registrar/Editar precio" (V2-1: extraído de price-history.module.js — refactor
// puro, ver docs/v2-roadmap.md V2-9). El selector de esta pantalla sigue siendo por Product
// (no se rediseña la UX de Historial en esta fase, ver docs/v2-roadmap.md V2-1); cuando el
// producto tiene exactamente una variante activa (el caso migrado/típico) el precio se estampa
// también con `productVariantId` sin ambigüedad — con varias variantes se deja sin estampar en
// vez de adivinar cuál.

import ProductRepository from '../grocery/product.repository.js';
import ProductVariantRepository from '../grocery/product-variant.repository.js';
import StoreRepository from '../stores/store.repository.js';
import PriceRepository from './price.repository.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { toISODate } from '../../core/dates.js';
import { isRequired, isPositiveNumber, isValidDate, validate, escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from '../grocery/units.js';

/** Resuelve la variante a estampar en un precio nuevo capturado por producto (no por
 * variante): solo si hay EXACTAMENTE una variante activa, para no adivinar entre varias. */
function unambiguousVariantId(productId) {
  const variants = ProductVariantRepository.forProduct(productId, { includeInactive: false });
  return variants.length === 1 ? variants[0].id : null;
}

/** Abre el modal de registrar/editar precio. `defaultProductId` es el producto actualmente
 * seleccionado en la pantalla (usado solo para un registro nuevo; al editar se usa
 * `existing.productId`). `onSaved()` se invoca tras guardar con éxito. */
export function openPriceForm({ existing, defaultProductId, onSaved } = {}) {
  const stores = StoreRepository.list({ includeInactive: false });
  // Si se edita un registro cuya tienda fue desactivada después, debe seguir apareciendo
  // como opción (si no, el <select> cae al primer valor y reasigna el precio a otra
  // tienda al guardar, o el formulario ni siquiera se puede abrir si no quedan activas).
  if (existing?.storeId && !stores.some((s) => s.id === existing.storeId)) {
    const currentStore = StoreRepository.getById(existing.storeId);
    if (currentStore) stores.push(currentStore);
  }
  if (!stores.length) {
    showToast('Primero agrega una tienda desde Mandado > Tiendas.', { type: 'error' });
    return;
  }

  // Contexto de solo lectura — el producto no es editable aquí, ya está fijado por el
  // selector de la página (o por el registro existente); deja explícita la relación
  // Producto + Presentación + Tienda + Precio + Fecha que pide el rediseño.
  const contextProductId = existing?.productId || defaultProductId;
  const contextProductName = ProductRepository.getById(contextProductId)?.name || 'Producto eliminado';

  const formId = `price-form-${Date.now()}`;
  const form = document.createElement('form');
  form.id = formId;
  form.className = 'form-grid';
  form.innerHTML = `
    <div class="flex items-center gap-sm">
      <span class="text-muted">Producto</span>
      <span class="card-title">${escapeHtml(contextProductName)}</span>
    </div>
    <div>
      <label for="${formId}-store">Tienda</label>
      <select id="${formId}-store" name="storeId">${stores.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
    </div>
    <div class="form-row">
      <div>
        <label for="${formId}-quantity">Cantidad (presentación)</label>
        <input type="number" id="${formId}-quantity" name="quantity" min="0" step="0.01" required value="${existing?.quantity ?? 1}">
      </div>
      <div>
        <label for="${formId}-unit">Unidad</label>
        <select id="${formId}-unit" name="unit">${UNIT_OPTIONS.map((u) => `<option value="${u.value}">${u.label}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row">
      <div>
        <label for="${formId}-price">Precio</label>
        <input type="number" id="${formId}-price" name="price" min="0" step="0.01" required value="${existing?.price ?? ''}">
      </div>
      <div>
        <label for="${formId}-date">Fecha</label>
        <input type="date" id="${formId}-date" name="date" required value="${existing?.date || toISODate(new Date())}">
      </div>
    </div>
    <div>
      <label for="${formId}-notes">Notas (opcional)</label>
      <input type="text" id="${formId}-notes" name="notes" value="${escapeHtml(existing?.notes || '')}">
    </div>
    <p class="form-error hidden"></p>
  `;

  const storeSelect = form.querySelector(`#${formId}-store`);
  if (existing?.storeId) storeSelect.value = existing.storeId;
  const unitSelect = form.querySelector(`#${formId}-unit`);
  unitSelect.value = existing?.unit || 'l';

  const footer = document.createElement('div');
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--ghost';
  cancelBtn.textContent = 'Cancelar';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn btn--primary';
  saveBtn.setAttribute('form', formId);
  saveBtn.textContent = existing ? 'Guardar cambios' : 'Registrar precio';
  footer.append(cancelBtn, saveBtn);

  const modal = openModal({ title: existing ? 'Editar precio' : 'Registrar precio', content: form, footer });
  cancelBtn.addEventListener('click', () => modal.close());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const storeId = data.get('storeId');
    const quantity = data.get('quantity');
    const unit = data.get('unit');
    const price = data.get('price');
    const date = data.get('date');
    const notes = data.get('notes');

    const { valid, errors } = validate([
      { valid: isRequired(storeId), message: 'Selecciona una tienda.' },
      { valid: isPositiveNumber(quantity), message: 'La cantidad debe ser mayor a 0.' },
      { valid: isPositiveNumber(price), message: 'El precio debe ser mayor a 0.' },
      { valid: isValidDate(date), message: 'La fecha no es válida.' },
    ]);
    const errorEl = form.querySelector('.form-error');
    if (!valid) {
      errorEl.textContent = errors.join(' ');
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    if (existing) {
      PriceRepository.update(existing.id, {
        storeId,
        quantity: Number(quantity),
        unit,
        price: Number(price),
        date,
        notes: (notes || '').trim(),
      });
    } else {
      PriceRepository.create({
        productId: contextProductId,
        productVariantId: unambiguousVariantId(contextProductId),
        storeId,
        quantity,
        unit,
        price,
        date,
        notes,
        source: 'manual',
      });
    }

    modal.close();
    showToast(existing ? 'Precio actualizado' : 'Precio registrado');
    if (onSaved) onSaved();
  });
}
