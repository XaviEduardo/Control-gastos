// Vista semanal: 100% calculada a partir de incomes/expenses existentes vía financeService.
// No crea ni duplica ninguna entidad.

import State from '../../core/state.js';
import { renderStatCard } from '../../components/stat-card.js';
import { renderProgressCard } from '../../components/progress-card.js';
import { iconMarkup } from '../../components/icons.js';
import { escapeHtml } from '../../core/validators.js';
import { formatMoney, formatPercent } from '../../core/currency.js';
import { formatDateShort, startOfWeek, endOfWeek, getISOWeekNumber, toISODate, parseFlexibleDate } from '../../core/dates.js';
import { totalIncome, totalExpenses, balance, mandadoTotal, expensesByCategory } from '../../services/financeService.js';
import { budgetProgress } from '../../services/budgetService.js';
import BudgetRepository from '../budget/budget.repository.js';

export function renderWeeklyModule(container) {
  const settings = State.getSettings();
  let referenceDate = settings.selectedWeekDate ? parseFlexibleDate(settings.selectedWeekDate) : new Date();

  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function persist() {
    State.setSettings({ selectedWeekDate: toISODate(referenceDate) });
  }

  function goToWeek(offsetWeeks) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + offsetWeeks * 7);
    referenceDate = d;
    persist();
    render();
  }

  function goToDate(dateStr) {
    if (!dateStr) return;
    referenceDate = parseFlexibleDate(dateStr);
    persist();
    render();
  }

  function render() {
    root.innerHTML = '';
    const period = { type: 'week', date: referenceDate };
    const income = totalIncome(period);
    const expense = totalExpenses(period);
    const mandado = mandadoTotal(period);
    const percentUsed = income > 0 ? expense / income : null;
    const weeklyBudget = BudgetRepository.find('weekly');

    const sections = [renderHeader(), renderNav(), renderStats({ income, expense, mandado })];
    if (weeklyBudget) {
      const progressCard = renderProgressCard('Presupuesto semanal', budgetProgress(weeklyBudget, period), { icon: 'target' });
      progressCard.classList.add('mb-md');
      sections.push(progressCard);
    }
    sections.push(renderUsageBar(percentUsed));
    sections.push(renderCategoryBreakdown(period));
    root.append(...sections);
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Finanzas</div>
      <h2 class="dashboard-header__title">Semana</h2>
    `;
    return wrap;
  }

  // "¿En qué estoy gastando?" (ver rediseño PASS 3) — mismo expensesByCategory() que ya usa
  // Mes/Reportes, aplicado al periodo semanal en vez de mensual.
  function renderCategoryBreakdown(period) {
    const card = document.createElement('div');
    card.className = 'card';
    const rows = expensesByCategory(period)
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((entry) => `<li><span>${escapeHtml(entry.category.name)}</span><span>${formatMoney(entry.total)}</span></li>`)
      .join('');
    card.innerHTML = `<div class="card-title mb-md">En qué estás gastando esta semana</div><ul class="breakdown-list">${rows || '<li class="text-muted">Sin gastos esta semana.</li>'}</ul>`;
    return card;
  }

  function renderNav() {
    const start = startOfWeek(referenceDate);
    const end = endOfWeek(referenceDate);

    const wrap = document.createElement('div');
    wrap.className = 'card mb-md';

    const nav = document.createElement('div');
    nav.className = 'period-nav';

    // V2-8: icon buttons (mismo patrón ya usado en Mi Lista/month-year-nav.js) — el texto
    // "← Semana anterior"/"Semana siguiente →" ocupaba demasiado ancho en mobile.
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'btn btn--icon btn--ghost';
    prevBtn.title = 'Semana anterior';
    prevBtn.setAttribute('aria-label', 'Semana anterior');
    prevBtn.innerHTML = iconMarkup('chevron-left', { size: 18 });
    prevBtn.addEventListener('click', () => goToWeek(-1));

    const label = document.createElement('div');
    label.className = 'period-nav__label';
    label.innerHTML = `<strong>Semana ${getISOWeekNumber(referenceDate)}</strong><br><span class="text-muted">${formatDateShort(start)} – ${formatDateShort(end)}</span>`;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn--icon btn--ghost';
    nextBtn.title = 'Semana siguiente';
    nextBtn.setAttribute('aria-label', 'Semana siguiente');
    nextBtn.innerHTML = iconMarkup('chevron-right', { size: 18 });
    nextBtn.addEventListener('click', () => goToWeek(1));

    nav.append(prevBtn, label, nextBtn);

    const jump = document.createElement('div');
    jump.className = 'period-nav__jump mt-md';
    jump.innerHTML = `<label for="weekJump">Ir a la semana que contiene:</label><input type="date" id="weekJump" value="${toISODate(referenceDate)}">`;
    jump.querySelector('#weekJump').addEventListener('change', (e) => goToDate(e.target.value));

    wrap.append(nav, jump);
    return wrap;
  }

  function renderStats({ income, expense, mandado }) {
    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';

    grid.appendChild(renderStatCard('Ingresos', formatMoney(income), { icon: 'trending-up', iconTone: 'success' }));
    grid.appendChild(renderStatCard('Gastos', formatMoney(expense), { icon: 'trending-down', iconTone: 'danger' }));
    grid.appendChild(renderStatCard('Balance', formatMoney(income - expense), {
      icon: 'bank', hero: true,
    }));
    if (mandado !== null) grid.appendChild(renderStatCard('Mandado', formatMoney(mandado), { icon: 'cart' }));

    return grid;
  }

  function renderUsageBar(percentUsed) {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    if (percentUsed === null) {
      card.innerHTML = `<div class="card-title">% de ingreso utilizado</div><p class="text-muted mt-md">Sin ingresos registrados esta semana.</p>`;
      return card;
    }

    const pct = Math.round(percentUsed * 100);
    const over = pct > 100;
    card.innerHTML = `
      <div class="card-title mb-md">% de ingreso utilizado</div>
      <div class="progress-bar"><div class="progress-bar__fill${over ? ' progress-bar__fill--over' : ''}" style="width:${Math.min(pct, 100)}%"></div></div>
      <div class="text-muted mt-md">${formatPercent(percentUsed)}${over ? ' — el gasto superó el ingreso de la semana' : ''}</div>
    `;
    return card;
  }

  render();
}
