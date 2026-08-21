// Catálogo de Mandado (V2-1, ver docs/v2-data-model.md): Product es el concepto general
// ("Leche"); ProductVariant es el SKU real que efectivamente se compra (marca+presentación+
// unidad de compra, ej. "Lala · 1.5 L · pieza"). Esta pantalla agrupa: cada Product es una
// tarjeta con sus ProductVariant listadas debajo. Ningún cálculo vive aquí — WEIGHT/UNIT sigue
// resolviéndose exclusivamente en groceryService.js sobre lo que ya captura Mi Lista.

import ProductRepository from './product.repository.js';
import ProductVariantRepository from './product-variant.repository.js';
import PriceRepository from '../prices/price.repository.js';
import StoreChainRepository from '../stores/store-chain.repository.js';
import StoreBranchRepository from '../stores/store-branch.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { iconMarkup } from '../../components/icons.js';
import { openModal } from '../../components/modal.js';
import { openCategoryManager } from '../../components/category-manager.js';
import { showToast } from '../../components/toast.js';
import { normalizePrice, formatNormalizedPrice } from '../../services/priceService.js';
import { parseFlexibleDate } from '../../core/dates.js';
import { isRequired, validate, escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from './units.js';
import { formatVariantLabel } from './variant-format.js';

const categoryRepo = createCategoryRepository('groceryCategories');

export function renderGroceryProductsModule(container) {
  ensureActionMenuOutsideClick();
  const view = { search: '', categoryFilter: 'all' };
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  const activeCategories = () => categoryRepo.list({ includeInactive: false });
  const categoryName = (id) => categoryRepo.list().find((c) => c.id === id)?.name || 'Sin categoría';

  // Último precio registrado para CUALQUIER variante de este producto (cualquier tienda) —
  // sigue leyendo por `productId` (Price lo conserva siempre, ver migración V1→V2), mismo
  // patrón de siempre, ninguna regla de cálculo nueva.
  function latestPriceInfo(productId) {
    const entries = PriceRepository.forProduct(productId);
    if (!entries.length) return null;
    const latest = entries.reduce((best, e) => (
      !best || parseFlexibleDate(e.date) > parseFlexibleDate(best.date) ? e : best
    ), null);
    return { entry: latest, normalized: normalizePrice(latest.price, latest.quantity, latest.unit) };
  }

  // Último precio registrado específicamente para ESTA variante (solo prices que ya se
  // capturaron con productVariantId resuelto sin ambigüedad — ver price-form.js).
  function latestVariantPriceInfo(variantId) {
    const entries = PriceRepository.all().filter((p) => p.productVariantId === variantId);
    if (!entries.length) return null;
    const latest = entries.reduce((best, e) => (
      !best || parseFlexibleDate(e.date) > parseFlexibleDate(best.date) ? e : best
    ), null);
    return { entry: latest, normalized: normalizePrice(latest.price, latest.quantity, latest.unit) };
  }

  function filteredProducts() {
    const term = view.search.trim().toLowerCase();
    return ProductRepository.list()
      .filter((p) => (view.categoryFilter === 'all' ? true : p.categoryId === view.categoryFilter))
      .filter((p) => (!term ? true : p.name.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function render() {
    root.innerHTML = '';
    root.append(renderHeader(), renderToolbar(), renderListSection());
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Mandado</div>
      <h2 class="dashboard-header__title">Productos</h2>
    `;
    return wrap;
  }

  function renderToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'flex justify-between items-center gap-sm mb-md toolbar';
    toolbar.innerHTML = `
      <div class="flex gap-sm items-center">
        <input type="search" placeholder="Buscar producto..." aria-label="Buscar producto">
        <select aria-label="Filtrar por categoría"></select>
      </div>
      <div class="flex gap-sm">
        <button type="button" class="btn btn--icon btn--ghost" title="Gestionar categorías" aria-label="Gestionar categorías"></button>
        <button type="button" class="btn btn--primary">+ Agregar producto</button>
      </div>
    `;

    const [searchInput] = toolbar.querySelectorAll('input');
    const [categorySelect] = toolbar.querySelectorAll('select');
    const [manageBtn, addBtn] = toolbar.querySelectorAll('button');
    manageBtn.innerHTML = iconMarkup('tag', { size: 18 });

    searchInput.value = view.search;
    categorySelect.innerHTML = '<option value="all">Todas las categorías</option>'
      + activeCategories().map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    categorySelect.value = view.categoryFilter;

    searchInput.addEventListener('input', (e) => { view.search = e.target.value; refreshList(); });
    categorySelect.addEventListener('change', (e) => { view.categoryFilter = e.target.value; refreshList(); });
    manageBtn.addEventListener('click', () => {
      openCategoryManager({ title: 'Categorías de mandado', repository: categoryRepo, onChange: render });
    });
    addBtn.addEventListener('click', () => openProductForm());

    return toolbar;
  }

  function renderListSection() {
    const section = document.createElement('div');
    section.id = 'productListSection';
    section.appendChild(buildList());
    return section;
  }

  function refreshList() {
    const section = root.querySelector('#productListSection');
    if (!section) return;
    section.innerHTML = '';
    section.appendChild(buildList());
  }

  function buildList() {
    const products = filteredProducts();
    const hasAny = ProductRepository.list().length > 0;

    if (!products.length) {
      return renderEmptyState({
        icon: '🥕',
        title: hasAny ? 'Sin resultados' : 'Todavía no tienes productos en tu catálogo',
        message: hasAny ? 'Ajusta la búsqueda o el filtro de categoría.' : 'Agrega tu primer producto para empezar a construir tus listas de mandado.',
        actionLabel: hasAny ? undefined : '+ Agregar primer producto',
        onAction: hasAny ? undefined : () => openProductForm(),
      });
    }

    const wrap = document.createElement('div');
    products.forEach((product) => wrap.appendChild(renderProductCard(product)));
    return wrap;
  }

  function renderProductCard(product) {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-start gap-sm mb-md';
    header.style.flexWrap = 'wrap';

    const titleWrap = document.createElement('div');
    const info = latestPriceInfo(product.id);
    titleWrap.innerHTML = `
      <div class="card-title">${escapeHtml(product.name)}</div>
      <div class="text-muted text-xs mt-md">
        ${escapeHtml(categoryName(product.categoryId))}${product.status === 'inactive' ? ' · <span class="badge badge--neutral">Inactivo</span>' : ''}
        ${info?.normalized ? ` · Último precio: ${escapeHtml(formatNormalizedPrice(info.normalized))}` : ''}
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'flex gap-sm items-center';

    const addVariantBtn = document.createElement('button');
    addVariantBtn.type = 'button';
    addVariantBtn.className = 'btn btn--icon btn--ghost';
    addVariantBtn.title = 'Agregar variante';
    addVariantBtn.setAttribute('aria-label', `Agregar variante a ${product.name}`);
    addVariantBtn.innerHTML = iconMarkup('plus', { size: 18 });
    addVariantBtn.addEventListener('click', () => openVariantForm(product));

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--icon btn--ghost';
    editBtn.title = 'Editar producto';
    editBtn.setAttribute('aria-label', `Editar ${product.name}`);
    editBtn.innerHTML = iconMarkup('edit', { size: 18 });
    editBtn.addEventListener('click', () => openProductForm(product));

    const menu = createActionMenu(`Más acciones para ${product.name}`, [
      {
        label: product.status === 'active' ? 'Desactivar' : 'Activar',
        onClick: () => {
          ProductRepository.setStatus(product.id, product.status === 'active' ? 'inactive' : 'active');
          showToast(product.status === 'active' ? 'Producto desactivado' : 'Producto activado');
          render();
        },
      },
    ]);

    actions.append(addVariantBtn, editBtn, menu);
    header.append(titleWrap, actions);
    card.appendChild(header);

    const variants = ProductVariantRepository.forProduct(product.id);
    if (!variants.length) {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = 'Sin variantes todavía — agrega al menos una para poder usarlo en tus listas de mandado.';
      card.appendChild(empty);
      return card;
    }

    const list = document.createElement('div');
    list.className = 'movement-list';
    variants.forEach((variant) => list.appendChild(renderVariantRow(product, variant)));
    card.appendChild(list);

    return card;
  }

  function renderVariantRow(product, variant) {
    const row = document.createElement('div');
    row.className = 'movement-row';

    const icon = document.createElement('span');
    icon.className = 'movement-row__icon';
    icon.innerHTML = iconMarkup('box', { size: 16 });

    const info = latestVariantPriceInfo(variant.id);
    const body = document.createElement('div');
    body.className = 'movement-row__body';
    body.innerHTML = `
      <div class="movement-row__title">${escapeHtml(formatVariantLabel(variant))}${variant.status === 'inactive' ? ' <span class="badge badge--neutral">Inactivo</span>' : ''}</div>
      <div class="movement-row__subtitle">${info?.normalized ? escapeHtml(formatNormalizedPrice(info.normalized)) : 'Sin precio registrado'}</div>
    `;

    const menu = createActionMenu(`Más acciones para ${formatVariantLabel(variant)}`, [
      { label: 'Editar', onClick: () => openVariantForm(product, variant) },
      { label: 'Preferir sucursal...', onClick: () => openPreferredBranchForm(variant) },
      {
        label: variant.status === 'active' ? 'Desactivar' : 'Activar',
        onClick: () => {
          ProductVariantRepository.setStatus(variant.id, variant.status === 'active' ? 'inactive' : 'active');
          showToast(variant.status === 'active' ? 'Variante desactivada' : 'Variante activada');
          render();
        },
      },
    ]);

    row.append(icon, body, menu);
    return row;
  }

  function openProductForm(existing) {
    if (!activeCategories().length) {
      showToast('Primero agrega una categoría de mandado.', { type: 'error' });
      openCategoryManager({ title: 'Categorías de mandado', repository: categoryRepo, onChange: render });
      return;
    }

    const formId = `grocery-product-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-name">Nombre</label>
        <input type="text" id="${formId}-name" name="name" required value="${escapeHtml(existing?.name || '')}">
      </div>
      <div>
        <label for="${formId}-category">Categoría</label>
        <select id="${formId}-category" name="categoryId"></select>
      </div>
      <div>
        <label for="${formId}-notes">Notas (opcional)</label>
        <textarea id="${formId}-notes" name="notes" rows="2">${escapeHtml(existing?.notes || '')}</textarea>
      </div>
      <p class="form-error hidden"></p>
    `;

    const categorySelect = form.querySelector(`#${formId}-category`);
    categorySelect.innerHTML = activeCategories().map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (existing?.categoryId) categorySelect.value = existing.categoryId;

    const footer = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancelar';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.setAttribute('form', formId);
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Agregar producto';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar producto' : 'Agregar producto', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        name: data.get('name'),
        categoryId: data.get('categoryId'),
        notes: data.get('notes'),
      };

      const { valid, errors } = validate([
        { valid: isRequired(payload.name), message: 'El nombre es obligatorio.' },
        { valid: isRequired(payload.categoryId), message: 'Selecciona una categoría.' },
      ]);

      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      if (existing) ProductRepository.update(existing.id, payload);
      else ProductRepository.create(payload);

      modal.close();
      showToast(existing ? 'Producto actualizado' : 'Producto agregado');
      render();
    });
  }

  function openVariantForm(product, existing) {
    const formId = `product-variant-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div class="flex items-center gap-sm">
        <span class="text-muted">Producto</span>
        <span class="card-title">${escapeHtml(product.name)}</span>
      </div>
      <div>
        <label for="${formId}-brand">Marca (opcional)</label>
        <input type="text" id="${formId}-brand" name="brand" value="${escapeHtml(existing?.brand || '')}" placeholder="Ej. Lala">
      </div>
      <div class="form-row">
        <div>
          <label for="${formId}-amount">Presentación (opcional)</label>
          <input type="number" id="${formId}-amount" name="presentationAmount" min="0" step="0.01" value="${existing?.presentationAmount ?? ''}" placeholder="Ej. 1.5">
        </div>
        <div>
          <label for="${formId}-presentation-unit">Unidad de presentación</label>
          <select id="${formId}-presentation-unit" name="presentationUnit"></select>
        </div>
      </div>
      <div>
        <label for="${formId}-purchase-unit">Unidad de compra</label>
        <select id="${formId}-purchase-unit" name="purchaseUnit"></select>
      </div>
      <div>
        <label for="${formId}-notes">Notas (opcional)</label>
        <textarea id="${formId}-notes" name="notes" rows="2">${escapeHtml(existing?.notes || '')}</textarea>
      </div>
      <p class="form-error hidden"></p>
    `;

    const presentationUnitSelect = form.querySelector(`#${formId}-presentation-unit`);
    presentationUnitSelect.innerHTML = '<option value="">Sin especificar</option>'
      + UNIT_OPTIONS.map((u) => `<option value="${u.value}">${u.label}</option>`).join('');
    presentationUnitSelect.value = existing?.presentationUnit || '';

    const purchaseUnitSelect = form.querySelector(`#${formId}-purchase-unit`);
    purchaseUnitSelect.innerHTML = UNIT_OPTIONS.map((u) => `<option value="${u.value}">${u.label}</option>`).join('');
    purchaseUnitSelect.value = existing?.purchaseUnit || 'pza';

    const footer = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancelar';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.setAttribute('form', formId);
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Agregar variante';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar variante' : 'Agregar variante', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        brand: data.get('brand'),
        presentationAmount: data.get('presentationAmount'),
        presentationUnit: data.get('presentationUnit') || null,
        purchaseUnit: data.get('purchaseUnit'),
        notes: data.get('notes'),
      };

      const { valid, errors } = validate([
        { valid: isRequired(payload.purchaseUnit), message: 'Selecciona la unidad de compra.' },
      ]);
      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      if (existing) ProductVariantRepository.update(existing.id, payload);
      else ProductVariantRepository.create({ ...payload, productId: product.id });

      modal.close();
      showToast(existing ? 'Variante actualizada' : 'Variante agregada');
      render();
    });
  }

  // V2-6: "preferir esta sucursal" — sugerencia opcional, nunca obligatoria (ver
  // groceryService.js#effectiveBranchId, que la usa como último escalón de prioridad).
  // "Sin preferencia" limpia `preferredBranchId` sin dejar de poder usarlo después.
  function openPreferredBranchForm(variant) {
    const chains = StoreChainRepository.list({ includeInactive: false });
    const formId = `variant-preferred-branch-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-branch">Sucursal preferida</label>
        <select id="${formId}-branch" name="branchId">
          <option value="">Sin preferencia</option>
          ${chains.map((chain) => `
            <optgroup label="${escapeHtml(chain.name)}">
              ${StoreBranchRepository.forChain(chain.id, { includeInactive: false }).map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
            </optgroup>
          `).join('')}
        </select>
      </div>
      <p class="text-muted text-xs">Se usa como sugerencia al agregar este producto a una lista — nunca impide elegir otra sucursal.</p>
    `;

    const select = form.querySelector('select');
    select.value = variant.preferredBranchId || '';

    const footer = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancelar';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.setAttribute('form', formId);
    saveBtn.textContent = 'Guardar';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: 'Sucursal preferida', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const branchId = new FormData(form).get('branchId') || null;
      ProductVariantRepository.update(variant.id, { preferredBranchId: branchId });
      modal.close();
      showToast(branchId ? 'Sucursal preferida guardada' : 'Preferencia de sucursal eliminada');
      render();
    });
  }

  render();
}
