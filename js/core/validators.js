// Validaciones reutilizables de formularios. La UI compone estas reglas; no reimplementar
// validaciones ad-hoc en cada módulo.

import { parseFlexibleDate } from './dates.js';

export function isRequired(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function isPositiveNumber(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n > 0;
}

export function isNonNegativeNumber(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n >= 0;
}

export function isValidDate(value) {
  const d = parseFlexibleDate(value);
  return !Number.isNaN(d.getTime());
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/** rules: [{ valid: boolean, message: string }] -> { valid, errors } */
export function validate(rules) {
  const errors = rules.filter((r) => !r.valid).map((r) => r.message);
  return { valid: errors.length === 0, errors };
}
