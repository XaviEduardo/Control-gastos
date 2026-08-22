// Fila individual de un GroceryListItem dentro de Mi Lista (extraído de grocery-list.module.js
// en V2-9 — refactor focalizado, sin cambiar comportamiento). Checkbox, cantidad/unidad,
// precio estimado/real, subtotal efectivo y menú de acciones (notas, cambiar tienda, quitar).

import GroceryListItemRepository from './grocery-list-item.repository.js';
import ProductRepository from './product.repository.js';
import ProductVariantRepository from './product-variant.repository.js';
import StoreChainRepository from '../stores/store-chain.repository.js';
import StoreBranchRepository from '../stores/store-branch.repository.js';
import { itemEffectiveSubtotal } from '../../services/groceryService.js';
import { syncPurchaseObservation } from '../../services/purchaseObservationService.js';
import { createActionMenu } from '../../components/action-menu.js';
import { openModal } from '../../components/modal.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { formatMoney } from '../../core/currency.js';
import { escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from './units.js';
import { formatVariantSuffix } from './variant-format.js';

// V2-4: único punto de código que combina "actualizar un item" con "sincronizar su
// PriceObservation automática" — mantiene esa responsabilidad fuera de cada handler suelto
// (ver js/services/purchaseObservationService.js). Se usa para TODA actualización de item en
// este módulo, no solo purchased/actualPrice: si cantidad/unidad cambian después de comprado,
// la observación ya creada debe reflejar el monto real correcto, no quedarse desactualizada.
function updateItemAndSync(item, patch, list) {
  const updated = GroceryListItemRepository.update(item.id, patch);
  const synced = syncPurchaseObservation(updated, list);
  return { updated, synced };
}

export function renderItemRow(item, list, { onChange }) {
  // V2-1: los items nuevos (y los migrados) tienen productVariantId resuelto; se cae a
  // productId directo solo como red de seguridad (nunca debería faltar, ver migración V1→V2).
  const variant = item.productVariantId ? ProductVariantRepository.getById(item.productVariantId) : null;
  const product = variant ? ProductRepository.getById(variant.productId) : ProductRepository.getById(item.productId);
  const variantSuffix = variant ? formatVariantSuffix(variant) : '';
  // V2-3: solo se muestra si el item tiene una sucursal PROPIA (distinta de heredar la de la
  // lista, ver groceryService.js#effectiveBranchId) — heredar en silencio es justo el punto
  // de tener una sucursal activa; mostrarla en cada item sería ruido visual innecesario.
  const overrideBranch = item.selectedBranchId ? StoreBranchRepository.getById(item.selectedBranchId) : null;
  const nameExtras = [variantSuffix, overrideBranch?.name].filter(Boolean).join(' · ');
  const unitLabel = UNIT_OPTIONS.find((u) => u.value === item.unit)?.label || item.unit;

  const row = document.createElement('div');
  row.className = `grocery-item-row${item.purchased ? ' grocery-item-row--purchased' : ''}`;

  const checkboxWrap = document.createElement('label');
  checkboxWrap.className = 'grocery-item-row__checkbox-wrap';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.purchased;
  checkbox.setAttribute('aria-label', `Marcar ${product?.name || 'producto'} como comprado`);
  checkbox.addEventListener('change', () => {
    const { synced } = updateItemAndSync(item, { purchased: checkbox.checked }, list);
    if (synced) showToast('Precio guardado en Historial');
    onChange();
  });
  checkboxWrap.appendChild(checkbox);

  const nameSpan = document.createElement('span');
  nameSpan.className = 'grocery-item-row__name';
  nameSpan.innerHTML = `${escapeHtml(product?.name || '(producto eliminado)')}${nameExtras ? ` <span class="text-muted text-xs">· ${escapeHtml(nameExtras)}</span>` : ''}`;

  const qtyWrap = document.createElement('div');
  qtyWrap.className = 'grocery-item-row__qty-wrap';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '0';
  qtyInput.step = '0.01';
  qtyInput.value = item.quantity;
  qtyInput.className = 'grocery-item-row__qty';
  qtyInput.setAttribute('aria-label', 'Cantidad');
  qtyInput.addEventListener('change', () => {
    const value = Number(qtyInput.value);
    if (value > 0) {
      updateItemAndSync(item, { quantity: value }, list);
    } else {
      showToast('La cantidad debe ser mayor a 0.', { type: 'error' });
    }
    onChange();
  });

  const unitSelect = document.createElement('select');
  unitSelect.setAttribute('aria-label', 'Unidad');
  unitSelect.innerHTML = UNIT_OPTIONS.map((u) => `<option value="${u.value}">${u.label}</option>`).join('');
  unitSelect.value = item.unit;
  unitSelect.addEventListener('change', () => {
    updateItemAndSync(item, { unit: unitSelect.value }, list);
    onChange();
  });

  qtyWrap.append(qtyInput, unitSelect);

  const estField = document.createElement('div');
  estField.className = 'grocery-item-row__field grocery-item-row__field--est';
  const estLabel = document.createElement('span');
  estLabel.className = 'grocery-item-row__field-label';
  estLabel.textContent = `Est./${unitLabel}`;

  const estInput = document.createElement('input');
  estInput.type = 'number';
  estInput.min = '0';
  estInput.step = '0.01';
  estInput.placeholder = 'Precio est.';
  estInput.value = item.estimatedPrice ?? '';
  estInput.className = 'grocery-item-row__price';
  estInput.setAttribute('aria-label', 'Precio estimado por unidad');
  estInput.addEventListener('change', () => {
    const raw = estInput.value;
    if (raw !== '' && !(Number(raw) >= 0)) {
      showToast('El precio estimado no puede ser negativo.', { type: 'error' });
    } else {
      updateItemAndSync(item, { estimatedPrice: raw === '' ? null : Number(raw) }, list);
    }
    onChange();
  });
  estField.append(estLabel, estInput);

  const realField = document.createElement('div');
  realField.className = 'grocery-item-row__field grocery-item-row__field--real';
  const realLabel = document.createElement('span');
  realLabel.className = 'grocery-item-row__field-label';
  realLabel.textContent = `Real/${unitLabel}`;

  const actualInput = document.createElement('input');
  actualInput.type = 'number';
  actualInput.min = '0';
  actualInput.step = '0.01';
  actualInput.placeholder = 'Precio real';
  actualInput.value = item.actualPrice ?? '';
  actualInput.className = 'grocery-item-row__price';
  actualInput.setAttribute('aria-label', 'Precio real por unidad');
  actualInput.addEventListener('change', () => {
    const raw = actualInput.value;
    if (raw !== '' && !(Number(raw) >= 0)) {
      showToast('El precio real no puede ser negativo.', { type: 'error' });
    } else {
      const { synced } = updateItemAndSync(item, { actualPrice: raw === '' ? null : Number(raw) }, list);
      if (synced) showToast('Precio guardado en Historial');
    }
    onChange();
  });
  realField.append(realLabel, actualInput);

  const subtotalWrap = document.createElement('div');
  subtotalWrap.className = 'grocery-item-row__subtotal-wrap';
  const subtotalLabel = document.createElement('span');
  subtotalLabel.className = 'grocery-item-row__subtotal-label';
  subtotalLabel.textContent = 'Subtotal';
  const subtotalSpan = document.createElement('span');
  subtotalSpan.className = 'grocery-item-row__subtotal';
  subtotalSpan.textContent = formatMoney(itemEffectiveSubtotal(item));
  subtotalWrap.append(subtotalLabel, subtotalSpan);

  const menu = createActionMenu(`Más acciones para ${product?.name || 'producto'}`, [
    {
      label: 'Notas',
      onClick: () => {
        const value = window.prompt('Notas', item.notes || '');
        if (value !== null) {
          GroceryListItemRepository.update(item.id, { notes: value });
          onChange();
        }
      },
    },
    {
      label: 'Cambiar tienda',
      onClick: () => openItemBranchForm(item, list, onChange),
    },
    {
      label: 'Quitar de la lista',
      danger: true,
      onClick: async () => {
        const confirmed = await confirmDialog({
          title: 'Quitar producto',
          message: `¿Quitar "${product?.name || ''}" de esta lista?`,
          confirmText: 'Quitar',
          danger: true,
        });
        if (confirmed) {
          GroceryListItemRepository.remove(item.id);
          showToast('Producto quitado de la lista');
          onChange();
        }
      },
    },
  ]);
  menu.classList.add('grocery-item-row__menu');

  row.append(checkboxWrap, nameSpan, qtyWrap, estField, realField, subtotalWrap, menu);
  return row;
}

// V2-3: "el usuario puede sobrescribir" la sucursal heredada de la lista para un item
// puntual. Escribe selectedStoreId/selectedBranchId explícitamente al mismo valor (mismo
// criterio ya usado en V2-1 para productId/productVariantId) — nunca solo uno de los dos.
function openItemBranchForm(item, list, onChange) {
  const chains = StoreChainRepository.list({ includeInactive: false });
  const formId = `item-branch-form-${Date.now()}`;
  const form = document.createElement('form');
  form.id = formId;
  form.className = 'form-grid';
  const activeBranch = list.activeBranchId ? StoreBranchRepository.getById(list.activeBranchId) : null;
  form.innerHTML = `
    <div>
      <label for="${formId}-branch">Sucursal para este producto</label>
      <select id="${formId}-branch" name="branchId">
        <option value="">Usar la sucursal de la lista${activeBranch ? ` (${escapeHtml(activeBranch.name)})` : ''}</option>
        ${chains.map((chain) => `
          <optgroup label="${escapeHtml(chain.name)}">
            ${StoreBranchRepository.forChain(chain.id, { includeInactive: false }).map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
          </optgroup>
        `).join('')}
      </select>
    </div>
    <p class="form-error hidden"></p>
  `;

  const select = form.querySelector('select');
  select.value = item.selectedBranchId || '';

  const footer = document.createElement('div');
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--ghost';
  cancelBtn.textContent = 'Cancelar';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn btn--primary';
  saveBtn.setAttribute('form', formId);
  saveBtn.textContent = 'Guardar';
  footer.append(cancelBtn, saveBtn);

  const modal = openModal({ title: 'Cambiar sucursal del producto', content: form, footer });
  cancelBtn.addEventListener('click', () => modal.close());

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const branchId = new FormData(form).get('branchId') || null;
    const updated = GroceryListItemRepository.update(item.id, { selectedStoreId: branchId, selectedBranchId: branchId });
    // Si el item ya estaba comprado con precio real, la observación (si existe) debe
    // reflejar la sucursal correcta — no solo quedarse con la vieja.
    syncPurchaseObservation(updated, list);
    modal.close();
    showToast('Sucursal actualizada');
    onChange();
  });
}
