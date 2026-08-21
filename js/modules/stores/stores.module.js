// Tiendas (V2-2, ver docs/v2-data-model.md): StoreChain es la cadena ("Walmart", "Smart");
// StoreBranch es la sucursal real donde se registra un precio (ej. "Walmart Ejército
// Nacional"). Esta pantalla agrupa: cada Chain es una tarjeta con sus Branches listadas debajo
// — mismo patrón que Productos (V2-1) con sus variantes. `js/modules/stores/store.repository.js`
// (legacy) sigue funcionando para el resto de la app vía compatibilidad; aquí se usan
// directamente los repositorios nuevos.

import StoreChainRepository from './store-chain.repository.js';
import StoreBranchRepository from './store-branch.repository.js';
import PriceRepository from '../prices/price.repository.js';
import ProductRepository from '../grocery/product.repository.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { iconMarkup } from '../../components/icons.js';
import { formatDateShort, parseFlexibleDate } from '../../core/dates.js';
import { isRequired, validate, escapeHtml } from '../../core/validators.js';

export function renderStoresModule(container) {
  ensureActionMenuOutsideClick();
  const view = { search: '' };
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  // Conteo de productos distintos con precio registrado en esta sucursal + el registro más
  // reciente — ambos derivados de PriceRepository (branchId), ninguna regla nueva.
  function branchStats(branchId) {
    const entries = PriceRepository.all().filter((p) => p.branchId === branchId);
    const productCount = new Set(entries.map((p) => p.productId)).size;
    const latest = entries.reduce((best, e) => (
      !best || parseFlexibleDate(e.date) > parseFlexibleDate(best.date) ? e : best
    ), null);
    return { productCount, latest };
  }

  function filteredChains() {
    const term = view.search.trim().toLowerCase();
    if (!term) return StoreChainRepository.list().sort((a, b) => a.name.localeCompare(b.name));
    return StoreChainRepository.list()
      .filter((chain) => {
        if (chain.name.toLowerCase().includes(term)) return true;
        return StoreBranchRepository.forChain(chain.id).some((b) => b.name.toLowerCase().includes(term));
      })
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
      <h2 class="dashboard-header__title">Tiendas</h2>
    `;
    return wrap;
  }

  function renderToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'flex justify-between items-center gap-sm mb-md toolbar';
    toolbar.innerHTML = `
      <input type="search" placeholder="Buscar cadena o sucursal..." aria-label="Buscar cadena o sucursal">
      <button type="button" class="btn btn--primary">+ Agregar cadena</button>
    `;
    const [searchInput] = toolbar.querySelectorAll('input');
    const [addBtn] = toolbar.querySelectorAll('button');

    searchInput.value = view.search;
    searchInput.addEventListener('input', (e) => { view.search = e.target.value; refreshList(); });
    addBtn.addEventListener('click', () => openChainForm());

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
    const chains = filteredChains();
    const hasAny = StoreChainRepository.list().length > 0;

    if (!chains.length) {
      return renderEmptyState({
        icon: '🏬',
        title: hasAny ? 'Sin resultados' : 'Todavía no tienes tiendas registradas',
        message: hasAny ? 'Ajusta la búsqueda.' : 'Agrega las cadenas donde sueles comprar (Walmart, Soriana, Smart, etc.) y sus sucursales.',
        actionLabel: hasAny ? undefined : '+ Agregar primera cadena',
        onAction: hasAny ? undefined : () => openChainForm(),
      });
    }

    const wrap = document.createElement('div');
    chains.forEach((chain) => wrap.appendChild(renderChainCard(chain)));
    return wrap;
  }

  function renderChainCard(chain) {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const branches = StoreBranchRepository.forChain(chain.id);

    const header = document.createElement('div');
    header.className = 'flex justify-between items-start gap-sm mb-md';
    header.style.flexWrap = 'wrap';

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `
      <div class="card-title">${escapeHtml(chain.name)}</div>
      <div class="text-muted text-xs mt-md">
        ${branches.length} sucursal${branches.length === 1 ? '' : 'es'}${chain.status === 'inactive' ? ' · <span class="badge badge--neutral">Inactiva</span>' : ''}
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'flex gap-sm items-center';

    const addBranchBtn = document.createElement('button');
    addBranchBtn.type = 'button';
    addBranchBtn.className = 'btn btn--icon btn--ghost';
    addBranchBtn.title = 'Agregar sucursal';
    addBranchBtn.setAttribute('aria-label', `Agregar sucursal a ${chain.name}`);
    addBranchBtn.innerHTML = iconMarkup('plus', { size: 18 });
    addBranchBtn.addEventListener('click', () => openBranchForm(chain));

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--icon btn--ghost';
    editBtn.title = 'Editar cadena';
    editBtn.setAttribute('aria-label', `Editar ${chain.name}`);
    editBtn.innerHTML = iconMarkup('edit', { size: 18 });
    editBtn.addEventListener('click', () => openChainForm(chain));

    const menu = createActionMenu(`Más acciones para ${chain.name}`, [
      {
        label: chain.status === 'active' ? 'Desactivar' : 'Activar',
        onClick: () => {
          StoreChainRepository.setStatus(chain.id, chain.status === 'active' ? 'inactive' : 'active');
          showToast(chain.status === 'active' ? 'Cadena desactivada' : 'Cadena activada');
          render();
        },
      },
    ]);

    actions.append(addBranchBtn, editBtn, menu);
    header.append(titleWrap, actions);
    card.appendChild(header);

    if (!branches.length) {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = 'Sin sucursales todavía — agrega al menos una para poder registrar precios ahí.';
      card.appendChild(empty);
      return card;
    }

    const list = document.createElement('div');
    list.className = 'movement-list';
    branches
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((branch) => list.appendChild(renderBranchRow(chain, branch)));
    card.appendChild(list);

    return card;
  }

  function renderBranchRow(chain, branch) {
    const row = document.createElement('div');
    row.className = 'movement-row';

    const icon = document.createElement('span');
    icon.className = 'movement-row__icon';
    icon.innerHTML = iconMarkup('store', { size: 16 });

    const stats = branchStats(branch.id);
    const subtitleParts = [];
    if (branch.location) subtitleParts.push(escapeHtml(branch.location));
    subtitleParts.push(stats.latest
      ? `Último precio: ${escapeHtml(ProductRepository.getById(stats.latest.productId)?.name || 'Producto eliminado')} · ${formatDateShort(stats.latest.date)}`
      : 'Sin precios registrados');

    const body = document.createElement('div');
    body.className = 'movement-row__body';
    body.innerHTML = `
      <div class="movement-row__title">${escapeHtml(branch.name)}${branch.status === 'inactive' ? ' <span class="badge badge--neutral">Inactiva</span>' : ''}</div>
      <div class="movement-row__subtitle">${subtitleParts.join(' · ')}</div>
    `;

    const menu = createActionMenu(`Más acciones para ${branch.name}`, [
      { label: 'Editar', onClick: () => openBranchForm(chain, branch) },
      {
        label: branch.status === 'active' ? 'Desactivar' : 'Activar',
        onClick: () => {
          StoreBranchRepository.setStatus(branch.id, branch.status === 'active' ? 'inactive' : 'active');
          showToast(branch.status === 'active' ? 'Sucursal desactivada' : 'Sucursal activada');
          render();
        },
      },
    ]);

    row.append(icon, body, menu);
    return row;
  }

  function openChainForm(existing) {
    const formId = `store-chain-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-name">Nombre</label>
        <input type="text" id="${formId}-name" name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ej. Walmart">
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
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Agregar cadena';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar cadena' : 'Agregar cadena', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = { name: data.get('name'), notes: data.get('notes') };

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

      if (existing) StoreChainRepository.update(existing.id, payload);
      else StoreChainRepository.create(payload);

      modal.close();
      showToast(existing ? 'Cadena actualizada' : 'Cadena agregada');
      render();
    });
  }

  function openBranchForm(chain, existing) {
    const formId = `store-branch-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div class="flex items-center gap-sm">
        <span class="text-muted">Cadena</span>
        <span class="card-title">${escapeHtml(chain.name)}</span>
      </div>
      <div>
        <label for="${formId}-name">Nombre de la sucursal</label>
        <input type="text" id="${formId}-name" name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ej. Ejército Nacional">
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
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Agregar sucursal';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar sucursal' : 'Agregar sucursal', content: form, footer });
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

      if (existing) StoreBranchRepository.update(existing.id, payload);
      else StoreBranchRepository.create({ ...payload, chainId: chain.id });

      modal.close();
      showToast(existing ? 'Sucursal actualizada' : 'Sucursal agregada');
      render();
    });
  }

  render();
}
