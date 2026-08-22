// Comparador inteligente: Nivel 1 (producto individual) y Nivel 2 (mandado completo).
// Solo lee productos/tiendas/precios/listas existentes; la única escritura posible es
// explícita ("Usar esta tienda" ajusta selectedStoreId/estimatedPrice de un item, nunca
// actualPrice — ver docs/decisions.md). Rediseño "Minimal Finance" (ver docs/ui-ux-audit.md):
// misma lógica de siempre (compareProductAcrossStores/compareListAcrossStores), composición
// visual nueva — el ganador debe identificarse de inmediato, sin comparar columnas a mano.
// V2-9: Nivel 1 y Nivel 2 viven en comparison-level-one.js/comparison-level-two.js.

import { renderLevelOne } from './comparison-level-one.js';
import { renderLevelTwo } from './comparison-level-two.js';

export function renderComparisonModule(container) {
  const root = document.createElement('div');
  root.className = 'module-view';
  container.appendChild(root);

  const levelOneState = { selectedProductId: null };
  const levelTwoState = { selectedListId: null };

  function render() {
    root.innerHTML = '';
    root.appendChild(renderHeader());
    root.appendChild(renderLevelOne(levelOneState, render));
    root.appendChild(renderLevelTwo(levelTwoState, render));
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

  render();
}
