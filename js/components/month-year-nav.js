import { MONTH_NAMES } from '../core/dates.js';
import { generateId } from '../core/id.js';
import { iconMarkup } from './icons.js';

/** Navegación reutilizable de mes/año (V2-8: ver docs/v2-roadmap.md — "problema específico
 * mes/año en mobile"). [‹] anterior · etiqueta compacta "Mes Año" (tocar para elegir mes/año
 * exacto) · siguiente [›]. El selector detallado empieza oculto y se revela al tocar la
 * etiqueta — nunca ocupa ancho de más por defecto, en mobile o en escritorio. */
export function renderMonthYearNav({ month, year, onChange }) {
  const uid = generateId();
  const wrap = document.createElement('div');
  wrap.className = 'card mb-md';

  const nav = document.createElement('div');
  nav.className = 'period-nav';

  function emit(newMonth, newYear) {
    let m = newMonth;
    let y = newYear;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    onChange(m, y);
  }

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'btn btn--icon btn--ghost';
  prevBtn.title = 'Mes anterior';
  prevBtn.setAttribute('aria-label', 'Mes anterior');
  prevBtn.innerHTML = iconMarkup('chevron-left', { size: 18 });
  prevBtn.addEventListener('click', () => emit(month - 1, year));

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'btn btn--icon btn--ghost';
  nextBtn.title = 'Mes siguiente';
  nextBtn.setAttribute('aria-label', 'Mes siguiente');
  nextBtn.innerHTML = iconMarkup('chevron-right', { size: 18 });
  nextBtn.addEventListener('click', () => emit(month + 1, year));

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'period-nav__label period-nav__label--action';
  label.textContent = `${MONTH_NAMES[month]} ${year}`;
  label.title = 'Elegir mes y año';
  label.setAttribute('aria-label', `Periodo actual: ${MONTH_NAMES[month]} ${year}. Tocar para elegir otro mes o año.`);
  label.addEventListener('click', () => jump.classList.toggle('hidden'));

  const jump = document.createElement('div');
  jump.className = 'period-nav__jump hidden';
  jump.innerHTML = `
    <label for="month-${uid}">Mes</label>
    <select id="month-${uid}">${MONTH_NAMES.map((name, i) => `<option value="${i}">${name}</option>`).join('')}</select>
    <label for="year-${uid}">Año</label>
    <input type="number" id="year-${uid}" step="1">
  `;
  const monthSelect = jump.querySelector(`#month-${uid}`);
  const yearInput = jump.querySelector(`#year-${uid}`);
  monthSelect.value = String(month);
  yearInput.value = String(year);

  monthSelect.addEventListener('change', () => emit(Number(monthSelect.value), Number(yearInput.value)));
  yearInput.addEventListener('change', () => {
    const parsed = Number(yearInput.value);
    if (Number.isInteger(parsed)) emit(Number(monthSelect.value), parsed);
  });

  nav.append(prevBtn, label, nextBtn);
  wrap.append(nav, jump);
  return wrap;
}
