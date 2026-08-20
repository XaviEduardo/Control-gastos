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
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { openModal } from '../../components/modal.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { formatMoney } from '../../core/currency.js';
import { formatDateShort, toISODate, parseFlexibleDate } from '../../core/dates.js';
import { isRequired, isPositiveNumber, isValidDate, validate, escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from '../grocery/units.js';

const CHART_COLORS = ['#2f6fed', '#1f9d55', '#d69e2e', '#d64545', '#6b7280', '#0ea5e9', '#a855f7', '#f97316'];

function unitLabel(value) {
  return UNIT_OPTIONS.find((u) => u.value === value)?.label || value;
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

  function render() {
    destroyCharts();
    root.innerHTML = '';

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
        onAction: () => openPriceForm(),
      }));
      return;
    }

    root.appendChild(renderLatestByStore(prices));
    renderEvolutionChart(root, prices);
    root.appendChild(renderHistoryTable(prices));
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
    addBtn.addEventListener('click', () => openPriceForm());

    bar.appendChild(addBtn);
    return bar;
  }

  function renderLatestByStore(prices) {
    const stores = StoreRepository.list({ includeInactive: false });
    const card = document.createElement('div');
    card.className = 'card mb-md';
    card.innerHTML = '<div class="summary-card__label mb-md">Último precio por tienda</div>';

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
    const dimensionCounts = new Map();
    prices.forEach((p) => {
      const dim = getUnitDimension(p.unit);
      if (dim) dimensionCounts.set(dim, (dimensionCounts.get(dim) || 0) + 1);
    });

    let dominantDim = null;
    let bestCount = 0;
    dimensionCounts.forEach((count, dim) => {
      if (count > bestCount) { bestCount = count; dominantDim = dim; }
    });

    const relevant = prices.filter((p) => getUnitDimension(p.unit) === dominantDim);

    if (relevant.length < 2) {
      const card = document.createElement('div');
      card.className = 'card chart-card mb-md';
      card.innerHTML = '<div class="summary-card__label mb-md">Evolución del precio</div><p class="text-muted">Registra al menos 2 precios con presentaciones compatibles (misma unidad de medida) para ver la evolución.</p>';
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
    card.innerHTML = `<div class="summary-card__label mb-md">Evolución del precio normalizado (por ${escapeHtml(baseUnit)})</div><div class="chart-wrapper"><canvas></canvas></div>`;
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
    card.innerHTML = '<div class="summary-card__label mb-md">Historial completo</div>';

    card.appendChild(renderTable({
      columns: [
        { key: 'date', label: 'Fecha', render: (row) => formatDateShort(row.date) },
        { key: 'storeId', label: 'Tienda', render: (row) => escapeHtml(StoreRepository.getById(row.storeId)?.name || 'Tienda eliminada') },
        { key: 'quantity', label: 'Presentación', render: (row) => `${row.quantity} ${escapeHtml(unitLabel(row.unit))}` },
        { key: 'price', label: 'Precio', render: (row) => formatMoney(row.price) },
        {
          key: 'normalized',
          label: 'Normalizado',
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
      { label: 'Editar', onClick: () => openPriceForm(row) },
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
    title.textContent = formatDateShort(row.date);
    header.append(title, actions);

    const subtitle = document.createElement('div');
    subtitle.className = 'responsive-card-list__subtitle';
    subtitle.textContent = store?.name || 'Tienda eliminada';

    const body = document.createElement('div');
    body.className = 'responsive-card-list__body';

    const line1 = document.createElement('span');
    line1.textContent = `${product?.name || 'Producto eliminado'} · ${row.quantity} ${unitLabel(row.unit)}`;

    const line2 = document.createElement('span');
    line2.className = 'responsive-card-list__amount';
    line2.textContent = formatMoney(row.price);

    body.append(line1, line2);

    if (normalized) {
      const line3 = document.createElement('span');
      line3.className = 'text-muted';
      line3.textContent = formatNormalizedPrice(normalized);
      body.appendChild(line3);
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

  function openPriceForm(existing) {
    const stores = StoreRepository.list({ includeInactive: false });
    // Si se edita un registro cuya tienda fue desactivada después, debe seguir apareciendo
    // como opción (si no, el <select> cae al primer valor y reasigna el precio a otra
    // tienda al guardar, o el formulario ni siquiera se puede abrir si no quedan activas).
    if (existing?.storeId && !stores.some((s) => s.id === existing.storeId)) {
      const currentStore = StoreRepository.getById(existing.storeId);
      if (currentStore) stores.push(currentStore);
    }
    if (!stores.length) {
      showToast('Primero agrega una tienda desde Mandado > Tiendas.', { type: 'error' });
      return;
    }

    const formId = `price-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-store">Tienda</label>
        <select id="${formId}-store" name="storeId">${stores.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
      </div>
      <div>
        <label for="${formId}-quantity">Cantidad (presentación)</label>
        <input type="number" id="${formId}-quantity" name="quantity" min="0" step="0.01" required value="${existing?.quantity ?? 1}">
      </div>
      <div>
        <label for="${formId}-unit">Unidad</label>
        <select id="${formId}-unit" name="unit">${UNIT_OPTIONS.map((u) => `<option value="${u.value}">${u.label}</option>`).join('')}</select>
      </div>
      <div>
        <label for="${formId}-price">Precio</label>
        <input type="number" id="${formId}-price" name="price" min="0" step="0.01" required value="${existing?.price ?? ''}">
      </div>
      <div>
        <label for="${formId}-date">Fecha</label>
        <input type="date" id="${formId}-date" name="date" required value="${existing?.date || toISODate(new Date())}">
      </div>
      <div>
        <label for="${formId}-notes">Notas (opcional)</label>
        <input type="text" id="${formId}-notes" name="notes" value="${escapeHtml(existing?.notes || '')}">
      </div>
      <p class="form-error hidden"></p>
    `;

    const storeSelect = form.querySelector(`#${formId}-store`);
    if (existing?.storeId) storeSelect.value = existing.storeId;
    const unitSelect = form.querySelector(`#${formId}-unit`);
    unitSelect.value = existing?.unit || 'l';

    const footer = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancelar';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.setAttribute('form', formId);
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Registrar precio';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar precio' : 'Registrar precio', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const storeId = data.get('storeId');
      const quantity = data.get('quantity');
      const unit = data.get('unit');
      const price = data.get('price');
      const date = data.get('date');
      const notes = data.get('notes');

      const { valid, errors } = validate([
        { valid: isRequired(storeId), message: 'Selecciona una tienda.' },
        { valid: isPositiveNumber(quantity), message: 'La cantidad debe ser mayor a 0.' },
        { valid: isPositiveNumber(price), message: 'El precio debe ser mayor a 0.' },
        { valid: isValidDate(date), message: 'La fecha no es válida.' },
      ]);
      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      if (existing) {
        PriceRepository.update(existing.id, {
          storeId,
          quantity: Number(quantity),
          unit,
          price: Number(price),
          date,
          notes: (notes || '').trim(),
        });
      } else {
        PriceRepository.create({ productId: selectedProductId, storeId, quantity, unit, price, date, notes });
      }

      modal.close();
      showToast(existing ? 'Precio actualizado' : 'Precio registrado');
      render();
    });
  }

  render();

  return () => destroyCharts();
}
