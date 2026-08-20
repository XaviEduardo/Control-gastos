import StoreRepository from './store.repository.js';
import { renderTable } from '../../components/table.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { isRequired, validate, escapeHtml } from '../../core/validators.js';

export function renderStoresModule(container) {
  ensureActionMenuOutsideClick();
  const view = { search: '' };
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function filteredStores() {
    const term = view.search.trim().toLowerCase();
    return StoreRepository.list()
      .filter((s) => (!term ? true : s.name.toLowerCase().includes(term)))
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
      <input type="search" placeholder="Buscar tienda..." aria-label="Buscar tienda">
      <button type="button" class="btn btn--primary">+ Agregar tienda</button>
    `;
    const [searchInput] = toolbar.querySelectorAll('input');
    const [addBtn] = toolbar.querySelectorAll('button');

    searchInput.value = view.search;
    searchInput.addEventListener('input', (e) => { view.search = e.target.value; refreshList(); });
    addBtn.addEventListener('click', () => openStoreForm());

    return toolbar;
  }

  function renderListSection() {
    const section = document.createElement('div');
    section.id = 'storeListSection';
    section.appendChild(buildList());
    return section;
  }

  function refreshList() {
    const section = root.querySelector('#storeListSection');
    if (!section) return;
    section.innerHTML = '';
    section.appendChild(buildList());
  }

  function buildList() {
    const stores = filteredStores();
    const hasAny = StoreRepository.list().length > 0;

    if (!stores.length) {
      return renderEmptyState({
        icon: '🏬',
        title: hasAny ? 'Sin resultados' : 'Todavía no tienes tiendas registradas',
        message: hasAny ? 'Ajusta la búsqueda.' : 'Agrega las tiendas donde sueles comprar (Walmart, Soriana, Smart, etc.).',
        actionLabel: hasAny ? undefined : '+ Agregar primera tienda',
        onAction: hasAny ? undefined : () => openStoreForm(),
      });
    }

    return renderTable({
      columns: [
        { key: 'name', label: 'Tienda' },
        { key: 'location', label: 'Ubicación', render: (row) => escapeHtml(row.location || '—') },
        { key: 'notes', label: 'Notas', render: (row) => escapeHtml(row.notes || '') },
        { key: 'status', label: 'Estado', render: (row) => (row.status === 'active' ? 'Activa' : 'Inactiva') },
      ],
      rows: stores,
      rowActions: (row) => buildRowActions(row),
      renderCard: (row, actions) => renderStoreCard(row, actions),
    });
  }

  function buildRowActions(row) {
    return createActionMenu(`Más acciones para ${row.name}`, [
      { label: 'Editar', onClick: () => openStoreForm(row) },
      {
        label: row.status === 'active' ? 'Desactivar' : 'Activar',
        onClick: () => {
          StoreRepository.setStatus(row.id, row.status === 'active' ? 'inactive' : 'active');
          showToast(row.status === 'active' ? 'Tienda desactivada' : 'Tienda activada');
          render();
        },
      },
    ]);
  }

  function renderStoreCard(row, actions) {
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
    subtitle.textContent = `${row.location || 'Sin ubicación'} · ${row.status === 'active' ? 'Activa' : 'Inactiva'}`;

    card.append(header, subtitle);

    if (row.notes) {
      const body = document.createElement('div');
      body.className = 'responsive-card-list__body';
      const note = document.createElement('span');
      note.className = 'text-muted';
      note.textContent = row.notes;
      body.appendChild(note);
      card.appendChild(body);
    }

    return card;
  }

  function openStoreForm(existing) {
    const formId = `store-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-name">Nombre</label>
        <input type="text" id="${formId}-name" name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ej. Walmart">
      </div>
      <div>
        <label for="${formId}-location">Ubicación (opcional)</label>
        <input type="text" id="${formId}-location" name="location" value="${escapeHtml(existing?.location || '')}">
      </div>
      <div>
        <label for="${formId}-notes">Notas (opcional)</label>
        <textarea id="${formId}-notes" name="notes" rows="2">${escapeHtml(existing?.notes || '')}</textarea>
      </div>
      <p class="form-error hidden"></p>
    `;

    const footer = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancelar';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.setAttribute('form', formId);
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Agregar tienda';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar tienda' : 'Agregar tienda', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        name: data.get('name'),
        location: data.get('location'),
        notes: data.get('notes'),
      };

      const { valid, errors } = validate([
        { valid: isRequired(payload.name), message: 'El nombre es obligatorio.' },
      ]);
      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      if (existing) {
        StoreRepository.update(existing.id, {
          name: payload.name.trim(),
          location: (payload.location || '').trim(),
          notes: (payload.notes || '').trim(),
        });
      } else {
        StoreRepository.create(payload);
      }

      modal.close();
      showToast(existing ? 'Tienda actualizada' : 'Tienda agregada');
      render();
    });
  }

  render();
}
