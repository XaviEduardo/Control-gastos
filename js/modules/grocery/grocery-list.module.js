// Pantalla principal de Mandado ("Mi lista"). No crea ninguna base de datos independiente:
// lee/escribe a través de GroceryList/GroceryListItem/Product repositories y de
// groceryService para los totales (ver docs/architecture.md, docs/decisions.md).

import State from '../../core/state.js';
import GroceryListRepository from './grocery-list.repository.js';
import GroceryListItemRepository from './grocery-list-item.repository.js';
import ProductRepository from './product.repository.js';
import ProductVariantRepository from './product-variant.repository.js';
import StoreChainRepository from '../stores/store-chain.repository.js';
import StoreBranchRepository from '../stores/store-branch.repository.js';
import { createCategoryRepository } from '../shared/category-repository.js';
import ExpenseRepository from '../expenses/expense.repository.js';
import {
  itemsForList, categoryTotals, listTotals, itemEffectiveSubtotal, effectiveBranchId, frequentProductIds,
} from '../../services/groceryService.js';
import { syncPurchaseObservation } from '../../services/purchaseObservationService.js';
import { renderEmptyState } from '../../components/empty-state.js';
import { createActionMenu, ensureActionMenuOutsideClick } from '../../components/action-menu.js';
import { iconMarkup } from '../../components/icons.js';
import { openModal } from '../../components/modal.js';
import { confirmDialog } from '../../components/confirm-dialog.js';
import { showToast } from '../../components/toast.js';
import { formatMoney, formatPercent } from '../../core/currency.js';
import { toISODate, formatDateShort } from '../../core/dates.js';
import { isRequired, validate, escapeHtml } from '../../core/validators.js';
import { UNIT_OPTIONS } from './units.js';
import { formatVariantSuffix } from './variant-format.js';
import { openGroceryItemForm } from './grocery-list-item-form.js';

const expenseCategoryRepo = createCategoryRepository('expenseCategories');

export function renderGroceryListModule(container) {
  ensureActionMenuOutsideClick();
  const settings = State.getSettings();
  let selectedListId = settings.selectedGroceryListId || null;
  // V2-3/V2-6: nada de esto es persistente (ver docs/v2-data-model.md — GroceryList.
  // activeBranchId es lo persistente); `branchPickerOpen` controla si el picker de sucursal
  // está expandido y `groupMode` si Mi Lista se ve por categoría o por sucursal — ambos son
  // preferencias de esta sesión de UI, no del modelo de datos.
  const view = { branchPickerOpen: false, groupMode: 'category' };

  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  function persistSelection() {
    State.setSettings({ selectedGroceryListId: selectedListId });
  }

  function currentLists() {
    return [...GroceryListRepository.list()].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }

  function ensureSelection(lists) {
    if (selectedListId && lists.some((l) => l.id === selectedListId)) return;
    selectedListId = lists[0]?.id || null;
    persistSelection();
  }

  function render() {
    root.innerHTML = '';
    const lists = currentLists();
    ensureSelection(lists);

    root.appendChild(renderHeader());
    root.appendChild(renderListSelector(lists));

    if (!selectedListId) {
      root.appendChild(renderEmptyState({
        icon: '🛒',
        title: 'Todavía no tienes listas de mandado',
        message: 'Crea tu primera lista para empezar a organizar tus compras.',
        actionLabel: '+ Nueva lista',
        onAction: () => openListForm(),
      }));
      return;
    }

    const list = GroceryListRepository.getById(selectedListId);
    root.appendChild(renderTotalsSummary(list));
    root.appendChild(renderBranchSection(list));
    const frequentSection = renderFrequentProductsSection(list);
    if (frequentSection) root.appendChild(frequentSection);
    root.appendChild(renderItemsByCategory(list));
  }

  function renderHeader() {
    const wrap = document.createElement('div');
    wrap.className = 'dashboard-header mb-md';
    wrap.innerHTML = `
      <div class="dashboard-header__eyebrow">Mandado</div>
      <h2 class="dashboard-header__title">Mi Lista</h2>
    `;
    return wrap;
  }

  function renderListSelector(lists) {
    const bar = document.createElement('div');
    bar.className = 'card mb-md flex justify-between items-center gap-sm toolbar';

    const selectWrap = document.createElement('div');
    selectWrap.className = 'flex items-center gap-sm';
    selectWrap.innerHTML = '<label for="groceryListSelect" style="margin:0;">Lista</label><select id="groceryListSelect"></select>';
    const select = selectWrap.querySelector('select');
    select.innerHTML = lists.length
      ? lists.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}${l.status === 'closed' ? ' (completada)' : ''}</option>`).join('')
      : '<option value="">Sin listas</option>';
    if (selectedListId) select.value = selectedListId;
    select.addEventListener('change', () => {
      selectedListId = select.value || null;
      persistSelection();
      render();
    });

    const actions = document.createElement('div');
    actions.className = 'flex gap-sm';

    // Solo ícono + title/aria-label (tooltip nativo en desktop, lector de pantalla en
    // cualquier plataforma) en vez de texto: con las 4 acciones juntas, los botones con texto
    // se salían de la pantalla en móvil (ver reporte de usuario). `.btn--icon` ya es 44×44
    // (objetivo táctil), igual en iOS/Android que en desktop.
    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'btn btn--icon btn--primary';
    newBtn.title = 'Nueva lista';
    newBtn.setAttribute('aria-label', 'Nueva lista');
    newBtn.innerHTML = iconMarkup('plus', { size: 18 });
    // V2-5: si ya existe al menos un mandado, ofrece repetirlo antes de ir directo al
    // formulario vacío — "reducir drásticamente el trabajo" de armar cada lista desde cero.
    newBtn.addEventListener('click', () => {
      const existingLists = currentLists();
      if (existingLists.length) openNewListChoice(existingLists[0]);
      else openListForm();
    });
    actions.appendChild(newBtn);

    if (selectedListId) {
      const list = GroceryListRepository.getById(selectedListId);

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn--icon btn--ghost';
      editBtn.title = 'Editar lista';
      editBtn.setAttribute('aria-label', 'Editar lista');
      editBtn.innerHTML = iconMarkup('edit', { size: 18 });
      editBtn.addEventListener('click', () => openListForm(list));

      const toggleLabel = list.status === 'open' ? 'Marcar completada' : 'Reabrir';
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'btn btn--icon btn--ghost';
      toggleBtn.title = toggleLabel;
      toggleBtn.setAttribute('aria-label', toggleLabel);
      toggleBtn.innerHTML = iconMarkup(list.status === 'open' ? 'check' : 'rotate-ccw', { size: 18 });
      toggleBtn.addEventListener('click', () => {
        GroceryListRepository.update(list.id, { status: list.status === 'open' ? 'closed' : 'open' });
        render();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn--icon btn--danger';
      delBtn.title = 'Eliminar lista';
      delBtn.setAttribute('aria-label', 'Eliminar lista');
      delBtn.innerHTML = iconMarkup('trash', { size: 18 });
      delBtn.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Eliminar lista',
          message: `¿Eliminar "${escapeHtml(list.name)}" y todos sus productos? Esta acción no se puede deshacer. Si ya registraste un gasto vinculado, ese gasto NO se elimina.`,
          confirmText: 'Eliminar',
          danger: true,
        });
        if (confirmed) {
          GroceryListRepository.remove(list.id);
          selectedListId = null;
          persistSelection();
          showToast('Lista eliminada');
          render();
        }
      });

      actions.append(editBtn, toggleBtn, delBtn);
    }

    bar.append(selectWrap, actions);
    return bar;
  }

  // Tarjeta única (nombre + monto + progreso) en vez de 4 stat-cards sueltas — misma
  // listTotals() de siempre, solo reorganizada visualmente (ver rediseño "Minimal Finance").
  function renderTotalsSummary(list) {
    const totals = listTotals(list);
    const wrap = document.createElement('div');

    const card = document.createElement('div');
    card.className = 'card mb-md mandado-summary';

    const metaParts = [];
    if (list.startDate) metaParts.push(formatDateShort(list.startDate));
    if (list.status === 'closed') metaParts.push('Completada');
    if (list.notes) metaParts.push(escapeHtml(list.notes));

    const header = document.createElement('div');
    header.className = 'mandado-summary__header';
    header.innerHTML = `
      <div class="mandado-summary__title">
        <span class="kpi-card__icon">${iconMarkup('cart', { size: 18 })}</span>
        <span>
          <div class="card-title">${escapeHtml(list.name)}</div>
          ${metaParts.length ? `<div class="text-muted text-xs mt-md">${metaParts.join(' · ')}</div>` : ''}
        </span>
      </div>
      <div class="mandado-summary__amount">
        <div class="mandado-summary__amount-value">${formatMoney(totals.real)}</div>
        <div class="mandado-summary__amount-caption">Gastado${totals.budget !== null ? ` · Est. ${formatMoney(totals.estimated)}` : ` / ${formatMoney(totals.estimated)} est.`}</div>
      </div>
    `;
    card.appendChild(header);

    if (totals.budget !== null) {
      const over = totals.difference < 0;
      const pct = totals.budget > 0 ? Math.min(totals.real / totals.budget, 1) : 0;
      const bar = document.createElement('div');
      bar.className = 'progress-bar mt-md';
      bar.innerHTML = `<div class="progress-bar__fill${over ? ' progress-bar__fill--over' : ''}" style="width:${pct * 100}%"></div>`;
      card.appendChild(bar);

      const footRow = document.createElement('div');
      footRow.className = 'mandado-summary__footrow';
      footRow.innerHTML = `
        <span>${formatPercent(totals.budget > 0 ? totals.real / totals.budget : 0, 0)} del presupuesto${over ? ` · excedido por ${formatMoney(Math.abs(totals.difference))}` : ''}</span>
        <span>${totals.purchasedCount}/${totals.itemCount} items</span>
      `;
      card.appendChild(footRow);
    } else {
      const footRow = document.createElement('div');
      footRow.className = 'mandado-summary__footrow mt-md';
      footRow.innerHTML = `<span>${totals.purchasedCount}/${totals.itemCount} items comprados</span>`;
      card.appendChild(footRow);
    }

    wrap.appendChild(card);
    wrap.appendChild(renderExpenseLink(list, totals));
    return wrap;
  }

  function renderExpenseLink(list, totals) {
    const card = document.createElement('div');
    card.className = 'card mb-md';

    const linkedExpense = list.linkedExpenseId ? ExpenseRepository.getById(list.linkedExpenseId) : null;
    const label = document.createElement('div');
    label.className = 'card-title mb-md';
    label.textContent = 'Integración con Gastos';
    card.appendChild(label);

    if (linkedExpense) {
      const msg = document.createElement('p');
      msg.className = 'text-muted';
      msg.textContent = `Ya se registró como gasto: "${linkedExpense.description}" por ${formatMoney(linkedExpense.amount)}. Se refleja en Semana/Mes/Dashboard.`;
      card.appendChild(msg);
      return card;
    }

    const mandadoCategory = expenseCategoryRepo.list().find((c) => c.name.trim().toLowerCase() === 'mandado');
    if (!mandadoCategory) {
      const msg = document.createElement('p');
      msg.className = 'text-muted';
      msg.textContent = 'Crea una categoría de gasto llamada "Mandado" (desde Gastos) para poder registrar aquí el total real.';
      card.appendChild(msg);
      return card;
    }

    if (totals.real <= 0) {
      const msg = document.createElement('p');
      msg.className = 'text-muted';
      msg.textContent = 'Captura precios reales en tus productos para poder registrar el total como gasto.';
      card.appendChild(msg);
      return card;
    }

    const msg = document.createElement('p');
    msg.className = 'text-muted mb-md';
    msg.textContent = `Total real actual: ${formatMoney(totals.real)}. Regístralo como gasto para que aparezca en Semana/Mes/Dashboard.`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--primary';
    btn.textContent = 'Registrar como gasto';
    btn.addEventListener('click', () => {
      const expense = ExpenseRepository.create({
        description: list.name,
        categoryId: mandadoCategory.id,
        amount: totals.real,
        date: list.startDate || toISODate(new Date()),
        frequency: 'once',
        notes: `Generado desde la lista de mandado "${list.name}".`,
      });
      GroceryListRepository.update(list.id, { linkedExpenseId: expense.id });
      showToast('Gasto registrado');
      render();
    });

    card.append(msg, btn);
    return card;
  }

  // V2-3 (Mandado 2.0): "¿dónde estoy comprando ahora?" — GroceryList.activeBranchId, sin
  // entidad nueva. Con sucursal ya fijada se muestra un indicador discreto ("Comprando en...")
  // con una forma de cambiarla; sin fijar (o si el usuario pidió cambiarla) se muestra el
  // selector. Nunca bloquea el resto de la pantalla — es una recomendación de flujo, no un
  // requisito para poder usar la lista (mismo criterio de "recomendar, no imponer" del resto
  // del rediseño V2).
  function renderBranchSection(list) {
    const activeBranch = list.activeBranchId ? StoreBranchRepository.getById(list.activeBranchId) : null;
    if (activeBranch && !view.branchPickerOpen) {
      return renderBranchIndicator(activeBranch);
    }
    return renderBranchPicker(list, activeBranch);
  }

  function renderBranchIndicator(branch) {
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
    changeBtn.addEventListener('click', () => { view.branchPickerOpen = true; render(); });
    row.appendChild(changeBtn);

    card.appendChild(row);
    return card;
  }

  function renderBranchPicker(list, activeBranch) {
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
      cancelBtn.addEventListener('click', () => { view.branchPickerOpen = false; render(); });
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
        render();
      });
      optionsList.appendChild(row);
    });
    card.appendChild(optionsList);

    return card;
  }

  function renderItemsByCategory(list) {
    const wrap = document.createElement('div');

    const toolbar = document.createElement('div');
    toolbar.className = 'flex justify-between items-center gap-sm mb-md';
    toolbar.style.flexWrap = 'wrap';
    toolbar.appendChild(renderGroupModeToggle());

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn--primary';
    addBtn.textContent = '+ Agregar producto';
    addBtn.addEventListener('click', () => openGroceryItemForm({ list, onSaved: render }));
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
      renderGroupsByBranch(list, items).forEach((node) => wrap.appendChild(node));
    } else {
      const totals = categoryTotals(list.id);
      totals.forEach(({ category, effective }) => {
        const catItems = items.filter((i) => i.categoryId === category.id);
        if (!catItems.length) return;
        wrap.appendChild(renderItemGroup(category.name, catItems, effective, list));
      });
    }

    return wrap;
  }

  // V2-6 (Parte B — "Lista por sucursal"): puramente presentación, mismos items de siempre
  // (`itemsForList`), solo cambia cómo se agrupan visualmente — nunca se crea/duplica ningún
  // dato. `.btn--icon` activo/inactivo simula un toggle segmentado sin CSS nuevo.
  function renderGroupModeToggle() {
    const wrap = document.createElement('div');
    wrap.className = 'flex gap-xs';

    const catBtn = document.createElement('button');
    catBtn.type = 'button';
    catBtn.className = `btn btn--icon ${view.groupMode === 'category' ? 'btn--primary' : 'btn--ghost'}`;
    catBtn.title = 'Ver por categoría';
    catBtn.setAttribute('aria-label', 'Ver agrupado por categoría');
    catBtn.setAttribute('aria-pressed', String(view.groupMode === 'category'));
    catBtn.innerHTML = iconMarkup('grid', { size: 18 });
    catBtn.addEventListener('click', () => { view.groupMode = 'category'; render(); });

    const branchBtn = document.createElement('button');
    branchBtn.type = 'button';
    branchBtn.className = `btn btn--icon ${view.groupMode === 'branch' ? 'btn--primary' : 'btn--ghost'}`;
    branchBtn.title = 'Ver por sucursal';
    branchBtn.setAttribute('aria-label', 'Ver agrupado por sucursal');
    branchBtn.setAttribute('aria-pressed', String(view.groupMode === 'branch'));
    branchBtn.innerHTML = iconMarkup('store', { size: 18 });
    branchBtn.addEventListener('click', () => { view.groupMode = 'branch'; render(); });

    wrap.append(catBtn, branchBtn);
    return wrap;
  }

  // Agrupa los MISMOS items por su sucursal efectiva (ver groceryService.js#effectiveBranchId
  // — selectedBranchId propio, si no la de la sesión, si no la preferida de la variante). Los
  // sin ninguna sucursal resoluble caen en "Sin sucursal asignada", al final.
  function renderGroupsByBranch(list, items) {
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
      return renderItemGroup(branchGroupLabel(branchId), groupItems, total, list);
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
  function renderItemGroup(groupLabel, items, effectiveTotal, list) {
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
    items.forEach((item) => itemList.appendChild(renderItemRow(item, list)));
    card.appendChild(itemList);

    return card;
  }

  // V2-6 (Parte A — "productos habituales"): sugerencia derivada de historial real, SIN IA
  // (ver groceryService.js#frequentProductIds). Nunca se preseleccionan solos — cada uno
  // requiere el "+" explícito del usuario. Se oculta por completo si no hay ningún candidato
  // pendiente (ya agregado, o sin suficiente historial todavía).
  function renderFrequentProductsSection(list) {
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
      addBtn.addEventListener('click', () => addFrequentProduct(product, list));

      row.append(icon, body, addBtn);
      list_.appendChild(row);
    });
    card.appendChild(list_);
    return card;
  }

  // Alta rápida de un producto habitual: con EXACTAMENTE 1 variante activa se agrega directo
  // (sin ambigüedad, mismo criterio que price-form.js#unambiguousVariantId); con 0 o varias
  // variantes se abre el formulario completo para que el usuario elija — nunca se adivina.
  function addFrequentProduct(product, list) {
    const variants = ProductVariantRepository.forProduct(product.id, { includeInactive: false });
    if (variants.length !== 1) {
      openGroceryItemForm({ list, onSaved: render });
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
    render();
  }

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

  function renderItemRow(item, list) {
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
      render();
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
      render();
    });

    const unitSelect = document.createElement('select');
    unitSelect.setAttribute('aria-label', 'Unidad');
    unitSelect.innerHTML = UNIT_OPTIONS.map((u) => `<option value="${u.value}">${u.label}</option>`).join('');
    unitSelect.value = item.unit;
    unitSelect.addEventListener('change', () => {
      updateItemAndSync(item, { unit: unitSelect.value }, list);
      render();
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
      render();
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
      render();
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
            render();
          }
        },
      },
      {
        label: 'Cambiar tienda',
        onClick: () => openItemBranchForm(item, list),
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
            render();
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
  function openItemBranchForm(item, list) {
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
      render();
    });
  }

  // V2-5: "Nuevo mandado" — repetir el último (con sus productos, cantidades, categorías y
  // notas, sin nada de compra/precio real) o empezar vacío como siempre. Dos botones grandes,
  // apilados — pensado para mobile, nada que escribir todavía.
  function openNewListChoice(lastList) {
    const content = document.createElement('div');
    content.className = 'form-grid';

    const intro = document.createElement('p');
    intro.className = 'text-muted';
    intro.textContent = '¿Cómo quieres empezar?';
    content.appendChild(intro);

    const repeatBtn = document.createElement('button');
    repeatBtn.type = 'button';
    repeatBtn.className = 'btn btn--primary';
    repeatBtn.style.width = '100%';
    repeatBtn.textContent = `Repetir "${lastList.name}"`;
    repeatBtn.addEventListener('click', () => {
      const clone = GroceryListRepository.duplicate(lastList.id);
      modal.close();
      selectedListId = clone.id;
      persistSelection();
      showToast('Lista creada a partir de tu último mandado');
      render();
    });

    const emptyBtn = document.createElement('button');
    emptyBtn.type = 'button';
    emptyBtn.className = 'btn btn--ghost';
    emptyBtn.style.width = '100%';
    emptyBtn.textContent = 'Crear lista vacía';
    emptyBtn.addEventListener('click', () => {
      modal.close();
      openListForm();
    });

    content.append(repeatBtn, emptyBtn);
    const modal = openModal({ title: 'Nuevo mandado', content });
  }

  function openListForm(existing) {
    const formId = `grocery-list-form-${Date.now()}`;
    const form = document.createElement('form');
    form.id = formId;
    form.className = 'form-grid';
    form.innerHTML = `
      <div>
        <label for="${formId}-name">Nombre</label>
        <input type="text" id="${formId}-name" name="name" required value="${escapeHtml(existing?.name || '')}" placeholder="Ej. Mandado Semana 34">
      </div>
      <div>
        <label for="${formId}-date">Fecha</label>
        <input type="date" id="${formId}-date" name="startDate" required value="${existing?.startDate || toISODate(new Date())}">
      </div>
      <div>
        <label for="${formId}-budget">Presupuesto (opcional)</label>
        <input type="number" id="${formId}-budget" name="budget" min="0" step="0.01" value="${existing?.budget ?? ''}">
      </div>
      <div>
        <label for="${formId}-notes">Notas (opcional)</label>
        <textarea id="${formId}-notes" name="notes" rows="2">${escapeHtml(existing?.notes || '')}</textarea>
      </div>
      <p class="form-error hidden"></p>
    `;

    const footer = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.textContent = 'Cancelar';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.setAttribute('form', formId);
    saveBtn.textContent = existing ? 'Guardar cambios' : 'Crear lista';
    footer.append(cancelBtn, saveBtn);

    const modal = openModal({ title: existing ? 'Editar lista' : 'Nueva lista de mandado', content: form, footer });
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = data.get('name');
      const startDate = data.get('startDate');
      const budget = data.get('budget');
      const notes = data.get('notes');

      const { valid, errors } = validate([
        { valid: isRequired(name), message: 'El nombre es obligatorio.' },
        { valid: isRequired(startDate), message: 'La fecha es obligatoria.' },
      ]);
      const errorEl = form.querySelector('.form-error');
      if (!valid) {
        errorEl.textContent = errors.join(' ');
        errorEl.classList.remove('hidden');
        return;
      }
      errorEl.classList.add('hidden');

      if (existing) {
        GroceryListRepository.update(existing.id, {
          name: name.trim(),
          startDate,
          budget: budget !== undefined && budget !== '' ? Number(budget) : null,
          notes: (notes || '').trim(),
        });
      } else {
        const created = GroceryListRepository.create({ name, startDate, budget, notes });
        selectedListId = created.id;
        persistSelection();
      }

      modal.close();
      showToast(existing ? 'Lista actualizada' : 'Lista creada');
      render();
    });
  }

  render();
}
