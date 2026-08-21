// Pantalla principal de Mandado ("Mi lista"). No crea ninguna base de datos independiente:
// lee/escribe a través de GroceryList/GroceryListItem/Product repositories y de
// groceryService para los totales (ver docs/architecture.md, docs/decisions.md).

import State from '../../core/state.js';
import GroceryListRepository from './grocery-list.repository.js';
import GroceryListItemRepository from './grocery-list-item.repository.js';
import ProductRepository from './product.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import ExpenseRepository from '../expenses/expense.repository.js';
import { itemsForList, categoryTotals, listTotals, itemEffectiveSubtotal } from '../../services/groceryService.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { iconMarkup } from '../../components/icons.js';
import { openModal } from '../../components/modal.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { formatMoney, formatPercent } from '../../core/currency.js';
import { toISODate, formatDateShort } from '../../core/dates.js';
import { isRequired, isPositiveNumber, validate, escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from './units.js';

const groceryCategoryRepo = createCategoryRepository('groceryCategories');
const expenseCategoryRepo = createCategoryRepository('expenseCategories');

export function renderGroceryListModule(container) {
  ensureActionMenuOutsideClick();
  const settings = State.getSettings();
  let selectedListId = settings.selectedGroceryListId || null;

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
    root.appendChild(renderItemsByCategory(list));
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

    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'btn btn--primary';
    newBtn.textContent = '+ Nueva lista';
    newBtn.addEventListener('click', () => openListForm());
    actions.appendChild(newBtn);

    if (selectedListId) {
      const list = GroceryListRepository.getById(selectedListId);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn--ghost';
      editBtn.textContent = 'Editar lista';
      editBtn.addEventListener('click', () => openListForm(list));

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'btn btn--ghost';
      toggleBtn.textContent = list.status === 'open' ? 'Marcar completada' : 'Reabrir';
      toggleBtn.addEventListener('click', () => {
        GroceryListRepository.update(list.id, { status: list.status === 'open' ? 'closed' : 'open' });
        render();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn--danger';
      delBtn.textContent = 'Eliminar lista';
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

  function renderItemsByCategory(list) {
    const wrap = document.createElement('div');
    const totals = categoryTotals(list.id);

    const addBar = document.createElement('div');
    addBar.className = 'flex justify-end mb-md';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn--primary';
    addBtn.textContent = '+ Agregar producto';
    addBtn.addEventListener('click', () => openItemForm(list));
    addBar.appendChild(addBtn);
    wrap.appendChild(addBar);

    if (!totals.length) {
      wrap.appendChild(renderEmptyState({
        icon: '🥕',
        title: 'Esta lista todavía no tiene productos',
        message: 'Agrega tu primer producto con el botón de arriba.',
      }));
      return wrap;
    }

    totals.forEach(({ category, effective }) => {
      const items = itemsForList(list.id).filter((i) => i.categoryId === category.id);
      if (!items.length) return;
      wrap.appendChild(renderCategoryGroup(list, category, items, effective));
    });

    return wrap;
  }

  function renderCategoryGroup(list, category, items, categoryEffectiveTotal) {
    // .mandado-category es una .card solo en escritorio; en móvil pierde el fondo/borde y
    // cada .grocery-item-row pasa a ser su propia tarjeta suelta (ver css/responsive.css
    // <1024px) — así se evita el look de "tarjetas dentro de una tarjeta".
    const card = document.createElement('div');
    card.className = 'mandado-category mb-md';

    const purchasedInCategory = items.filter((i) => i.purchased).length;

    const header = document.createElement('div');
    header.className = 'mandado-category__header';
    header.innerHTML = `
      <div class="mandado-category__title">
        <span class="mandado-category__bar" aria-hidden="true"></span>
        <span class="card-title">${escapeHtml(category.name)}</span>
        <span class="badge badge--neutral">${purchasedInCategory}/${items.length} items</span>
      </div>
      <div class="mandado-category__total">${formatMoney(categoryEffectiveTotal)}</div>
    `;
    card.appendChild(header);

    const itemList = document.createElement('div');
    itemList.className = 'grocery-item-list';
    items.forEach((item) => itemList.appendChild(renderItemRow(item)));
    card.appendChild(itemList);

    return card;
  }

  function renderItemRow(item) {
    const product = ProductRepository.getById(item.productId);
    const unitLabel = UNIT_OPTIONS.find((u) => u.value === item.unit)?.label || item.unit;

    const row = document.createElement('div');
    row.className = `grocery-item-row${item.purchased ? ' grocery-item-row--purchased' : ''}`;

    const checkboxWrap = document.createElement('label');
    checkboxWrap.className = 'grocery-item-row__checkbox-wrap';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.purchased;
    checkbox.setAttribute('aria-label', `Marcar ${product?.name || 'producto'} como comprado`);
    checkbox.addEventListener('change', () => {
      GroceryListItemRepository.update(item.id, { purchased: checkbox.checked });
      render();
    });
    checkboxWrap.appendChild(checkbox);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'grocery-item-row__name';
    nameSpan.textContent = product?.name || '(producto eliminado)';

    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'grocery-item-row__qty-wrap';

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '0';
    qtyInput.step = '0.01';
    qtyInput.value = item.quantity;
    qtyInput.className = 'grocery-item-row__qty';
    qtyInput.setAttribute('aria-label', 'Cantidad');
    qtyInput.addEventListener('change', () => {
      const value = Number(qtyInput.value);
      if (value > 0) {
        GroceryListItemRepository.update(item.id, { quantity: value });
      } else {
        showToast('La cantidad debe ser mayor a 0.', { type: 'error' });
      }
      render();
    });

    const unitSelect = document.createElement('select');
    unitSelect.setAttribute('aria-label', 'Unidad');
    unitSelect.innerHTML = UNIT_OPTIONS.map((u) => `<option value="${u.value}">${u.label}</option>`).join('');
    unitSelect.value = item.unit;
    unitSelect.addEventListener('change', () => {
      GroceryListItemRepository.update(item.id, { unit: unitSelect.value });
      render();
    });

    qtyWrap.append(qtyInput, unitSelect);

    const estField = document.createElement('div');
    estField.className = 'grocery-item-row__field grocery-item-row__field--est';
    const estLabel = document.createElement('span');
    estLabel.className = 'grocery-item-row__field-label';
    estLabel.textContent = `Est./${unitLabel}`;

    const estInput = document.createElement('input');
    estInput.type = 'number';
    estInput.min = '0';
    estInput.step = '0.01';
    estInput.placeholder = 'Precio est.';
    estInput.value = item.estimatedPrice ?? '';
    estInput.className = 'grocery-item-row__price';
    estInput.setAttribute('aria-label', 'Precio estimado por unidad');
    estInput.addEventListener('change', () => {
      const raw = estInput.value;
      if (raw !== '' && !(Number(raw) >= 0)) {
        showToast('El precio estimado no puede ser negativo.', { type: 'error' });
      } else {
        GroceryListItemRepository.update(item.id, { estimatedPrice: raw === '' ? null : Number(raw) });
      }
      render();
    });
    estField.append(estLabel, estInput);

    const realField = document.createElement('div');
    realField.className = 'grocery-item-row__field grocery-item-row__field--real';
    const realLabel = document.createElement('span');
    realLabel.className = 'grocery-item-row__field-label';
    realLabel.textContent = `Real/${unitLabel}`;

    const actualInput = document.createElement('input');
    actualInput.type = 'number';
    actualInput.min = '0';
    actualInput.step = '0.01';
    actualInput.placeholder = 'Precio real';
    actualInput.value = item.actualPrice ?? '';
    actualInput.className = 'grocery-item-row__price';
    actualInput.setAttribute('aria-label', 'Precio real por unidad');
    actualInput.addEventListener('change', () => {
      const raw = actualInput.value;
      if (raw !== '' && !(Number(raw) >= 0)) {
        showToast('El precio real no puede ser negativo.', { type: 'error' });
      } else {
        GroceryListItemRepository.update(item.id, { actualPrice: raw === '' ? null : Number(raw) });
      }
      render();
    });
    realField.append(realLabel, actualInput);

    const subtotalWrap = document.createElement('div');
    subtotalWrap.className = 'grocery-item-row__subtotal-wrap';
    const subtotalLabel = document.createElement('span');
    subtotalLabel.className = 'grocery-item-row__subtotal-label';
    subtotalLabel.textContent = 'Subtotal';
    const subtotalSpan = document.createElement('span');
    subtotalSpan.className = 'grocery-item-row__subtotal';
    subtotalSpan.textContent = formatMoney(itemEffectiveSubtotal(item));
    subtotalWrap.append(subtotalLabel, subtotalSpan);

    const menu = createActionMenu(`Más acciones para ${product?.name || 'producto'}`, [
      {
        label: item.notes ? 'Notas 📝' : 'Notas',
        onClick: () => {
          const value = window.prompt('Notas', item.notes || '');
          if (value !== null) {
            GroceryListItemRepository.update(item.id, { notes: value });
            render();
          }
        },
      },
      {
        label: 'Quitar de la lista',
        danger: true,
        onClick: async () => {
          const confirmed = await confirmDialog({
            title: 'Quitar producto',
            message: `¿Quitar "${product?.name || ''}" de esta lista?`,
            confirmText: 'Quitar',
            danger: true,
          });
          if (confirmed) {
            GroceryListItemRepository.remove(item.id);
            showToast('Producto quitado de la lista');
            render();
          }
        },
      },
    ]);
    menu.classList.add('grocery-item-row__menu');

    row.append(checkboxWrap, nameSpan, qtyWrap, estField, realField, subtotalWrap, menu);
    return row;
  }

  function openItemForm(list) {
    const categories = groceryCategoryRepo.list({ includeInactive: false });
    if (!categories.length) {
      showToast('Primero agrega una categoría de mandado.', { type: 'error' });
      return;
    }

    const products = ProductRepository.list({ includeInactive: false });
    const formId = `grocery-item-form-${Date.now()}`;
    const datalistId = `${formId}-products`;

    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-name">Producto</label>
        <input type="text" id="${formId}-name" name="name" list="${datalistId}" required autocomplete="off" placeholder="Ej. Tomate">
        <datalist id="${datalistId}">${products.map((p) => `<option value="${escapeHtml(p.name)}"></option>`).join('')}</datalist>
      </div>
      <div>
        <label for="${formId}-category">Categoría</label>
        <select id="${formId}-category" name="categoryId">${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
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

    const nameInput = form.querySelector(`#${formId}-name`);
    const categorySelect = form.querySelector(`#${formId}-category`);
    const unitSelect = form.querySelector(`#${formId}-unit`);
    nameInput.addEventListener('input', () => {
      const match = ProductRepository.findByName(nameInput.value, { includeInactive: false });
      if (match) {
        categorySelect.value = match.categoryId;
        unitSelect.value = match.preferredUnit;
      }
    });

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
      const name = data.get('name');
      const categoryId = data.get('categoryId');
      const quantity = data.get('quantity');
      const unit = data.get('unit');
      const estimatedPrice = data.get('estimatedPrice');
      const notes = data.get('notes');

      const { valid, errors } = validate([
        { valid: isRequired(name), message: 'El nombre del producto es obligatorio.' },
        { valid: isPositiveNumber(quantity), message: 'La cantidad debe ser mayor a 0.' },
      ]);
      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      let product = ProductRepository.findByName(name, { includeInactive: false });
      if (!product) {
        product = ProductRepository.create({ name, categoryId, preferredUnit: unit });
      }

      GroceryListItemRepository.create({
        groceryListId: list.id,
        productId: product.id,
        categoryId: product.categoryId,
        quantity,
        unit,
        estimatedPrice,
        notes,
      });

      modal.close();
      showToast('Producto agregado a la lista');
      render();
    });
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
