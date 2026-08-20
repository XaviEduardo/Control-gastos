import ProductRepository from './product.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import { renderTable } from '../../components/table.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { openModal } from '../../components/modal.js';
import { openCategoryManager } from '../../components/category-manager.js';
import { showToast } from '../../components/toast.js';
import { isRequired, validate, escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from './units.js';

const categoryRepo = createCategoryRepository('groceryCategories');

export function renderGroceryProductsModule(container) {
  const view = { search: '', categoryFilter: 'all' };
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  const activeCategories = () => categoryRepo.list({ includeInactive: false });
  const categoryName = (id) => categoryRepo.list().find((c) => c.id === id)?.name || 'Sin categoría';
  const unitLabel = (value) => UNIT_OPTIONS.find((u) => u.value === value)?.label || value;

  function filteredProducts() {
    const term = view.search.trim().toLowerCase();
    return ProductRepository.list()
      .filter((p) => (view.categoryFilter === 'all' ? true : p.categoryId === view.categoryFilter))
      .filter((p) => (!term ? true : p.name.toLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function render() {
    root.innerHTML = '';
    root.append(renderToolbar(), renderListSection());
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
        { key: 'preferredUnit', label: 'Unidad', render: (row) => escapeHtml(unitLabel(row.preferredUnit)) },
        { key: 'status', label: 'Estado', render: (row) => (row.status === 'active' ? 'Activo' : 'Inactivo') },
      ],
      rows: products,
      rowActions: (row) => buildRowActions(row),
    });
  }

  function buildRowActions(row) {
    const wrap = document.createElement('div');
    wrap.className = 'flex gap-xs';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--ghost';
    editBtn.textContent = 'Editar';
    editBtn.addEventListener('click', () => openProductForm(row));

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn btn--ghost';
    toggleBtn.textContent = row.status === 'active' ? 'Desactivar' : 'Activar';
    toggleBtn.addEventListener('click', () => {
      ProductRepository.setStatus(row.id, row.status === 'active' ? 'inactive' : 'active');
      showToast(row.status === 'active' ? 'Producto desactivado' : 'Producto activado');
      render();
    });

    wrap.append(editBtn, toggleBtn);
    return wrap;
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
