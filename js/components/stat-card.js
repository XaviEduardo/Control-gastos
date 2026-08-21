import { iconMarkup } from './icons.js';

/** Tarjeta KPI (rediseño "Minimal Finance"): etiqueta + valor, con extras opcionales.
 * - icon/iconTone: icono en un chip superior derecho (ver js/components/icons.js).
 * - delta: { text, direction } de core/currency.js#formatDeltaParts — colorea la variación.
 * - hero: superficie sólida (ver tarjeta de Balance en Dashboard) en vez de blanca.
 * - subtitle: string plano (compatibilidad con llamadas existentes que no usan delta/icon —
 *   Reportes, Presupuesto, Mandado siguen funcionando sin cambios). */
export function renderStatCard(label, value, { tone, subtitle, icon, iconTone, delta, hero } = {}) {
  const card = document.createElement('div');
  card.className = `kpi-card stat-card${tone ? ` stat-card--${tone}` : ''}${hero ? ' kpi-card--hero' : ''}`;

  const header = document.createElement('div');
  header.className = 'kpi-card__header';

  const labelEl = document.createElement('div');
  labelEl.className = 'kpi-card__label';
  labelEl.textContent = label;
  header.appendChild(labelEl);

  if (icon) {
    const iconWrap = document.createElement('span');
    iconWrap.className = `kpi-card__icon${iconTone ? ` kpi-card__icon--${iconTone}` : ''}`;
    iconWrap.innerHTML = iconMarkup(icon, { size: 18 });
    header.appendChild(iconWrap);
  }
  card.appendChild(header);

  const valueEl = document.createElement('div');
  valueEl.className = 'kpi-card__value';
  valueEl.textContent = value;
  card.appendChild(valueEl);

  if (delta) {
    // El color (tone) lo decide quien llama según si esa dirección es buena o mala para esa
    // métrica (ej. un alza en Gastos es negativa aunque la flecha apunte hacia arriba); si no
    // se pasa tone, se cae de vuelta al mapeo directo up=positivo/down=negativo.
    const colorKey = delta.tone === 'positive' ? 'up' : delta.tone === 'negative' ? 'down' : delta.direction;
    const colorClass = colorKey === 'up' ? ' kpi-card__delta--up' : colorKey === 'down' ? ' kpi-card__delta--down' : '';
    const arrowIcon = delta.direction === 'up' ? 'arrow-up-right' : delta.direction === 'down' ? 'arrow-down-right' : null;

    const deltaEl = document.createElement('div');
    deltaEl.className = `kpi-card__delta${colorClass}`;
    deltaEl.innerHTML = `${arrowIcon ? iconMarkup(arrowIcon, { size: 13 }) : ''}<span>${delta.text}</span>`;
    card.appendChild(deltaEl);
  } else if (subtitle) {
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'text-muted mt-md';
    subtitleEl.textContent = subtitle;
    card.appendChild(subtitleEl);
  }

  return card;
}
