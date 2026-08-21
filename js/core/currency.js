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
 * (ver KPI cards del rediseño) sin tener que parsear el string de formatDelta. */
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

/** Delta de KPI con tono explícito (bueno/malo) y sufijo de comparación — ver
 * js/components/stat-card.js. `invert`: true si un incremento es negativo para esa métrica
 * (ej. Gastos: subir es malo, aunque la flecha apunte hacia arriba). */
export function kpiDelta(current, previous, { invert = false, label = 'vs periodo anterior' } = {}) {
  const parts = formatDeltaParts(current, previous);
  if (parts.direction === 'flat' || parts.direction === 'new') return { ...parts, text: `${parts.text} ${label}` };
  const goodDirection = invert ? 'down' : 'up';
  return { ...parts, tone: parts.direction === goodDirection ? 'positive' : 'negative', text: `${parts.text} ${label}` };
}
