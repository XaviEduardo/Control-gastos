// Formulario "Agregar producto a la lista" (V2-1: extraído de grocery-list.module.js —
// refactor puro, ver docs/v2-roadmap.md V2-9 — y actualizado para resolver por ProductVariant
// en vez de Product directo, ver docs/v2-data-model.md). Solo variantes ya existentes (mismo
// criterio que antes con productos, ver docs/decisions.md): registrar una variante nueva es
// responsabilidad exclusiva de Mandado > Productos, no de este modal.

import ProductRepository from './product.repository.js';
import ProductVariantRepository from './product-variant.repository.js';
import GroceryListItemRepository from './grocery-list-item.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { isRequired, isPositiveNumber, validate, escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from './units.js';
import { formatVariantLabel } from './variant-format.js';

const groceryCategoryRepo = createCategoryRepository('groceryCategories');

/** Abre el modal para agregar un producto (variante) a `list`. `onSaved()` se invoca tras
 * guardar con éxito (el caller decide cómo re-renderizar — este módulo no conoce la vista). */
export function openGroceryItemForm({ list, onSaved }) {
  const products = ProductRepository.list({ includeInactive: false });
  const variantsByProduct = products
    .map((product) => ({ product, variants: ProductVariantRepository.forProduct(product.id, { includeInactive: false }) }))
    .filter(({ variants }) => variants.length > 0)
    .sort((a, b) => a.product.name.localeCompare(b.product.name));

  if (!variantsByProduct.length) {
    showToast('Primero agrega productos (con al menos una variante) en Mandado > Productos.', { type: 'error' });
    return;
  }
  const categories = groceryCategoryRepo.list({ includeInactive: false });
  const formId = `grocery-item-form-${Date.now()}`;

  const form = document.createElement('form');
  form.id = formId;
  form.className = 'form-grid';
  form.innerHTML = `
    <div>
      <label for="${formId}-variant">Producto</label>
      <select id="${formId}-variant" name="productVariantId">
        ${variantsByProduct.map(({ product, variants }) => `
          <optgroup label="${escapeHtml(product.name)}">
            ${variants.map((v) => `<option value="${v.id}">${escapeHtml(formatVariantLabel(v))}</option>`).join('')}
          </optgroup>
        `).join('')}
      </select>
    </div>
    <div>
      <label for="${formId}-category">Categoría</label>
      <select id="${formId}-category" name="categoryId" disabled>${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
    </div>
    <div class="form-row">
      <div>
        <label for="${formId}-quantity">Cantidad</label>
        <input type="number" id="${formId}-quantity" name="quantity" min="0" step="0.01" value="1" required>
      </div>
      <div>
        <label for="${formId}-unit">Unidad</label>
        <select id="${formId}-unit" name="unit">${UNIT_OPTIONS.map((u) => `<option value="${u.value}">${u.label}</option>`).join('')}</select>
      </div>
    </div>
    <div>
      <label for="${formId}-price">Precio estimado por unidad (opcional)</label>
      <input type="number" id="${formId}-price" name="estimatedPrice" min="0" step="0.01">
    </div>
    <div>
      <label for="${formId}-notes">Notas (opcional)</label>
      <input type="text" id="${formId}-notes" name="notes">
    </div>
    <p class="form-error hidden"></p>
  `;

  const variantSelect = form.querySelector(`#${formId}-variant`);
  const categorySelect = form.querySelector(`#${formId}-category`);
  const unitSelect = form.querySelector(`#${formId}-unit`);

  // Categoría es pura referencia (nunca elección manual, ver PASS 6): siempre la del producto
  // dueño de la variante seleccionada, obtenida directamente del catálogo ya existente — por
  // eso el <select> está disabled y solo se sincroniza por código.
  function syncFields() {
    const variant = ProductVariantRepository.getById(variantSelect.value);
    if (!variant) return;
    const product = ProductRepository.getById(variant.productId);
    if (product) categorySelect.value = product.categoryId;
    unitSelect.value = variant.purchaseUnit;
  }
  variantSelect.addEventListener('change', syncFields);
  syncFields();

  const footer = document.createElement('div');
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--ghost';
  cancelBtn.textContent = 'Cancelar';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn btn--primary';
  saveBtn.setAttribute('form', formId);
  saveBtn.textContent = 'Agregar producto';
  footer.append(cancelBtn, saveBtn);

  const modal = openModal({ title: 'Agregar producto a la lista', content: form, footer });
  cancelBtn.addEventListener('click', () => modal.close());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const productVariantId = data.get('productVariantId');
    const quantity = data.get('quantity');
    const unit = data.get('unit');
    const estimatedPrice = data.get('estimatedPrice');
    const notes = data.get('notes');

    const { valid, errors } = validate([
      { valid: isRequired(productVariantId), message: 'Selecciona un producto.' },
      { valid: isPositiveNumber(quantity), message: 'La cantidad debe ser mayor a 0.' },
    ]);
    const errorEl = form.querySelector('.form-error');
    if (!valid) {
      errorEl.textContent = errors.join(' ');
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    const variant = ProductVariantRepository.getById(productVariantId);
    const product = ProductRepository.getById(variant.productId);

    GroceryListItemRepository.create({
      groceryListId: list.id,
      productId: product.id,
      productVariantId: variant.id,
      categoryId: product.categoryId,
      quantity,
      unit,
      estimatedPrice,
      notes,
    });

    modal.close();
    showToast('Producto agregado a la lista');
    if (onSaved) onSaved();
  });
}
