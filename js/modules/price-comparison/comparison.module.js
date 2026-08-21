// Comparador inteligente: Nivel 1 (producto individual) y Nivel 2 (mandado completo).
// Solo lee productos/tiendas/precios/listas existentes; la única escritura posible es
// explícita ("Usar esta tienda" ajusta selectedStoreId/estimatedPrice de un item, nunca
// actualPrice — ver docs/decisions.md). Rediseño "Minimal Finance" (ver docs/ui-ux-audit.md):
// misma lógica de siempre (compareProductAcrossStores/compareListAcrossStores), composición
// visual nueva — el ganador debe identificarse de inmediato, sin comparar columnas a mano.

import ProductRepository from '../grocery/product.repository.js';
import GroceryListRepository from '../grocery/grocery-list.repository.js';
import GroceryListItemRepository from '../grocery/grocery-list-item.repository.js';
import { compareProductAcrossStores, compareListAcrossStores } from '../../services/comparisonService.js';
import { navigateTo } from '../../core/router.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { iconMarkup } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
import { formatMoney } from '../../core/currency.js';
import { escapeHtml } from '../../core/validators.js';

const DIMENSION_LABELS = { mass: 'peso', volume: 'volumen', pza: 'pieza', paquete: 'paquete' };

export function renderComparisonModule(container) {
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  let selectedProductId = null;
  let selectedListId = null;

  function render() {
    root.innerHTML = '';
    root.appendChild(renderHeader());
    root.appendChild(renderLevelOne());
    root.appendChild(renderLevelTwo());
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Mandado</div>
      <h2 class="dashboard-header__title">Comparador</h2>
    `;
    return wrap;
  }

  // ---------- NIVEL 1: producto individual ----------

  function renderLevelOne() {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const title = document.createElement('div');
    title.className = 'card-title mb-md';
    title.textContent = 'Comparar un producto entre tiendas';
    card.appendChild(title);

    const products = ProductRepository.list({ includeInactive: false });
    if (!products.length) {
      card.appendChild(renderEmptyState({
        icon: '🥕',
        title: 'Sin productos en tu catálogo',
        message: 'Agrega productos desde Mandado > Productos.',
      }));
      return card;
    }

    if (!selectedProductId || !products.some((p) => p.id === selectedProductId)) {
      selectedProductId = products[0].id;
    }

    const selectWrap = document.createElement('div');
    selectWrap.className = 'flex items-center gap-sm mb-md';
    selectWrap.innerHTML = '<label for="compareProductSelect" style="margin:0;">Producto</label><select id="compareProductSelect"></select>';
    const select = selectWrap.querySelector('select');
    select.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    select.value = selectedProductId;
    select.addEventListener('change', () => { selectedProductId = select.value; render(); });
    card.appendChild(selectWrap);

    const groups = compareProductAcrossStores(selectedProductId);
    if (!groups.length) {
      card.appendChild(renderEmptyState({
        icon: '💲',
        title: 'Sin precios registrados para este producto',
        message: 'Registra precios para comenzar a comparar tiendas.',
        actionLabel: '+ Registrar precio',
        onAction: () => navigateTo('/mandado/historial'),
      }));
      return card;
    }

    groups.forEach((group) => card.appendChild(renderProductGroup(group)));
    return card;
  }

  function renderProductGroup(group) {
    const wrap = document.createElement('div');
    wrap.className = 'mb-md';
    const hasComparison = group.entries.length > 1;
    const best = group.entries.find((e) => e.isBest);

    const heading = document.createElement('div');
    heading.className = 'text-muted mb-md';
    heading.textContent = hasComparison
      ? `Comparación por ${DIMENSION_LABELS[group.dimension] || group.dimension} (normalizado por ${group.baseUnit})`
      : `Presentación por ${DIMENSION_LABELS[group.dimension] || group.dimension} — solo hay un precio registrado, agrega más para comparar`;
    wrap.appendChild(heading);

    if (hasComparison) wrap.appendChild(renderWinnerBanner(best, group.baseUnit));

    const list = document.createElement('ul');
    list.className = 'comparison-product-list';

    group.entries.forEach((entry) => {
      const highlightAsBest = hasComparison && entry.isBest;
      const li = document.createElement('li');
      li.className = `comparison-product-item${highlightAsBest ? ' comparison-product-item--best' : ''}`;

      const left = document.createElement('span');
      left.innerHTML = `${escapeHtml(entry.store.name)} <span class="text-muted">(${entry.priceEntry.quantity} ${escapeHtml(entry.priceEntry.unit)} el ${escapeHtml(entry.priceEntry.date)})</span>`;

      const right = document.createElement('span');
      const diffText = !hasComparison || entry.isBest
        ? ''
        : ` <span class="text-muted">(+${formatMoney(entry.differenceVsBest)}/${group.baseUnit} vs. mejor opción)</span>`;
      right.innerHTML = `${formatMoney(entry.priceEntry.price)} <span class="text-muted">→ ${formatMoney(entry.normalized.pricePerBaseUnit)}/${group.baseUnit}</span>${diffText}`;

      li.append(left, right);
      list.appendChild(li);
    });

    wrap.appendChild(list);
    return wrap;
  }

  // Callout que identifica al ganador de inmediato (ver PASS 4: "el usuario no debería tener
  // que comparar manualmente"). Mismo dato que ya resalta comparison-product-item--best.
  function renderWinnerBanner(best, baseUnit) {
    const banner = document.createElement('div');
    banner.className = 'compare-winner';
    banner.innerHTML = `
      <div>
        <span class="badge badge--success">${iconMarkup('check', { size: 13 })} Mejor precio</span>
        <div class="compare-winner__store">${escapeHtml(best.store.name)}</div>
      </div>
      <div class="compare-winner__price">
        <div class="compare-winner__price-value">${formatMoney(best.priceEntry.price)}</div>
        <div class="compare-winner__price-note">${formatMoney(best.normalized.pricePerBaseUnit)}/${escapeHtml(baseUnit)} · ${best.priceEntry.quantity} ${escapeHtml(best.priceEntry.unit)}</div>
      </div>
    `;
    return banner;
  }

  // ---------- NIVEL 2: mandado completo ----------

  function renderLevelTwo() {
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

    if (!selectedListId || !lists.some((l) => l.id === selectedListId)) {
      selectedListId = lists[0].id;
    }

    const selectWrap = document.createElement('div');
    selectWrap.className = 'flex items-center gap-sm mb-md';
    selectWrap.innerHTML = '<label for="compareListSelect" style="margin:0;">Lista</label><select id="compareListSelect"></select>';
    const select = selectWrap.querySelector('select');
    select.innerHTML = lists.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
    select.value = selectedListId;
    select.addEventListener('change', () => { selectedListId = select.value; render(); });
    card.appendChild(selectWrap);

    const result = compareListAcrossStores(selectedListId);

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
    card.appendChild(renderOptimizedCart(result));

    return card;
  }

  function productName(productId) {
    return ProductRepository.getById(productId)?.name || 'Producto eliminado';
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

  function renderOptimizedCart(result) {
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

      const info = document.createElement('span');
      info.innerHTML = `${escapeHtml(productName(entry.item.productId))} <span class="text-muted">(${entry.item.quantity} ${escapeHtml(entry.item.unit)} en ${escapeHtml(entry.store.name)})</span>`;

      const right = document.createElement('span');
      right.className = 'flex gap-xs items-center';
      const costSpan = document.createElement('span');
      costSpan.textContent = formatMoney(entry.cost);

      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'btn btn--ghost';
      useBtn.textContent = entry.item.selectedStoreId === entry.store.id ? 'Tienda asignada ✓' : 'Usar esta tienda';
      useBtn.disabled = entry.item.selectedStoreId === entry.store.id;
      useBtn.addEventListener('click', () => {
        GroceryListItemRepository.update(entry.item.id, {
          selectedStoreId: entry.store.id,
          estimatedPrice: Math.round(entry.pricePerItemUnit * 100) / 100,
        });
        showToast(`Precio estimado de "${productName(entry.item.productId)}" actualizado en la lista`);
        render();
      });

      right.append(costSpan, useBtn);
      li.append(info, right);
      list.appendChild(li);
    });
    detail.appendChild(list);
    wrap.appendChild(detail);

    return wrap;
  }

  render();
}
