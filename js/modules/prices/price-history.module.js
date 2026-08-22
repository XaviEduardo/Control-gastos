// Captura e historial de precios. Cada registro es inmutable en el sentido de que
// "registrar un precio" SIEMPRE crea una entrada nueva (nunca sobrescribe la anterior);
// editar/eliminar corrigen un registro puntual, no "actualizan" el precio vigente.
// `Chart` es un global cargado por CDN en index.html (ver dashboard.module.js).

import ProductRepository from '../grocery/product.repository.js';
import StoreRepository from '../stores/store.repository.js';
import PriceRepository from './price.repository.js';
import { normalizePrice, formatNormalizedPrice, getUnitDimension } from '../../services/priceService.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { renderTable } from '../../components/table.js';
import { renderStatCard } from '../../components/stat-card.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { formatMoney } from '../../core/currency.js';
import { formatDateShort, parseFlexibleDate } from '../../core/dates.js';
import { escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from '../grocery/units.js';
import { openPriceForm } from './price-form.js';

const CHART_COLORS = ['#4F46E5', '#17A567', '#C98A1E', '#DC4949', '#6b7280', '#0ea5e9', '#a855f7', '#f97316'];

function unitLabel(value) {
  return UNIT_OPTIONS.find((u) => u.value === value)?.label || value;
}

// V2-4: distingue de dónde vino cada registro — 'purchase' (generado automáticamente al
// marcar un item de Mi Lista como comprado) vs. 'manual' (capturado aquí con "+ Registrar
// precio"). Puramente informativo, no cambia ningún cálculo.
function sourceBadge(source) {
  return source === 'purchase'
    ? '<span class="badge badge--info">Compra</span>'
    : '<span class="badge badge--neutral">Manual</span>';
}

export function renderPriceHistoryModule(container) {
  ensureActionMenuOutsideClick();
  let selectedProductId = null;
  let charts = [];

  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function destroyCharts() {
    charts.forEach((chart) => chart.destroy());
    charts = [];
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Mandado</div>
      <h2 class="dashboard-header__title">Historial de precios</h2>
    `;
    return wrap;
  }

  function render() {
    destroyCharts();
    root.innerHTML = '';

    root.appendChild(renderHeader());

    const products = ProductRepository.list({ includeInactive: false });
    if (!products.length) {
      root.appendChild(renderEmptyState({
        icon: '📈',
        title: 'Todavía no tienes productos en tu catálogo',
        message: 'Agrega productos desde Mandado > Productos para poder registrar precios.',
      }));
      return;
    }

    if (!selectedProductId || !products.some((p) => p.id === selectedProductId)) {
      selectedProductId = products[0].id;
    }

    root.appendChild(renderProductSelector(products));

    const prices = PriceRepository.forProduct(selectedProductId)
      .sort((a, b) => parseFlexibleDate(b.date) - parseFlexibleDate(a.date));

    if (!prices.length) {
      root.appendChild(renderEmptyState({
        icon: '💲',
        title: 'Sin precios registrados para este producto',
        message: 'Registra el primer precio con el botón de arriba.',
        actionLabel: '+ Registrar precio',
        onAction: () => openPriceForm({ defaultProductId: selectedProductId, onSaved: render }),
      }));
      return;
    }

    const statsGrid = renderPriceStats(prices);
    if (statsGrid) root.appendChild(statsGrid);
    root.appendChild(renderLatestByStore(prices));
    renderEvolutionChart(root, prices);
    root.appendChild(renderHistoryTable(prices));
  }

  // Misma dimensión "dominante" que ya usa renderEvolutionChart (nunca mezclar peso con
  // pieza) — extraída para reutilizarla también en las 4 estadísticas de abajo.
  function dominantDimensionGroup(prices) {
    const dimensionCounts = new Map();
    prices.forEach((p) => {
      const dim = getUnitDimension(p.unit);
      if (dim) dimensionCounts.set(dim, (dimensionCounts.get(dim) || 0) + 1);
    });
    let dominantDim = null;
    let bestCount = 0;
    dimensionCounts.forEach((count, dim) => { if (count > bestCount) { bestCount = count; dominantDim = dim; } });
    return prices.filter((p) => getUnitDimension(p.unit) === dominantDim);
  }

  // "Pantalla analítica" (ver rediseño PASS 4): actual/mínimo/máximo/promedio sobre los
  // MISMOS precios normalizados que ya calcula normalizePrice() — ninguna regla nueva, solo
  // Math.min/max/promedio sobre valores ya existentes.
  function renderPriceStats(prices) {
    const relevant = dominantDimensionGroup(prices);
    const normalized = relevant.map((p) => normalizePrice(p.price, p.quantity, p.unit)).filter(Boolean);
    if (!normalized.length) return null;

    const values = normalized.map((n) => n.pricePerBaseUnit);
    const baseUnit = normalized[0].baseUnit;
    const mostRecent = [...relevant].sort((a, b) => parseFlexibleDate(b.date) - parseFlexibleDate(a.date))[0];
    const current = normalizePrice(mostRecent.price, mostRecent.quantity, mostRecent.unit)?.pricePerBaseUnit;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    const fmt = (v) => `${formatMoney(v)}/${baseUnit}`;
    const grid = document.createElement('div');
    grid.className = 'stats-grid mb-md';
    grid.appendChild(renderStatCard('Precio actual', fmt(current)));
    grid.appendChild(renderStatCard('Mínimo', fmt(Math.min(...values))));
    grid.appendChild(renderStatCard('Máximo', fmt(Math.max(...values))));
    grid.appendChild(renderStatCard('Promedio', fmt(avg)));
    return grid;
  }

  function renderProductSelector(products) {
    const bar = document.createElement('div');
    bar.className = 'card mb-md flex justify-between items-center gap-sm toolbar';
    bar.innerHTML = `
      <div class="flex items-center gap-sm">
        <label for="priceProductSelect" style="margin:0;">Producto</label>
        <select id="priceProductSelect"></select>
      </div>
    `;
    const select = bar.querySelector('select');
    select.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    select.value = selectedProductId;
    select.addEventListener('change', () => { selectedProductId = select.value; render(); });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn--primary';
    addBtn.textContent = '+ Registrar precio';
    addBtn.addEventListener('click', () => openPriceForm({ defaultProductId: selectedProductId, onSaved: render }));

    bar.appendChild(addBtn);
    return bar;
  }

  function renderLatestByStore(prices) {
    const stores = StoreRepository.list({ includeInactive: false });
    const card = document.createElement('div');
    card.className = 'card mb-md';
    card.innerHTML = '<div class="card-title mb-md">Último precio por tienda</div>';

    const list = document.createElement('ul');
    list.className = 'breakdown-list';
    let any = false;

    stores.forEach((store) => {
      const storePrices = prices.filter((p) => p.storeId === store.id); // ya ordenado desc por fecha
      if (!storePrices.length) return;
      any = true;
      const latest = storePrices[0];
      const normalized = normalizePrice(latest.price, latest.quantity, latest.unit);
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(store.name)} — ${formatDateShort(latest.date)} (${latest.quantity} ${escapeHtml(unitLabel(latest.unit))})</span><span>${formatMoney(latest.price)}${normalized ? ` <span class="text-muted">(${escapeHtml(formatNormalizedPrice(normalized))})</span>` : ''}</span>`;
      list.appendChild(li);
    });

    if (!any) {
      const p = document.createElement('p');
      p.className = 'text-muted';
      p.textContent = 'Sin tiendas activas con precios registrados para este producto.';
      card.appendChild(p);
      return card;
    }

    card.appendChild(list);
    return card;
  }

  function renderEvolutionChart(parent, prices) {
    const relevant = dominantDimensionGroup(prices);

    if (relevant.length < 2) {
      const card = document.createElement('div');
      card.className = 'card chart-card mb-md';
      card.innerHTML = '<div class="card-title mb-md">Evolución del precio</div><p class="text-muted">Registra al menos 2 precios con presentaciones compatibles (misma unidad de medida) para ver la evolución.</p>';
      parent.appendChild(card);
      return;
    }

    const sorted = [...relevant].sort((a, b) => parseFlexibleDate(a.date) - parseFlexibleDate(b.date));
    const dateLabels = [...new Set(sorted.map((p) => p.date))].sort();
    const storeIds = [...new Set(sorted.map((p) => p.storeId))];
    const baseUnit = normalizePrice(sorted[0].price, sorted[0].quantity, sorted[0].unit)?.baseUnit || '';

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

    const card = document.createElement('div');
    card.className = 'card chart-card mb-md';
    card.innerHTML = `<div class="card-title mb-md">Evolución del precio normalizado (por ${escapeHtml(baseUnit)})</div><div class="chart-wrapper"><canvas></canvas></div>`;
    parent.appendChild(card); // insertar antes de instanciar Chart.js (evita canvas 0x0)

    const ctx = card.querySelector('canvas').getContext('2d');
    charts.push(new Chart(ctx, {
      type: 'line',
      data: { labels: dateLabels.map((d) => formatDateShort(d)), datasets },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
    }));
  }

  function renderHistoryTable(prices) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<div class="card-title mb-md">Historial completo</div>';

    card.appendChild(renderTable({
      columns: [
        { key: 'date', label: 'Fecha', render: (row) => formatDateShort(row.date) },
        { key: 'source', label: 'Origen', render: (row) => sourceBadge(row.source) },
        { key: 'storeId', label: 'Tienda', render: (row) => escapeHtml(StoreRepository.getById(row.storeId)?.name || 'Tienda eliminada') },
        { key: 'quantity', label: 'Presentación', render: (row) => `${row.quantity} ${escapeHtml(unitLabel(row.unit))}` },
        { key: 'price', label: 'Precio', align: 'right', render: (row) => formatMoney(row.price) },
        {
          key: 'normalized',
          label: 'Normalizado',
          align: 'right',
          render: (row) => {
            const n = normalizePrice(row.price, row.quantity, row.unit);
            return n ? escapeHtml(formatNormalizedPrice(n)) : '—';
          },
        },
        { key: 'notes', label: 'Notas', render: (row) => escapeHtml(row.notes || '') },
      ],
      rows: prices,
      rowActions: (row) => buildRowActions(row),
      renderCard: (row, actions) => renderPriceCard(row, actions),
    }));

    return card;
  }

  function buildRowActions(row) {
    return createActionMenu('Más acciones para este precio', [
      { label: 'Editar', onClick: () => openPriceForm({ existing: row, onSaved: render }) },
      {
        label: 'Eliminar',
        danger: true,
        onClick: async () => {
          const confirmed = await confirmDialog({
            title: 'Eliminar precio',
            message: '¿Eliminar este registro de precio? Esta acción no se puede deshacer.',
            confirmText: 'Eliminar',
            danger: true,
          });
          if (confirmed) {
            PriceRepository.remove(row.id);
            showToast('Precio eliminado');
            render();
          }
        },
      },
    ]);
  }

  function renderPriceCard(row, actions) {
    const product = ProductRepository.getById(row.productId);
    const store = StoreRepository.getById(row.storeId);
    const normalized = normalizePrice(row.price, row.quantity, row.unit);

    const card = document.createElement('div');
    card.className = 'responsive-card-list__item';

    const header = document.createElement('div');
    header.className = 'responsive-card-list__header';
    const title = document.createElement('span');
    title.className = 'responsive-card-list__title';
    title.innerHTML = `${escapeHtml(formatDateShort(row.date))} ${sourceBadge(row.source)}`;
    header.append(title, actions);

    const subtitle = document.createElement('div');
    subtitle.className = 'responsive-card-list__subtitle';
    subtitle.textContent = store?.name || 'Tienda eliminada';

    const body = document.createElement('div');
    body.className = 'responsive-card-list__body';

    const line1 = document.createElement('span');
    line1.textContent = `${product?.name || 'Producto eliminado'} · ${row.quantity} ${unitLabel(row.unit)}`;

    const priceRow = document.createElement('div');
    priceRow.className = 'flex justify-between items-center mt-md';
    priceRow.innerHTML = `<span class="text-muted">Precio pagado</span><span class="responsive-card-list__amount">${formatMoney(row.price)}</span>`;

    body.append(line1, priceRow);

    if (normalized) {
      const normRow = document.createElement('div');
      normRow.className = 'flex justify-between items-center text-muted';
      normRow.innerHTML = `<span>Normalizado</span><span>${escapeHtml(formatNormalizedPrice(normalized))}</span>`;
      body.appendChild(normRow);
    }

    if (row.notes) {
      const notes = document.createElement('span');
      notes.className = 'text-muted';
      notes.textContent = row.notes;
      body.appendChild(notes);
    }

    card.append(header, subtitle, body);
    return card;
  }

  render();

  return () => destroyCharts();
}
