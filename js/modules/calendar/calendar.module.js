// Calendario financiero: representación pura de incomes/expenses existentes (vía
// recurrenceService). No crea ninguna colección propia — solo lee/escribe a través de
// IncomeRepository/ExpenseRepository, igual que las pantallas de Ingresos/Gastos.

import State from '../../core/state.js';
import { renderMonthYearNav } from '../../components/month-year-nav.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { openMovementForm } from '../shared/movement-form.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import IncomeRepository from '../income/income.repository.js';
import ExpenseRepository from '../expenses/expense.repository.js';
import { formatMoney } from '../../core/currency.js';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, toISODate, formatDateLong,
} from '../../core/dates.js';
import { getOccurrencesInRange, frequencyLabel } from '../../services/recurrenceService.js';
import { escapeHtml } from '../../core/validators.js';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const incomeTypeRepo = createCategoryRepository('incomeTypes');
const expenseCategoryRepo = createCategoryRepository('expenseCategories');

export function renderCalendarModule(container) {
  const settings = State.getSettings();
  const now = new Date();
  let year = settings.selectedYear ?? now.getFullYear();
  let month = settings.selectedMonth ?? now.getMonth();
  let selectedDate = toISODate(now);

  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function persist() {
    State.setSettings({ selectedMonth: month, selectedYear: year });
  }

  function mandadoCategoryId() {
    return expenseCategoryRepo.list().find((c) => c.name.trim().toLowerCase() === 'mandado')?.id || null;
  }

  function buildOccurrenceMap(rangeStart, rangeEnd) {
    const map = new Map();
    function addTo(dateKey, bucketKey, item) {
      if (!map.has(dateKey)) map.set(dateKey, { incomes: [], expenses: [] });
      map.get(dateKey)[bucketKey].push(item);
    }
    State.getCollection('incomes').forEach((income) => {
      getOccurrencesInRange(income, rangeStart, rangeEnd).forEach((occ) => addTo(toISODate(occ), 'incomes', income));
    });
    State.getCollection('expenses').forEach((expense) => {
      getOccurrencesInRange(expense, rangeStart, rangeEnd).forEach((occ) => addTo(toISODate(occ), 'expenses', expense));
    });
    return map;
  }

  function render() {
    root.innerHTML = '';

    root.appendChild(renderMonthYearNav({
      month,
      year,
      onChange: (m, y) => { month = m; year = y; persist(); render(); },
    }));

    const monthStart = startOfMonth(year, month);
    const monthEnd = endOfMonth(year, month);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const occurrenceMap = buildOccurrenceMap(gridStart, gridEnd);
    const mandadoId = mandadoCategoryId();

    root.appendChild(renderGrid({ monthStart, monthEnd, gridStart, gridEnd, occurrenceMap, mandadoId }));
    root.appendChild(renderDayDetail(occurrenceMap));
  }

  function renderGrid({ monthStart, monthEnd, gridStart, gridEnd, occurrenceMap, mandadoId }) {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-grid calendar-grid--header';
    WEEKDAY_LABELS.forEach((label) => {
      const cell = document.createElement('div');
      cell.className = 'calendar-weekday';
      cell.textContent = label;
      headerRow.appendChild(cell);
    });

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    const todayIso = toISODate(new Date());
    let cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const iso = toISODate(cursor);
      const inMonth = cursor >= monthStart && cursor <= monthEnd;
      const dayData = occurrenceMap.get(iso) || { incomes: [], expenses: [] };
      const hasMandado = dayData.expenses.some((e) => e.categoryId === mandadoId);

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = [
        'calendar-day',
        inMonth ? '' : 'calendar-day--outside',
        iso === todayIso ? 'calendar-day--today' : '',
        iso === selectedDate ? 'calendar-day--selected' : '',
      ].filter(Boolean).join(' ');
      cell.setAttribute('aria-label', formatDateLong(cursor));
      cell.innerHTML = `
        <span class="calendar-day__number">${cursor.getDate()}</span>
        <span class="calendar-day__badges">
          ${dayData.incomes.length ? `<span class="calendar-badge calendar-badge--income">💰${dayData.incomes.length}</span>` : ''}
          ${dayData.expenses.length ? `<span class="calendar-badge calendar-badge--expense">🧾${dayData.expenses.length}</span>` : ''}
          ${hasMandado ? '<span class="calendar-badge calendar-badge--mandado">🛒</span>' : ''}
        </span>
      `;
      cell.addEventListener('click', () => {
        selectedDate = iso;
        render();
      });

      grid.appendChild(cell);
      const next = new Date(cursor);
      next.setDate(next.getDate() + 1);
      cursor = next;
    }

    card.append(headerRow, grid);
    return card;
  }

  function renderDayDetail(occurrenceMap) {
    const card = document.createElement('div');
    card.className = 'card';

    const dayData = occurrenceMap.get(selectedDate) || { incomes: [], expenses: [] };
    const totalIncomeDay = dayData.incomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const totalExpenseDay = dayData.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center gap-sm mb-md';
    header.style.flexWrap = 'wrap';

    const title = document.createElement('div');
    title.className = 'summary-card__label';
    title.textContent = formatDateLong(selectedDate);

    const actions = document.createElement('div');
    actions.className = 'flex gap-sm';

    const addIncomeBtn = document.createElement('button');
    addIncomeBtn.type = 'button';
    addIncomeBtn.className = 'btn btn--ghost';
    addIncomeBtn.textContent = '+ Ingreso';
    addIncomeBtn.addEventListener('click', () => openMovementForm({ type: 'income', defaultDate: selectedDate, onSaved: render }));

    const addExpenseBtn = document.createElement('button');
    addExpenseBtn.type = 'button';
    addExpenseBtn.className = 'btn btn--primary';
    addExpenseBtn.textContent = '+ Gasto';
    addExpenseBtn.addEventListener('click', () => openMovementForm({ type: 'expense', defaultDate: selectedDate, onSaved: render }));

    actions.append(addIncomeBtn, addExpenseBtn);
    header.append(title, actions);
    card.appendChild(header);

    if (!dayData.incomes.length && !dayData.expenses.length) {
      card.appendChild(renderEmptyState({
        icon: '📅',
        title: 'Sin movimientos este día',
        message: 'Agrega un ingreso o gasto para esta fecha con los botones de arriba.',
      }));
      return card;
    }

    if (dayData.incomes.length) card.appendChild(renderMovementList(dayData.incomes, 'income', totalIncomeDay));
    if (dayData.expenses.length) card.appendChild(renderMovementList(dayData.expenses, 'expense', totalExpenseDay));

    return card;
  }

  function renderMovementList(items, kind, total) {
    const isIncome = kind === 'income';
    const categoryRepo = isIncome ? incomeTypeRepo : expenseCategoryRepo;

    const section = document.createElement('div');
    section.className = 'mb-md';
    section.innerHTML = `<div class="summary-card__label mb-md">${isIncome ? 'Ingresos' : 'Gastos'} del día — ${formatMoney(total)}</div>`;

    const list = document.createElement('ul');
    list.className = 'top-expenses-list';

    items.forEach((item) => {
      const categoryId = isIncome ? item.incomeTypeId : item.categoryId;
      const categoryName = categoryRepo.list().find((c) => c.id === categoryId)?.name || 'Sin categoría';
      const recurrent = item.frequency !== 'once';

      const li = document.createElement('li');

      const info = document.createElement('span');
      info.innerHTML = `${escapeHtml(item.description)} <span class="text-muted">(${escapeHtml(categoryName)}${recurrent ? ` · 🔁 ${escapeHtml(frequencyLabel(item.frequency))}` : ''})</span>`;

      const right = document.createElement('span');
      right.className = 'flex gap-xs items-center';

      const amountSpan = document.createElement('span');
      amountSpan.textContent = formatMoney(item.amount);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn--ghost';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', () => openMovementForm({ type: kind, existing: item, onSaved: render }));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn--danger';
      delBtn.textContent = 'Eliminar';
      delBtn.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: `Eliminar ${isIncome ? 'ingreso' : 'gasto'}`,
          message: recurrent
            ? `"${escapeHtml(item.description)}" es recurrente (${escapeHtml(frequencyLabel(item.frequency))}). Eliminarlo quitará TODAS sus ocurrencias, no solo este día. ¿Continuar?`
            : `¿Eliminar "${escapeHtml(item.description)}"? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar',
          danger: true,
        });
        if (confirmed) {
          (isIncome ? IncomeRepository : ExpenseRepository).remove(item.id);
          showToast(`${isIncome ? 'Ingreso' : 'Gasto'} eliminado`);
          render();
        }
      });

      right.append(amountSpan, editBtn, delBtn);
      li.append(info, right);
      list.appendChild(li);
    });

    section.appendChild(list);
    return section;
  }

  render();
}
