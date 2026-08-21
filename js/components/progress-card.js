import { formatMoney, formatPercent } from '../core/currency.js';
import { iconMarkup } from './icons.js';

// Umbral puramente visual (a partir de qué % se colorea en advertencia antes de excederse) —
// no cambia budgetProgress() ni ningún cálculo, solo cómo se pinta un valor ya calculado.
const WARNING_THRESHOLD = 0.8;

/** Tarjeta de progreso de presupuesto (rediseño "Minimal Finance"). `progress` es el objeto
 * ya calculado por services/budgetService.js#budgetProgress — este componente solo presenta,
 * nunca recalcula. `amountFirst`: prioriza el monto gastado (ej. Mandado) en vez del % (ej.
 * Presupuesto mensual). `actions`: nodo opcional (ej. botones Editar/Quitar) para el header. */
export function renderProgressCard(title, progress, { icon, amountFirst = false, actions } = {}) {
  const over = progress.remaining < 0;
  const finite = Number.isFinite(progress.percentUsed);
  const pctForBar = finite ? Math.min(progress.percentUsed * 100, 100) : 100;
  const pctText = finite ? formatPercent(progress.percentUsed, 0) : '100%+';
  const status = over ? 'over' : (finite && progress.percentUsed >= WARNING_THRESHOLD) ? 'warning' : 'normal';

  const card = document.createElement('div');
  card.className = 'progress-summary-card';

  const header = document.createElement('div');
  header.className = 'progress-summary-card__header';
  if (icon) {
    const iconChip = document.createElement('span');
    iconChip.className = `kpi-card__icon${status !== 'normal' ? ` kpi-card__icon--${status === 'over' ? 'danger' : 'warning'}` : ''}`;
    iconChip.innerHTML = iconMarkup(icon, { size: 16 });
    header.appendChild(iconChip);
  }
  const titleEl = document.createElement('span');
  titleEl.className = 'progress-summary-card__title';
  titleEl.textContent = title;
  header.appendChild(titleEl);
  if (actions) header.appendChild(actions);
  card.appendChild(header);

  const valueRow = document.createElement('div');
  valueRow.className = 'progress-summary-card__value-row';
  const valueClass = `progress-summary-card__value${status !== 'normal' ? ` progress-summary-card__value--${status}` : ''}`;
  if (amountFirst) {
    valueRow.innerHTML = `
      <span class="${valueClass}">${formatMoney(progress.spent)}</span>
      <span class="progress-summary-card__caption">de ${formatMoney(progress.amount)}</span>
    `;
  } else {
    valueRow.innerHTML = `
      <span class="${valueClass}">${pctText}</span>
      <span class="progress-summary-card__caption">${over ? 'Excedido por ' : ''}${formatMoney(Math.abs(progress.remaining))}${over ? '' : ' restantes'}</span>
    `;
  }
  card.appendChild(valueRow);

  const bar = document.createElement('div');
  bar.className = 'progress-bar mt-md';
  const fillClass = status === 'over' ? ' progress-bar__fill--over' : status === 'warning' ? ' progress-bar__fill--warning' : '';
  bar.innerHTML = `<div class="progress-bar__fill${fillClass}" style="width:${pctForBar}%"></div>`;
  card.appendChild(bar);

  const footnote = document.createElement('div');
  footnote.className = 'progress-summary-card__footnote';
  footnote.textContent = amountFirst
    ? `${pctText} del presupuesto${over ? ' — excedido' : status === 'warning' ? ' — cerca del límite' : ''}`
    : `Basado en tu límite de ${formatMoney(progress.amount)}`;
  card.appendChild(footnote);

  return card;
}
