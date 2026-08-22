// Comparador Nivel 2 (mandado completo entre tiendas) — extraído de comparison.module.js en
// V2-9 (refactor focalizado, sin cambiar comportamiento). La única escritura posible es
// explícita ("Usar esta tienda" ajusta selectedStoreId/estimatedPrice de un item, nunca
// actualPrice — ver docs/decisions.md).

import ProductRepository from '../grocery/product.repository.js';
import GroceryListRepository from '../grocery/grocery-list.repository.js';
import GroceryListItemRepository from '../grocery/grocery-list-item.repository.js';
import StoreBranchRepository from '../stores/store-branch.repository.js';
import { compareListAcrossStores } from '../../services/comparisonService.js';
import { priceFreshness } from '../../services/priceService.js';
import { navigateTo } from '../../core/router.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { showToast } from '../../components/toast.js';
import { formatMoney } from '../../core/currency.js';
import { escapeHtml } from '../../core/validators.js';

function productName(productId) {
  return ProductRepository.getById(productId)?.name || 'Producto eliminado';
}

// `state` es un objeto mutable ({ selectedListId }) que el módulo principal conserva entre
// renders (mismo patrón que `view` en grocery-list.module.js) para que el <select> de lista
// recuerde la selección.
export function renderLevelTwo(state, onChange) {
  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('div');
  title.className = 'card-title mb-md';
  title.textContent = 'Comparar una lista de mandado completa';
  card.appendChild(title);

  const lists = GroceryListRepository.list();
  if (!lists.length) {
    card.appendChild(renderEmptyState({
      icon: '🛒',
      title: 'Sin listas de mandado',
      message: 'Crea una lista desde Mandado > Mi lista.',
    }));
    return card;
  }

  if (!state.selectedListId || !lists.some((l) => l.id === state.selectedListId)) {
    state.selectedListId = lists[0].id;
  }

  const selectWrap = document.createElement('div');
  selectWrap.className = 'flex items-center gap-sm mb-md';
  selectWrap.innerHTML = '<label for="compareListSelect" style="margin:0;">Lista</label><select id="compareListSelect"></select>';
  const select = selectWrap.querySelector('select');
  select.innerHTML = lists.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
  select.value = state.selectedListId;
  select.addEventListener('change', () => { state.selectedListId = select.value; onChange(); });
  card.appendChild(selectWrap);

  const result = compareListAcrossStores(state.selectedListId);

  if (!result.totalItemCount) {
    card.appendChild(renderEmptyState({
      icon: '🥕',
      title: 'Esta lista todavía no tiene productos',
      message: 'Agrega productos desde Mandado > Mi lista.',
    }));
    return card;
  }

  if (result.unavailableItems.length) {
    const p = document.createElement('p');
    p.className = 'text-muted mb-md';
    p.innerHTML = `<strong>Sin precio en ninguna tienda (excluidos de la comparación):</strong> ${result.unavailableItems.map((item) => escapeHtml(productName(item.productId))).join(', ')}`;
    card.appendChild(p);
  }

  if (!result.comparableCount) {
    card.appendChild(renderEmptyState({
      icon: '💲',
      title: 'Sin precios registrados para los productos de esta lista',
      message: 'Registra precios para comenzar a comparar tiendas.',
      actionLabel: '+ Registrar precio',
      onAction: () => navigateTo('/mandado/historial'),
    }));
    return card;
  }

  card.appendChild(renderSavingsSummary(result));
  card.appendChild(renderStoreTotals(result));
  card.appendChild(renderOptimizedCart(result, onChange));

  return card;
}

// "¿Cuánto puedo ahorrar?" primero, arriba de todo — es la pregunta que más importa
// responder de inmediato (ver PASS 4).
function renderSavingsSummary(result) {
  const wrap = document.createElement('div');
  wrap.className = 'mb-md';

  if (!result.bestSingleStoreFullCoverage) {
    wrap.innerHTML = `
      <p class="text-muted">Ninguna tienda tiene precio registrado para los ${result.comparableCount} productos comparables de esta lista, así que no se puede calcular un ahorro directo contra "comprar todo en una tienda".
      La mejor opción parcial es <strong>${escapeHtml(result.bestSingleStore.store.name)}</strong> (${result.bestSingleStore.covered}/${result.comparableCount} productos, ${formatMoney(result.bestSingleStore.total)}).</p>
    `;
    return wrap;
  }

  const over = result.potentialSavings < 0;
  const banner = document.createElement('div');
  banner.className = 'compare-winner';
  banner.innerHTML = `
    <div>
      <span class="badge ${over ? 'badge--neutral' : 'badge--success'}">Ahorro potencial</span>
      <div class="compare-winner__store">Comprando optimizado vs. ${escapeHtml(result.bestSingleStoreFullCoverage.store.name)} (mejor tienda única)</div>
    </div>
    <div class="compare-winner__price">
      <div class="compare-winner__price-value">${over ? '$0.00' : formatMoney(result.potentialSavings)}</div>
      <div class="compare-winner__price-note">Optimizado: ${formatMoney(result.optimizedTotal)}</div>
    </div>
  `;
  wrap.appendChild(banner);
  return wrap;
}

function renderStoreTotals(result) {
  const wrap = document.createElement('div');
  wrap.className = 'mb-md';
  wrap.innerHTML = '<div class="card-title mb-md">Comprar todo en una sola tienda</div>';

  const list = document.createElement('ul');
  list.className = 'comparison-product-list';
  result.storeTotals.forEach((entry) => {
    const isBest = result.bestSingleStoreFullCoverage === entry;
    const li = document.createElement('li');
    li.className = `comparison-product-item${isBest ? ' comparison-product-item--best' : ''}`;
    li.innerHTML = `
      <span>${escapeHtml(entry.store.name)}${isBest ? ' <span class="badge badge--success">Mejor tienda única</span>' : ''} <span class="text-muted">(${entry.covered}/${result.comparableCount} productos${entry.missing ? `, faltan ${entry.missing}` : ''})</span></span>
      <span style="font-weight:700">${formatMoney(entry.total)}</span>
    `;
    list.appendChild(li);
  });
  wrap.appendChild(list);
  return wrap;
}

function renderOptimizedCart(result, onChange) {
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="card-title mb-md">Compra optimizada (mejor tienda por producto)</div>';

  // Resumen por tienda (agrupación simple de result.optimized, ya calculado por
  // comparisonService — no es un dato nuevo, solo se agrupa/suma para la vista rápida
  // que pide el rediseño).
  const byStore = new Map();
  result.optimized.forEach((entry) => {
    const bucket = byStore.get(entry.store.id) || { store: entry.store, count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += entry.cost;
    byStore.set(entry.store.id, bucket);
  });
  const storeSummary = [...byStore.values()].sort((a, b) => b.total - a.total);

  const summaryList = document.createElement('ul');
  summaryList.className = 'comparison-product-list mb-md';
  storeSummary.forEach(({ store, count, total }) => {
    const li = document.createElement('li');
    li.className = 'comparison-product-item';
    li.innerHTML = `<span>${escapeHtml(store.name)} <span class="text-muted">(${count} producto${count === 1 ? '' : 's'})</span></span><span style="font-weight:700">${formatMoney(total)}</span>`;
    summaryList.appendChild(li);
  });
  wrap.appendChild(summaryList);

  const totalP = document.createElement('p');
  totalP.className = 'mb-md';
  totalP.innerHTML = `<strong>Total optimizado:</strong> ${formatMoney(result.optimizedTotal)}`;
  wrap.appendChild(totalP);

  // Detalle por producto (se conserva íntegro: aquí vive la acción real "Usar esta tienda").
  const detail = document.createElement('details');
  const summaryToggle = document.createElement('summary');
  summaryToggle.className = 'text-muted';
  summaryToggle.textContent = `Ver detalle por producto (${result.optimized.length})`;
  detail.appendChild(summaryToggle);

  const list = document.createElement('ul');
  list.className = 'top-expenses-list mt-md';
  result.optimized.forEach((entry) => {
    const li = document.createElement('li');

    // V2-7: si el item ya tiene una sucursal fijada por el usuario (ver "Cambiar tienda",
    // V2-3) distinta de la recomendación optimizada, se muestra como referencia — nunca
    // reemplaza ni bloquea la sugerencia matemática, solo la contextualiza.
    const freshness = priceFreshness(entry.priceEntry.date);
    const preferredBranch = entry.item.selectedBranchId && entry.item.selectedBranchId !== entry.store.id
      ? StoreBranchRepository.getById(entry.item.selectedBranchId)
      : null;

    const info = document.createElement('span');
    info.innerHTML = `${escapeHtml(productName(entry.item.productId))} <span class="text-muted">(${entry.item.quantity} ${escapeHtml(entry.item.unit)} en ${escapeHtml(entry.store.name)} · ${escapeHtml(freshness.label)})</span>${preferredBranch ? `<br><span class="text-muted text-xs">Tu sucursal fijada: ${escapeHtml(preferredBranch.name)}</span>` : ''}`;

    const right = document.createElement('span');
    right.className = 'flex gap-xs items-center';
    const costSpan = document.createElement('span');
    costSpan.textContent = formatMoney(entry.cost);

    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'btn btn--ghost';
    useBtn.textContent = entry.item.selectedStoreId === entry.store.id ? 'Tienda asignada' : 'Usar esta tienda';
    useBtn.disabled = entry.item.selectedStoreId === entry.store.id;
    useBtn.addEventListener('click', () => {
      GroceryListItemRepository.update(entry.item.id, {
        selectedStoreId: entry.store.id,
        estimatedPrice: Math.round(entry.pricePerItemUnit * 100) / 100,
      });
      showToast(`Precio estimado de "${productName(entry.item.productId)}" actualizado en la lista`);
      onChange();
    });

    right.append(costSpan, useBtn);
    li.append(info, right);
    list.appendChild(li);
  });
  detail.appendChild(list);
  wrap.appendChild(detail);

  return wrap;
}
