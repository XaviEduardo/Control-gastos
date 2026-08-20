import { MONTH_NAMES } from '../core/dates.js';
import { generateId } from '../core/id.js';

/** Navegación reutilizable de mes/año: ← anterior | select mes + input año | siguiente →. */
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
  prevBtn.className = 'btn btn--ghost';
  prevBtn.textContent = '← Mes anterior';
  prevBtn.addEventListener('click', () => emit(month - 1, year));

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'btn btn--ghost';
  nextBtn.textContent = 'Mes siguiente →';
  nextBtn.addEventListener('click', () => emit(month + 1, year));

  const jump = document.createElement('div');
  jump.className = 'period-nav__jump';
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

  nav.append(prevBtn, jump, nextBtn);
  wrap.appendChild(nav);
  return wrap;
}
