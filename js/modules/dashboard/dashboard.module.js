// Dashboard: solo lectura y presentación. Todos los cálculos vienen de financeService/
// budgetService/recurrenceService; este módulo no reimplementa sumas, recurrencias ni
// reglas de presupuesto (ver docs/architecture.md). Rediseño "Minimal Finance" (ver
// docs/ui-ux-audit.md): misma lógica de siempre, composición visual nueva.
// `Chart` es un global cargado por CDN en index.html (chart.js UMD), antes de este módulo.

import State from '../../core/state.js';
import { renderStatCard } from '../../components/stat-card.js';
import { renderMonthYearNav } from '../../components/month-year-nav.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { iconMarkup } from '../../components/icons.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import { formatMoney, kpiDelta } from '../../core/currency.js';
import { renderProgressCard } from '../../components/progress-card.js';
import {
  MONTH_NAMES, startOfMonth, endOfMonth, startOfWeek, toISODate, formatDateShort,
} from '../../core/dates.js';
import { escapeHtml } from '../../core/validators.js';
import {
  totalIncome, totalExpenses, mandadoTotal, expensesByCategory, incomeByType, previousPeriod,
} from '../../services/financeService.js';
import { budgetProgress } from '../../services/budgetService.js';
import { getOccurrencesInRange, frequencyLabel } from '../../services/recurrenceService.js';
import BudgetRepository from '../budget/budget.repository.js';

const CHART_COLORS = ['#4F46E5', '#17A567', '#C98A1E', '#DC4949', '#6b7280', '#0ea5e9', '#a855f7', '#f97316'];
const UPCOMING_WINDOW_DAYS = 14;
const UPCOMING_LIMIT = 5;

const incomeTypeRepo = createCategoryRepository('incomeTypes');
const expenseCategoryRepo = createCategoryRepository('expenseCategories');

export function renderDashboardModule(container) {
  const settings = State.getSettings();
  const now = new Date();
  let year = settings.selectedYear ?? now.getFullYear();
  let month = settings.selectedMonth ?? now.getMonth();
  let charts = [];

  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function destroyCharts() {
    charts.forEach((chart) => chart.destroy());
    charts = [];
  }

  function persist() {
    State.setSettings({ selectedMonth: month, selectedYear: year });
  }

  function hasAnyData() {
    return State.getCollection('incomes').length > 0 || State.getCollection('expenses').length > 0;
  }

  function chartCard(title) {
    const card = document.createElement('div');
    card.className = 'card chart-card';
    card.innerHTML = `<div class="card-title mb-md">${title}</div><div class="chart-wrapper"><canvas></canvas></div>`;
    return card;
  }

  function noDataCard(title, message) {
    const card = document.createElement('div');
    card.className = 'card chart-card';
    card.innerHTML = `<div class="card-title mb-md">${title}</div><p class="text-muted">${message}</p>`;
    return card;
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Hola</div>
      <h2 class="dashboard-header__title">Resumen de ${MONTH_NAMES[month]} ${year}</h2>
    `;
    return wrap;
  }

  function renderKpis({ income, expense, prevIncome, prevExpense, weeklyExpense }) {
    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';

    grid.appendChild(renderStatCard('Ingresos del mes', formatMoney(income), {
      icon: 'trending-up',
      iconTone: 'success',
      delta: kpiDelta(income, prevIncome, { label: 'vs mes anterior' }),
    }));
    grid.appendChild(renderStatCard('Gastos del mes', formatMoney(expense), {
      icon: 'trending-down',
      iconTone: 'danger',
      delta: kpiDelta(expense, prevExpense, { invert: true, label: 'vs mes anterior' }),
    }));

    const balanceVal = income - expense;
    const prevBalance = prevIncome - prevExpense;
    grid.appendChild(renderStatCard('Balance', formatMoney(balanceVal), {
      icon: 'bank',
      hero: true,
      delta: kpiDelta(balanceVal, prevBalance, { label: 'vs mes anterior' }),
    }));

    grid.appendChild(renderStatCard('Gasto de esta semana', formatMoney(weeklyExpense), { icon: 'calendar' }));

    return grid;
  }

  // Sin presupuesto de mandado configurado, no hay contra qué mostrar barra de progreso —
  // se muestra igual el total del mes como KPI simple (mismo dato que antes, mandadoTotal()).
  function renderMandadoFallbackCard(mandado) {
    return renderStatCard('Mandado del mes', formatMoney(mandado), { icon: 'cart' });
  }

  // ---------- Próximos movimientos: reorganización visual de datos ya existentes ----------
  // Usa exactamente el mismo getOccurrencesInRange() que ya usa Calendario — no es lógica
  // nueva, es la misma consulta sobre un rango de los próximos días en vez del mes visible.
  function upcomingMovements() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + UPCOMING_WINDOW_DAYS);

    const entries = [];
    State.getCollection('incomes').forEach((item) => {
      getOccurrencesInRange(item, start, end).forEach((date) => entries.push({ item, date, isIncome: true }));
    });
    State.getCollection('expenses').forEach((item) => {
      getOccurrencesInRange(item, start, end).forEach((date) => entries.push({ item, date, isIncome: false }));
    });

    return entries
      .sort((a, b) => a.date - b.date)
      .slice(0, UPCOMING_LIMIT);
  }

  function renderUpcomingMovements() {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<div class="card-title mb-md">Próximos movimientos</div>';

    const entries = upcomingMovements();
    if (!entries.length) {
      const p = document.createElement('p');
      p.className = 'text-muted';
      p.textContent = `Sin movimientos programados en los próximos ${UPCOMING_WINDOW_DAYS} días.`;
      card.appendChild(p);
      return card;
    }

    const list = document.createElement('div');
    list.className = 'movement-list';

    entries.forEach(({ item, date, isIncome }) => {
      const categoryRepo = isIncome ? incomeTypeRepo : expenseCategoryRepo;
      const categoryId = isIncome ? item.incomeTypeId : item.categoryId;
      const categoryName = categoryRepo.list().find((c) => c.id === categoryId)?.name || 'Sin categoría';
      const recurrent = item.frequency !== 'once';

      const row = document.createElement('div');
      row.className = 'movement-row';
      row.innerHTML = `
        <span class="movement-row__icon${isIncome ? ' movement-row__icon--income' : ' movement-row__icon--expense'}">${iconMarkup(isIncome ? 'trending-up' : 'trending-down', { size: 18 })}</span>
        <span class="movement-row__body">
          <div class="movement-row__title">${escapeHtml(item.description)}</div>
          <div class="movement-row__subtitle">${escapeHtml(categoryName)} · ${formatDateShort(toISODate(date))}${recurrent ? ` · ${escapeHtml(frequencyLabel(item.frequency))}` : ''}</div>
        </span>
        <span class="movement-row__amount${isIncome ? ' movement-row__amount--income' : ''}">${isIncome ? '+' : '-'}${formatMoney(item.amount)}</span>
      `;
      list.appendChild(row);
    });

    card.appendChild(list);
    return card;
  }

  // Cada render*Chart(grid) inserta primero la tarjeta en el DOM y solo después instancia
  // Chart.js — un canvas todavía desconectado del documento mide 0x0 y puede quedar mal
  // dimensionado incluso con `responsive:true`.

  function renderIncomeVsExpenseChart(grid) {
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(year, month - i, 1);
      months.push({
        label: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} '${String(d.getFullYear()).slice(-2)}`,
        period: { type: 'month', date: d },
      });
    }
    const incomeSeries = months.map((m) => totalIncome(m.period));
    const expenseSeries = months.map((m) => totalExpenses(m.period));

    if (incomeSeries.every((v) => v === 0) && expenseSeries.every((v) => v === 0)) {
      grid.appendChild(noDataCard('Ingresos vs Gastos', 'Sin datos suficientes para esta gráfica.'));
      return;
    }

    const card = chartCard('Ingresos vs Gastos (últimos 6 meses)');
    grid.appendChild(card);
    const ctx = card.querySelector('canvas').getContext('2d');
    charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map((m) => m.label),
        datasets: [
          { label: 'Ingresos', data: incomeSeries, backgroundColor: CHART_COLORS[1], borderRadius: 4 },
          { label: 'Gastos', data: expenseSeries, backgroundColor: CHART_COLORS[3], borderRadius: 4 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
    }));
  }

  function renderCategoryChart(grid, period) {
    const breakdown = expensesByCategory(period).filter((b) => b.total > 0);
    if (!breakdown.length) {
      grid.appendChild(noDataCard('Gastos por categoría', 'Sin gastos este mes.'));
      return;
    }

    const card = chartCard('Gastos por categoría (este mes)');
    grid.appendChild(card);
    const ctx = card.querySelector('canvas').getContext('2d');
    charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: breakdown.map((b) => b.category.name),
        datasets: [{
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    }));
  }

  function renderWeeklyEvolutionChart(grid) {
    const start = startOfMonth(year, month);
    const end = endOfMonth(year, month);
    const weeks = [];
    let cursor = startOfWeek(start);
    let index = 1;
    while (cursor <= end) {
      weeks.push({ label: `Semana ${index}`, total: totalExpenses({ type: 'week', date: cursor }) });
      const next = new Date(cursor);
      next.setDate(next.getDate() + 7);
      cursor = next;
      index += 1;
    }

    if (weeks.every((w) => w.total === 0)) {
      grid.appendChild(noDataCard('Evolución de gastos', 'Sin gastos este mes.'));
      return;
    }

    const card = chartCard('Evolución de gastos (semanas del mes)');
    grid.appendChild(card);
    const ctx = card.querySelector('canvas').getContext('2d');
    charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: weeks.map((w) => w.label),
        datasets: [{
          label: 'Gastos', data: weeks.map((w) => w.total), borderColor: CHART_COLORS[3], backgroundColor: 'transparent', tension: 0.3,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
    }));
  }

  function renderIncomeDistributionChart(grid, period) {
    const breakdown = incomeByType(period).filter((b) => b.total > 0);
    if (!breakdown.length) {
      grid.appendChild(noDataCard('Distribución de ingresos', 'Sin ingresos este mes.'));
      return;
    }

    const card = chartCard('Distribución de ingresos (este mes)');
    grid.appendChild(card);
    const ctx = card.querySelector('canvas').getContext('2d');
    charts.push(new Chart(ctx, {
      type: 'pie',
      data: {
        labels: breakdown.map((b) => b.type.name),
        datasets: [{
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    }));
  }

  function render() {
    destroyCharts();
    root.innerHTML = '';

    if (!hasAnyData()) {
      root.appendChild(renderEmptyState({
        icon: '👋',
        title: 'Todavía no tienes movimientos registrados',
        message: 'Agrega tu primer ingreso o gasto para ver aquí tu panorama financiero.',
      }));
      return;
    }

    const period = { type: 'month', date: new Date(year, month, 1) };
    const prev = previousPeriod(period);

    const income = totalIncome(period);
    const expense = totalExpenses(period);
    const prevIncome = totalIncome(prev);
    const prevExpense = totalExpenses(prev);
    const weeklyExpense = totalExpenses({ type: 'week', date: new Date() });
    const mandado = mandadoTotal(period);

    root.appendChild(renderHeader());
    root.appendChild(renderMonthYearNav({ month, year, onChange: (m, y) => { month = m; year = y; persist(); render(); } }));
    root.appendChild(renderKpis({ income, expense, prevIncome, prevExpense, weeklyExpense }));

    const monthlyBudget = BudgetRepository.find('monthly');
    const groceryBudget = BudgetRepository.find('grocery');
    if (monthlyBudget || groceryBudget || mandado !== null) {
      const summaryGrid = document.createElement('div');
      summaryGrid.className = 'stats-grid mb-md';
      if (monthlyBudget) summaryGrid.appendChild(renderProgressCard('Presupuesto mensual', budgetProgress(monthlyBudget, period), { icon: 'target' }));
      if (groceryBudget) summaryGrid.appendChild(renderProgressCard('Mandado', budgetProgress(groceryBudget, period), { icon: 'cart', amountFirst: true }));
      else if (mandado !== null) summaryGrid.appendChild(renderMandadoFallbackCard(mandado));
      root.appendChild(summaryGrid);
    }

    const chartsGrid = document.createElement('div');
    chartsGrid.className = 'charts-grid mb-md';
    root.appendChild(chartsGrid);

    renderIncomeVsExpenseChart(chartsGrid);
    renderCategoryChart(chartsGrid, period);
    renderWeeklyEvolutionChart(chartsGrid);
    renderIncomeDistributionChart(chartsGrid, period);

    root.appendChild(renderUpcomingMovements());
  }

  render();

  return () => destroyCharts();
}
