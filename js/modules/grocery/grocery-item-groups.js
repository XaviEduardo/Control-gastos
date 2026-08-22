// Agrupación de items de Mi Lista por categoría o por sucursal, y sugerencia de "productos
// habituales" (extraído de grocery-list.module.js en V2-9 — refactor focalizado, sin cambiar
// comportamiento). Reutiliza el mismo renderItemRow para cada item sin importar el modo.

import ProductRepository from './product.repository.js';
import ProductVariantRepository from './product-variant.repository.js';
import GroceryListItemRepository from './grocery-list-item.repository.js';
import StoreChainRepository from '../stores/store-chain.repository.js';
import StoreBranchRepository from '../stores/store-branch.repository.js';
import {
  itemsForList, categoryTotals, itemEffectiveSubtotal, effectiveBranchId, frequentProductIds,
} from '../../services/groceryService.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { iconMarkup } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
import { formatMoney } from '../../core/currency.js';
import { escapeHtml } from '../../core/validators.js';
import { openGroceryItemForm } from './grocery-list-item-form.js';
import { renderItemRow } from './grocery-item-row.js';

export function renderItemsByCategory(list, view, { onChange }) {
  const wrap = document.createElement('div');

  const toolbar = document.createElement('div');
  toolbar.className = 'flex justify-between items-center gap-sm mb-md';
  toolbar.style.flexWrap = 'wrap';
  toolbar.appendChild(renderGroupModeToggle(view, onChange));

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn--primary';
  addBtn.textContent = '+ Agregar producto';
  addBtn.addEventListener('click', () => openGroceryItemForm({ list, onSaved: onChange }));
  toolbar.appendChild(addBtn);
  wrap.appendChild(toolbar);

  const items = itemsForList(list.id);
  if (!items.length) {
    wrap.appendChild(renderEmptyState({
      icon: '🥕',
      title: 'Esta lista todavía no tiene productos',
      message: 'Agrega tu primer producto con el botón de arriba.',
    }));
    return wrap;
  }

  if (view.groupMode === 'branch') {
    renderGroupsByBranch(list, items, onChange).forEach((node) => wrap.appendChild(node));
  } else {
    const totals = categoryTotals(list.id);
    totals.forEach(({ category, effective }) => {
      const catItems = items.filter((i) => i.categoryId === category.id);
      if (!catItems.length) return;
      wrap.appendChild(renderItemGroup(category.name, catItems, effective, list, onChange));
    });
  }

  return wrap;
}

// V2-6 (Parte B — "Lista por sucursal"): puramente presentación, mismos items de siempre
// (`itemsForList`), solo cambia cómo se agrupan visualmente — nunca se crea/duplica ningún
// dato. `.btn--icon` activo/inactivo simula un toggle segmentado sin CSS nuevo.
function renderGroupModeToggle(view, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'flex gap-xs';

  const catBtn = document.createElement('button');
  catBtn.type = 'button';
  catBtn.className = `btn btn--icon ${view.groupMode === 'category' ? 'btn--primary' : 'btn--ghost'}`;
  catBtn.title = 'Ver por categoría';
  catBtn.setAttribute('aria-label', 'Ver agrupado por categoría');
  catBtn.setAttribute('aria-pressed', String(view.groupMode === 'category'));
  catBtn.innerHTML = iconMarkup('grid', { size: 18 });
  catBtn.addEventListener('click', () => { view.groupMode = 'category'; onChange(); });

  const branchBtn = document.createElement('button');
  branchBtn.type = 'button';
  branchBtn.className = `btn btn--icon ${view.groupMode === 'branch' ? 'btn--primary' : 'btn--ghost'}`;
  branchBtn.title = 'Ver por sucursal';
  branchBtn.setAttribute('aria-label', 'Ver agrupado por sucursal');
  branchBtn.setAttribute('aria-pressed', String(view.groupMode === 'branch'));
  branchBtn.innerHTML = iconMarkup('store', { size: 18 });
  branchBtn.addEventListener('click', () => { view.groupMode = 'branch'; onChange(); });

  wrap.append(catBtn, branchBtn);
  return wrap;
}

// Agrupa los MISMOS items por su sucursal efectiva (ver groceryService.js#effectiveBranchId
// — selectedBranchId propio, si no la de la sesión, si no la preferida de la variante). Los
// sin ninguna sucursal resoluble caen en "Sin sucursal asignada", al final.
function renderGroupsByBranch(list, items, onChange) {
  const groups = new Map();
  items.forEach((item) => {
    const branchId = effectiveBranchId(item, list) || 'none';
    if (!groups.has(branchId)) groups.set(branchId, []);
    groups.get(branchId).push(item);
  });

  const namedIds = [...groups.keys()]
    .filter((id) => id !== 'none')
    .sort((a, b) => branchGroupLabel(a).localeCompare(branchGroupLabel(b)));
  const orderedIds = groups.has('none') ? [...namedIds, 'none'] : namedIds;

  return orderedIds.map((branchId) => {
    const groupItems = groups.get(branchId);
    const total = groupItems.reduce((sum, item) => sum + itemEffectiveSubtotal(item), 0);
    return renderItemGroup(branchGroupLabel(branchId), groupItems, total, list, onChange);
  });
}

function branchGroupLabel(branchId) {
  if (branchId === 'none') return 'Sin sucursal asignada';
  const branch = StoreBranchRepository.getById(branchId);
  if (!branch) return 'Sucursal eliminada';
  const chain = StoreChainRepository.getById(branch.chainId);
  return chain ? `${chain.name} — ${branch.name}` : branch.name;
}

// Un solo renderizador de "grupo de items" reutilizado por categoría Y por sucursal (V2-6)
// — mismo markup/estilo `.mandado-category` de siempre, ningún dato duplicado ni recalculado
// distinto según el modo (mismo `renderItemRow` de siempre).
function renderItemGroup(groupLabel, items, effectiveTotal, list, onChange) {
  // .mandado-category es una .card solo en escritorio; en móvil pierde el fondo/borde y
  // cada .grocery-item-row pasa a ser su propia tarjeta suelta (ver css/responsive.css
  // <1024px) — así se evita el look de "tarjetas dentro de una tarjeta".
  const card = document.createElement('div');
  card.className = 'mandado-category mb-md';

  const purchasedInGroup = items.filter((i) => i.purchased).length;

  const header = document.createElement('div');
  header.className = 'mandado-category__header';
  header.innerHTML = `
    <div class="mandado-category__title">
      <span class="mandado-category__bar" aria-hidden="true"></span>
      <span class="card-title">${escapeHtml(groupLabel)}</span>
      <span class="badge badge--neutral">${purchasedInGroup}/${items.length} items</span>
    </div>
    <div class="mandado-category__total">${formatMoney(effectiveTotal)}</div>
  `;
  card.appendChild(header);

  const itemList = document.createElement('div');
  itemList.className = 'grocery-item-list';
  items.forEach((item) => itemList.appendChild(renderItemRow(item, list, { onChange })));
  card.appendChild(itemList);

  return card;
}

// V2-6 (Parte A — "productos habituales"): sugerencia derivada de historial real, SIN IA
// (ver groceryService.js#frequentProductIds). Nunca se preseleccionan solos — cada uno
// requiere el "+" explícito del usuario. Se oculta por completo si no hay ningún candidato
// pendiente (ya agregado, o sin suficiente historial todavía).
export function renderFrequentProductsSection(list, { onChange }) {
  const alreadyAdded = new Set(itemsForList(list.id).map((item) => item.productId));
  const candidates = [...frequentProductIds()]
    .filter((id) => !alreadyAdded.has(id))
    .map((id) => ProductRepository.getById(id))
    .filter((p) => p && p.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!candidates.length) return null;

  const card = document.createElement('div');
  card.className = 'card mb-md';
  const header = document.createElement('div');
  header.className = 'card-title mb-md';
  header.textContent = 'Productos habituales';
  card.appendChild(header);

  const list_ = document.createElement('div');
  list_.className = 'movement-list';
  candidates.forEach((product) => {
    const row = document.createElement('div');
    row.className = 'movement-row';

    const icon = document.createElement('span');
    icon.className = 'movement-row__icon';
    icon.innerHTML = iconMarkup('box', { size: 16 });

    const body = document.createElement('div');
    body.className = 'movement-row__body';
    body.innerHTML = `<div class="movement-row__title">${escapeHtml(product.name)}</div>`;

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn--icon btn--ghost';
    addBtn.title = `Agregar ${product.name}`;
    addBtn.setAttribute('aria-label', `Agregar ${product.name} a la lista`);
    addBtn.innerHTML = iconMarkup('plus', { size: 18 });
    addBtn.addEventListener('click', () => addFrequentProduct(product, list, onChange));

    row.append(icon, body, addBtn);
    list_.appendChild(row);
  });
  card.appendChild(list_);
  return card;
}

// Alta rápida de un producto habitual: con EXACTAMENTE 1 variante activa se agrega directo
// (sin ambigüedad, mismo criterio que price-form.js#unambiguousVariantId); con 0 o varias
// variantes se abre el formulario completo para que el usuario elija — nunca se adivina.
function addFrequentProduct(product, list, onChange) {
  const variants = ProductVariantRepository.forProduct(product.id, { includeInactive: false });
  if (variants.length !== 1) {
    openGroceryItemForm({ list, onSaved: onChange });
    return;
  }
  const variant = variants[0];
  GroceryListItemRepository.create({
    groceryListId: list.id,
    productId: product.id,
    productVariantId: variant.id,
    categoryId: product.categoryId,
    quantity: 1,
    unit: variant.purchaseUnit,
  });
  showToast(`${product.name} agregado a la lista`);
  onChange();
}
