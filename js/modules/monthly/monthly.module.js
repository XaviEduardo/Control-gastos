// Vista mensual: 100% calculada a partir de incomes/expenses existentes vía financeService.
// No crea ni duplica ninguna entidad. Funciona para cualquier año (no hardcodea 2026).

import State from '../../core/state.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import ExpenseRepository from '../expenses/expense.repository.js';
import { renderStatCard } from '../../components/stat-card.js';
import { renderProgressCard } from '../../components/progress-card.js';
import { renderMonthYearNav } from '../../components/month-year-nav.js';
import { formatMoney, kpiDelta } from '../../core/currency.js';
import { endOfMonth } from '../../core/dates.js';
import {
  totalIncome, totalExpenses, expensesByCategory, previousPeriod, getPeriodRange, mandadoTotal,
} from '../../services/financeService.js';
import { getOccurrencesInRange } from '../../services/recurrenceService.js';
import { budgetProgress } from '../../services/budgetService.js';
import BudgetRepository from '../budget/budget.repository.js';
import { escapeHtml } from '../../core/validators.js';

const categoryRepo = createCategoryRepository('expenseCategories');

function topExpenses(period, limit = 5) {
  const [start, end] = getPeriodRange(period);
  return ExpenseRepository.list()
    .map((expense) => {
      const occurrences = getOccurrencesInRange(expense, start, end).length;
      return { expense, occurrences, effective: occurrences * (Number(expense.amount) || 0) };
    })
    .filter((entry) => entry.occurrences > 0)
    .sort((a, b) => b.effective - a.effective)
    .slice(0, limit);
}

export function renderMonthlyModule(container) {
  const settings = State.getSettings();
  const now = new Date();
  let year = settings.selectedYear ?? now.getFullYear();
  let month = settings.selectedMonth ?? now.getMonth();

  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function persist() {
    State.setSettings({ selectedYear: year, selectedMonth: month });
  }


  function render() {
    root.innerHTML = '';
    const period = { type: 'month', date: new Date(year, month, 1) };
    const prev = previousPeriod(period);

    const income = totalIncome(period);
    const expense = totalExpenses(period);
    const prevIncome = totalIncome(prev);
    const prevExpense = totalExpenses(prev);
    const mandado = mandadoTotal(period);

    const daysInMonth = endOfMonth(year, month).getDate();
    const weeklyAvg = expense / (daysInMonth / 7);

    const monthYearNav = renderMonthYearNav({
      month, year, onChange: (m, y) => { month = m; year = y; persist(); render(); },
    });
    const sections = [renderHeader(), monthYearNav, renderStats({ income, expense, prevIncome, prevExpense, mandado, weeklyAvg })];
    const monthlyBudget = BudgetRepository.find('monthly');
    const groceryBudget = BudgetRepository.find('grocery');
    if (monthlyBudget) sections.push(progressCardSpaced('Presupuesto mensual', budgetProgress(monthlyBudget, period), { icon: 'target' }));
    if (groceryBudget) sections.push(progressCardSpaced('Mandado', budgetProgress(groceryBudget, period), { icon: 'cart', amountFirst: true }));
    sections.push(
      renderCategoryBreakdown(period),
      renderTopExpenses(period),
    );
    root.append(...sections);
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Finanzas</div>
      <h2 class="dashboard-header__title">Mes</h2>
    `;
    return wrap;
  }

  // renderProgressCard() no trae margen propio (también se usa dentro de grids con `gap`,
  // ej. Dashboard) — aquí, apilada a pantalla completa, sí necesita separación.
  function progressCardSpaced(title, progress, opts) {
    const card = renderProgressCard(title, progress, opts);
    card.classList.add('mb-md');
    return card;
  }

  // Cada KPI ya muestra su propio delta vs mes anterior (ver kpiDelta) — no hace falta una
  // sección de "Comparación" separada como antes (renderComparison), quedaba redundante.
  function renderStats({ income, expense, prevIncome, prevExpense, mandado, weeklyAvg }) {
    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';

    grid.appendChild(renderStatCard('Ingresos', formatMoney(income), {
      icon: 'trending-up', iconTone: 'success', delta: kpiDelta(income, prevIncome, { label: 'vs mes anterior' }),
    }));
    grid.appendChild(renderStatCard('Gastos', formatMoney(expense), {
      icon: 'trending-down', iconTone: 'danger', delta: kpiDelta(expense, prevExpense, { invert: true, label: 'vs mes anterior' }),
    }));
    grid.appendChild(renderStatCard('Balance', formatMoney(income - expense), {
      icon: 'bank', hero: true, delta: kpiDelta(income - expense, prevIncome - prevExpense, { label: 'vs mes anterior' }),
    }));
    if (mandado !== null) grid.appendChild(renderStatCard('Mandado', formatMoney(mandado), { icon: 'cart' }));
    grid.appendChild(renderStatCard('Promedio semanal de gasto', formatMoney(weeklyAvg), { icon: 'calendar' }));

    return grid;
  }

  function renderCategoryBreakdown(period) {
    const card = document.createElement('div');
    card.className = 'card mb-md';
    const rows = expensesByCategory(period)
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((entry) => `<li><span>${escapeHtml(entry.category.name)}</span><span>${formatMoney(entry.total)}</span></li>`)
      .join('');
    card.innerHTML = `<div class="card-title mb-md">Gastos por categoría</div><ul class="breakdown-list">${rows || '<li class="text-muted">Sin gastos este mes.</li>'}</ul>`;
    return card;
  }

  function renderTopExpenses(period) {
    const card = document.createElement('div');
    card.className = 'card';
    const entries = topExpenses(period);
    const rows = entries.map(({ expense, occurrences, effective }) => {
      const categoryName = categoryRepo.list().find((c) => c.id === expense.categoryId)?.name || 'Sin categoría';
      const occurrenceNote = occurrences > 1 ? ` · ${occurrences} ocurrencias` : '';
      return `<li><span>${escapeHtml(expense.description)} <span class="text-muted">(${escapeHtml(categoryName)}${occurrenceNote})</span></span><span>${formatMoney(effective)}</span></li>`;
    }).join('');
    card.innerHTML = `<div class="card-title mb-md">Principales gastos del mes</div><ul class="top-expenses-list">${rows || '<li class="text-muted">Sin gastos este mes.</li>'}</ul>`;
    return card;
  }

  render();
}
