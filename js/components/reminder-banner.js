// Banner de "pagos próximos sin marcar" — ver js/services/remindersService.js. No persiste
// nada por sí mismo, es una proyección en vivo sobre expenses/expensePayments ya existentes.
// Reutiliza 100% clases ya existentes del Design System (.card/.movement-list/.movement-row/
// utilidades) — sin CSS nuevo.

import { upcomingUnpaidExpenses, DEFAULT_REMINDERS_DAYS_AHEAD } from '../services/remindersService.js';
import { iconMarkup } from './icons.js';
import { formatMoney } from '../core/currency.js';
import { formatDateShort, toISODate } from '../core/dates.js';
import { escapeHtml } from '../core/validators.js';

const VISIBLE_LIMIT = 5;

function daysFromToday(occurrenceDate) {
  const todayIso = toISODate(new Date());
  const diffMs = new Date(occurrenceDate) - new Date(todayIso);
  return Math.round(diffMs / 86400000);
}

function dueLabel(occurrenceDate) {
  const diff = daysFromToday(occurrenceDate);
  if (diff <= 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  return `En ${diff} días`;
}

/** Devuelve el nodo del banner, o `null` si no hay nada pendiente — el llamador decide si lo
 * agrega al DOM: `const banner = renderReminderBanner(); if (banner) root.appendChild(banner);`. */
export function renderReminderBanner(daysAhead = DEFAULT_REMINDERS_DAYS_AHEAD) {
  const rows = upcomingUnpaidExpenses(daysAhead);
  if (!rows.length) return null;

  const visible = rows.slice(0, VISIBLE_LIMIT);
  const extra = rows.length - visible.length;

  const card = document.createElement('div');
  card.className = 'card mb-md';

  const title = document.createElement('div');
  title.className = 'flex items-center gap-sm mb-md';
  title.innerHTML = `
    <span class="kpi-card__icon kpi-card__icon--danger">${iconMarkup('bell', { size: 18 })}</span>
    <span class="card-title">${rows.length === 1 ? 'Tienes 1 pago próximo sin marcar' : `Tienes ${rows.length} pagos próximos sin marcar`}</span>
  `;
  card.appendChild(title);

  const list = document.createElement('div');
  list.className = 'movement-list';
  visible.forEach(({ expense, occurrenceDate }) => {
    const row = document.createElement('div');
    row.className = 'movement-row';
    row.innerHTML = `
      <span class="movement-row__icon movement-row__icon--expense">${iconMarkup('trending-down', { size: 18 })}</span>
      <span class="movement-row__body">
        <div class="movement-row__title">${escapeHtml(expense.description)}</div>
        <div class="movement-row__subtitle">${dueLabel(occurrenceDate)} · ${formatDateShort(occurrenceDate)}</div>
      </span>
      <span class="movement-row__amount">-${formatMoney(expense.amount)}</span>
    `;
    list.appendChild(row);
  });
  card.appendChild(list);

  if (extra > 0) {
    const more = document.createElement('p');
    more.className = 'text-muted text-xs mt-md';
    more.textContent = `y ${extra} más`;
    card.appendChild(more);
  }

  return card;
}
