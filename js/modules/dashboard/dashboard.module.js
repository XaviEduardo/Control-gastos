// Dashboard: solo lectura y presentación. Todos los cálculos vienen de financeService;
// este módulo no reimplementa sumas ni recurrencias (ver docs/architecture.md).
// `Chart` es un global cargado por CDN en index.html (chart.js UMD), antes de este módulo.

import State from '../../core/state.js';
import { renderStatCard } from '../../components/stat-card.js';
import { renderMonthYearNav } from '../../components/month-year-nav.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { formatMoney, formatDelta, formatPercent } from '../../core/currency.js';
import { MONTH_NAMES, startOfMonth, endOfMonth, startOfWeek } from '../../core/dates.js';
import {
  totalIncome, totalExpenses, mandadoTotal, expensesByCategory, incomeByType, previousPeriod,
} from '../../services/financeService.js';
import { budgetProgress } from '../../services/budgetService.js';
import BudgetRepository from '../budget/budget.repository.js';

const CHART_COLORS = ['#2f6fed', '#1f9d55', '#d69e2e', '#d64545', '#6b7280', '#0ea5e9', '#a855f7', '#f97316'];

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
    card.innerHTML = `<div class="summary-card__label mb-md">${title}</div><div class="chart-wrapper"><canvas></canvas></div>`;
    return card;
  }

  function noDataCard(title, message) {
    const card = document.createElement('div');
    card.className = 'card chart-card';
    card.innerHTML = `<div class="summary-card__label mb-md">${title}</div><p class="text-muted">${message}</p>`;
    return card;
  }

  function renderKpis({ income, expense, prevIncome, prevExpense, weeklyExpense, mandado }) {
    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';

    grid.appendChild(renderStatCard('Ingresos del mes', formatMoney(income), { subtitle: formatDelta(income, prevIncome, 'vs mes anterior') }));
    grid.appendChild(renderStatCard('Gastos del mes', formatMoney(expense), { subtitle: formatDelta(expense, prevExpense, 'vs mes anterior') }));

    const balanceVal = income - expense;
    const prevBalance = prevIncome - prevExpense;
    grid.appendChild(renderStatCard('Balance', formatMoney(balanceVal), {
      tone: balanceVal < 0 ? 'negative' : 'positive',
      subtitle: formatDelta(balanceVal, prevBalance, 'vs mes anterior'),
    }));

    grid.appendChild(renderStatCard('Gasto de esta semana', formatMoney(weeklyExpense)));
    if (mandado !== null) grid.appendChild(renderStatCard('Mandado del mes', formatMoney(mandado)));

    return grid;
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
          { label: 'Ingresos', data: incomeSeries, backgroundColor: CHART_COLORS[1] },
          { label: 'Gastos', data: expenseSeries, backgroundColor: CHART_COLORS[3] },
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
          label: 'Gastos', data: weeks.map((w) => w.total), borderColor: CHART_COLORS[3], backgroundColor: 'transparent', tension: 0.25,
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

    const sections = [
      renderMonthYearNav({ month, year, onChange: (m, y) => { month = m; year = y; persist(); render(); } }),
      renderKpis({ income, expense, prevIncome, prevExpense, weeklyExpense, mandado }),
    ];
    const monthlyBudget = BudgetRepository.find('monthly');
    const groceryBudget = BudgetRepository.find('grocery');
    if (monthlyBudget) sections.push(renderBudgetSection('Presupuesto mensual', monthlyBudget, period));
    if (groceryBudget) sections.push(renderBudgetSection('Presupuesto de mandado', groceryBudget, period));
    root.append(...sections);

    const chartsGrid = document.createElement('div');
    chartsGrid.className = 'charts-grid';
    root.appendChild(chartsGrid);

    renderIncomeVsExpenseChart(chartsGrid);
    renderCategoryChart(chartsGrid, period);
    renderWeeklyEvolutionChart(chartsGrid);
    renderIncomeDistributionChart(chartsGrid, period);
  }

  render();

  return () => destroyCharts();
}
