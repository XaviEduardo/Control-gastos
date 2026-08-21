import ProductRepository from './product.repository.js';
import PriceRepository from '../prices/price.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import { renderTable } from '../../components/table.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { openModal } from '../../components/modal.js';
import { openCategoryManager } from '../../components/category-manager.js';
import { showToast } from '../../components/toast.js';
import { normalizePrice, formatNormalizedPrice } from '../../services/priceService.js';
import { parseFlexibleDate } from '../../core/dates.js';
import { isRequired, validate, escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from './units.js';

const categoryRepo = createCategoryRepository('groceryCategories');

const UNIT_PHRASES = { kg: 'Por kg', g: 'Por gramo', l: 'Por litro', ml: 'Por mililitro', pza: 'Por unidad', paquete: 'Por paquete' };

export function renderGroceryProductsModule(container) {
  ensureActionMenuOutsideClick();
  const view = { search: '', categoryFilter: 'all' };
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  const activeCategories = () => categoryRepo.list({ includeInactive: false });
  const categoryName = (id) => categoryRepo.list().find((c) => c.id === id)?.name || 'Sin categoría';
  const unitLabel = (value) => UNIT_OPTIONS.find((u) => u.value === value)?.label || value;
  const unitPhrase = (value) => UNIT_PHRASES[value] || `Por ${unitLabel(value)}`;

  // Precio más reciente registrado para el producto (cualquier tienda) — mismo patrón que
  // ya usa price-history.module.js (encontrar el registro más nuevo por fecha), sin tocar
  // ninguna regla de cálculo. null si nunca se ha registrado un precio.
  function latestPriceInfo(productId) {
    const entries = PriceRepository.forProduct(productId);
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
        <button type="button" class="btn btn--ghost">Gestionar categorías</button>
        <button type="button" class="btn btn--primary">+ Agregar producto</button>
      </div>
    `;

    const [searchInput] = toolbar.querySelectorAll('input');
    const [categorySelect] = toolbar.querySelectorAll('select');
    const [manageBtn, addBtn] = toolbar.querySelectorAll('button');

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

    return renderTable({
      columns: [
        { key: 'name', label: 'Producto' },
        { key: 'categoryId', label: 'Categoría', render: (row) => escapeHtml(categoryName(row.categoryId)) },
        { key: 'preferredUnit', label: 'Presentación', render: (row) => escapeHtml(unitPhrase(row.preferredUnit)) },
        {
          key: 'lastPrice',
          label: 'Último precio',
          align: 'right',
          render: (row) => {
            const info = latestPriceInfo(row.id);
            return info?.normalized ? escapeHtml(formatNormalizedPrice(info.normalized)) : '<span class="text-muted">Sin registrar</span>';
          },
        },
        { key: 'status', label: 'Estado', render: (row) => statusBadge(row.status) },
      ],
      rows: products,
      rowActions: (row) => buildRowActions(row),
      renderCard: (row, actions) => renderProductCard(row, actions),
    });
  }

  function statusBadge(status) {
    return status === 'active'
      ? '<span class="badge badge--success">Activo</span>'
      : '<span class="badge badge--neutral">Inactivo</span>';
  }

  function buildRowActions(row) {
    return createActionMenu(`Más acciones para ${row.name}`, [
      { label: 'Editar', onClick: () => openProductForm(row) },
      {
        label: row.status === 'active' ? 'Desactivar' : 'Activar',
        onClick: () => {
          ProductRepository.setStatus(row.id, row.status === 'active' ? 'inactive' : 'active');
          showToast(row.status === 'active' ? 'Producto desactivado' : 'Producto activado');
          render();
        },
      },
    ]);
  }

  function renderProductCard(row, actions) {
    const card = document.createElement('div');
    card.className = 'responsive-card-list__item';

    const header = document.createElement('div');
    header.className = 'responsive-card-list__header';
    const title = document.createElement('span');
    title.className = 'responsive-card-list__title';
    title.textContent = row.name;
    header.append(title, actions);

    const subtitle = document.createElement('div');
    subtitle.className = 'responsive-card-list__subtitle';
    subtitle.textContent = categoryName(row.categoryId);

    const body = document.createElement('div');
    body.className = 'responsive-card-list__body';

    const unitLine = document.createElement('span');
    unitLine.textContent = unitPhrase(row.preferredUnit);
    body.appendChild(unitLine);

    const priceRow = document.createElement('div');
    priceRow.className = 'flex justify-between items-center mt-md';
    const info = latestPriceInfo(row.id);
    priceRow.innerHTML = info?.normalized
      ? `<span class="text-muted">Último precio</span><span style="font-weight:700">${escapeHtml(formatNormalizedPrice(info.normalized))}</span>`
      : '<span class="text-muted">Sin precio registrado</span>';
    body.appendChild(priceRow);

    const statusRow = document.createElement('div');
    statusRow.className = 'mt-md';
    statusRow.innerHTML = statusBadge(row.status);
    body.appendChild(statusRow);

    card.append(header, subtitle, body);
    return card;
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
        <label for="${formId}-unit">Unidad preferida</label>
        <select id="${formId}-unit" name="preferredUnit"></select>
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

    const unitSelect = form.querySelector(`#${formId}-unit`);
    unitSelect.innerHTML = UNIT_OPTIONS.map((u) => `<option value="${u.value}">${u.label}</option>`).join('');
    unitSelect.value = existing?.preferredUnit || 'pza';

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
        preferredUnit: data.get('preferredUnit'),
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

  render();
}
