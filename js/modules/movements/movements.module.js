// Vista "Movimientos": combina Ingresos y Gastos en una sola pantalla con filtro
// Todos/Ingresos/Gastos (V2-8 — simplificación de navegación). No crea ninguna colección
// propia ni duplica lógica: lee/escribe a través de los MISMOS repositorios que usan las
// pantallas de Ingresos/Gastos. Esas pantallas siguen existiendo (ya no en el sidebar
// directo) para gestión avanzada — dueDay, método de pago, categorías — accesibles desde
// los enlaces al final de esta vista (principio "máximo ~2 interacciones" de V2-8).

import { renderEmptyState } from '../../components/empty-state.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { iconMarkup } from '../../components/icons.js';
import { openMovementForm } from '../shared/movement-form.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import IncomeRepository from '../income/income.repository.js';
import ExpenseRepository from '../expenses/expense.repository.js';
import { formatMoney } from '../../core/currency.js';
import { formatDateShort, parseFlexibleDate } from '../../core/dates.js';
import { frequencyLabel } from '../../services/recurrenceService.js';
import { escapeHtml } from '../../core/validators.js';

const incomeTypeRepo = createCategoryRepository('incomeTypes');
const expenseCategoryRepo = createCategoryRepository('expenseCategories');

const FILTERS = [
  ['all', 'Todos'],
  ['income', 'Ingresos'],
  ['expense', 'Gastos'],
];

export function renderMovementsModule(container) {
  ensureActionMenuOutsideClick();
  const view = { filter: 'all' };

  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function combinedMovements() {
    const incomes = IncomeRepository.list().map((row) => ({ kind: 'income', row }));
    const expenses = ExpenseRepository.list().map((row) => ({ kind: 'expense', row }));
    const items = view.filter === 'all' ? incomes.concat(expenses)
      : view.filter === 'income' ? incomes : expenses;
    return items.sort((a, b) => parseFlexibleDate(b.row.date) - parseFlexibleDate(a.row.date));
  }

  function render() {
    root.innerHTML = '';
    root.append(renderHeader(), renderToolbar(), renderListSection());
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Finanzas</div>
      <h2 class="dashboard-header__title">Movimientos</h2>
    `;
    return wrap;
  }

  function renderToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'flex justify-between items-center gap-sm mb-md toolbar';
    toolbar.style.flexWrap = 'wrap';

    const filters = document.createElement('div');
    filters.className = 'flex flex-wrap gap-sm';
    FILTERS.forEach(([value, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${view.filter === value ? 'btn--primary' : 'btn--ghost'}`;
      btn.textContent = label;
      btn.addEventListener('click', () => { view.filter = value; render(); });
      filters.appendChild(btn);
    });

    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap gap-sm';

    const addIncomeBtn = document.createElement('button');
    addIncomeBtn.type = 'button';
    addIncomeBtn.className = 'btn btn--ghost';
    addIncomeBtn.textContent = '+ Ingreso';
    addIncomeBtn.addEventListener('click', () => openMovementForm({ type: 'income', onSaved: render }));

    const addExpenseBtn = document.createElement('button');
    addExpenseBtn.type = 'button';
    addExpenseBtn.className = 'btn btn--primary';
    addExpenseBtn.textContent = '+ Gasto';
    addExpenseBtn.addEventListener('click', () => openMovementForm({ type: 'expense', onSaved: render }));

    actions.append(addIncomeBtn, addExpenseBtn);
    toolbar.append(filters, actions);
    return toolbar;
  }

  function renderListSection() {
    const section = document.createElement('div');
    section.appendChild(buildList());
    return section;
  }

  function buildList() {
    const items = combinedMovements();
    const hasAny = IncomeRepository.list().length > 0 || ExpenseRepository.list().length > 0;

    const wrap = document.createElement('div');

    if (!items.length) {
      wrap.appendChild(renderEmptyState({
        icon: '💳',
        title: hasAny ? 'Sin resultados' : 'Todavía no tienes movimientos registrados',
        message: hasAny ? 'Ajusta el filtro para ver otros movimientos.' : 'Agrega un ingreso o gasto con los botones de arriba.',
      }));
      return wrap;
    }

    const card = document.createElement('div');
    card.className = 'card';
    const list = document.createElement('div');
    list.className = 'movement-list';
    items.forEach(({ kind, row }) => list.appendChild(renderMovementRow(kind, row)));
    card.appendChild(list);

    wrap.append(card, renderManageLinks());
    return wrap;
  }

  // Mismo lenguaje visual que Dashboard/Calendario/Ingresos/Gastos (icono + cuerpo + monto +
  // menú ⋮, ver .movement-row* en css/components.css) — sin inventar ningún estilo nuevo.
  function renderMovementRow(kind, row) {
    const isIncome = kind === 'income';
    const categoryRepo = isIncome ? incomeTypeRepo : expenseCategoryRepo;
    const categoryId = isIncome ? row.incomeTypeId : row.categoryId;
    const categoryName = categoryRepo.list().find((c) => c.id === categoryId)?.name || 'Sin categoría';
    const recurrent = row.frequency && row.frequency !== 'once';

    const rowEl = document.createElement('div');
    rowEl.className = 'movement-row';

    const icon = document.createElement('span');
    icon.className = `movement-row__icon${isIncome ? ' movement-row__icon--income' : ' movement-row__icon--expense'}`;
    icon.innerHTML = iconMarkup(isIncome ? 'trending-up' : 'trending-down', { size: 18 });

    const body = document.createElement('div');
    body.className = 'movement-row__body';
    body.innerHTML = `
      <div class="movement-row__title">${escapeHtml(row.description)}</div>
      <div class="movement-row__subtitle">${escapeHtml(categoryName)} · ${formatDateShort(row.date)}${recurrent ? ` · ${escapeHtml(frequencyLabel(row.frequency))}` : ''}</div>
    `;

    const amount = document.createElement('span');
    amount.className = `movement-row__amount${isIncome ? ' movement-row__amount--income' : ''}`;
    amount.textContent = `${isIncome ? '+' : '-'}${formatMoney(row.amount)}`;

    const menu = createActionMenu(`Más acciones para ${row.description}`, [
      { label: 'Editar', onClick: () => openMovementForm({ type: kind, existing: row, onSaved: render }) },
      {
        label: 'Eliminar',
        danger: true,
        onClick: async () => {
          const confirmed = await confirmDialog({
            title: `Eliminar ${isIncome ? 'ingreso' : 'gasto'}`,
            message: recurrent
              ? `"${escapeHtml(row.description)}" es recurrente (${escapeHtml(frequencyLabel(row.frequency))}). Eliminarlo quitará TODAS sus ocurrencias. ¿Continuar?`
              : `¿Eliminar "${escapeHtml(row.description)}"? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            danger: true,
          });
          if (confirmed) {
            (isIncome ? IncomeRepository : ExpenseRepository).remove(row.id);
            showToast(`${isIncome ? 'Ingreso' : 'Gasto'} eliminado`);
            render();
          }
        },
      },
    ]);

    rowEl.append(icon, body, amount, menu);
    return rowEl;
  }

  // Gestión avanzada (dueDay, método de pago, categorías) vive en las pantallas completas
  // de Ingresos/Gastos: ya no están en el sidebar directo, pero siguen 100% funcionales y
  // accesibles a un toque desde aquí.
  function renderManageLinks() {
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-wrap gap-sm mt-md';
    wrap.innerHTML = `
      <a href="#/ingresos" class="btn btn--ghost">Gestionar ingresos</a>
      <a href="#/gastos" class="btn btn--ghost">Gestionar gastos</a>
    `;
    return wrap;
  }

  render();
}
