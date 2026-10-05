import { toISODate } from '../core/dates.js';

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miercoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sabado' },
  { value: 0, label: 'Domingo' },
];

export function weekdayLabel(value) {
  const weekday = Number(value);
  return WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label || '';
}

function nextWeekdayDate(weekday, from = new Date()) {
  const target = Number(weekday);
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);
  const daysAhead = (target - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysAhead);
  return date;
}

function nextMonthlyDate(dueDay, from = new Date()) {
  const day = Number(dueDay);
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentMonthLastDay = new Date(year, month + 1, 0).getDate();
  let candidate = new Date(year, month, Math.min(day, currentMonthLastDay));
  if (candidate < today) {
    const nextMonthLastDay = new Date(year, month + 2, 0).getDate();
    candidate = new Date(year, month + 1, Math.min(day, nextMonthLastDay));
  }
  return candidate;
}

export function suggestedDateForTemplate(template, from = new Date()) {
  if (template?.weekday !== null && template?.weekday !== undefined && template.weekday !== '') {
    return toISODate(nextWeekdayDate(template.weekday, from));
  }
  if (template?.frequency === 'monthly' && template?.dueDay) {
    return toISODate(nextMonthlyDate(template.dueDay, from));
  }
  return toISODate(from);
}

export function templateToMovementPayload(template, { currentAmount = '' } = {}) {
  const payload = {
    description: template.description,
    amount: template.amount !== null && template.amount !== undefined ? template.amount : currentAmount,
    date: suggestedDateForTemplate(template),
    frequency: template.frequency || 'once',
    intervalDays: template.intervalDays || 30,
    notes: template.notes || '',
  };

  if (template.type === 'income') {
    payload.incomeTypeId = template.incomeTypeId;
  } else {
    payload.categoryId = template.categoryId;
    payload.dueDay = template.dueDay || '';
    payload.paymentMethod = template.paymentMethod || '';
  }

  return payload;
}
