import IncomeRepository from './income.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import { renderTable } from '../../components/table.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { iconMarkup } from '../../components/icons.js';
import { openModal } from '../../components/modal.js';
import { openCategoryManager } from '../../components/category-manager.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { renderStatCard } from '../../components/stat-card.js';
import { formatMoney, kpiDelta } from '../../core/currency.js';
import { formatDateShort, toISODate, parseFlexibleDate } from '../../core/dates.js';
import { isRequired, isPositiveNumber, isValidDate, validate, escapeHtml } from '../../core/validators.js';
import { FREQUENCY_OPTIONS, frequencyLabel } from '../../services/recurrenceService.js';
import { totalIncome, incomeByType, previousPeriod } from '../../services/financeService.js';

const incomeTypeRepo = createCategoryRepository('incomeTypes');

export function renderIncomeModule(container) {
  ensureActionMenuOutsideClick();
  const view = { search: '', typeFilter: 'all' };
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  const activeTypes = () => incomeTypeRepo.list({ includeInactive: false });
  const typeName = (id) => incomeTypeRepo.list().find((t) => t.id === id)?.name || 'Sin tipo';

  function filteredIncomes() {
    const term = view.search.trim().toLowerCase();
    return IncomeRepository.list()
      .filter((inc) => (view.typeFilter === 'all' ? true : inc.incomeTypeId === view.typeFilter))
      .filter((inc) => (!term ? true : inc.description.toLowerCase().includes(term)))
      .sort((a, b) => parseFlexibleDate(b.date) - parseFlexibleDate(a.date));
  }

  function render() {
    root.innerHTML = '';
    root.append(renderHeader(), renderSummary(), renderToolbar(), renderListSection());
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Finanzas</div>
      <h2 class="dashboard-header__title">Ingresos</h2>
    `;
    return wrap;
  }

  function renderSummary() {
    const wrap = document.createElement('div');

    const period = { type: 'month', date: new Date() };
    const prev = previousPeriod(period);
    const total = totalIncome(period);
    const prevTotal = totalIncome(prev);

    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';
    grid.appendChild(renderStatCard('Ingresos del mes', formatMoney(total), {
      icon: 'trending-up',
      iconTone: 'success',
      delta: kpiDelta(total, prevTotal, { label: 'vs mes anterior' }),
    }));
    wrap.appendChild(grid);

    const breakdown = document.createElement('div');
    breakdown.className = 'card mb-md';
    const rows = incomeByType(period)
      .map(({ type, total: t }) => `<li><span>${escapeHtml(type.name)}</span><span>${formatMoney(t)}</span></li>`)
      .join('');
    breakdown.innerHTML = `<div class="card-title mb-md">Ingresos por tipo (este mes)</div><ul class="breakdown-list">${rows || '<li class="text-muted">Sin datos todavía.</li>'}</ul>`;
    wrap.appendChild(breakdown);

    return wrap;
  }

  function renderToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'flex justify-between items-center gap-sm mb-md toolbar';
    toolbar.innerHTML = `
      <div class="flex gap-sm items-center">
        <input type="search" placeholder="Buscar ingreso..." aria-label="Buscar ingreso">
        <select aria-label="Filtrar por tipo"></select>
      </div>
      <div class="flex gap-sm">
        <button type="button" class="btn btn--ghost">Gestionar tipos</button>
        <button type="button" class="btn btn--primary">+ Agregar ingreso</button>
      </div>
    `;

    const [searchInput] = toolbar.querySelectorAll('input');
    const [typeSelect] = toolbar.querySelectorAll('select');
    const [manageBtn, addBtn] = toolbar.querySelectorAll('button');

    searchInput.value = view.search;
    typeSelect.innerHTML = '<option value="all">Todos los tipos</option>'
      + activeTypes().map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    typeSelect.value = view.typeFilter;

    searchInput.addEventListener('input', (e) => {
      view.search = e.target.value;
      refreshList();
    });
    typeSelect.addEventListener('change', (e) => {
      view.typeFilter = e.target.value;
      refreshList();
    });
    manageBtn.addEventListener('click', () => {
      openCategoryManager({ title: 'Tipos de ingreso', repository: incomeTypeRepo, onChange: render });
    });
    addBtn.addEventListener('click', () => openIncomeForm());

    return toolbar;
  }

  function renderListSection() {
    const section = document.createElement('div');
    section.id = 'incomeListSection';
    section.appendChild(buildList());
    return section;
  }

  function refreshList() {
    const section = root.querySelector('#incomeListSection');
    if (!section) return;
    section.innerHTML = '';
    section.appendChild(buildList());
  }

  function buildList() {
    const incomes = filteredIncomes();
    const hasAny = IncomeRepository.list().length > 0;

    if (!incomes.length) {
      return renderEmptyState({
        icon: '💵',
        title: hasAny ? 'Sin resultados' : 'Todavía no tienes ingresos registrados',
        message: hasAny ? 'Ajusta la búsqueda o el filtro de tipo.' : 'Agrega tu primer ingreso para comenzar a llevar el control.',
        actionLabel: hasAny ? undefined : '+ Agregar primer ingreso',
        onAction: hasAny ? undefined : () => openIncomeForm(),
      });
    }

    return renderTable({
      columns: [
        { key: 'date', label: 'Fecha', render: (row) => formatDateShort(row.date) },
        { key: 'description', label: 'Concepto' },
        { key: 'incomeTypeId', label: 'Tipo', render: (row) => escapeHtml(typeName(row.incomeTypeId)) },
        { key: 'frequency', label: 'Recurrencia', render: (row) => escapeHtml(frequencyLabel(row.frequency)) },
        { key: 'amount', label: 'Cantidad', align: 'right', render: (row) => formatMoney(row.amount) },
      ],
      rows: incomes,
      rowActions: (row) => buildRowActions(row),
      renderCard: (row, actions) => renderIncomeCard(row, actions),
    });
  }

  function buildRowActions(row) {
    return createActionMenu(`Más acciones para ${row.description}`, [
      { label: 'Editar', onClick: () => openIncomeForm(row) },
      {
        label: 'Duplicar',
        onClick: () => {
          IncomeRepository.duplicate(row.id);
          showToast('Ingreso duplicado');
          render();
        },
      },
      {
        label: 'Eliminar',
        danger: true,
        onClick: async () => {
          const confirmed = await confirmDialog({
            title: 'Eliminar ingreso',
            message: `¿Eliminar "${escapeHtml(row.description)}"? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            danger: true,
          });
          if (confirmed) {
            IncomeRepository.remove(row.id);
            showToast('Ingreso eliminado');
            render();
          }
        },
      },
    ]);
  }

  // Mismo lenguaje visual que "Próximos movimientos" del Dashboard (icono + cuerpo + monto,
  // ver .movement-row* en css/components.css) — aquí dentro de la tarjeta individual ya
  // construida por table.js (.responsive-card-list__item conserva su borde/sombra propios).
  function renderIncomeCard(row, actions) {
    const card = document.createElement('div');
    card.className = 'responsive-card-list__item';

    const content = document.createElement('div');
    content.className = 'flex items-center gap-md';

    const icon = document.createElement('span');
    icon.className = 'movement-row__icon movement-row__icon--income';
    icon.innerHTML = iconMarkup('trending-up', { size: 18 });

    const body = document.createElement('div');
    body.className = 'movement-row__body';
    body.innerHTML = `
      <div class="movement-row__title">${escapeHtml(row.description)}</div>
      <div class="movement-row__subtitle">${escapeHtml(typeName(row.incomeTypeId))} · ${formatDateShort(row.date)}</div>
    `;

    const amount = document.createElement('span');
    amount.className = 'movement-row__amount movement-row__amount--income';
    amount.textContent = `+${formatMoney(row.amount)}`;

    content.append(icon, body, amount);

    const footer = document.createElement('div');
    footer.className = 'flex mt-md';
    footer.style.justifyContent = 'flex-end';
    footer.appendChild(actions);

    card.append(content, footer);
    return card;
  }

  function openIncomeForm(existing) {
    if (!activeTypes().length) {
      showToast('Primero agrega al menos un tipo de ingreso', { type: 'error' });
      openCategoryManager({ title: 'Tipos de ingreso', repository: incomeTypeRepo, onChange: render });
      return;
    }

    const formId = `income-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-description">Concepto</label>
        <input type="text" id="${formId}-description" name="description" required value="${escapeHtml(existing?.description || '')}">
      </div>
      <div class="form-row">
        <div>
          <label for="${formId}-amount">Cantidad</label>
          <input type="number" id="${formId}-amount" name="amount" min="0" step="0.01" required value="${existing?.amount ?? ''}">
        </div>
        <div>
          <label for="${formId}-date">Fecha</label>
          <input type="date" id="${formId}-date" name="date" required value="${existing?.date ? existing.date.slice(0, 10) : toISODate(new Date())}">
        </div>
      </div>
      <div>
        <label for="${formId}-type">Tipo</label>
        <select id="${formId}-type" name="incomeTypeId"></select>
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
        <label for="${formId}-notes">Notas</label>
        <textarea id="${formId}-notes" name="notes" rows="2">${escapeHtml(existing?.notes || '')}</textarea>
      </div>
      <p class="form-error hidden"></p>
    `;

    const typeSelect = form.querySelector(`#${formId}-type`);
    const availableTypes = activeTypes();
    // Si se edita un ingreso cuyo tipo fue desactivado después, debe seguir apareciendo como
    // opción (si no, el <select> cae en el primero y reasigna el ingreso a otro tipo al guardar).
    if (existing?.incomeTypeId && !availableTypes.some((t) => t.id === existing.incomeTypeId)) {
      const currentType = incomeTypeRepo.list().find((t) => t.id === existing.incomeTypeId);
      if (currentType) availableTypes.push(currentType);
    }
    typeSelect.innerHTML = availableTypes.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    if (existing?.incomeTypeId) typeSelect.value = existing.incomeTypeId;

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
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Agregar ingreso';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar ingreso' : 'Agregar ingreso', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        description: data.get('description'),
        amount: data.get('amount'),
        date: data.get('date'),
        incomeTypeId: data.get('incomeTypeId'),
        frequency: data.get('frequency'),
        intervalDays: data.get('intervalDays'),
        notes: data.get('notes'),
      };

      const { valid, errors } = validate([
        { valid: isRequired(payload.description), message: 'El concepto es obligatorio.' },
        { valid: isPositiveNumber(payload.amount), message: 'La cantidad debe ser mayor a 0.' },
        { valid: isValidDate(payload.date), message: 'La fecha no es válida.' },
        { valid: isRequired(payload.incomeTypeId), message: 'Selecciona un tipo de ingreso.' },
      ]);

      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      if (existing) IncomeRepository.update(existing.id, payload);
      else IncomeRepository.create(payload);

      modal.close();
      render();
      showToast(existing ? 'Ingreso actualizado' : 'Ingreso agregado');
    });
  }

  render();
}
