// Set mínimo de iconos lineales inline (sin librería externa, sin dependencia pesada — ver
// docs/ui-ux-audit.md / rediseño "Minimal Finance"). Todos comparten convención: viewBox
// 24x24, stroke actual (hereda color por CSS), stroke-width 1.8, trazos redondeados.
// Reemplaza el emoji usado hasta ahora en sidebar/dashboard/mandado por un lenguaje visual
// consistente. El menú "⋮" y el "×" de cerrar modal se dejan como están: son glifos de
// puntuación, no emoji, y ya funcionan bien (ver docs/roadmap.md UI-3/UI-6).

const PATHS = {
  grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16 12h3"/><circle cx="16.3" cy="12" r="0.6" fill="currentColor" stroke="none"/>',
  bank: '<path d="M3 10 12 4 21 10"/><rect x="4" y="10" width="16" height="9"/><line x1="4" y1="19" x2="20" y2="19"/><line x1="8" y1="10" x2="8" y2="19"/><line x1="12" y1="10" x2="12" y2="19"/><line x1="16" y1="10" x2="16" y2="19"/>',
  'trending-up': '<polyline points="3,17 9,11 13,15 21,7"/><polyline points="15,7 21,7 21,13"/>',
  'trending-down': '<polyline points="3,7 9,13 13,9 21,17"/><polyline points="21,11 21,17 15,17"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  cart: '<circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 4h3l2.5 12.5h11L21 8H6.2"/>',
  box: '<path d="M3 8 12 3 21 8 21 17 12 22 3 17z"/><line x1="3" y1="8" x2="12" y2="13"/><line x1="21" y1="8" x2="12" y2="13"/><line x1="12" y1="13" x2="12" y2="22"/>',
  tag: '<path d="M11 4h-7v7l10 10 7-7z"/><circle cx="8" cy="8" r="1.4"/>',
  store: '<path d="M3 9 4 4h16l1 5"/><path d="M4 9v11h16V9"/><line x1="9" y1="20" x2="9" y2="14"/><line x1="15" y1="20" x2="15" y2="14"/>',
  scale: '<line x1="12" y1="3" x2="12" y2="21"/><line x1="5" y1="7" x2="19" y2="7"/><path d="M5 7 2 14a3 3 0 0 0 6 0z"/><path d="M19 7 16 14a3 3 0 0 0 6 0z"/>',
  history: '<circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 16,14"/>',
  'bar-chart': '<line x1="4" y1="20" x2="4" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="20" y1="20" x2="20" y2="15"/>',
  settings: '<circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.5" y1="4.5" x2="6.5" y2="6.5"/><line x1="17.5" y1="17.5" x2="19.5" y2="19.5"/><line x1="4.5" y1="19.5" x2="6.5" y2="17.5"/><line x1="17.5" y1="6.5" x2="19.5" y2="4.5"/>',
  'chevron-down': '<polyline points="6,9 12,15 18,9"/>',
  check: '<polyline points="5,13 10,18 19,7"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>',
  'arrow-up-right': '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="9,7 17,7 17,15"/>',
  'arrow-down-right': '<line x1="7" y1="7" x2="17" y2="17"/><polyline points="17,9 17,17 9,17"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<polyline points="3,6 5,6 21,6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  'rotate-ccw': '<polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
};

/** Devuelve el string <svg>...</svg> del icono `name` (cae a "receipt" si no existe). */
export function iconMarkup(name, { size = 20 } = {}) {
  const inner = PATHS[name] || PATHS.receipt;
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/** Igual que iconMarkup pero devuelve un nodo <svg> real, para construir DOM con createElement. */
export function createIcon(name, opts) {
  const wrap = document.createElement('span');
  wrap.innerHTML = iconMarkup(name, opts);
  return wrap.firstElementChild;
}
