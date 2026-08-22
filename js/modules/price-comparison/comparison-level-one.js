// Comparador Nivel 1 (producto individual entre tiendas/sucursales/cadenas) — extraído de
// comparison.module.js en V2-9 (refactor focalizado, sin cambiar comportamiento). Solo lee
// productos/precios existentes; ninguna escritura ocurre en este nivel.

import ProductRepository from '../grocery/product.repository.js';
import { compareProductAcrossStores } from '../../services/comparisonService.js';
import { priceFreshness } from '../../services/priceService.js';
import { navigateTo } from '../../core/router.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { iconMarkup } from '../../components/icons.js';
import { formatMoney } from '../../core/currency.js';
import { formatDateShort } from '../../core/dates.js';
import { escapeHtml } from '../../core/validators.js';

const DIMENSION_LABELS = { mass: 'peso', volume: 'volumen', pza: 'pieza', paquete: 'paquete' };

// `state` es un objeto mutable ({ selectedProductId }) que el módulo principal conserva
// entre renders (mismo patrón que `view` en grocery-list.module.js) para que el <select> de
// producto recuerde la selección.
export function renderLevelOne(state, onChange) {
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

  if (!state.selectedProductId || !products.some((p) => p.id === state.selectedProductId)) {
    state.selectedProductId = products[0].id;
  }

  const selectWrap = document.createElement('div');
  selectWrap.className = 'flex items-center gap-sm mb-md';
  selectWrap.innerHTML = '<label for="compareProductSelect" style="margin:0;">Producto</label><select id="compareProductSelect"></select>';
  const select = selectWrap.querySelector('select');
  select.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  select.value = state.selectedProductId;
  select.addEventListener('change', () => { state.selectedProductId = select.value; onChange(); });
  card.appendChild(selectWrap);

  const groups = compareProductAcrossStores(state.selectedProductId);
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

  if (hasComparison) {
    wrap.appendChild(renderWinnerBanner(best, group.baseUnit));
    const chainRanking = renderChainRanking(group);
    if (chainRanking) wrap.appendChild(chainRanking);
  }

  const list = document.createElement('ul');
  list.className = 'comparison-product-list';

  group.entries.forEach((entry) => {
    const highlightAsBest = hasComparison && entry.isBest;
    const li = document.createElement('li');
    li.className = `comparison-product-item${highlightAsBest ? ' comparison-product-item--best' : ''}`;

    // V2-7: frescura en vez de la fecha cruda — comunica antigüedad sin ocultar el precio;
    // la fecha exacta sigue disponible en el `title` (tooltip) para quien la necesite.
    const freshness = priceFreshness(entry.priceEntry.date);
    const left = document.createElement('span');
    left.innerHTML = `${escapeHtml(entry.store.name)} <span class="text-muted">(${entry.priceEntry.quantity} ${escapeHtml(entry.priceEntry.unit)} · <span title="${escapeHtml(formatDateShort(entry.priceEntry.date))}">${escapeHtml(freshness.label)}</span>)</span>`;

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
      <div class="compare-winner__price-note">${formatMoney(best.normalized.pricePerBaseUnit)}/${escapeHtml(baseUnit)} · ${best.priceEntry.quantity} ${escapeHtml(best.priceEntry.unit)} · ${escapeHtml(priceFreshness(best.priceEntry.date).label)}</div>
    </div>
  `;
  return banner;
}

// V2-7 (Comparador V2): "mejor cadena" ≠ "mejor sucursal" — se muestra solo cuando hay ≥2
// cadenas con precio (con 1 sola, coincide siempre con el ganador de arriba y no aporta
// nada nuevo). Cada fila es la mejor sucursal DE esa cadena, no un promedio inventado (ver
// comparisonService.js#aggregateByChain).
function renderChainRanking(group) {
  if (group.chains.length < 2) return null;

  const wrap = document.createElement('div');
  wrap.className = 'mb-md';
  const heading = document.createElement('div');
  heading.className = 'text-muted mb-md';
  heading.textContent = 'Por cadena (mejor sucursal de cada una)';
  wrap.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'comparison-product-list';
  group.chains.forEach((c) => {
    const li = document.createElement('li');
    li.className = `comparison-product-item${c.isBestChain ? ' comparison-product-item--best' : ''}`;
    li.innerHTML = `
      <span>${escapeHtml(c.chainName)}${c.isBestChain ? ' <span class="badge badge--success">Mejor cadena</span>' : ''} <span class="text-muted">(${c.branchCount} sucursal${c.branchCount === 1 ? '' : 'es'} con precio)</span></span>
      <span style="font-weight:700">${formatMoney(c.bestEntry.normalized.pricePerBaseUnit)}/${escapeHtml(group.baseUnit)}</span>
    `;
    list.appendChild(li);
  });
  wrap.appendChild(list);
  return wrap;
}
