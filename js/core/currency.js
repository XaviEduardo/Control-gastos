// Moneda centralizada. v1 usa MXN pero queda preparado para configurarse (docs/decisions.md).

let currentCurrency = 'MXN';

export function setCurrency(code) {
  currentCurrency = code;
}

export function getCurrency() {
  return currentCurrency;
}

export function formatMoney(amount, currency = currentCurrency) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(value);
}

export function formatPercent(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits }).format(value || 0);
}

/** Texto de variación entre dos periodos, ej. "▲ 5% vs mes anterior". */
export function formatDelta(current, previous, label = 'vs periodo anterior') {
  if (previous === 0) return current === 0 ? 'Sin cambio' : `Nuevo (sin datos en el periodo anterior)`;
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '→';
  return `${arrow} ${Math.abs(pct)}% ${label}`;
}

/** Igual cálculo que formatDelta, pero en partes separadas para poder colorear el signo
 * (ver KPI cards del rediseño) sin tener que parsear el string de formatDelta. No usado por
 * los módulos que ya consumen formatDelta (monthly.module.js) — no se les toca. */
export function formatDeltaParts(current, previous) {
  if (previous === 0) {
    return current === 0
      ? { text: 'Sin cambio', direction: 'flat' }
      : { text: 'Nuevo', direction: 'new' };
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return { text: `${Math.abs(pct)}%`, direction, pct };
}
