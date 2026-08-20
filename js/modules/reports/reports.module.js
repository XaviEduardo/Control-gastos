// Reportes: solo lectura y presentación. TODOS los cálculos vienen de financeService /
// groceryService / comparisonService / priceService — este módulo no reimplementa sumas,
// normalización de precios ni recurrencias (ver docs/architecture.md).
// `Chart` es un global cargado por CDN en index.html (ver dashboard.module.js).

import State from '../../core/state.js';
import ProductRepository from '../grocery/product.repository.js';
import GroceryListRepository from '../grocery/grocery-list.repository.js';
import StoreRepository from '../stores/store.repository.js';
import {
  totalIncome, totalExpenses, mandadoTotal, expensesByCategory, incomeByType, getPeriodRange,
} from '../../services/financeService.js';
import { itemsForList, itemEffectiveSubtotal } from '../../services/groceryService.js';
import { compareProductAcrossStores, compareListAcrossStores } from '../../services/comparisonService.js';
import { normalizePrice, getUnitDimension } from '../../services/priceService.js';
import PriceRepository from '../prices/price.repository.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { renderStatCard } from '../../components/stat-card.js';
import { renderMonthYearNav } from '../../components/month-year-nav.js';
import { formatMoney } from '../../core/currency.js';
import {
  MONTH_NAMES, startOfWeek, toISODate, parseFlexibleDate, formatDateShort,
} from '../../core/dates.js';
import { escapeHtml } from '../../core/validators.js';

const CHART_COLORS = ['#2f6fed', '#1f9d55', '#d69e2e', '#d64545', '#6b7280', '#0ea5e9', '#a855f7', '#f97316'];
const PERIOD_LABELS = { week: 'Semana', month: 'Mes', year: 'Año' };

export function renderReportsModule(container) {
  const settings = State.getSettings();
  const now = new Date();
  let periodType = settings.reportsPeriodType || 'month';
  let year = settings.reportsYear ?? now.getFullYear();
  let month = settings.reportsMonth ?? now.getMonth();
  let weekReferenceDate = settings.reportsWeekDate ? parseFlexibleDate(settings.reportsWeekDate) : now;
  let selectedPriceProductId = null;
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

    root.appendChild(renderPeriodSelector());
    root.appendChild(renderSummary(period));

    const chartsGrid = document.createElement('div');
    chartsGrid.className = 'charts-grid mb-md';
    root.appendChild(chartsGrid);
    renderCategoryChart(chartsGrid, period);
    renderIncomeChart(chartsGrid, period);
    renderTrendChart(chartsGrid, period);

    root.appendChild(renderTopProducts(period));
    renderPriceEvolutionSection(root);
    root.appendChild(renderCheapestStores());
    root.appendChild(renderSavingsSection(period));
  }

  // ---------- Selector de periodo (Semana / Mes / Año) ----------

  function renderPeriodSelector() {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const toggle = document.createElement('div');
    toggle.className = 'flex gap-sm mb-md';
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

    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';
    grid.appendChild(renderStatCard('Ingresos', formatMoney(income)));
    grid.appendChild(renderStatCard('Gastos', formatMoney(expense)));
    grid.appendChild(renderStatCard('Balance', formatMoney(income - expense), { tone: income - expense < 0 ? 'negative' : 'positive' }));
    if (mandado !== null) grid.appendChild(renderStatCard('Mandado', formatMoney(mandado)));
    return grid;
  }

  // ---------- Gastos por categoría / Ingresos por fuente ----------

  function renderCategoryChart(grid, period) {
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

  function renderIncomeChart(grid, period) {
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

  function renderTrendChart(grid, period) {
    const count = period.type === 'year' ? 5 : 6;
    const points = trendPeriods(period, count);
    const incomeSeries = points.map((p) => totalIncome(p.period));
    const expenseSeries = points.map((p) => totalExpenses(p.period));

    if (incomeSeries.every((v) => v === 0) && expenseSeries.every((v) => v === 0)) {
      grid.appendChild(noDataCard('Evolución de ingresos y gastos', 'Sin datos suficientes para esta gráfica.'));
      return;
    }

    const card = chartCard(`Evolución de ingresos y gastos (por ${PERIOD_LABELS[period.type].toLowerCase()})`);
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

  // ---------- Principales productos (por gasto efectivo, listas del periodo) ----------

  function listsInPeriod(period) {
    const [start, end] = getPeriodRange(period);
    return GroceryListRepository.list().filter((l) => {
      if (!l.startDate) return false;
      const d = parseFlexibleDate(l.startDate);
      return d >= start && d <= end;
    });
  }

  function topProducts(period, limit = 5) {
    const lists = listsInPeriod(period);
    const totals = new Map();
    lists.forEach((list) => {
      itemsForList(list.id).forEach((item) => {
        const amount = itemEffectiveSubtotal(item);
        if (amount <= 0) return;
        totals.set(item.productId, (totals.get(item.productId) || 0) + amount);
      });
    });
    return [...totals.entries()]
      .map(([productId, total]) => ({ product: ProductRepository.getById(productId), total }))
      .filter((entry) => entry.product)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  function renderTopProducts(period) {
    const card = document.createElement('div');
    card.className = 'card mb-md';
    card.innerHTML = '<div class="summary-card__label mb-md">Principales productos del mandado (este periodo)</div>';

    const entries = topProducts(period);
    if (!entries.length) {
      card.appendChild(renderEmptyState({
        icon: '🥕',
        title: 'Sin datos de mandado en este periodo',
        message: 'Registra cantidades y precios en tus listas de mandado (Mandado > Mi lista) para ver aquí tus productos principales.',
      }));
      return card;
    }

    const list = document.createElement('ul');
    list.className = 'breakdown-list';
    entries.forEach(({ product, total }) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(product.name)}</span><span>${formatMoney(total)}</span>`;
      list.appendChild(li);
    });
    card.appendChild(list);
    return card;
  }

  // ---------- Historial/evolución de precios (producto seleccionable) ----------

  function renderPriceEvolutionSection(parent) {
    const wrap = document.createElement('div');
    wrap.className = 'card mb-md';
    parent.appendChild(wrap); // insertar antes de instanciar Chart.js (evita canvas 0x0)

    const products = ProductRepository.list({ includeInactive: false }).filter((p) => PriceRepository.forProduct(p.id).length);
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center gap-sm mb-md';
    header.style.flexWrap = 'wrap';
    header.innerHTML = '<div class="summary-card__label">Evolución de precios</div>';
    wrap.appendChild(header);

    if (!products.length) {
      wrap.appendChild(renderEmptyState({
        icon: '📈',
        title: 'Sin precios registrados todavía',
        message: 'Registra precios desde Mandado > Historial de precios.',
      }));
      return;
    }

    if (!selectedPriceProductId || !products.some((p) => p.id === selectedPriceProductId)) {
      selectedPriceProductId = products[0].id;
    }

    const selectWrap = document.createElement('div');
    selectWrap.className = 'flex items-center gap-sm mb-md';
    selectWrap.innerHTML = '<label for="reportsPriceProduct" style="margin:0;">Producto</label><select id="reportsPriceProduct"></select>';
    const select = selectWrap.querySelector('select');
    select.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    select.value = selectedPriceProductId;
    select.addEventListener('change', () => { selectedPriceProductId = select.value; render(); });
    wrap.appendChild(selectWrap);

    const prices = PriceRepository.forProduct(selectedPriceProductId);
    const dimensionCounts = new Map();
    prices.forEach((p) => {
      const dim = getUnitDimension(p.unit);
      if (dim) dimensionCounts.set(dim, (dimensionCounts.get(dim) || 0) + 1);
    });
    let dominantDim = null;
    let bestCount = 0;
    dimensionCounts.forEach((count, dim) => { if (count > bestCount) { bestCount = count; dominantDim = dim; } });
    const relevant = prices.filter((p) => getUnitDimension(p.unit) === dominantDim);

    if (relevant.length < 2) {
      const p = document.createElement('p');
      p.className = 'text-muted';
      p.textContent = 'Registra al menos 2 precios con presentaciones compatibles de este producto para ver su evolución.';
      wrap.appendChild(p);
      return;
    }

    const sorted = [...relevant].sort((a, b) => parseFlexibleDate(a.date) - parseFlexibleDate(b.date));
    const dateLabels = [...new Set(sorted.map((p) => p.date))].sort();
    const storeIds = [...new Set(sorted.map((p) => p.storeId))];
    const baseUnit = normalizePrice(sorted[0].price, sorted[0].quantity, sorted[0].unit)?.baseUnit || '';

    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-wrapper';
    chartWrapper.innerHTML = '<canvas></canvas>';
    wrap.appendChild(chartWrapper); // insertar antes de instanciar Chart.js (evita canvas 0x0)

    const datasets = storeIds.map((storeId, i) => {
      const store = StoreRepository.getById(storeId);
      const byDate = new Map();
      sorted.filter((p) => p.storeId === storeId).forEach((p) => {
        const norm = normalizePrice(p.price, p.quantity, p.unit);
        byDate.set(p.date, norm ? norm.pricePerBaseUnit : null);
      });
      return {
        label: store?.name || 'Tienda',
        data: dateLabels.map((d) => (byDate.has(d) ? byDate.get(d) : null)),
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        backgroundColor: 'transparent',
        spanGaps: false,
        tension: 0.2,
      };
    });

    const ctx = chartWrapper.querySelector('canvas').getContext('2d');
    charts.push(new Chart(ctx, {
      type: 'line',
      data: { labels: dateLabels.map((d) => formatDateShort(d)), datasets },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: `$/${baseUnit}` } } } },
    }));
  }

  // ---------- Tiendas más económicas (cuando existan datos suficientes) ----------

  function cheapestStores(limit = 5) {
    const products = ProductRepository.list({ includeInactive: false });
    const wins = new Map();
    let comparableProducts = 0;

    products.forEach((product) => {
      const groups = compareProductAcrossStores(product.id);
      groups.forEach((group) => {
        if (group.entries.length < 2) return;
        comparableProducts += 1;
        const best = group.entries.find((e) => e.isBest);
        wins.set(best.store.id, (wins.get(best.store.id) || 0) + 1);
      });
    });

    const ranked = [...wins.entries()]
      .map(([storeId, count]) => ({ store: StoreRepository.getById(storeId), wins: count }))
      .filter((entry) => entry.store)
      .sort((a, b) => b.wins - a.wins)
      .slice(0, limit);

    return { ranked, comparableProducts };
  }

  function renderCheapestStores() {
    const card = document.createElement('div');
    card.className = 'card mb-md';
    card.innerHTML = '<div class="summary-card__label mb-md">Tiendas más económicas</div>';

    const { ranked, comparableProducts } = cheapestStores();
    if (!comparableProducts) {
      card.appendChild(renderEmptyState({
        icon: '🏬',
        title: 'Sin datos suficientes todavía',
        message: 'Registra el precio de al menos un mismo producto en 2 o más tiendas para comparar.',
      }));
      return card;
    }

    const p = document.createElement('p');
    p.className = 'text-muted mb-md';
    p.textContent = `Con base en ${comparableProducts} producto(s) con precio en 2 o más tiendas — cuenta cuántas veces cada tienda tuvo el mejor precio normalizado.`;
    card.appendChild(p);

    const list = document.createElement('ul');
    list.className = 'breakdown-list';
    ranked.forEach(({ store, wins }) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(store.name)}</span><span>${wins} producto(s) más baratos</span>`;
      list.appendChild(li);
    });
    card.appendChild(list);
    return card;
  }

  // ---------- Ahorro potencial (comparador aplicado a las listas del periodo) ----------

  function renderSavingsSection(period) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<div class="summary-card__label mb-md">Ahorro potencial (comparador de precios)</div>';

    const lists = listsInPeriod(period);
    if (!lists.length) {
      card.appendChild(renderEmptyState({
        icon: '💰',
        title: 'Sin listas de mandado en este periodo',
        message: 'Crea una lista en Mandado > Mi lista para ver aquí el ahorro potencial.',
      }));
      return card;
    }

    const rows = lists.map((list) => ({ list, result: compareListAcrossStores(list.id) }));
    const withSavings = rows.filter((r) => r.result.potentialSavings !== null);

    if (!withSavings.length) {
      card.appendChild(renderEmptyState({
        icon: '💰',
        title: 'Sin datos suficientes para calcular ahorro',
        message: 'Ninguna tienda tiene precio registrado para todos los productos comparables de tus listas de este periodo todavía.',
      }));
      return card;
    }

    const totalSavings = withSavings.reduce((sum, r) => sum + r.result.potentialSavings, 0);
    const totalP = document.createElement('p');
    totalP.className = 'mb-md';
    totalP.innerHTML = `<strong>Ahorro potencial total del periodo:</strong> ${formatMoney(totalSavings)} (comparando la mejor tienda única contra la compra optimizada por producto)`;
    card.appendChild(totalP);

    const list = document.createElement('ul');
    list.className = 'breakdown-list';
    withSavings.forEach(({ list: groceryList, result }) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(groceryList.name)}</span><span>${formatMoney(result.potentialSavings)}</span>`;
      list.appendChild(li);
    });
    card.appendChild(list);

    return card;
  }

  render();

  return () => destroyCharts();
}
