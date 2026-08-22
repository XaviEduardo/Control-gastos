// Gráficas de Reportes (gastos por categoría, ingresos por fuente, evolución ingresos/gastos)
// — extraído de reports.module.js en V2-9 (refactor focalizado, sin cambiar comportamiento).
// `Chart` es un global cargado por CDN en index.html (ver dashboard.module.js).

import { totalIncome, totalExpenses, expensesByCategory, incomeByType } from '../../services/financeService.js';
import { MONTH_NAMES, startOfWeek, formatDateShort } from '../../core/dates.js';

const CHART_COLORS = ['#4F46E5', '#17A567', '#C98A1E', '#DC4949', '#6b7280', '#0ea5e9', '#a855f7', '#f97316'];

export function chartCard(title) {
  const card = document.createElement('div');
  card.className = 'card chart-card';
  card.innerHTML = `<div class="card-title mb-md">${title}</div><div class="chart-wrapper"><canvas></canvas></div>`;
  return card;
}

export function noDataCard(title, message) {
  const card = document.createElement('div');
  card.className = 'card chart-card';
  card.innerHTML = `<div class="card-title mb-md">${title}</div><p class="text-muted">${message}</p>`;
  return card;
}

// ---------- Gastos por categoría / Ingresos por fuente ----------

export function renderCategoryChart(grid, period, charts) {
  const breakdown = expensesByCategory(period).filter((b) => b.total > 0);
  if (!breakdown.length) {
    grid.appendChild(noDataCard('Gastos por categoría', 'Sin gastos en este periodo.'));
    return;
  }
  const card = chartCard('Gastos por categoría');
  grid.appendChild(card);
  const ctx = card.querySelector('canvas').getContext('2d');
  charts.push(new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: breakdown.map((b) => b.category.name),
      datasets: [{ data: breakdown.map((b) => b.total), backgroundColor: breakdown.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  }));
}

export function renderIncomeChart(grid, period, charts) {
  const breakdown = incomeByType(period).filter((b) => b.total > 0);
  if (!breakdown.length) {
    grid.appendChild(noDataCard('Ingresos por fuente', 'Sin ingresos en este periodo.'));
    return;
  }
  const card = chartCard('Ingresos por fuente');
  grid.appendChild(card);
  const ctx = card.querySelector('canvas').getContext('2d');
  charts.push(new Chart(ctx, {
    type: 'pie',
    data: {
      labels: breakdown.map((b) => b.type.name),
      datasets: [{ data: breakdown.map((b) => b.total), backgroundColor: breakdown.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  }));
}

// ---------- Evolución de ingresos/gastos (granularidad = tipo de periodo elegido) ----------

function trendPeriods(period, count) {
  const periods = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    if (period.type === 'week') {
      const d = new Date(period.date);
      d.setDate(d.getDate() - i * 7);
      periods.push({ period: { type: 'week', date: d }, label: formatDateShort(startOfWeek(d)) });
    } else if (period.type === 'year') {
      const y = period.date.getFullYear() - i;
      periods.push({ period: { type: 'year', date: new Date(y, 0, 1) }, label: String(y) });
    } else {
      const d = new Date(period.date.getFullYear(), period.date.getMonth() - i, 1);
      periods.push({ period: { type: 'month', date: d }, label: `${MONTH_NAMES[d.getMonth()].slice(0, 3)} '${String(d.getFullYear()).slice(-2)}` });
    }
  }
  return periods;
}

export function renderTrendChart(grid, period, charts, periodLabelLower) {
  const count = period.type === 'year' ? 5 : 6;
  const points = trendPeriods(period, count);
  const incomeSeries = points.map((p) => totalIncome(p.period));
  const expenseSeries = points.map((p) => totalExpenses(p.period));

  if (incomeSeries.every((v) => v === 0) && expenseSeries.every((v) => v === 0)) {
    grid.appendChild(noDataCard('Evolución de ingresos y gastos', 'Sin datos suficientes para esta gráfica.'));
    return;
  }

  const card = chartCard(`Evolución de ingresos y gastos (por ${periodLabelLower})`);
  grid.appendChild(card);
  const ctx = card.querySelector('canvas').getContext('2d');
  charts.push(new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map((p) => p.label),
      datasets: [
        { label: 'Ingresos', data: incomeSeries, borderColor: CHART_COLORS[1], backgroundColor: 'transparent', tension: 0.2 },
        { label: 'Gastos', data: expenseSeries, borderColor: CHART_COLORS[3], backgroundColor: 'transparent', tension: 0.2 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
  }));
}
