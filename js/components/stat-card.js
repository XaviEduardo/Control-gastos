/** Tarjeta de indicador simple: etiqueta + valor, con tono opcional para positivo/negativo. */
export function renderStatCard(label, value, { tone, subtitle } = {}) {
  const card = document.createElement('div');
  card.className = `card stat-card${tone ? ` stat-card--${tone}` : ''}`;
  card.innerHTML = `
    <div class="summary-card__label">${label}</div>
    <div class="summary-card__value">${value}</div>
    ${subtitle ? `<div class="text-muted mt-md">${subtitle}</div>` : ''}
  `;
  return card;
}
