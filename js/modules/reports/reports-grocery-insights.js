// Secciones de Reportes relacionadas con Mandado: principales productos, evolución de
// precios, tiendas más económicas y ahorro potencial — extraído de reports.module.js en
// V2-9 (refactor focalizado, sin cambiar comportamiento). `Chart` es un global cargado por
// CDN en index.html (ver dashboard.module.js).

import ProductRepository from '../grocery/product.repository.js';
import GroceryListRepository from '../grocery/grocery-list.repository.js';
import StoreRepository from '../stores/store.repository.js';
import PriceRepository from '../prices/price.repository.js';
import { getPeriodRange } from '../../services/financeService.js';
import { itemsForList, itemEffectiveSubtotal } from '../../services/groceryService.js';
import { compareProductAcrossStores, compareListAcrossStores } from '../../services/comparisonService.js';
import { normalizePrice, getUnitDimension } from '../../services/priceService.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { formatMoney } from '../../core/currency.js';
import { formatDateShort, parseFlexibleDate } from '../../core/dates.js';
import { escapeHtml } from '../../core/validators.js';

const CHART_COLORS = ['#4F46E5', '#17A567', '#C98A1E', '#DC4949', '#6b7280', '#0ea5e9', '#a855f7', '#f97316'];

function listsInPeriod(period) {
  const [start, end] = getPeriodRange(period);
  return GroceryListRepository.list().filter((l) => {
    if (!l.startDate) return false;
    const d = parseFlexibleDate(l.startDate);
    return d >= start && d <= end;
  });
}

// ---------- Principales productos (por gasto efectivo, listas del periodo) ----------

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

export function renderTopProducts(period) {
  const card = document.createElement('div');
  card.className = 'card mb-md';
  card.innerHTML = '<div class="card-title mb-md">Principales productos del mandado (este periodo)</div>';

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

// `state` es un objeto mutable ({ selectedPriceProductId }) que el módulo principal conserva
// entre renders (mismo patrón que `view` en grocery-list.module.js) para que el <select> de
// producto recuerde la selección; `charts` es el arreglo compartido de instancias Chart.js
// que el módulo principal destruye en cada render.
export function renderPriceEvolutionSection(parent, state, charts, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'card mb-md';
  parent.appendChild(wrap); // insertar antes de instanciar Chart.js (evita canvas 0x0)

  const products = ProductRepository.list({ includeInactive: false }).filter((p) => PriceRepository.forProduct(p.id).length);
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center gap-sm mb-md';
  header.style.flexWrap = 'wrap';
  header.innerHTML = '<div class="card-title">Evolución de precios</div>';
  wrap.appendChild(header);

  if (!products.length) {
    wrap.appendChild(renderEmptyState({
      icon: '📈',
      title: 'Sin precios registrados todavía',
      message: 'Registra precios desde Mandado > Historial de precios.',
    }));
    return;
  }

  if (!state.selectedPriceProductId || !products.some((p) => p.id === state.selectedPriceProductId)) {
    state.selectedPriceProductId = products[0].id;
  }

  const selectWrap = document.createElement('div');
  selectWrap.className = 'flex items-center gap-sm mb-md';
  selectWrap.innerHTML = '<label for="reportsPriceProduct" style="margin:0;">Producto</label><select id="reportsPriceProduct"></select>';
  const select = selectWrap.querySelector('select');
  select.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  select.value = state.selectedPriceProductId;
  select.addEventListener('change', () => { state.selectedPriceProductId = select.value; onChange(); });
  wrap.appendChild(selectWrap);

  const prices = PriceRepository.forProduct(state.selectedPriceProductId);
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

export function renderCheapestStores() {
  const card = document.createElement('div');
  card.className = 'card mb-md';
  card.innerHTML = '<div class="card-title mb-md">Tiendas más económicas</div>';

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

export function renderSavingsSection(period) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<div class="card-title mb-md">Ahorro potencial (comparador de precios)</div>';

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
