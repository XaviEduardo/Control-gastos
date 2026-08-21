// Normalización de precios por unidad base. Única fuente de verdad para comparar precios
// entre presentaciones distintas sin mezclar dimensiones incompatibles (kg/g vs L/ml vs
// piezas vs paquetes). Usado por el historial de precios y, más adelante, el comparador.

import { formatMoney } from '../core/currency.js';
import { parseFlexibleDate } from '../core/dates.js';

// Cada unidad pertenece a una "dimensión": solo unidades de la misma dimensión son
// comparables entre sí. `toBase` convierte la cantidad a la unidad base de su dimensión.
const UNIT_INFO = {
  kg: { dimension: 'mass', toBase: 1, baseLabel: 'kg' },
  g: { dimension: 'mass', toBase: 0.001, baseLabel: 'kg' },
  l: { dimension: 'volume', toBase: 1, baseLabel: 'L' },
  ml: { dimension: 'volume', toBase: 0.001, baseLabel: 'L' },
  pza: { dimension: 'pza', toBase: 1, baseLabel: 'pza' },
  paquete: { dimension: 'paquete', toBase: 1, baseLabel: 'paquete' },
};

export function getUnitDimension(unit) {
  return UNIT_INFO[unit]?.dimension || null;
}

export function areComparable(unitA, unitB) {
  const dimA = getUnitDimension(unitA);
  return Boolean(dimA) && dimA === getUnitDimension(unitB);
}

/** { pricePerBaseUnit, baseUnit, dimension } o null si la unidad es desconocida o la
 * cantidad no es válida. */
export function normalizePrice(price, quantity, unit) {
  const info = UNIT_INFO[unit];
  const qty = Number(quantity) || 0;
  const amount = Number(price) || 0;
  if (!info || qty <= 0) return null;
  const baseQuantity = qty * info.toBase;
  if (baseQuantity <= 0) return null;
  return { pricePerBaseUnit: amount / baseQuantity, baseUnit: info.baseLabel, dimension: info.dimension };
}

export function formatNormalizedPrice(normalized) {
  if (!normalized) return null;
  return `${formatMoney(normalized.pricePerBaseUnit)}/${normalized.baseUnit}`;
}

/** Convierte una cantidad expresada en `unit` a la unidad base de su dimensión
 * (ej. 500 g -> 0.5 kg). Devuelve null si la unidad no se reconoce. */
export function getBaseQuantity(quantity, unit) {
  const info = UNIT_INFO[unit];
  if (!info) return null;
  return (Number(quantity) || 0) * info.toBase;
}

// V2-7 (Comparador V2, ver docs/v2-roadmap.md): "frescura" de un precio — puramente derivada
// de `date` en el momento de mostrarlo, NUNCA almacenada (ver docs/v2-analysis.md §20). Nunca
// oculta un precio viejo, solo comunica su antigüedad. `tone` es la clasificación interna (útil
// para color/badge); `label` es el texto exacto a mostrar — coincide con el ejemplo del brief
// ("hace 2 días"/"hace 15 días" usan la misma redacción, solo cambia el tono visual).
export function priceFreshness(dateStr) {
  // Ambas fechas se normalizan a medianoche local antes de restar — comparar "ahora" (con
  // hora) contra la medianoche de `dateStr` daría un número de días fraccional que redondea
  // mal según la hora del día (ej. "hoy" a las 23:00 podría redondear a 1 día en vez de 0).
  // parseFlexibleDate (no `new Date(string)` directo): ver docs/decisions.md.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseFlexibleDate(dateStr);
  target.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.round((today.getTime() - target.getTime()) / 86400000));
  if (days === 0) return { days, tone: 'today', label: 'Hoy' };
  if (days <= 7) return { days, tone: 'recent', label: `Hace ${days} día${days === 1 ? '' : 's'}` };
  if (days <= 30) return { days, tone: 'aging', label: `Hace ${days} días` };
  return { days, tone: 'old', label: 'Precio antiguo' };
}
