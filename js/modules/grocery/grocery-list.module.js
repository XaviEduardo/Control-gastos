// Pantalla principal de Mandado ("Mi lista"). No crea ninguna base de datos independiente:
// lee/escribe a través de GroceryList/GroceryListItem/Product repositories y de
// groceryService para los totales (ver docs/architecture.md, docs/decisions.md).

import State from '../../core/state.js';
import GroceryListRepository from './grocery-list.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import ExpenseRepository from '../expenses/expense.repository.js';
import { listTotals } from '../../services/groceryService.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { iconMarkup } from '../../components/icons.js';
import { openModal } from '../../components/modal.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { formatMoney, formatPercent } from '../../core/currency.js';
import { toISODate, formatDateShort } from '../../core/dates.js';
import { isRequired, validate, escapeHtml } from '../../core/validators.js';
import { renderBranchSection } from './grocery-branch-section.js';
import { renderItemsByCategory, renderFrequentProductsSection } from './grocery-item-groups.js';

const expenseCategoryRepo = createCategoryRepository('expenseCategories');

export function renderGroceryListModule(container) {
  ensureActionMenuOutsideClick();
  const settings = State.getSettings();
  let selectedListId = settings.selectedGroceryListId || null;
  // V2-3/V2-6: nada de esto es persistente (ver docs/v2-data-model.md — GroceryList.
  // activeBranchId es lo persistente); `branchPickerOpen` controla si el picker de sucursal
  // está expandido y `groupMode` si Mi Lista se ve por categoría o por sucursal — ambos son
  // preferencias de esta sesión de UI, no del modelo de datos.
  const view = { branchPickerOpen: false, groupMode: 'category' };

  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function persistSelection() {
    State.setSettings({ selectedGroceryListId: selectedListId });
  }

  function currentLists() {
    return [...GroceryListRepository.list()].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }

  function ensureSelection(lists) {
    if (selectedListId && lists.some((l) => l.id === selectedListId)) return;
    selectedListId = lists[0]?.id || null;
    persistSelection();
  }

  function render() {
    root.innerHTML = '';
    const lists = currentLists();
    ensureSelection(lists);

    root.appendChild(renderHeader());
    root.appendChild(renderListSelector(lists));

    if (!selectedListId) {
      root.appendChild(renderEmptyState({
        icon: '🛒',
        title: 'Todavía no tienes listas de mandado',
        message: 'Crea tu primera lista para empezar a organizar tus compras.',
        actionLabel: '+ Nueva lista',
        onAction: () => openListForm(),
      }));
      return;
    }

    const list = GroceryListRepository.getById(selectedListId);
    root.appendChild(renderTotalsSummary(list));
    root.appendChild(renderBranchSection(list, view, { onChange: render }));
    const frequentSection = renderFrequentProductsSection(list, { onChange: render });
    if (frequentSection) root.appendChild(frequentSection);
    root.appendChild(renderItemsByCategory(list, view, { onChange: render }));
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Mandado</div>
      <h2 class="dashboard-header__title">Mi Lista</h2>
    `;
    return wrap;
  }

  function renderListSelector(lists) {
    const bar = document.createElement('div');
    bar.className = 'card mb-md flex justify-between items-center gap-sm toolbar';

    const selectWrap = document.createElement('div');
    selectWrap.className = 'flex items-center gap-sm';
    selectWrap.innerHTML = '<label for="groceryListSelect" style="margin:0;">Lista</label><select id="groceryListSelect"></select>';
    const select = selectWrap.querySelector('select');
    select.innerHTML = lists.length
      ? lists.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}${l.status === 'closed' ? ' (completada)' : ''}</option>`).join('')
      : '<option value="">Sin listas</option>';
    if (selectedListId) select.value = selectedListId;
    select.addEventListener('change', () => {
      selectedListId = select.value || null;
      persistSelection();
      render();
    });

    const actions = document.createElement('div');
    actions.className = 'flex gap-sm';

    // Solo ícono + title/aria-label (tooltip nativo en desktop, lector de pantalla en
    // cualquier plataforma) en vez de texto: con las 4 acciones juntas, los botones con texto
    // se salían de la pantalla en móvil (ver reporte de usuario). `.btn--icon` ya es 44×44
    // (objetivo táctil), igual en iOS/Android que en desktop.
    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'btn btn--icon btn--primary';
    newBtn.title = 'Nueva lista';
    newBtn.setAttribute('aria-label', 'Nueva lista');
    newBtn.innerHTML = iconMarkup('plus', { size: 18 });
    // V2-5: si ya existe al menos un mandado, ofrece repetirlo antes de ir directo al
    // formulario vacío — "reducir drásticamente el trabajo" de armar cada lista desde cero.
    newBtn.addEventListener('click', () => {
      const existingLists = currentLists();
      if (existingLists.length) openNewListChoice(existingLists[0]);
      else openListForm();
    });
    actions.appendChild(newBtn);

    if (selectedListId) {
      const list = GroceryListRepository.getById(selectedListId);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn--icon btn--ghost';
      editBtn.title = 'Editar lista';
      editBtn.setAttribute('aria-label', 'Editar lista');
      editBtn.innerHTML = iconMarkup('edit', { size: 18 });
      editBtn.addEventListener('click', () => openListForm(list));

      const toggleLabel = list.status === 'open' ? 'Marcar completada' : 'Reabrir';
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'btn btn--icon btn--ghost';
      toggleBtn.title = toggleLabel;
      toggleBtn.setAttribute('aria-label', toggleLabel);
      toggleBtn.innerHTML = iconMarkup(list.status === 'open' ? 'check' : 'rotate-ccw', { size: 18 });
      toggleBtn.addEventListener('click', () => {
        GroceryListRepository.update(list.id, { status: list.status === 'open' ? 'closed' : 'open' });
        render();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn--icon btn--danger';
      delBtn.title = 'Eliminar lista';
      delBtn.setAttribute('aria-label', 'Eliminar lista');
      delBtn.innerHTML = iconMarkup('trash', { size: 18 });
      delBtn.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Eliminar lista',
          message: `¿Eliminar "${escapeHtml(list.name)}" y todos sus productos? Esta acción no se puede deshacer. Si ya registraste un gasto vinculado, ese gasto NO se elimina.`,
          confirmText: 'Eliminar',
          danger: true,
        });
        if (confirmed) {
          GroceryListRepository.remove(list.id);
          selectedListId = null;
          persistSelection();
          showToast('Lista eliminada');
          render();
        }
      });

      actions.append(editBtn, toggleBtn, delBtn);
    }

    bar.append(selectWrap, actions);
    return bar;
  }

  // Tarjeta única (nombre + monto + progreso) en vez de 4 stat-cards sueltas — misma
  // listTotals() de siempre, solo reorganizada visualmente (ver rediseño "Minimal Finance").
  function renderTotalsSummary(list) {
    const totals = listTotals(list);
    const wrap = document.createElement('div');

    const card = document.createElement('div');
    card.className = 'card mb-md mandado-summary';

    const metaParts = [];
    if (list.startDate) metaParts.push(formatDateShort(list.startDate));
    if (list.status === 'closed') metaParts.push('Completada');
    if (list.notes) metaParts.push(escapeHtml(list.notes));

    const header = document.createElement('div');
    header.className = 'mandado-summary__header';
    header.innerHTML = `
      <div class="mandado-summary__title">
        <span class="kpi-card__icon">${iconMarkup('cart', { size: 18 })}</span>
        <span>
          <div class="card-title">${escapeHtml(list.name)}</div>
          ${metaParts.length ? `<div class="text-muted text-xs mt-md">${metaParts.join(' · ')}</div>` : ''}
        </span>
      </div>
      <div class="mandado-summary__amount">
        <div class="mandado-summary__amount-value">${formatMoney(totals.real)}</div>
        <div class="mandado-summary__amount-caption">Gastado${totals.budget !== null ? ` · Est. ${formatMoney(totals.estimated)}` : ` / ${formatMoney(totals.estimated)} est.`}</div>
      </div>
    `;
    card.appendChild(header);

    if (totals.budget !== null) {
      const over = totals.difference < 0;
      const pct = totals.budget > 0 ? Math.min(totals.real / totals.budget, 1) : 0;
      const bar = document.createElement('div');
      bar.className = 'progress-bar mt-md';
      bar.innerHTML = `<div class="progress-bar__fill${over ? ' progress-bar__fill--over' : ''}" style="width:${pct * 100}%"></div>`;
      card.appendChild(bar);

      const footRow = document.createElement('div');
      footRow.className = 'mandado-summary__footrow';
      footRow.innerHTML = `
        <span>${formatPercent(totals.budget > 0 ? totals.real / totals.budget : 0, 0)} del presupuesto${over ? ` · excedido por ${formatMoney(Math.abs(totals.difference))}` : ''}</span>
        <span>${totals.purchasedCount}/${totals.itemCount} items</span>
      `;
      card.appendChild(footRow);
    } else {
      const footRow = document.createElement('div');
      footRow.className = 'mandado-summary__footrow mt-md';
      footRow.innerHTML = `<span>${totals.purchasedCount}/${totals.itemCount} items comprados</span>`;
      card.appendChild(footRow);
    }

    wrap.appendChild(card);
    wrap.appendChild(renderExpenseLink(list, totals));
    return wrap;
  }

  function renderExpenseLink(list, totals) {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const linkedExpense = list.linkedExpenseId ? ExpenseRepository.getById(list.linkedExpenseId) : null;
    const label = document.createElement('div');
    label.className = 'card-title mb-md';
    label.textContent = 'Integración con Gastos';
    card.appendChild(label);

    if (linkedExpense) {
      const msg = document.createElement('p');
      msg.className = 'text-muted';
      msg.textContent = `Ya se registró como gasto: "${linkedExpense.description}" por ${formatMoney(linkedExpense.amount)}. Se refleja en Semana/Mes/Dashboard.`;
      card.appendChild(msg);
      return card;
    }

    const mandadoCategory = expenseCategoryRepo.list().find((c) => c.name.trim().toLowerCase() === 'mandado');
    if (!mandadoCategory) {
      const msg = document.createElement('p');
      msg.className = 'text-muted';
      msg.textContent = 'Crea una categoría de gasto llamada "Mandado" (desde Gastos) para poder registrar aquí el total real.';
      card.appendChild(msg);
      return card;
    }

    if (totals.real <= 0) {
      const msg = document.createElement('p');
      msg.className = 'text-muted';
      msg.textContent = 'Captura precios reales en tus productos para poder registrar el total como gasto.';
      card.appendChild(msg);
      return card;
    }

    const msg = document.createElement('p');
    msg.className = 'text-muted mb-md';
    msg.textContent = `Total real actual: ${formatMoney(totals.real)}. Regístralo como gasto para que aparezca en Semana/Mes/Dashboard.`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--primary';
    btn.textContent = 'Registrar como gasto';
    btn.addEventListener('click', () => {
      const expense = ExpenseRepository.create({
        description: list.name,
        categoryId: mandadoCategory.id,
        amount: totals.real,
        date: list.startDate || toISODate(new Date()),
        frequency: 'once',
        notes: `Generado desde la lista de mandado "${list.name}".`,
      });
      GroceryListRepository.update(list.id, { linkedExpenseId: expense.id });
      showToast('Gasto registrado');
      render();
    });

    card.append(msg, btn);
    return card;
  }

  // V2-5: "Nuevo mandado" — repetir el último (con sus productos, cantidades, categorías y
  // notas, sin nada de compra/precio real) o empezar vacío como siempre. Dos botones grandes,
  // apilados — pensado para mobile, nada que escribir todavía.
  function openNewListChoice(lastList) {
    const content = document.createElement('div');
    content.className = 'form-grid';

    const intro = document.createElement('p');
    intro.className = 'text-muted';
    intro.textContent = '¿Cómo quieres empezar?';
    content.appendChild(intro);

    const repeatBtn = document.createElement('button');
    repeatBtn.type = 'button';
    repeatBtn.className = 'btn btn--primary';
    repeatBtn.style.width = '100%';
    repeatBtn.textContent = `Repetir "${lastList.name}"`;
    repeatBtn.addEventListener('click', () => {
      const clone = GroceryListRepository.duplicate(lastList.id);
      modal.close();
      selectedListId = clone.id;
      persistSelection();
      showToast('Lista creada a partir de tu último mandado');
      render();
    });

    const emptyBtn = document.createElement('button');
    emptyBtn.type = 'button';
    emptyBtn.className = 'btn btn--ghost';
    emptyBtn.style.width = '100%';
    emptyBtn.textContent = 'Crear lista vacía';
    emptyBtn.addEventListener('click', () => {
      modal.close();
      openListForm();
    });

    content.append(repeatBtn, emptyBtn);
    const modal = openModal({ title: 'Nuevo mandado', content });
  }

  function openListForm(existing) {
    const formId = `grocery-list-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-name">Nombre</label>
        <input type="text" id="${formId}-name" name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ej. Mandado Semana 34">
      </div>
      <div>
        <label for="${formId}-date">Fecha</label>
        <input type="date" id="${formId}-date" name="startDate" required value="${existing?.startDate || toISODate(new Date())}">
      </div>
      <div>
        <label for="${formId}-budget">Presupuesto (opcional)</label>
        <input type="number" id="${formId}-budget" name="budget" min="0" step="0.01" value="${existing?.budget ?? ''}">
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
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Crear lista';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar lista' : 'Nueva lista de mandado', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = data.get('name');
      const startDate = data.get('startDate');
      const budget = data.get('budget');
      const notes = data.get('notes');

      const { valid, errors } = validate([
        { valid: isRequired(name), message: 'El nombre es obligatorio.' },
        { valid: isRequired(startDate), message: 'La fecha es obligatoria.' },
      ]);
      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      if (existing) {
        GroceryListRepository.update(existing.id, {
          name: name.trim(),
          startDate,
          budget: budget !== undefined && budget !== '' ? Number(budget) : null,
          notes: (notes || '').trim(),
        });
      } else {
        const created = GroceryListRepository.create({ name, startDate, budget, notes });
        selectedListId = created.id;
        persistSelection();
      }

      modal.close();
      showToast(existing ? 'Lista actualizada' : 'Lista creada');
      render();
    });
  }

  render();
}
