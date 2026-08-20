// Vista mensual: 100% calculada a partir de incomes/expenses existentes vía financeService.
// No crea ni duplica ninguna entidad. Funciona para cualquier año (no hardcodea 2026).

import State from '../../core/state.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import ExpenseRepository from '../expenses/expense.repository.js';
import { formatMoney, formatPercent } from '../../core/currency.js';
import { MONTH_NAMES, endOfMonth } from '../../core/dates.js';
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

function formatDelta(current, previous) {
  if (previous === 0) return current === 0 ? 'Sin cambio' : 'Nuevo (sin datos el mes anterior)';
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '→';
  return `${arrow} ${Math.abs(pct)}% vs mes anterior`;
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

  function goToMonth(offset) {
    month += offset;
    if (month < 0) { month = 11; year -= 1; }
    else if (month > 11) { month = 0; year += 1; }
    persist();
    render();
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

    const sections = [renderNav(), renderStats({ income, expense, mandado, weeklyAvg })];
    const monthlyBudget = BudgetRepository.find('monthly');
    const groceryBudget = BudgetRepository.find('grocery');
    if (monthlyBudget) sections.push(renderBudgetSection('Presupuesto mensual', monthlyBudget, period));
    if (groceryBudget) sections.push(renderBudgetSection('Presupuesto de mandado', groceryBudget, period));
    sections.push(
      renderComparison({ income, expense, prevIncome, prevExpense }),
      renderCategoryBreakdown(period),
      renderTopExpenses(period),
    );
    root.append(...sections);
  }

  function renderBudgetSection(title, budget, period) {
    const progress = budgetProgress(budget, period);
    const over = progress.remaining < 0;
    const finite = Number.isFinite(progress.percentUsed);
    const pctForBar = finite ? Math.min(progress.percentUsed * 100, 100) : 100;
    const pctText = finite ? formatPercent(progress.percentUsed, 2) : 'más de 100%';

    const card = document.createElement('div');
    card.className = 'card mb-md';
    card.innerHTML = `
      <div class="summary-card__label mb-md">${title}</div>
      <div class="text-muted">Presupuesto ${formatMoney(progress.amount)} · Gastado ${formatMoney(progress.spent)} · ${over ? 'Excedido' : 'Disponible'} ${formatMoney(Math.abs(progress.remaining))}</div>
      <div class="progress-bar mt-md"><div class="progress-bar__fill${over ? ' progress-bar__fill--over' : ''}" style="width:${pctForBar}%"></div></div>
      <div class="text-muted mt-md">${pctText} utilizado${over ? ' — presupuesto excedido' : ''}</div>
    `;
    return card;
  }

  function renderNav() {
    const wrap = document.createElement('div');
    wrap.className = 'card mb-md';

    const nav = document.createElement('div');
    nav.className = 'period-nav';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'btn btn--ghost';
    prevBtn.textContent = '← Mes anterior';
    prevBtn.addEventListener('click', () => goToMonth(-1));

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn--ghost';
    nextBtn.textContent = 'Mes siguiente →';
    nextBtn.addEventListener('click', () => goToMonth(1));

    const jump = document.createElement('div');
    jump.className = 'period-nav__jump';
    jump.innerHTML = `
      <label for="monthSelect">Mes</label>
      <select id="monthSelect">${MONTH_NAMES.map((name, i) => `<option value="${i}">${name}</option>`).join('')}</select>
      <label for="yearInput">Año</label>
      <input type="number" id="yearInput" value="${year}" step="1">
    `;
    const monthSelect = jump.querySelector('#monthSelect');
    const yearInput = jump.querySelector('#yearInput');
    monthSelect.value = String(month);

    monthSelect.addEventListener('change', () => {
      month = Number(monthSelect.value);
      persist();
      render();
    });
    yearInput.addEventListener('change', () => {
      const parsed = Number(yearInput.value);
      if (Number.isInteger(parsed)) {
        year = parsed;
        persist();
        render();
      }
    });

    nav.append(prevBtn, jump, nextBtn);
    wrap.appendChild(nav);
    return wrap;
  }

  function renderStats({ income, expense, mandado, weeklyAvg }) {
    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';

    grid.appendChild(statCard('Ingresos', formatMoney(income)));
    grid.appendChild(statCard('Gastos', formatMoney(expense)));
    grid.appendChild(statCard('Balance', formatMoney(income - expense), income - expense < 0 ? 'negative' : 'positive'));
    if (mandado !== null) grid.appendChild(statCard('Mandado', formatMoney(mandado)));
    grid.appendChild(statCard('Promedio semanal de gasto', formatMoney(weeklyAvg)));

    return grid;
  }

  function statCard(label, value, tone) {
    const card = document.createElement('div');
    card.className = `card stat-card${tone ? ` stat-card--${tone}` : ''}`;
    card.innerHTML = `<div class="summary-card__label">${label}</div><div class="summary-card__value">${value}</div>`;
    return card;
  }

  function renderComparison({ income, expense, prevIncome, prevExpense }) {
    const card = document.createElement('div');
    card.className = 'card mb-md';
    card.innerHTML = `
      <div class="summary-card__label mb-md">Comparación contra el mes anterior</div>
      <ul class="comparison-list">
        <li><span>Ingresos</span><span>${formatMoney(income)} <span class="text-muted">(${formatDelta(income, prevIncome)})</span></span></li>
        <li><span>Gastos</span><span>${formatMoney(expense)} <span class="text-muted">(${formatDelta(expense, prevExpense)})</span></span></li>
        <li><span>Balance</span><span>${formatMoney(income - expense)} <span class="text-muted">(${formatDelta(income - expense, prevIncome - prevExpense)})</span></span></li>
      </ul>
    `;
    return card;
  }

  function renderCategoryBreakdown(period) {
    const card = document.createElement('div');
    card.className = 'card mb-md';
    const rows = expensesByCategory(period)
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((entry) => `<li><span>${escapeHtml(entry.category.name)}</span><span>${formatMoney(entry.total)}</span></li>`)
      .join('');
    card.innerHTML = `<div class="summary-card__label mb-md">Gastos por categoría</div><ul class="breakdown-list">${rows || '<li class="text-muted">Sin gastos este mes.</li>'}</ul>`;
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
    card.innerHTML = `<div class="summary-card__label mb-md">Principales gastos del mes</div><ul class="top-expenses-list">${rows || '<li class="text-muted">Sin gastos este mes.</li>'}</ul>`;
    return card;
  }

  render();
}
