import ExpenseRepository from './expense.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import { renderTable } from '../../components/table.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { openModal } from '../../components/modal.js';
import { openCategoryManager } from '../../components/category-manager.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { formatMoney } from '../../core/currency.js';
import { formatDateShort, toISODate, parseFlexibleDate } from '../../core/dates.js';
import { isRequired, isPositiveNumber, isValidDate, validate, escapeHtml } from '../../core/validators.js';
import { FREQUENCY_OPTIONS, frequencyLabel } from '../../services/recurrenceService.js';
import { totalExpenses, expensesByCategory } from '../../services/financeService.js';

const categoryRepo = createCategoryRepository('expenseCategories');

export function renderExpenseModule(container) {
  ensureActionMenuOutsideClick();
  const view = { search: '', categoryFilter: 'all' };
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  const activeCategories = () => categoryRepo.list({ includeInactive: false });
  const categoryName = (id) => categoryRepo.list().find((c) => c.id === id)?.name || 'Sin categoría';

  function filteredExpenses() {
    const term = view.search.trim().toLowerCase();
    return ExpenseRepository.list()
      .filter((exp) => (view.categoryFilter === 'all' ? true : exp.categoryId === view.categoryFilter))
      .filter((exp) => (!term ? true : exp.description.toLowerCase().includes(term)))
      .sort((a, b) => parseFlexibleDate(b.date) - parseFlexibleDate(a.date));
  }

  function render() {
    root.innerHTML = '';
    root.append(renderSummary(), renderToolbar(), renderListSection());
  }

  function renderSummary() {
    const wrap = document.createElement('div');
    wrap.className = 'flex gap-md mb-md';
    wrap.style.flexWrap = 'wrap';

    const total = document.createElement('div');
    total.className = 'card';
    total.style.flex = '1 1 200px';
    total.innerHTML = `
      <div class="summary-card__label">Gastos de este mes</div>
      <div class="summary-card__value">${formatMoney(totalExpenses({ type: 'month', date: new Date() }))}</div>
    `;

    const breakdown = document.createElement('div');
    breakdown.className = 'card';
    breakdown.style.flex = '2 1 320px';
    const rows = expensesByCategory({ type: 'month', date: new Date() })
      .map(({ category, total: t }) => `<li><span>${escapeHtml(category.name)}</span><span>${formatMoney(t)}</span></li>`)
      .join('');
    breakdown.innerHTML = `<div class="summary-card__label mb-md">Gastos por categoría (este mes)</div><ul class="breakdown-list">${rows || '<li class="text-muted">Sin datos todavía.</li>'}</ul>`;

    wrap.append(total, breakdown);
    return wrap;
  }

  function renderToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'flex justify-between items-center gap-sm mb-md toolbar';
    toolbar.innerHTML = `
      <div class="flex gap-sm items-center">
        <input type="search" placeholder="Buscar gasto..." aria-label="Buscar gasto">
        <select aria-label="Filtrar por categoría"></select>
      </div>
      <div class="flex gap-sm">
        <button type="button" class="btn btn--ghost">Gestionar categorías</button>
        <button type="button" class="btn btn--primary">+ Agregar gasto</button>
      </div>
    `;

    const [searchInput] = toolbar.querySelectorAll('input');
    const [categorySelect] = toolbar.querySelectorAll('select');
    const [manageBtn, addBtn] = toolbar.querySelectorAll('button');

    searchInput.value = view.search;
    categorySelect.innerHTML = '<option value="all">Todas las categorías</option>'
      + activeCategories().map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    categorySelect.value = view.categoryFilter;

    searchInput.addEventListener('input', (e) => {
      view.search = e.target.value;
      refreshList();
    });
    categorySelect.addEventListener('change', (e) => {
      view.categoryFilter = e.target.value;
      refreshList();
    });
    manageBtn.addEventListener('click', () => {
      openCategoryManager({ title: 'Categorías de gasto', repository: categoryRepo, onChange: render });
    });
    addBtn.addEventListener('click', () => openExpenseForm());

    return toolbar;
  }

  function renderListSection() {
    const section = document.createElement('div');
    section.id = 'expenseListSection';
    section.appendChild(buildList());
    return section;
  }

  function refreshList() {
    const section = root.querySelector('#expenseListSection');
    if (!section) return;
    section.innerHTML = '';
    section.appendChild(buildList());
  }

  function buildList() {
    const expenses = filteredExpenses();
    const hasAny = ExpenseRepository.list().length > 0;

    if (!expenses.length) {
      return renderEmptyState({
        icon: '🧾',
        title: hasAny ? 'Sin resultados' : 'Todavía no tienes gastos registrados',
        message: hasAny ? 'Ajusta la búsqueda o el filtro de categoría.' : 'Agrega tu primer gasto para comenzar a llevar el control.',
        actionLabel: hasAny ? undefined : '+ Agregar primer gasto',
        onAction: hasAny ? undefined : () => openExpenseForm(),
      });
    }

    return renderTable({
      columns: [
        { key: 'date', label: 'Fecha', render: (row) => formatDateShort(row.date) },
        { key: 'description', label: 'Concepto' },
        { key: 'categoryId', label: 'Categoría', render: (row) => escapeHtml(categoryName(row.categoryId)) },
        { key: 'frequency', label: 'Recurrencia', render: (row) => escapeHtml(frequencyLabel(row.frequency)) },
        { key: 'amount', label: 'Cantidad', render: (row) => formatMoney(row.amount) },
      ],
      rows: expenses,
      rowActions: (row) => buildRowActions(row),
      renderCard: (row, actions) => renderExpenseCard(row, actions),
    });
  }

  function buildRowActions(row) {
    return createActionMenu(`Más acciones para ${row.description}`, [
      { label: 'Editar', onClick: () => openExpenseForm(row) },
      {
        label: 'Duplicar',
        onClick: () => {
          ExpenseRepository.duplicate(row.id);
          showToast('Gasto duplicado');
          render();
        },
      },
      {
        label: 'Eliminar',
        danger: true,
        onClick: async () => {
          const confirmed = await confirmDialog({
            title: 'Eliminar gasto',
            message: `¿Eliminar "${escapeHtml(row.description)}"? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            danger: true,
          });
          if (confirmed) {
            ExpenseRepository.remove(row.id);
            showToast('Gasto eliminado');
            render();
          }
        },
      },
    ]);
  }

  function renderExpenseCard(row, actions) {
    const card = document.createElement('div');
    card.className = 'responsive-card-list__item';

    const header = document.createElement('div');
    header.className = 'responsive-card-list__header';
    const title = document.createElement('span');
    title.className = 'responsive-card-list__title';
    title.textContent = row.description;
    const amount = document.createElement('span');
    amount.className = 'responsive-card-list__amount';
    amount.textContent = formatMoney(row.amount);
    header.append(title, amount);

    const subtitle = document.createElement('div');
    subtitle.className = 'responsive-card-list__subtitle';
    subtitle.textContent = `${categoryName(row.categoryId)} · ${formatDateShort(row.date)}`;

    const footer = document.createElement('div');
    footer.className = 'responsive-card-list__body';
    footer.style.flexDirection = 'row';
    footer.style.justifyContent = 'flex-end';
    footer.appendChild(actions);

    card.append(header, subtitle, footer);
    return card;
  }

  function openExpenseForm(existing) {
    if (!activeCategories().length) {
      showToast('Primero agrega al menos una categoría de gasto', { type: 'error' });
      openCategoryManager({ title: 'Categorías de gasto', repository: categoryRepo, onChange: render });
      return;
    }

    const formId = `expense-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-description">Concepto</label>
        <input type="text" id="${formId}-description" name="description" required value="${escapeHtml(existing?.description || '')}">
      </div>
      <div>
        <label for="${formId}-amount">Cantidad</label>
        <input type="number" id="${formId}-amount" name="amount" min="0" step="0.01" required value="${existing?.amount ?? ''}">
      </div>
      <div>
        <label for="${formId}-date">Fecha</label>
        <input type="date" id="${formId}-date" name="date" required value="${existing?.date ? existing.date.slice(0, 10) : toISODate(new Date())}">
      </div>
      <div>
        <label for="${formId}-category">Categoría</label>
        <select id="${formId}-category" name="categoryId"></select>
      </div>
      <div>
        <label for="${formId}-frequency">Recurrencia</label>
        <select id="${formId}-frequency" name="frequency"></select>
      </div>
      <div data-custom-rule class="${existing?.frequency === 'custom' ? '' : 'hidden'}">
        <label for="${formId}-interval">Repetir cada (días)</label>
        <input type="number" id="${formId}-interval" name="intervalDays" min="1" value="${existing?.customRule?.intervalDays || 30}">
      </div>
      <div>
        <label for="${formId}-dueDay">Día esperado de pago (opcional, 1-31)</label>
        <input type="number" id="${formId}-dueDay" name="dueDay" min="1" max="31" value="${existing?.dueDay || ''}">
      </div>
      <div>
        <label for="${formId}-paymentMethod">Método de pago (opcional)</label>
        <input type="text" id="${formId}-paymentMethod" name="paymentMethod" value="${escapeHtml(existing?.paymentMethod || '')}" placeholder="Efectivo, tarjeta, transferencia...">
      </div>
      <div>
        <label for="${formId}-notes">Notas</label>
        <textarea id="${formId}-notes" name="notes" rows="2">${escapeHtml(existing?.notes || '')}</textarea>
      </div>
      <p class="form-error hidden"></p>
    `;

    const categorySelect = form.querySelector(`#${formId}-category`);
    const availableCategories = activeCategories();
    // Si se edita un gasto cuya categoría fue desactivada después, debe seguir apareciendo
    // como opción (si no, el <select> cae en la primera y reasigna el gasto silenciosamente).
    if (existing?.categoryId && !availableCategories.some((c) => c.id === existing.categoryId)) {
      const currentCategory = categoryRepo.list().find((c) => c.id === existing.categoryId);
      if (currentCategory) availableCategories.push(currentCategory);
    }
    categorySelect.innerHTML = availableCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (existing?.categoryId) categorySelect.value = existing.categoryId;

    const freqSelect = form.querySelector(`#${formId}-frequency`);
    freqSelect.innerHTML = FREQUENCY_OPTIONS.map((f) => `<option value="${f.value}">${f.label}</option>`).join('');
    freqSelect.value = existing?.frequency || 'once';
    const customRuleField = form.querySelector('[data-custom-rule]');
    freqSelect.addEventListener('change', () => {
      customRuleField.classList.toggle('hidden', freqSelect.value !== 'custom');
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
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Agregar gasto';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar gasto' : 'Agregar gasto', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        description: data.get('description'),
        amount: data.get('amount'),
        date: data.get('date'),
        categoryId: data.get('categoryId'),
        frequency: data.get('frequency'),
        intervalDays: data.get('intervalDays'),
        dueDay: data.get('dueDay'),
        paymentMethod: data.get('paymentMethod'),
        notes: data.get('notes'),
      };

      const dueDayNum = Number(payload.dueDay);
      const { valid, errors } = validate([
        { valid: isRequired(payload.description), message: 'El concepto es obligatorio.' },
        { valid: isPositiveNumber(payload.amount), message: 'La cantidad debe ser mayor a 0.' },
        { valid: isValidDate(payload.date), message: 'La fecha no es válida.' },
        { valid: isRequired(payload.categoryId), message: 'Selecciona una categoría.' },
        { valid: !payload.dueDay || (Number.isInteger(dueDayNum) && dueDayNum >= 1 && dueDayNum <= 31), message: 'El día de pago debe ser un número entre 1 y 31.' },
      ]);

      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      if (existing) ExpenseRepository.update(existing.id, payload);
      else ExpenseRepository.create(payload);

      modal.close();
      render();
      showToast(existing ? 'Gasto actualizado' : 'Gasto agregado');
    });
  }

  render();
}
