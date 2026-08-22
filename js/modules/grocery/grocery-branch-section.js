// "¿Dónde estás comprando?" — sucursal activa de la lista (extraído de
// grocery-list.module.js en V2-9 — refactor focalizado, sin cambiar comportamiento).

import GroceryListRepository from './grocery-list.repository.js';
import StoreChainRepository from '../stores/store-chain.repository.js';
import StoreBranchRepository from '../stores/store-branch.repository.js';
import { itemsForList } from '../../services/groceryService.js';
import { syncPurchaseObservation } from '../../services/purchaseObservationService.js';
import { iconMarkup } from '../../components/icons.js';
import { showToast } from '../../components/toast.js';
import { escapeHtml } from '../../core/validators.js';

// V2-3 (Mandado 2.0): "¿dónde estoy comprando ahora?" — GroceryList.activeBranchId, sin
// entidad nueva. Con sucursal ya fijada se muestra un indicador discreto ("Comprando en...")
// con una forma de cambiarla; sin fijar (o si el usuario pidió cambiarla) se muestra el
// selector. Nunca bloquea el resto de la pantalla — es una recomendación de flujo, no un
// requisito para poder usar la lista (mismo criterio de "recomendar, no imponer" del resto
// del rediseño V2).
export function renderBranchSection(list, view, { onChange }) {
  const activeBranch = list.activeBranchId ? StoreBranchRepository.getById(list.activeBranchId) : null;
  if (activeBranch && !view.branchPickerOpen) {
    return renderBranchIndicator(activeBranch, view, onChange);
  }
  return renderBranchPicker(list, activeBranch, view, onChange);
}

function renderBranchIndicator(branch, view, onChange) {
  const chain = StoreChainRepository.getById(branch.chainId);
  const card = document.createElement('div');
  card.className = 'card mb-md';

  const row = document.createElement('div');
  row.className = 'settings-row';
  row.innerHTML = `
    <span class="kpi-card__icon">${iconMarkup('store', { size: 16 })}</span>
    <span class="settings-row__body">
      <span class="settings-row__title">Comprando en</span>
      <span class="settings-row__subtitle">${escapeHtml(chain?.name || '')}${chain ? ' — ' : ''}${escapeHtml(branch.name)}</span>
    </span>
  `;

  const changeBtn = document.createElement('button');
  changeBtn.type = 'button';
  changeBtn.className = 'btn btn--icon btn--ghost';
  changeBtn.title = 'Cambiar sucursal';
  changeBtn.setAttribute('aria-label', 'Cambiar sucursal donde estás comprando');
  changeBtn.innerHTML = iconMarkup('edit', { size: 16 });
  changeBtn.addEventListener('click', () => { view.branchPickerOpen = true; onChange(); });
  row.appendChild(changeBtn);

  card.appendChild(row);
  return card;
}

function renderBranchPicker(list, activeBranch, view, onChange) {
  const card = document.createElement('div');
  card.className = 'card mb-md';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center gap-sm mb-md';
  header.style.flexWrap = 'wrap';
  header.innerHTML = '<div class="card-title">¿Dónde estás comprando?</div>';
  if (activeBranch) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', () => { view.branchPickerOpen = false; onChange(); });
    header.appendChild(cancelBtn);
  }
  card.appendChild(header);

  const chains = StoreChainRepository.list({ includeInactive: false });
  const options = [];
  chains.forEach((chain) => {
    StoreBranchRepository.forChain(chain.id, { includeInactive: false }).forEach((branch) => {
      options.push({ chain, branch });
    });
  });

  if (!options.length) {
    const empty = document.createElement('p');
    empty.className = 'text-muted';
    empty.textContent = 'Agrega una tienda desde Mandado > Tiendas para poder elegir dónde comprar.';
    card.appendChild(empty);
    return card;
  }

  const optionsList = document.createElement('div');
  optionsList.className = 'settings-list';
  options.forEach(({ chain, branch }) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'settings-row settings-row--action';
    row.innerHTML = `
      <span class="kpi-card__icon">${iconMarkup('store', { size: 16 })}</span>
      <span class="settings-row__body">
        <span class="settings-row__title">${escapeHtml(chain.name)} — ${escapeHtml(branch.name)}</span>
      </span>
    `;
    row.addEventListener('click', () => {
      const updatedList = GroceryListRepository.update(list.id, { activeBranchId: branch.id });
      // Caso poco común pero real: items marcados comprado+con precio ANTES de fijar la
      // sucursal de la lista (sin sucursal propia, así que no se pudo generar su
      // observación al momento). Al fijarla ahora, se resincronizan retroactivamente —
      // syncPurchaseObservation ya es un no-op seguro para los que no aplican.
      itemsForList(list.id).forEach((it) => syncPurchaseObservation(it, updatedList));
      view.branchPickerOpen = false;
      showToast(`Comprando en ${chain.name} — ${branch.name}`);
      onChange();
    });
    optionsList.appendChild(row);
  });
  card.appendChild(optionsList);

  return card;
}
