// Menú "⋮" de acciones secundarias, usado en Mandado, Productos, Tiendas, Historial de
// precios, Ingresos y Gastos (ver docs/responsive-plan.md).
//
// El panel usa position:fixed con coordenadas calculadas en JS (getBoundingClientRect),
// no position:absolute. Con absolute, el panel quedaba atrapado por cualquier ancestro con
// overflow (ej. .data-table{overflow:hidden}, .table-wrapper con scroll) o simplemente se
// salía por abajo del viewport sin recolocarse — el bug reportado ("la tarjeta sale para
// abajo y no se visualiza"). Con fixed, el contenedor de referencia es siempre el viewport
// (funciona igual en desktop, iOS Safari y Android Chrome), y se recalcula min/max contra
// el ancho/alto visible más un flip hacia arriba si no cabe abajo.

const VIEWPORT_MARGIN = 8;

// actions: [{ label, onClick, danger? }]
export function createActionMenu(label, actions) {
  const wrap = document.createElement('div');
  wrap.className = 'action-menu';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'action-menu__toggle';
  toggle.textContent = '⋮';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', label);

  const panel = document.createElement('div');
  panel.className = 'action-menu__panel hidden';
  actions.forEach(({ label: actionLabel, onClick, danger }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `action-menu__item${danger ? ' action-menu__item--danger' : ''}`;
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      closeAllActionMenus();
      onClick();
    });
    panel.appendChild(btn);
  });

  function positionPanel() {
    const rect = toggle.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;

    let left = rect.right - panelWidth;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - panelWidth - VIEWPORT_MARGIN));

    let top = rect.bottom + 4;
    if (top + panelHeight > viewportHeight - VIEWPORT_MARGIN) {
      top = rect.top - panelHeight - 4; // no cabe abajo: se abre hacia arriba
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const wasOpen = !panel.classList.contains('hidden');
    closeAllActionMenus();
    if (!wasOpen) {
      panel.classList.remove('hidden');
      positionPanel();
      toggle.setAttribute('aria-expanded', 'true');
    }
  });

  wrap.append(toggle, panel);
  return wrap;
}

export function closeAllActionMenus() {
  document.querySelectorAll('.action-menu__panel').forEach((p) => p.classList.add('hidden'));
  document.querySelectorAll('.action-menu__toggle').forEach((t) => t.setAttribute('aria-expanded', 'false'));
}

// Una sola vez por carga de página: cierra cualquier menú abierto al hacer click fuera, al
// hacer scroll (con position:fixed el panel no sigue al toggle si la página se mueve; cerrar
// es más simple y seguro que reposicionar en vivo) o al cambiar el tamaño/orientación del
// viewport. Todo consulta el DOM en vivo (document.querySelectorAll) en el momento del
// evento, así que nunca referencia nodos de una vista ya desmontada — no hay nada que
// limpiar al navegar entre módulos.
let boundOnce = false;
export function ensureActionMenuOutsideClick() {
  if (boundOnce) return;
  boundOnce = true;
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.action-menu')) closeAllActionMenus();
  });
  window.addEventListener('resize', closeAllActionMenus);
  // capture:true: también cierra si el scroll ocurre dentro de un contenedor interno (ej. una
  // lista con overflow-y propio), ya que "scroll" no burbujea pero sí se captura desde window.
  window.addEventListener('scroll', closeAllActionMenus, { passive: true, capture: true });
}
