// Reportes: solo lectura y presentación. TODOS los cálculos vienen de financeService /
// groceryService / comparisonService / priceService — este módulo no reimplementa sumas,
// normalización de precios ni recurrencias (ver docs/architecture.md).
// `Chart` es un global cargado por CDN en index.html (ver dashboard.module.js).

import State from '../../core/state.js';
import { totalIncome, totalExpenses, mandadoTotal, previousPeriod } from '../../services/financeService.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { renderStatCard } from '../../components/stat-card.js';
import { renderMonthYearNav } from '../../components/month-year-nav.js';
import { formatMoney, kpiDelta } from '../../core/currency.js';
import { toISODate, parseFlexibleDate } from '../../core/dates.js';
import { renderCategoryChart, renderIncomeChart, renderTrendChart } from './reports-charts.js';
import {
  renderTopProducts, renderPriceEvolutionSection, renderCheapestStores, renderSavingsSection,
} from './reports-grocery-insights.js';

const PERIOD_LABELS = { week: 'Semana', month: 'Mes', year: 'Año' };

export function renderReportsModule(container) {
  const settings = State.getSettings();
  const now = new Date();
  let periodType = settings.reportsPeriodType || 'month';
  let year = settings.reportsYear ?? now.getFullYear();
  let month = settings.reportsMonth ?? now.getMonth();
  let weekReferenceDate = settings.reportsWeekDate ? parseFlexibleDate(settings.reportsWeekDate) : now;
  const priceEvolutionState = { selectedPriceProductId: null };
  let charts = [];

  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function destroyCharts() {
    charts.forEach((chart) => chart.destroy());
    charts = [];
  }

  function persist() {
    State.setSettings({
      reportsPeriodType: periodType,
      reportsYear: year,
      reportsMonth: month,
      reportsWeekDate: toISODate(weekReferenceDate),
    });
  }

  function currentPeriod() {
    if (periodType === 'week') return { type: 'week', date: weekReferenceDate };
    if (periodType === 'year') return { type: 'year', date: new Date(year, 0, 1) };
    return { type: 'month', date: new Date(year, month, 1) };
  }

  // Dashboard = estado actual; Reportes = análisis histórico (ver rediseño PASS 5) — mismo
  // encabezado que Dashboard/Calendario/Configuración para que se sienta el mismo producto,
  // pero con su propio subtítulo.
  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Reportes</div>
      <h2 class="dashboard-header__title">Análisis histórico</h2>
    `;
    return wrap;
  }

  function render() {
    destroyCharts();
    root.innerHTML = '';

    const hasAnyData = State.getCollection('incomes').length > 0 || State.getCollection('expenses').length > 0;
    if (!hasAnyData) {
      root.appendChild(renderEmptyState({
        icon: '📑',
        title: 'Todavía no hay datos para generar reportes',
        message: 'Agrega ingresos y gastos para ver aquí tus reportes.',
      }));
      return;
    }

    const period = currentPeriod();

    root.appendChild(renderHeader());
    root.appendChild(renderPeriodSelector());
    root.appendChild(renderSummary(period));

    const chartsGrid = document.createElement('div');
    chartsGrid.className = 'charts-grid mb-md';
    root.appendChild(chartsGrid);
    renderCategoryChart(chartsGrid, period, charts);
    renderIncomeChart(chartsGrid, period, charts);
    renderTrendChart(chartsGrid, period, charts, PERIOD_LABELS[period.type].toLowerCase());

    root.appendChild(renderTopProducts(period));
    renderPriceEvolutionSection(root, priceEvolutionState, charts, render);
    root.appendChild(renderCheapestStores());
    root.appendChild(renderSavingsSection(period));
  }

  // ---------- Selector de periodo (Semana / Mes / Año) ----------

  function renderPeriodSelector() {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const toggle = document.createElement('div');
    toggle.className = 'flex flex-wrap gap-sm mb-md';
    Object.entries(PERIOD_LABELS).forEach(([type, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${periodType === type ? 'btn--primary' : 'btn--ghost'}`;
      btn.textContent = label;
      btn.addEventListener('click', () => { periodType = type; persist(); render(); });
      toggle.appendChild(btn);
    });
    card.appendChild(toggle);

    if (periodType === 'month') {
      card.appendChild(renderMonthYearNav({
        month, year, onChange: (m, y) => { month = m; year = y; persist(); render(); },
      }));
    } else if (periodType === 'week') {
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center gap-sm';
      wrap.innerHTML = `<label for="reportsWeekInput" style="margin:0;">Semana que contiene:</label><input type="date" id="reportsWeekInput" value="${toISODate(weekReferenceDate)}">`;
      wrap.querySelector('input').addEventListener('change', (e) => {
        if (e.target.value) { weekReferenceDate = parseFlexibleDate(e.target.value); persist(); render(); }
      });
      card.appendChild(wrap);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center gap-sm';
      wrap.innerHTML = `<label for="reportsYearInput" style="margin:0;">Año</label><input type="number" id="reportsYearInput" step="1" value="${year}">`;
      wrap.querySelector('input').addEventListener('change', (e) => {
        const parsed = Number(e.target.value);
        if (Number.isInteger(parsed)) { year = parsed; persist(); render(); }
      });
      card.appendChild(wrap);
    }

    return card;
  }

  // ---------- Resumen (ingresos, gastos, balance, mandado) ----------

  function renderSummary(period) {
    const income = totalIncome(period);
    const expense = totalExpenses(period);
    const mandado = mandadoTotal(period);
    const prev = previousPeriod(period);
    const deltaLabel = `vs ${PERIOD_LABELS[period.type].toLowerCase()} anterior`;

    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';
    grid.appendChild(renderStatCard('Ingresos', formatMoney(income), {
      icon: 'trending-up', iconTone: 'success', delta: kpiDelta(income, totalIncome(prev), { label: deltaLabel }),
    }));
    grid.appendChild(renderStatCard('Gastos', formatMoney(expense), {
      icon: 'trending-down', iconTone: 'danger', delta: kpiDelta(expense, totalExpenses(prev), { invert: true, label: deltaLabel }),
    }));
    grid.appendChild(renderStatCard('Balance', formatMoney(income - expense), {
      icon: 'bank', hero: true,
      delta: kpiDelta(income - expense, totalIncome(prev) - totalExpenses(prev), { label: deltaLabel }),
    }));
    if (mandado !== null) grid.appendChild(renderStatCard('Mandado', formatMoney(mandado), { icon: 'cart' }));
    return grid;
  }

  render();

  return () => destroyCharts();
}
