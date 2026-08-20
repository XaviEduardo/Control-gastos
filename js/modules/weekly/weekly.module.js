// Vista semanal: 100% calculada a partir de incomes/expenses existentes vía financeService.
// No crea ni duplica ninguna entidad.

import State from '../../core/state.js';
import { formatMoney, formatPercent } from '../../core/currency.js';
import { formatDateShort, startOfWeek, endOfWeek, getISOWeekNumber, toISODate, parseFlexibleDate } from '../../core/dates.js';
import { totalIncome, totalExpenses, balance, mandadoTotal } from '../../services/financeService.js';
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

    const sections = [renderNav(), renderStats({ income, expense, mandado })];
    if (weeklyBudget) sections.push(renderBudgetSection(weeklyBudget, period));
    sections.push(renderUsageBar(percentUsed));
    root.append(...sections);
  }

  function renderBudgetSection(budget, period) {
    const progress = budgetProgress(budget, period);
    const over = progress.remaining < 0;
    const finite = Number.isFinite(progress.percentUsed);
    const pctForBar = finite ? Math.min(progress.percentUsed * 100, 100) : 100;
    const pctText = finite ? formatPercent(progress.percentUsed, 2) : 'más de 100%';

    const card = document.createElement('div');
    card.className = 'card mb-md';
    card.innerHTML = `
      <div class="summary-card__label mb-md">Presupuesto semanal</div>
      <div class="text-muted">Presupuesto ${formatMoney(progress.amount)} · Gastado ${formatMoney(progress.spent)} · ${over ? 'Excedido' : 'Disponible'} ${formatMoney(Math.abs(progress.remaining))}</div>
      <div class="progress-bar mt-md"><div class="progress-bar__fill${over ? ' progress-bar__fill--over' : ''}" style="width:${pctForBar}%"></div></div>
      <div class="text-muted mt-md">${pctText} utilizado${over ? ' — presupuesto excedido' : ''}</div>
    `;
    return card;
  }

  function renderNav() {
    const start = startOfWeek(referenceDate);
    const end = endOfWeek(referenceDate);

    const wrap = document.createElement('div');
    wrap.className = 'card mb-md';

    const nav = document.createElement('div');
    nav.className = 'period-nav';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'btn btn--ghost';
    prevBtn.textContent = '← Semana anterior';
    prevBtn.addEventListener('click', () => goToWeek(-1));

    const label = document.createElement('div');
    label.className = 'period-nav__label';
    label.innerHTML = `<strong>Semana ${getISOWeekNumber(referenceDate)}</strong><br><span class="text-muted">${formatDateShort(start)} – ${formatDateShort(end)}</span>`;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn--ghost';
    nextBtn.textContent = 'Semana siguiente →';
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

    grid.appendChild(statCard('Ingresos', formatMoney(income)));
    grid.appendChild(statCard('Gastos', formatMoney(expense)));
    grid.appendChild(statCard('Balance', formatMoney(income - expense), income - expense < 0 ? 'negative' : 'positive'));
    if (mandado !== null) grid.appendChild(statCard('Mandado', formatMoney(mandado)));

    return grid;
  }

  function statCard(label, value, tone) {
    const card = document.createElement('div');
    card.className = `card stat-card${tone ? ` stat-card--${tone}` : ''}`;
    card.innerHTML = `<div class="summary-card__label">${label}</div><div class="summary-card__value">${value}</div>`;
    return card;
  }

  function renderUsageBar(percentUsed) {
    const card = document.createElement('div');
    card.className = 'card';

    if (percentUsed === null) {
      card.innerHTML = `<div class="summary-card__label">% de ingreso utilizado</div><p class="text-muted mt-md">Sin ingresos registrados esta semana.</p>`;
      return card;
    }

    const pct = Math.round(percentUsed * 100);
    const over = pct > 100;
    card.innerHTML = `
      <div class="summary-card__label mb-md">% de ingreso utilizado</div>
      <div class="progress-bar"><div class="progress-bar__fill${over ? ' progress-bar__fill--over' : ''}" style="width:${Math.min(pct, 100)}%"></div></div>
      <div class="text-muted mt-md">${formatPercent(percentUsed)}${over ? ' — el gasto superó el ingreso de la semana' : ''}</div>
    `;
    return card;
  }

  render();
}
