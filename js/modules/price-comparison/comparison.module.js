// Comparador inteligente: Nivel 1 (producto individual) y Nivel 2 (mandado completo).
// Solo lee productos/tiendas/precios/listas existentes; la única escritura posible es
// explícita ("Usar esta tienda" ajusta selectedStoreId/estimatedPrice de un item, nunca
// actualPrice — ver docs/decisions.md).

import ProductRepository from '../grocery/product.repository.js';
import GroceryListRepository from '../grocery/grocery-list.repository.js';
import GroceryListItemRepository from '../grocery/grocery-list-item.repository.js';
import { compareProductAcrossStores, compareListAcrossStores } from '../../services/comparisonService.js';
import { renderEmptyState } from '../../components/empty-state.js';
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
    root.appendChild(renderLevelOne());
    root.appendChild(renderLevelTwo());
  }

  // ---------- NIVEL 1: producto individual ----------

  function renderLevelOne() {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const title = document.createElement('div');
    title.className = 'summary-card__label mb-md';
    title.textContent = 'Nivel 1 — Comparar un producto entre tiendas';
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
        message: 'Registra precios desde Mandado > Historial de precios.',
      }));
      return card;
    }

    groups.forEach((group) => card.appendChild(renderProductGroup(group)));
    return card;
  }

  function renderProductGroup(group) {
    const wrap = document.createElement('div');
    wrap.className = 'mb-md';

    const heading = document.createElement('div');
    heading.className = 'text-muted mb-md';
    heading.textContent = group.entries.length > 1
      ? `Comparación por ${DIMENSION_LABELS[group.dimension] || group.dimension} (normalizado por ${group.baseUnit})`
      : `Presentación por ${DIMENSION_LABELS[group.dimension] || group.dimension} — solo hay un precio registrado, agrega más para comparar`;
    wrap.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'comparison-product-list';

    const hasComparison = group.entries.length > 1;

    group.entries.forEach((entry) => {
      const highlightAsBest = hasComparison && entry.isBest;
      const li = document.createElement('li');
      li.className = `comparison-product-item${highlightAsBest ? ' comparison-product-item--best' : ''}`;

      const left = document.createElement('span');
      left.innerHTML = `${highlightAsBest ? '🏆 ' : ''}${escapeHtml(entry.store.name)} <span class="text-muted">(${entry.priceEntry.quantity} ${escapeHtml(entry.priceEntry.unit)} el ${escapeHtml(entry.priceEntry.date)})</span>`;

      const right = document.createElement('span');
      const diffText = !hasComparison || entry.isBest
        ? ''
        : ` <span class="text-muted">(+${formatMoney(entry.differenceVsBest)}/${group.baseUnit} vs. mejor opción)</span>`;
      right.innerHTML = `${formatMoney(entry.priceEntry.price)} <span class="text-muted">→ ${formatMoney(entry.normalized.pricePerBaseUnit)}/${group.baseUnit}</span>${diffText}`;

      li.append(left, right);
      list.appendChild(li);
    });

    wrap.appendChild(list);

    if (group.entries.length > 1) {
      const best = group.entries.find((e) => e.isBest);
      const banner = document.createElement('p');
      banner.className = 'text-muted mt-md';
      banner.innerHTML = `<strong>Mejor precio:</strong> ${escapeHtml(best.store.name)} — ${formatMoney(best.priceEntry.price)} (${best.priceEntry.quantity} ${escapeHtml(best.priceEntry.unit)})`;
      wrap.appendChild(banner);
    }

    return wrap;
  }

  // ---------- NIVEL 2: mandado completo ----------

  function renderLevelTwo() {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'summary-card__label mb-md';
    title.textContent = 'Nivel 2 — Comparar una lista de mandado completa';
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
        message: 'Registra precios desde Mandado > Historial de precios.',
      }));
      return card;
    }

    card.appendChild(renderStoreTotals(result));
    card.appendChild(renderOptimizedCart(result));
    card.appendChild(renderComparisonSummary(result));

    return card;
  }

  function productName(productId) {
    return ProductRepository.getById(productId)?.name || 'Producto eliminado';
  }

  function renderStoreTotals(result) {
    const wrap = document.createElement('div');
    wrap.className = 'mb-md';
    wrap.innerHTML = '<div class="summary-card__label mb-md">Comprar todo en una sola tienda</div>';

    const list = document.createElement('ul');
    list.className = 'comparison-product-list';
    result.storeTotals.forEach((entry) => {
      const li = document.createElement('li');
      li.className = `comparison-product-item${result.bestSingleStoreFullCoverage === entry ? ' comparison-product-item--best' : ''}`;
      li.innerHTML = `
        <span>${escapeHtml(entry.store.name)} <span class="text-muted">(${entry.covered}/${result.comparableCount} productos${entry.missing ? `, faltan ${entry.missing}` : ''})</span></span>
        <span>${formatMoney(entry.total)}</span>
      `;
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function renderOptimizedCart(result) {
    const wrap = document.createElement('div');
    wrap.className = 'mb-md';
    wrap.innerHTML = '<div class="summary-card__label mb-md">Compra optimizada (mejor tienda por producto)</div>';

    const list = document.createElement('ul');
    list.className = 'top-expenses-list';
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
    wrap.appendChild(list);

    const totalP = document.createElement('p');
    totalP.className = 'mt-md';
    totalP.innerHTML = `<strong>Total optimizado:</strong> ${formatMoney(result.optimizedTotal)}`;
    wrap.appendChild(totalP);

    return wrap;
  }

  function renderComparisonSummary(result) {
    const wrap = document.createElement('div');
    wrap.className = 'card';

    if (!result.bestSingleStoreFullCoverage) {
      wrap.innerHTML = `
        <p class="text-muted">Ninguna tienda tiene precio registrado para los ${result.comparableCount} productos comparables de esta lista, así que no se puede calcular un ahorro directo contra "comprar todo en una tienda".
        La mejor opción parcial es <strong>${escapeHtml(result.bestSingleStore.store.name)}</strong> (${result.bestSingleStore.covered}/${result.comparableCount} productos, ${formatMoney(result.bestSingleStore.total)}).</p>
      `;
      return wrap;
    }

    const over = result.potentialSavings < 0;
    wrap.innerHTML = `
      <p><strong>Mejor tienda única:</strong> ${escapeHtml(result.bestSingleStoreFullCoverage.store.name)} — ${formatMoney(result.bestSingleStoreFullCoverage.total)} (cubre los ${result.comparableCount} productos comparables)</p>
      <p class="mt-md"><strong>Total optimizado:</strong> ${formatMoney(result.optimizedTotal)}</p>
      <p class="mt-md"><strong>Ahorro potencial:</strong> ${over ? '$0.00 (la compra optimizada no resultó más barata)' : formatMoney(result.potentialSavings)}</p>
    `;
    return wrap;
  }

  render();
}
