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
